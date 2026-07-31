"""Auto-generate 'Test your understanding' quizzes from a resource's document.

The generator works ONLY from the converted web version (``ResourceHTML``)
of the uploaded PDF/DOCX, so every answer is verbatim in the document the
reader just scrolled through — nothing is answerable from general knowledge.

How it works (deterministic, no external services):
  1. Split the stored HTML into sections at h1/h2/h3 headings.
  2. Extract clean candidate sentences per section.
  3. In each sentence, find a strong "key term" — a number, an acronym/code
     (QR, TB, REDCap, 1FOU-03121), or a distinctive long word.
  4. Round-robin across sections so the quiz covers the ENTIRE document,
     not just the first page — up to MAX_QUESTIONS questions.
  5. Question styles cycle through a fixed pattern for variety:
       - cloze MCQ ("Fill in the blank") with same-kind distractors from
         elsewhere in the document,
       - Yes/No — a statement quoted verbatim (Yes) or with its key term
         swapped for another term from the document (No),
       - association MCQ ("Which of the following is directly associated
         with X?") linking two terms that co-occur in one sentence — the
         less-direct, understanding-style questions,
       - a few short/straight typed answers graded fuzzily.

Everything is seeded from the resource id, so regeneration is stable.
Admins can edit or replace any question (Django admin or Manage panel);
regeneration only ever deletes rows flagged ``auto_generated``.
"""
from __future__ import annotations

import html as html_lib
import random
import re

# Words never worth blanking out.
_STOPWORDS = frozenset("""
a an and are as at be been by can could do does for from has have if in into is
it its may must not of on or shall should that the their them then these they
this to was were will with within your you we our all any each which when who
whom how what where why also than more most other same such only after before
during between under over above below out up down off once here there both few
""".split())

_TAG_RE = re.compile(r"<[^>]+>")
_HEADING_SPLIT_RE = re.compile(r"<h([1-3])[^>]*>(.*?)</h\1>", re.IGNORECASE | re.DOTALL)
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9“\"(])")
_NUMBER_RE = re.compile(r"\b\d+(?:[.,]\d+)?\b")
# Acronyms and codes: REDCap, TB, QR, GeneXpert, 1FOU-03121x …
_CODE_RE = re.compile(r"\b(?:[A-Z][A-Z0-9]{1,}[a-z0-9]*[A-Z0-9][A-Za-z0-9-]*|\d[A-Z0-9-]{3,}x?)\b")
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z-]{5,}")

MAX_QUESTIONS = 20
MIN_QUESTIONS = 4
MAX_SHORT_ANSWERS = 3  # straight/typed answers mixed into the quiz

# Question-style rotation — repeats until the target count is reached, so
# every quiz mixes recall (cloze), verification (yes/no), association
# ("technical", less direct) and typed answers.
STYLE_PATTERN = ("cloze", "yesno", "cloze", "short", "assoc", "cloze", "yesno")


def _strip_html(fragment):
    text = _TAG_RE.sub(" ", fragment)
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _sections_from_html(html):
    """Return [(section_title, section_text), ...] split at h1–h3 headings."""
    parts = _HEADING_SPLIT_RE.split(html)
    sections = []
    # parts = [before, level, title, body, level, title, body, ...]
    intro = _strip_html(parts[0])
    if intro:
        sections.append(("Introduction", intro))
    for i in range(1, len(parts) - 2, 3):
        title = _strip_html(parts[i + 1])
        body = _strip_html(parts[i + 2])
        if body:
            sections.append((title or "Section", body))
    if not sections:
        whole = _strip_html(html)
        if whole:
            sections = [("Document", whole)]
    return sections


def _sentences(text):
    out = []
    for s in _SENTENCE_SPLIT_RE.split(text):
        s = s.strip().strip("•-–· ")
        words = s.split()
        if not (8 <= len(words) <= 40):
            continue
        if s.lower().startswith(("figure", "table", "page ")):
            continue
        if "...." in s or "|" in s:  # TOC dot leaders / cover-page layout rows
            continue
        # Title/front-page blobs read as Capitalized Word Salad, not prose.
        caps = sum(1 for w in words if w[:1].isupper())
        if caps / len(words) > 0.6:
            continue
        out.append(s)
    return out


def _key_term(sentence, used_terms):
    """Pick the strongest blankable term: number > code/acronym > long word.
    Returns (term, kind) or None."""
    for m in _NUMBER_RE.finditer(sentence):
        t = m.group()
        if t not in used_terms and len(t) <= 12:
            return t, "number"
    codes = [m.group() for m in _CODE_RE.finditer(sentence)]
    for t in codes:
        if t not in used_terms and 2 <= len(t) <= 24:
            return t, "code"
    words = [w for w in _WORD_RE.findall(sentence)
             if w.lower() not in _STOPWORDS and w not in used_terms]
    if words:
        # The rarest-looking (longest) word is usually the most meaningful.
        words.sort(key=len, reverse=True)
        return words[0], "word"
    return None


def _blank(sentence, term):
    # Whole-token replacement of the FIRST occurrence only.
    pattern = re.compile(r"(?<![\w-])" + re.escape(term) + r"(?![\w-])")
    return pattern.sub("_____", sentence, count=1)


def _distractors(term, kind, pools, rng):
    """Three wrong options of the same kind, preferably from the document."""
    pool = [t for t in pools.get(kind, []) if t.lower() != term.lower()]
    rng.shuffle(pool)
    picks = []
    for t in pool:
        if t.lower() not in {p.lower() for p in picks}:
            picks.append(t)
        if len(picks) == 3:
            return picks
    # Numbers can be padded with plausible perturbations when the document
    # doesn't contain three other numbers.
    if kind == "number":
        try:
            base = int(re.sub(r"[.,].*$", "", term))
            for delta in (1, 2, 3, 5, 10):
                for cand in (base + delta, max(0, base - delta)):
                    s = str(cand)
                    if s != term and s not in picks:
                        picks.append(s)
                    if len(picks) == 3:
                        return picks
        except ValueError:
            pass
    return picks if len(picks) >= 2 else None  # need at least 3 options total


def generate_questions(html, seed=0):
    """Build question dicts from a document's HTML. Pure — no DB access."""
    rng = random.Random(seed * 9973 + 17)
    sections = _sections_from_html(html)

    # Candidate sentences per section, de-duplicated across the document
    # (repeated page headers produce identical sentences).
    seen_sentences = set()
    per_section = []
    for title, text in sections:
        uniq = []
        for s in _sentences(text):
            key = s.lower()
            if key in seen_sentences:
                continue
            seen_sentences.add(key)
            uniq.append(s)
        if uniq:
            per_section.append((title, uniq))
    if not per_section:
        return []

    # Term pools for distractors, gathered from the whole document.
    all_text = " ".join(t for _, t in sections)
    pools = {
        "number": list(dict.fromkeys(_NUMBER_RE.findall(all_text)))[:60],
        "code": list(dict.fromkeys(_CODE_RE.findall(all_text)))[:60],
        "word": list(dict.fromkeys(
            w for w in _WORD_RE.findall(all_text) if w.lower() not in _STOPWORDS
        ))[:120],
    }

    total_sentences = sum(len(ss) for _, ss in per_section)
    target = max(MIN_QUESTIONS, min(MAX_QUESTIONS, (2 * total_sentences) // 3))

    # Round-robin across sections so every part of the document is covered.
    used_terms = set()
    drafts = []
    cursors = [0] * len(per_section)
    while len(drafts) < target:
        progressed = False
        for si, (title, sents) in enumerate(per_section):
            if len(drafts) >= target:
                break
            while cursors[si] < len(sents):
                sentence = sents[cursors[si]]
                cursors[si] += 1
                found = _key_term(sentence, used_terms)
                if not found:
                    continue
                term, kind = found
                used_terms.add(term)
                drafts.append({"section": title, "sentence": sentence,
                               "term": term, "kind": kind})
                progressed = True
                break
        if not progressed:
            break

    if not drafts:
        return []

    questions = []
    shorts_made = 0
    for i, d in enumerate(drafts):
        style = STYLE_PATTERN[i % len(STYLE_PATTERN)]
        if style == "short" and shorts_made >= MAX_SHORT_ANSWERS:
            style = "cloze"

        q = None
        if style == "yesno":
            q = _build_yesno(d, pools, rng)
        elif style == "assoc":
            q = _build_association(d, pools, rng, used_terms)
        elif style == "short":
            q = _build_short(d)
            if q:
                shorts_made += 1
        if q is None:  # style not possible for this sentence — fall back
            q = _build_cloze(d, pools, rng) or _build_short(d)
            if q and q["question_type"] == "short":
                shorts_made += 1
        if q:
            q["order"] = len(questions) + 1
            questions.append(q)

    return questions


def _quote(sentence):
    return f"“{sentence}”"


def _from_doc(sentence):
    return f"From the document: {_quote(sentence)}"


def _build_cloze(d, pools, rng):
    wrong = _distractors(d["term"], d["kind"], pools, rng)
    if wrong is None:
        return None
    options = [d["term"]] + wrong
    rng.shuffle(options)
    letters = "abcd"
    q = {
        "question": f"Fill in the blank:\n{_quote(_blank(d['sentence'], d['term']))}",
        "question_type": "mcq",
        "correct": letters[options.index(d["term"])],
        "explanation": _from_doc(d["sentence"]),
    }
    for letter, opt in zip(letters, options):
        q[f"option_{letter}"] = opt
    return q


def _build_short(d):
    return {
        "question": f"Complete the missing word:\n{_quote(_blank(d['sentence'], d['term']))}",
        "question_type": "short",
        "answer_text": d["term"],
        "explanation": _from_doc(d["sentence"]),
    }


def _build_yesno(d, pools, rng):
    """A statement quoted verbatim (Yes) or falsified by swapping its key
    term for another same-kind term from elsewhere in the document (No)."""
    statement, correct = d["sentence"], "a"
    explanation = _from_doc(d["sentence"])
    if rng.random() < 0.55:
        replacement = None
        candidates = [t for t in pools.get(d["kind"], [])
                      if t.lower() != d["term"].lower()
                      and t.lower() not in d["sentence"].lower()]
        if candidates:
            replacement = candidates[rng.randrange(len(candidates))]
        elif d["kind"] == "number":
            try:
                replacement = str(int(re.sub(r"[.,].*$", "", d["term"])) + rng.choice((1, 2, 5)))
            except ValueError:
                pass
        if replacement:
            statement = _blank(d["sentence"], d["term"]).replace("_____", replacement, 1)
            correct = "b"
            explanation = f"Not quite — the document actually says: {_quote(d['sentence'])}"
    return {
        "question": f"Yes or No — is this statement correct?\n{_quote(statement)}",
        "question_type": "mcq",
        "option_a": "Yes",
        "option_b": "No",
        "option_c": "",
        "option_d": "",
        "correct": correct,
        "explanation": explanation,
    }


def _build_association(d, pools, rng, used_terms):
    """Less-direct question linking two terms that co-occur in one sentence.
    Distractors must NOT appear in that sentence, so only real understanding
    (or reading) answers it."""
    second = _key_term(d["sentence"], used_terms | {d["term"]})
    if not second:
        return None
    term2, kind2 = second
    used_terms.add(term2)
    wrong = [t for t in pools.get(kind2, [])
             if t.lower() != term2.lower()
             and t.lower() not in d["sentence"].lower()]
    rng.shuffle(wrong)
    picks = []
    for t in wrong:
        if t.lower() not in {p.lower() for p in picks}:
            picks.append(t)
        if len(picks) == 3:
            break
    if len(picks) < 2:
        return None
    options = [term2] + picks
    rng.shuffle(options)
    letters = "abcd"
    q = {
        "question": f"Which of the following is directly associated with “{d['term']}” in this material?",
        "question_type": "mcq",
        "correct": letters[options.index(term2)],
        "explanation": _from_doc(d["sentence"]),
    }
    for letter, opt in zip(letters, options):
        q[f"option_{letter}"] = opt
    return q


# ---------------------------------------------------------------------------
# DB orchestration
# ---------------------------------------------------------------------------

def generate_for_resource(resource, replace_auto=False):
    """Create quiz questions for a resource from its converted document.

    Never touches hand-written questions. Returns the number of questions
    created (0 when there's no ready HTML, or manual questions exist and
    ``replace_auto`` is False while auto ones are present).
    """
    from .models import QuizQuestion, ResourceHTML

    doc = (
        resource.html_docs.filter(status=ResourceHTML.Status.READY)
        .order_by("language")  # '' (legacy) sorts first, then en/fr/…
        .first()
    )
    # Prefer English when several language versions exist.
    en = resource.html_docs.filter(
        status=ResourceHTML.Status.READY, language="en"
    ).first()
    doc = en or doc
    if doc is None or not doc.html:
        return 0

    existing = resource.quiz_questions.all()
    if replace_auto:
        existing.filter(auto_generated=True).delete()
    elif existing.exists():
        return 0  # don't double up on an existing quiz

    manual_count = resource.quiz_questions.count()
    made = generate_questions(doc.html, seed=resource.id)
    for q in made:
        QuizQuestion.objects.create(
            resource=resource,
            auto_generated=True,
            question=q["question"],
            question_type=q["question_type"],
            option_a=q.get("option_a", ""),
            option_b=q.get("option_b", ""),
            option_c=q.get("option_c", ""),
            option_d=q.get("option_d", ""),
            correct=q.get("correct", "a"),
            answer_text=q.get("answer_text", ""),
            explanation=q["explanation"],
            order=manual_count + q["order"],
        )
    return len(made)


def maybe_autogenerate(resource):
    """Hook for the conversion pipeline: quiz a resource that has none yet."""
    try:
        if not resource.quiz_questions.exists():
            return generate_for_resource(resource)
    except Exception:  # noqa: BLE001 — never break uploads/requests over quizzes
        import logging
        logging.getLogger(__name__).exception(
            "Quiz auto-generation failed for resource %s", resource.pk
        )
    return 0
