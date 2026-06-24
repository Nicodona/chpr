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
      const scale = containerWidth / vp0.width;
      const vp = page.getViewport({ scale });

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

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] != null);

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
                    {r.your_answer.toUpperCase()}. {r.options[r.your_answer]}
                    {r.is_correct ? " ✓" : " ✗"}
                  </p>
                )}
                {!r.is_correct && r.correct && (
                  <p className="rd-qr-correct-ans">
                    <span className="rd-qr-label">Correct:</span>{" "}
                    {r.correct.toUpperCase()}. {r.options[r.correct]}
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
        <p className="rd-quiz-counter">Question {current + 1} of {questions.length}</p>

        <p className="rd-quiz-question">{q.question}</p>

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
              disabled={answers[q.id] == null}
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

  if (!user) {
    return (
      <div className="rd-comments">
        <h3 className="rd-section-title">Comments</h3>
        <p className="rd-comment-guest">
          Comments are available to registered users only. Please contact your administrator for access.
        </p>
      </div>
    );
  }

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
  const apiSyncTimerRef = useRef(null);

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

  const { type_key, file_url, name, description, project_name, project_slug, posted_by, activity_label, test_platform, sample_type } = resource;
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
  const isPdf = activeUrl?.split("?")[0].toLowerCase().endsWith(".pdf");

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
        <div className="rd-header-meta">
          <span className={`res-type-badge ${typeClass}`}>{typeLabel}</span>
          {project_slug && (
            <Link to={`/projects/${project_slug}`} className="rd-project-link">
              {project_name}
            </Link>
          )}
          <button className={"rd-share-btn" + (copied ? " rd-share-copied" : "")} onClick={handleShare} title="Share this resource">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
              <circle cx="15" cy="3.5" r="1.5"/><circle cx="15" cy="16.5" r="1.5"/><circle cx="5" cy="10" r="1.5"/>
              <line x1="13.6" y1="4.5" x2="6.4" y2="9"/><line x1="13.6" y1="15.5" x2="6.4" y2="11"/>
            </svg>
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
        <h1 className="rd-title">{name}</h1>
        {description && <p className="rd-description">{description}</p>}
        <div className="rd-meta-row">
          {posted_by && (
            <span className="rd-meta-item">
              <strong>Posted by:</strong> {posted_by}
            </span>
          )}
          {activity_label && (
            <span className="rd-meta-item">
              <strong>Setting:</strong> {activity_label}
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
      </div>

      {/* Reader section */}
      <div className="rd-reader-section">
        <div className="rd-reader-header">
          <h2 className="rd-section-title">{isVideo ? "Video" : "Document"}</h2>
          {activeUrl && (
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rd-openfile-link"
            >
              {isVideo ? "Open video" : "Open file"} ↗
            </a>
          )}
        </div>

        {/* Language switcher (only when more than one language exists) */}
        {langs.length > 1 && (
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
        )}

        {/* Progress bar */}
        <div className="rd-progress-wrap">
          <div className="rd-progress-bar-track">
            <div
              className="rd-progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="rd-progress-label">{progress}% {isVideo ? "watched" : "read"}</span>
        </div>

        <div className="rd-reader-box">
          {isPdf && activeUrl ? (
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

      {/* Test Your Understanding */}
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

      {/* Comments */}
      <CommentSection resourceId={id} user={user} />

      {/* Quiz modal */}
      {quizOpen && (
        <QuizModal resourceId={id} onClose={() => setQuizOpen(false)} />
      )}
    </main>
  );
}
