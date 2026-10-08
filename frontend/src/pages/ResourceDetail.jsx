import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { TYPE_CLASS, TYPE_LABELS } from "../constants";
import { trackInteraction } from "../api";

// ── Constants ─────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL ?? "";

// ── Inline auth helpers (same pattern as ManagePanel.jsx) ─────────────────────
function getToken() {
  return localStorage.getItem("chpr_token");
}

function getCsrfCookie() {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrftoken="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

async function ensureCsrf() {
  const existing = getCsrfCookie();
  if (existing) return existing;
  const res = await fetch(`${BASE}/api/csrf/`, { credentials: "include" });
  const data = await res.json();
  return data.csrfToken ?? getCsrfCookie() ?? "";
}

async function authedPost(url, body) {
  const token = getToken();
  const csrfToken = await ensureCsrf();
  const headers = {
    "Content-Type": "application/json",
    "X-CSRFToken": csrfToken,
  };
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data?.detail ?? Object.values(data).flat().join(" ") ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Progress helpers — cookie + localStorage fallback ─────────────────────────
const PROG_KEY  = (id) => `chpr_rdprog_${id}`;
const COOK_DAYS = 60; // 60-day cookie TTL

function _readCookie(name) {
  const entry = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  if (!entry) return null;
  try { return JSON.parse(decodeURIComponent(entry.split("=").slice(1).join("="))); } catch { return null; }
}

function _writeCookie(name, value) {
  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    document.cookie = `${name}=${encoded}; path=/; max-age=${COOK_DAYS * 86400}; SameSite=Lax`;
    return true;
  } catch { return false; }
}

function loadProgress(id) {
  const key    = PROG_KEY(id);
  const cookie = _readCookie(key);
  if (cookie) return cookie;
  try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
}

function saveProgress(id, data) {
  const key = PROG_KEY(id);
  const ok  = _writeCookie(key, data);
  if (!ok) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
  } else {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* best-effort */ }
  }
}

// ── API progress sync (authenticated users only) ──────────────────────────────
async function fetchApiProgress(id) {
  try {
    const token = localStorage.getItem("chpr_token");
    const headers = {};
    if (token) headers["Authorization"] = `Token ${token}`;
    const res = await fetch(`${BASE}/api/resources/${id}/my-progress/`, {
      credentials: "include",
      headers,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function pushApiProgress(id, data) {
  try {
    await authedPost(`/api/resources/${id}/my-progress/`, data);
  } catch { /* non-fatal */ }
}

// ── PDF.js singleton (same pattern as ResourceTile.jsx) ───────────────────────
let _pdfJsPromise = null;
function getPdfJs() {
  if (_pdfJsPromise) return _pdfJsPromise;
  _pdfJsPromise = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      if (!window.pdfjsLib) { reject(new Error("pdf.js unavailable")); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _pdfJsPromise;
}

// ── In-document search helpers (plain DOM — the article is static HTML) ──────
const MAX_MATCHES = 400;

function clearDocHighlights(root) {
  root.querySelectorAll("mark.rd-doc-hl").forEach((mark) => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize(); // merge split text nodes so repeat searches work
  });
}

function highlightDocMatches(root, query) {
  const q = query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  const marks = [];
  for (const node of textNodes) {
    if (marks.length >= MAX_MATCHES) break;
    const text = node.nodeValue;
    const lower = text.toLowerCase();
    let idx = lower.indexOf(q);
    if (idx === -1) continue;

    const frag = document.createDocumentFragment();
    let last = 0;
    while (idx !== -1 && marks.length < MAX_MATCHES) {
      frag.appendChild(document.createTextNode(text.slice(last, idx)));
      const mark = document.createElement("mark");
      mark.className = "rd-doc-hl";
      mark.textContent = text.slice(idx, idx + q.length);
      frag.appendChild(mark);
      marks.push(mark);
      last = idx + q.length;
      idx = lower.indexOf(q, last);
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  return marks;
}

// ── HtmlDocReader ─────────────────────────────────────────────────────────────
// Renders the backend-converted web (HTML) version of a PDF/DOCX resource and
// reports reading progress from how far the user has scrolled the article.
// Also extracts the document outline (headings) for the parent's section
// chips, tracks the section currently in view, and offers keyword search
// with highlight + prev/next navigation.
// If the backend has no usable conversion, onUnavailable() lets the parent
// fall back to the original-file viewer.
function HtmlDocReader({
  resourceId, lang, onProgress, onReady, onUnavailable, onOutline, onActiveSection,
}) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const articleRef = useRef(null);
  const maxPctRef = useRef(0);
  const headingElsRef = useRef([]);
  const activeSecRef = useRef(null);

  // Search state
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const marksRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
        const token = getToken(); // staff-only resources need auth to resolve
        const res = await fetch(`${BASE}/api/resources/${resourceId}/html/${qs}`, {
          headers: token ? { Authorization: `Token ${token}` } : {},
          credentials: "include",
        });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (data?.status === "ready" && data.html) {
          setHtml(data.html);
          onReady?.();
        } else {
          onUnavailable?.();
        }
      } catch {
        if (!cancelled) onUnavailable?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resourceId, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Outline: give every heading an id, then hand the parent a de-duplicated
  // chip list (repeated page-header titles collapse to their first occurrence).
  // Must run before the scroll effect below so the ids exist for scroll-spy.
  useEffect(() => {
    if (!html || !articleRef.current) return;
    const heads = Array.from(articleRef.current.querySelectorAll("h1, h2, h3"));
    const seen = new Set();
    const outline = [];
    heads.forEach((h, i) => {
      const text = h.textContent.replace(/\s+/g, " ").trim();
      h.id = `rdsec-${i}`;
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      outline.push({
        id: h.id,
        text: text.length > 60 ? `${text.slice(0, 57)}…` : text,
        level: Number(h.tagName[1]),
      });
    });
    // Chip row wants the major sections; fall back to all levels when the
    // document has no real h1/h2 structure.
    let chips = outline.filter((o) => o.level <= 2);
    if (chips.length < 3) chips = outline;
    chips = chips.slice(0, 14);
    headingElsRef.current = chips
      .map((o) => document.getElementById(o.id))
      .filter(Boolean);
    onOutline?.(chips);
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-based progress + scroll-spy. The article lives inside the
  // scrollable reader box, so measure against the nearest scrollable
  // ancestor (fallback: window).
  useEffect(() => {
    if (!html || !articleRef.current) return;
    const el = articleRef.current;

    let scroller = null;
    for (let node = el.parentElement; node; node = node.parentElement) {
      const { overflowY } = getComputedStyle(node);
      if (overflowY === "auto" || overflowY === "scroll") { scroller = node; break; }
    }

    function measure() {
      const rect = el.getBoundingClientRect();
      if (rect.height < 1) return;
      const scrollerRect = scroller ? scroller.getBoundingClientRect() : null;
      const viewBottom = scrollerRect ? scrollerRect.bottom : window.innerHeight;
      const seen = Math.min(Math.max(viewBottom - rect.top, 0), rect.height);
      const pct = Math.round((seen / rect.height) * 100);
      if (pct > maxPctRef.current) {
        maxPctRef.current = pct;
        onProgress(pct);
      }

      // Scroll-spy: the active section is the last heading scrolled past.
      const viewTop = scrollerRect ? scrollerRect.top : 0;
      let active = null;
      for (const h of headingElsRef.current) {
        if (h.getBoundingClientRect().top <= viewTop + 100) active = h.id;
        else break;
      }
      if (active !== activeSecRef.current) {
        activeSecRef.current = active;
        onActiveSection?.(active);
      }
    }

    measure();
    const target = scroller ?? window;
    target.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure); // images loading change the height
    ro.observe(el);
    return () => {
      target.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyword search: debounce, then highlight every match in the article.
  useEffect(() => {
    if (!html || !articleRef.current) return;
    const timer = setTimeout(() => {
      const root = articleRef.current;
      if (!root) return;
      clearDocHighlights(root);
      marksRef.current = [];
      const q = query.trim();
      if (q.length >= 2) {
        marksRef.current = highlightDocMatches(root, q);
        if (marksRef.current.length > 0) {
          marksRef.current[0].classList.add("rd-doc-hl-current");
          marksRef.current[0].scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      setMatchCount(marksRef.current.length);
      setCurrentIdx(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, html]);

  function gotoMatch(delta) {
    const marks = marksRef.current;
    if (marks.length === 0) return;
    const next = (currentIdx + delta + marks.length) % marks.length;
    marks[currentIdx]?.classList.remove("rd-doc-hl-current");
    marks[next].classList.add("rd-doc-hl-current");
    marks[next].scrollIntoView({ behavior: "smooth", block: "center" });
    setCurrentIdx(next);
  }

  if (loading) {
    return (
      <div className="rd-pdf-loading">
        <div className="rd-pdf-spinner" />
        <span>Preparing web version…</span>
      </div>
    );
  }
  if (!html) return null; // parent switches to the fallback viewer

  const hasQuery = query.trim().length >= 2;

  return (
    <>
      <div className="rd-docsearch">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="15" height="15" aria-hidden="true" className="rd-docsearch-icon">
          <circle cx="9" cy="9" r="5.5" /><path d="M13.5 13.5L17 17" />
        </svg>
        <input
          type="search"
          className="rd-docsearch-input"
          placeholder="Search in this document…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); gotoMatch(1); }
            if (e.key === "Escape") setQuery("");
          }}
          aria-label="Search within the document"
        />
        {hasQuery && (
          <span className="rd-docsearch-count">
            {matchCount === 0 ? "No matches" : `${currentIdx + 1} / ${matchCount}`}
          </span>
        )}
        {matchCount > 0 && (
          <span className="rd-docsearch-nav">
            <button type="button" onClick={() => gotoMatch(-1)} title="Previous match" aria-label="Previous match">↑</button>
            <button type="button" onClick={() => gotoMatch(1)} title="Next match" aria-label="Next match">↓</button>
          </span>
        )}
        {hasQuery && (
          <button type="button" className="rd-docsearch-clear" onClick={() => setQuery("")} title="Clear search">
            ×
          </button>
        )}
      </div>
      <article
        ref={articleRef}
        className="rd-htmldoc"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

// ── PdfDocReader ──────────────────────────────────────────────────────────────
function PdfDocReader({ url, seenPages, onPageSeen, onNumPages }) {
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  const renderedRef = useRef(new Set());
  const renderObsRef = useRef(null);
  const seenObsRef = useRef(null);
  const [docLoading, setDocLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);

  // Load PDF document
  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await getPdfJs();
        const pdf = await pdfjs.getDocument({ url, withCredentials: true }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        onNumPages(pdf.numPages);
        setDocLoading(false);
      } catch {
        if (!cancelled) setDocLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up observers once the placeholders are in the DOM
  useEffect(() => {
    if (docLoading || !containerRef.current || !pdfRef.current) return;

    const container = containerRef.current;

    // Render observer: lazily render pages when within 600px of viewport
    renderObsRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const pageNum = Number(entry.target.dataset.page);
          if (renderedRef.current.has(pageNum)) return;
          renderedRef.current.add(pageNum);
          renderPage(pageNum, entry.target);
        });
      },
      { root: null, rootMargin: "600px 0px", threshold: 0 }
    );

    // Seen observer: mark page as seen when 40% visible
    seenObsRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const pageNum = Number(entry.target.dataset.page);
          onPageSeen(pageNum);
        });
      },
      { root: null, threshold: 0.4 }
    );

    const placeholders = container.querySelectorAll("[data-page]");
    placeholders.forEach((el) => {
      renderObsRef.current.observe(el);
      seenObsRef.current.observe(el);
    });

    return () => {
      renderObsRef.current?.disconnect();
      seenObsRef.current?.disconnect();
    };
  }, [docLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function renderPage(pageNum, placeholder) {
    if (!pdfRef.current) return;
    try {
      const page = await pdfRef.current.getPage(pageNum);
      const vp0 = page.getViewport({ scale: 1 });
      const containerWidth = placeholder.clientWidth || 800;
      // Render the canvas backing store at device-pixel-ratio (super-sampled) so
      // text stays sharp on hi-DPI screens; CSS scales it back down to 100%.
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cssScale = containerWidth / vp0.width;
      const vp = page.getViewport({ scale: cssScale * dpr });

      const canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = "100%";
      canvas.style.display = "block";

      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;

      placeholder.style.height = "";
      placeholder.innerHTML = "";
      placeholder.appendChild(canvas);

      const isSeen = seenPages.includes(pageNum);
      if (isSeen) placeholder.classList.add("rd-pdf-page-seen");
    } catch {
      // silently fail for individual pages
    }
  }

  if (docLoading) {
    return (
      <div className="rd-pdf-loading">
        <div className="rd-pdf-spinner" />
        <span>Loading document…</span>
      </div>
    );
  }

  return (
    <div className="rd-pdf-pages" ref={containerRef}>
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
        <div
          key={pageNum}
          className={`rd-pdf-page${seenPages.includes(pageNum) ? " rd-pdf-page-seen" : ""}`}
          data-page={pageNum}
          style={{ minHeight: "1000px" }}
        >
          <span className="rd-pdf-page-num">Page {pageNum}</span>
        </div>
      ))}
    </div>
  );
}

// ── VideoDocReader ────────────────────────────────────────────────────────────
function VideoDocReader({ url, initialPercent, onProgress }) {
  const videoRef = useRef(null);
  const seekedRef = useRef(false);

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    onProgress(Math.min(Math.round((v.currentTime / v.duration) * 100), 100));
  }

  function handleEnded() {
    onProgress(100);
  }

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (!v || seekedRef.current) return;
    if (initialPercent > 0) {
      v.currentTime = (initialPercent / 100) * v.duration * 0.98;
    }
    seekedRef.current = true;
  }

  return (
    <div className="rd-video-wrap">
      <video
        ref={videoRef}
        src={url}
        controls
        className="rd-video"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
      />
    </div>
  );
}

// ── QuizModal ─────────────────────────────────────────────────────────────────
// OPT_KEYS matches the backend's stored values ("a"/"b"/"c"/"d")
const OPT_KEYS   = ["a", "b", "c", "d"];
const OPT_LABELS = ["A", "B", "C", "D"];

function QuizModal({ resourceId, onClose }) {
  const [questions, setQuestions]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [answers, setAnswers]         = useState({});   // { [q.id]: "a"|"b"|"c"|"d" }
  const [results, setResults]         = useState(null);
  const [current, setCurrent]         = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/quiz-questions/?resource=${resourceId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setQuestions(data.results ?? data);
      } catch {
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [resourceId]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      // answers = { "42": "b", "43": "a", ... }  — matches backend expectation
      const data = await authedPost(`/api/resources/${resourceId}/submit-quiz/`, { answers });
      setResults(data);
    } catch (e) {
      setSubmitError(e.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetake() {
    setAnswers({});
    setResults(null);
    setCurrent(0);
    setSubmitError("");
  }

  // Short-answer questions count as answered once something is typed.
  const isAnswered = (q) =>
    q.question_type === "short"
      ? Boolean((answers[q.id] ?? "").trim())
      : answers[q.id] != null;
  const allAnswered = questions.length > 0 && questions.every(isAnswered);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rd-quiz-modal" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="rd-quiz-body">
          <div className="rd-pdf-loading"><div className="rd-pdf-spinner" /><span>Loading questions…</span></div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rd-quiz-modal" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="rd-quiz-body">
          <h3 style={{ marginBottom: "0.75rem" }}>No Questions Yet</h3>
          <p style={{ color: "var(--muted,#888)", marginBottom: "1.5rem" }}>
            The admin hasn't added quiz questions for this resource yet.
          </p>
          <button className="rd-quiz-btn rd-quiz-btn-active" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // ── Results view ─────────────────────────────────────────────────────────────
  if (results) {
    const passed = results.percent >= 70;
    return (
      <div className="rd-quiz-modal" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="rd-quiz-body">
          <h3 style={{ marginBottom: "0.5rem" }}>Quiz Results</h3>
          <div className={`rd-quiz-score ${passed ? "rd-quiz-pass" : "rd-quiz-fail"}`}>
            {results.score} / {results.total} ({results.percent}%)
            {" — "}{passed ? "Well done!" : "Keep studying and try again."}
          </div>

          <div className="rd-quiz-results-body">
            {results.results.map((r) => (
              <div key={r.id} className={`rd-quiz-result-item ${r.is_correct ? "rd-qr-correct" : "rd-qr-wrong"}`}>
                <p className="rd-qr-q">
                  <span className="rd-qr-label">{r.is_correct ? "✓" : "✗"}</span> {r.question}
                </p>
                {r.your_answer && (
                  <p className="rd-qr-ans">
                    <span className="rd-qr-label">Your answer:</span>{" "}
                    {r.question_type === "short"
                      ? `“${r.your_answer}”`
                      : `${r.your_answer.toUpperCase()}. ${r.options[r.your_answer]}`}
                    {r.is_correct ? " ✓" : " ✗"}
                  </p>
                )}
                {!r.is_correct && (r.correct || r.correct_text) && (
                  <p className="rd-qr-correct-ans">
                    <span className="rd-qr-label">Correct:</span>{" "}
                    {r.question_type === "short"
                      ? r.correct_text
                      : `${r.correct.toUpperCase()}. ${r.options[r.correct]}`}
                  </p>
                )}
                {r.explanation && <p className="rd-qr-explanation">{r.explanation}</p>}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem" }}>
            <button className="rd-quiz-btn" onClick={handleRetake}>Retake</button>
            <button className="rd-quiz-btn rd-quiz-btn-active" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Question view ─────────────────────────────────────────────────────────────
  const q            = questions[current];
  const isLast       = current === questions.length - 1;
  const progressPct  = ((current + 1) / questions.length) * 100;

  return (
    <div className="rd-quiz-modal" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rd-quiz-body">
        <button
          className="rd-quiz-close"
          onClick={onClose}
          aria-label="Close quiz"
        >×</button>

        <div className="rd-quiz-progress-bar">
          <div className="rd-quiz-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="rd-quiz-source-note">
          📖 According to this document — every answer is found in the material you just read.
        </p>
        <p className="rd-quiz-counter">Question {current + 1} of {questions.length}</p>

        <p className="rd-quiz-question">{q.question}</p>

        {q.question_type === "short" ? (
          <div className="rd-quiz-short">
            <input
              type="text"
              className="rd-quiz-short-input"
              placeholder="Type your answer from the document…"
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              autoFocus
            />
            <p className="rd-quiz-short-hint">
              Straight answer — capitals and punctuation don't matter.
            </p>
          </div>
        ) : (
          <div className="rd-quiz-options">
            {OPT_KEYS.map((key, idx) => (
              q[`option_${key}`] ? (
                <button
                  key={key}
                  className={`rd-quiz-option${answers[q.id] === key ? " rd-quiz-option-selected" : ""}`}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: key }))}
                >
                  <span className="rd-quiz-opt-letter">{OPT_LABELS[idx]}</span>
                  {q[`option_${key}`]}
                </button>
              ) : null
            ))}
          </div>
        )}

        {submitError && <p className="rd-quiz-error">{submitError}</p>}

        <div className="rd-quiz-nav">
          <button
            className="rd-quiz-btn"
            onClick={() => setCurrent(c => c - 1)}
            disabled={current === 0}
          >← Back</button>

          {!isLast ? (
            <button
              className="rd-quiz-btn rd-quiz-btn-active"
              onClick={() => setCurrent(c => c + 1)}
              disabled={!isAnswered(q)}
            >Next →</button>
          ) : (
            <button
              className={`rd-quiz-btn ${allAnswered ? "rd-quiz-btn-active" : "rd-quiz-btn-locked"}`}
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
            >{submitting ? "Submitting…" : "Submit Quiz"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CommentSection ────────────────────────────────────────────────────────────
function CommentSection({ resourceId, user }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/comments/?resource=${resourceId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments(data.results ?? data);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  async function handlePost(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setPostError("");
    try {
      await authedPost("/api/comments/", {
        resource: resourceId,
        author_name: user.first_name
          ? `${user.first_name} ${user.last_name ?? ""}`.trim()
          : user.username,
        author_role: user.role ?? "staff",
        body: body.trim(),
      });
      setBody("");
      await loadComments();
    } catch (e) {
      setPostError(e.message || "Failed to post comment.");
    } finally {
      setPosting(false);
    }
  }

  function initials(comment) {
    const name = comment.author_name ?? "";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || "?";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  if (!user) return null;

  return (
    <div className="rd-comments">
      <h3 className="rd-section-title">Comments</h3>

      {loading ? (
        <p className="rd-loading">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="rd-comments-empty">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="rd-comment-list">
          {comments.map((c) => (
            <div key={c.id} className="rd-comment">
              <div className="rd-comment-avatar">{initials(c)}</div>
              <div className="rd-comment-body">
                <div className="rd-comment-meta">
                  <span className="rd-comment-author">{c.author_name}</span>
                  {c.author_role && (
                    <span className="rd-comment-role">{c.author_role}</span>
                  )}
                  <span className="rd-comment-date">{formatDate(c.created_at)}</span>
                </div>
                <p className="rd-comment-text">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="rd-comment-form" onSubmit={handlePost}>
        <p className="rd-comment-form-title">Post a comment</p>
        <textarea
          rows={3}
          placeholder="Write your comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ width: "100%", resize: "vertical" }}
        />
        {postError && (
          <p style={{ color: "red", fontSize: "0.875rem" }}>{postError}</p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="submit" className="rd-quiz-btn rd-quiz-btn-active" disabled={posting || !body.trim()}>
            {posting ? "Posting…" : "Post comment"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── ResourceDetail (main component) ──────────────────────────────────────────
export default function ResourceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [seenPages, setSeenPages] = useState([]);
  const [numPages, setNumPages] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedLang, setSelectedLang] = useState("");
  const [docView, setDocView] = useState("original");        // "web" | "original"
  const [webAvailable, setWebAvailable] = useState(null); // null=unknown yet
  const [outline, setOutline] = useState([]);           // section chips (from doc headings)
  const [activeSection, setActiveSection] = useState(null);
  const apiSyncTimerRef = useRef(null);
  const progressRef = useRef(0);

  // Load resource + progress (API for authenticated users, cookie/localStorage otherwise)
  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        const res = await fetch(`${BASE}/api/resources/${id}/`, {
          headers: token ? { Authorization: `Token ${token}` } : {},
          credentials: "include",
        });
        if (!res.ok) throw new Error("Resource not found");
        const data = await res.json();
        setResource(data);
        const userType = user ? (user.role === "admin" ? "admin" : "staff") : "visitor";
        trackInteraction(data.id, "view", userType);
      } catch (e) {
        setError(e.message || "Failed to load resource.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canonical permalink: upgrade a numeric / stale URL to the resource's slug.
  useEffect(() => {
    if (resource?.slug && id !== resource.slug) {
      navigate(`/resources/${resource.slug}`, { replace: true });
    }
  }, [resource, id, navigate]);

  // Load progress: API first (if authenticated), then cookie/localStorage
  useEffect(() => {
    if (!id) return;
    (async () => {
      let saved = null;
      if (user) {
        saved = await fetchApiProgress(id);
      }
      if (!saved || (!saved.progress && !saved.seen_pages?.length)) {
        saved = loadProgress(id);
        // Normalize: API uses seen_pages, local uses seenPages
        if (!saved.seen_pages && saved.seenPages) saved.seen_pages = saved.seenPages;
      }
      if (saved.progress)                      setProgress(saved.progress);
      if (Array.isArray(saved.seen_pages))      setSeenPages(saved.seen_pages);
    })();
  }, [id, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // A different resource or language file gets a fresh web-view decision.
  useEffect(() => {
    setDocView("original");
    setWebAvailable(null);
    setOutline([]);
    setActiveSection(null);
  }, [id, selectedLang]);

  const handleOutline = useCallback((chips) => setOutline(chips), []);
  const handleActiveSection = useCallback((secId) => setActiveSection(secId), []);

  function jumpToSection(secId) {
    const el = document.getElementById(secId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Mirror progress into a ref so the web-reader handler can stay monotonic
  // (a fresh reader reporting 5% must not clobber a restored 80%).
  useEffect(() => {
    progressRef.current = Math.max(progressRef.current, progress);
  }, [progress]);

  // Debounced API sync for authenticated users
  function scheduleApiSync(id, data) {
    if (!user) return;
    clearTimeout(apiSyncTimerRef.current);
    apiSyncTimerRef.current = setTimeout(() => pushApiProgress(id, data), 4000);
  }

  // Recompute PDF progress when seenPages / numPages change
  useEffect(() => {
    if (!resource) return;
    const isPdf = resource.file_url?.split("?")[0].toLowerCase().endsWith(".pdf");
    if (!isPdf || numPages === 0) return;
    const pct       = Math.round((seenPages.length / numPages) * 100);
    const completed = pct >= 100;
    setProgress(pct);
    saveProgress(id, { progress: pct, seenPages });
    scheduleApiSync(id, { progress: pct, seen_pages: seenPages, completed });
  }, [seenPages, numPages]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageSeen = useCallback((pageNum) => {
    setSeenPages((prev) => {
      if (prev.includes(pageNum)) return prev;
      return [...prev, pageNum];
    });
  }, []);

  const handleNumPages = useCallback((n) => {
    setNumPages(n);
  }, []);

  // Progress from the web (HTML) reader — only ever moves forward.
  const handleDocProgress = useCallback(
    (pct) => {
      if (pct <= progressRef.current) return;
      progressRef.current = pct;
      setProgress(pct);
      saveProgress(id, { progress: pct });
      scheduleApiSync(id, { progress: pct, seen_pages: [], completed: pct >= 100 });
    },
    [id, user] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleVideoProgress = useCallback(
    (pct) => {
      setProgress(pct);
      saveProgress(id, { progress: pct });
      scheduleApiSync(id, { progress: pct, seen_pages: [], completed: pct >= 100 });
    },
    [id, user] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: resource?.name, url }); } catch (e) {
        if (e.name === "AbortError") return;
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const inp = document.createElement("input");
        inp.value = url; document.body.appendChild(inp);
        inp.select(); document.execCommand("copy"); document.body.removeChild(inp);
      }
    }
    const userType = user ? (user.role === "admin" ? "admin" : "staff") : "visitor";
    if (resource?.id) trackInteraction(resource.id, "share", userType);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <main className="rd-main">
        <div className="rd-spinner-wrap">
          <div className="rd-spinner-lg" />
        </div>
      </main>
    );
  }

  if (error || !resource) {
    return (
      <main className="rd-main">
        <button className="rd-back" onClick={() => navigate(-1)}>← Back</button>
        <p className="rd-error">{error || "Resource not found."}</p>
      </main>
    );
  }

  const { type_key, file_url, name, description, project_name, project_slug, posted_by, test_platform, sample_type, embed_url } = resource;
  // YouTube embed: when embed_url is set we play an inline iframe instead of a hosted file.
  const ytId = (() => {
    if (!embed_url) return "";
    const m = embed_url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  })();
  const embedSrc = ytId ? `https://www.youtube-nocookie.com/embed/${ytId}?rel=0` : "";
  const watchUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : (embed_url || "");
  const isEmbed = !!embedSrc;
  const typeLabel = resource.type_label || TYPE_LABELS[type_key] || type_key;
  const typeClass = TYPE_CLASS[type_key] || "";

  // Language variants: pick the active file (default English, else first).
  const LANG_NAMES = { en: "English", fr: "French", pcm: "Pidgin", ful: "Fulfulde" };
  const langs = resource.languages || [];
  const activeLang = selectedLang
    || (langs.find((l) => l.language === "en") ? "en" : (langs[0]?.language || ""));
  const activeFile = langs.find((l) => l.language === activeLang);
  const activeUrl = (activeFile && activeFile.url) || file_url;

  const isVideo = type_key === "vid";
  const cleanUrl = activeUrl?.split("?")[0].toLowerCase() ?? "";
  const isPdf = cleanUrl.endsWith(".pdf");
  const isDocx = cleanUrl.endsWith(".docx");
  // PDF/DOCX get the converted web version by default; readers can switch to
  // the original, and we fall back automatically when no conversion exists.
  const isDocFile = (isPdf || isDocx) && !isVideo;
  const showWebReader = isDocFile && docView === "web" && webAvailable !== false;

  // Clean filename for the Download button (keeps the real extension).
  const fileExt = (activeUrl?.split("?")[0].split(".").pop() || "").toLowerCase();
  const downloadName = fileExt && fileExt.length <= 5 ? `${name}.${fileExt}` : name;

  const savedProgress = loadProgress(id);
  const initialVideoPercent = savedProgress.progress ?? 0;

  return (
    <main className="rd-main">
      {/* Back button */}
      <button className="rd-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* Header */}
      <div className="rd-header">
        <div className="rd-header-top">
          <div className="rd-header-tags">
            <span className={`res-type-badge ${typeClass}`}>{typeLabel}</span>
            {user && project_slug && (
              <Link to={`/projects/${project_slug}`} className="rd-project-link">
                {project_name}
              </Link>
            )}
          </div>
          <div className="rd-header-actions">
            {activeUrl && (
              <a
                className="rd-download-btn"
                href={activeUrl}
                download={downloadName}
                title={`Download the ${LANG_NAMES[activeLang] || "current"} ${isVideo ? "video" : "file"}`}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
                  <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5" /><path d="M4 16.5h12" />
                </svg>
                Download{langs.length > 1 ? ` (${LANG_NAMES[activeLang] || activeLang})` : ""}
              </a>
            )}
            {isEmbed && (
              <a
                className="rd-download-btn"
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open this video on YouTube"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
                  <path d="M3 6.2c0-.9.6-1.6 1.5-1.8C6 4.1 10 4.1 10 4.1s4 0 5.5.3c.9.2 1.5.9 1.5 1.8.2 1.1.2 2.5.2 2.5s0 1.4-.2 2.5c0 .9-.6 1.6-1.5 1.8-1.5.3-5.5.3-5.5.3s-4 0-5.5-.3A1.9 1.9 0 0 1 3 11.2C2.8 10.1 2.8 8.7 2.8 8.7s0-1.4.2-2.5z"/><path fill="#fff" d="M8.5 10.9V6.6l3.6 2.2z"/>
                </svg>
                Watch on YouTube ↗
              </a>
            )}
            <button className={"rd-share-btn" + (copied ? " rd-share-copied" : "")} onClick={handleShare} title="Share this resource">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
                <circle cx="15" cy="3.5" r="1.5"/><circle cx="15" cy="16.5" r="1.5"/><circle cx="5" cy="10" r="1.5"/>
                <line x1="13.6" y1="4.5" x2="6.4" y2="9"/><line x1="13.6" y1="15.5" x2="6.4" y2="11"/>
              </svg>
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
        </div>
        <h1 className="rd-title">{name}</h1>
        {description && <p className="rd-description">{description}</p>}
        <div className="rd-meta-row">
          {posted_by && (
            <span className="rd-meta-item">
              <strong>Posted by:</strong> {posted_by}
            </span>
          )}
          {test_platform && (
            <span className="rd-meta-item">
              <strong>Platform:</strong> {test_platform}
            </span>
          )}
          {sample_type && (
            <span className="rd-meta-item">
              <strong>Sample:</strong> {sample_type}
            </span>
          )}
        </div>

        {/* Language picker — controls the preview, Open and Download below */}
        {langs.length > 1 && (
          <div className="rd-lang-pick">
            <span className="rd-lang-pick-label">Language</span>
            <div className="rd-lang-switch" role="group" aria-label="Choose language">
              {langs.map((l) => (
                <button
                  key={l.language}
                  type="button"
                  className={"rd-lang-btn" + (l.language === activeLang ? " rd-lang-btn-active" : "")}
                  aria-pressed={l.language === activeLang}
                  onClick={() => setSelectedLang(l.language)}
                >
                  {LANG_NAMES[l.language] || l.language_label || l.language}
                </button>
              ))}
            </div>
            <span className="rd-lang-pick-hint">applies to preview, open &amp; download</span>
          </div>
        )}

        {/* Section chips — jump straight to a heading in the web version */}
        {showWebReader && webAvailable && outline.length > 1 && (
          <div className="rd-sections">
            <span className="rd-sections-label">Jump to</span>
            <div className="rd-section-chips" role="navigation" aria-label="Document sections">
              {outline.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  className={
                    "rd-section-chip" +
                    (sec.id === activeSection ? " rd-section-chip-active" : "") +
                    (sec.level >= 3 ? " rd-section-chip-sub" : "")
                  }
                  title={sec.text}
                  onClick={() => jumpToSection(sec.id)}
                >
                  {sec.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reader section */}
      <div className="rd-reader-section">
        <div className="rd-reader-header">
          <h2 className="rd-section-title">
            {isVideo ? "Video" : "Document"}
            {showWebReader && webAvailable && (
              <span className="rd-webver-badge">Web version</span>
            )}
          </h2>
          <div className="rd-reader-header-actions">
            {isDocFile && webAvailable !== false && (
              <button
                type="button"
                className="rd-viewtoggle-btn"
                onClick={() => setDocView((v) => (v === "web" ? "original" : "web"))}
              >
                {docView === "web"
                  ? `View original ${isPdf ? "PDF" : "file"}`
                  : "View web version"}
              </button>
            )}
            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rd-openfile-link"
              >
                {isVideo ? "Open video" : "Open file"}{langs.length > 1 ? ` (${LANG_NAMES[activeLang] || activeLang})` : ""} ↗
              </a>
            )}
          </div>
        </div>

        {/* Progress bar (hidden for embedded videos — YouTube watch progress isn't trackable) */}
        {!isEmbed && (
        <div className="rd-progress-wrap">
          <div className="rd-progress-bar-track">
            <div
              className="rd-progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="rd-progress-label">{progress}% {isVideo ? "watched" : "read"}</span>
        </div>
        )}

        <div className="rd-reader-box">
          {isEmbed ? (
            <div
              className="rd-embed-wrap"
              style={{ position: "relative", width: "100%", paddingBottom: "56.25%", height: 0, borderRadius: "12px", overflow: "hidden", background: "#000" }}
            >
              <iframe
                className="rd-embed"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                src={embedSrc}
                title={name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : showWebReader && activeUrl ? (
            <HtmlDocReader
              key={activeUrl}
              resourceId={resource.slug || resource.id}
              lang={activeLang}
              onProgress={handleDocProgress}
              onReady={() => setWebAvailable(true)}
              onUnavailable={() => setWebAvailable(false)}
              onOutline={handleOutline}
              onActiveSection={handleActiveSection}
            />
          ) : isPdf && activeUrl ? (
            <PdfDocReader
              key={activeUrl}
              url={activeUrl}
              seenPages={seenPages}
              onPageSeen={handlePageSeen}
              onNumPages={handleNumPages}
            />
          ) : isVideo && activeUrl ? (
            <VideoDocReader
              key={activeUrl}
              url={activeUrl}
              initialPercent={initialVideoPercent}
              onProgress={handleVideoProgress}
            />
          ) : activeUrl ? (
            <div className="rd-other-file">
              <p>This file cannot be previewed in the browser.</p>
              <a href={activeUrl} target="_blank" rel="noopener noreferrer" className="rd-quiz-btn rd-quiz-btn-active">
                Download / open file ↗
              </a>
            </div>
          ) : (
            <div className="rd-no-file">
              <p>No file attached to this resource.</p>
            </div>
          )}
        </div>
      </div>

      {/* Test Your Understanding (hidden for documents and embedded videos) */}
      {!isDocFile && !isEmbed && (
      <div className="rd-quiz-section">
        <div className="rd-quiz-section-inner">
          <div className="rd-quiz-info">
            <h2 className="rd-section-title" style={{ margin: 0 }}>Test Your Understanding</h2>
            {progress < 100 && (
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--muted, #888)" }}>
                Finish {isVideo ? "watching the video" : "reading the document"} to unlock the quiz ({progress}% complete).
              </p>
            )}
          </div>
          <button
            className={`rd-quiz-btn${progress >= 100 ? " rd-quiz-btn-active" : " rd-quiz-btn-locked"}`}
            onClick={() => setQuizOpen(true)}
            disabled={progress < 100}
          >
            Start Quiz
          </button>
        </div>
      </div>
      )}

      {/* Comments */}
      <CommentSection resourceId={resource.id} user={user} />

      {/* Quiz modal */}
      {quizOpen && (
        <QuizModal resourceId={resource.id} onClose={() => setQuizOpen(false)} />
      )}
    </main>
  );
}
