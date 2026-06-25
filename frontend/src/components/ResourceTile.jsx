import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TYPE_CLASS, TYPE_LABELS } from "../constants";

// ── PDF.js — loaded once on first PDF tile, cached for the rest ───────────────
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

export function isPdf(url) {
  if (!url) return false;
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

export const LANG_SHORT = { en: "EN", fr: "FR", pcm: "Pidgin", ful: "Fulfulde" };

// Pick the URL to thumbnail/preview: prefer English, else first language file,
// else the legacy single file_url.
export function primaryUrl(resource) {
  const langs = resource.languages || [];
  const en = langs.find((l) => l.language === "en");
  return (en && en.url) || (langs[0] && langs[0].url) || resource.file_url || null;
}

// ── Lazy mount: only render heavy thumbnails once the tile scrolls near view.
// Stops the page from fetching every PDF/video up-front (the slow-load cause).
function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setInView(true); io.disconnect(); }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  return [ref, inView];
}

function DocFallback({ tag }) {
  return (
    <div className="tile-doc-page tile-doc-page-fallback">
      <div className="tile-doc-corner" />
      <div className="tile-doc-header" />
      <div className="tile-doc-line" />
      <div className="tile-doc-line short" />
      <div className="tile-doc-line" />
      <div className="tile-doc-line medium" />
    </div>
  );
}

// ── Video thumbnail (metadata only; lazy) ─────────────────────────────────────
function VideoThumb({ src, active }) {
  const vidRef = useRef(null);
  function handleMeta() {
    const v = vidRef.current;
    if (v) v.currentTime = Math.min(2, (v.duration || 20) * 0.1);
  }
  return (
    <div className="tile-thumb tile-thumb-video">
      {active && src && (
        <video
          ref={vidRef}
          src={src}
          className="tile-thumb-img"
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={handleMeta}
          aria-hidden="true"
        />
      )}
      <div className="tile-thumb-video-bg" />
      <div className="tile-thumb-play" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </div>
      <span className="tile-thumb-tag">VIDEO</span>
    </div>
  );
}

// ── PDF thumbnail (renders page 1; only when `active`) ────────────────────────
function PdfThumb({ src, active }) {
  const [imgUrl, setImgUrl] = useState(null);
  useEffect(() => {
    if (!src || !active) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await getPdfJs();
        const pdf = await pdfjs.getDocument({ url: src, withCredentials: true }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;
        const vp0 = page.getViewport({ scale: 1 });
        const scaledVp = page.getViewport({ scale: 400 / vp0.width });
        const canvas = document.createElement("canvas");
        canvas.width = scaledVp.width;
        canvas.height = scaledVp.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: scaledVp }).promise;
        if (!cancelled) setImgUrl(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        /* CSS fallback stays */
      }
    })();
    return () => { cancelled = true; };
  }, [src, active]);

  return (
    <div className="tile-thumb tile-thumb-pdf">
      {!imgUrl && <DocFallback />}
      {imgUrl && <img src={imgUrl} className="tile-pdf-img tile-pdf-img-ready" alt="" aria-hidden="true" />}
      <span className="tile-thumb-tag tile-thumb-tag-pdf">PDF</span>
    </div>
  );
}

function DocThumb() {
  return (
    <div className="tile-thumb tile-thumb-pdf">
      <DocFallback />
      <span className="tile-thumb-tag tile-thumb-tag-pdf">FILE</span>
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
export default function ResourceTile({ resource, showProject = true }) {
  const { type_key } = resource;
  const typeLabel = resource.type_label || TYPE_LABELS[type_key] || type_key;
  const typeClass = TYPE_CLASS[type_key] || "";
  const url = primaryUrl(resource);
  const langs = resource.languages || [];
  const [ref, inView] = useInView();

  let thumb;
  if (type_key === "vid") {
    thumb = <VideoThumb src={url} active={inView} />;
  } else if (isPdf(url)) {
    thumb = <PdfThumb src={url} active={inView} />;
  } else {
    thumb = <DocThumb />;
  }

  return (
    <Link to={`/resources/${resource.slug || resource.id}`} className="resource-tile" ref={ref}>
      {thumb}
      <div className="tile-body">
        <span className={`res-type-badge ${typeClass}`}>{typeLabel}</span>
        <h3 className="tile-title">{resource.name}</h3>
        {showProject && <span className="tile-project">{resource.project_name}</span>}
        {resource.description && <p className="tile-desc">{resource.description}</p>}
        {langs.length > 1 && (
          <div className="tile-langs" aria-label="Available languages">
            {langs.map((l) => (
              <span key={l.language} className="tile-lang-pill">{LANG_SHORT[l.language] || l.language}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
