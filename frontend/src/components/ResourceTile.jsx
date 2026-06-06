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

function isPdf(url) {
  if (!url) return false;
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

// ── Video thumbnail ───────────────────────────────────────────────────────────
// Uses a hidden <video> element. After metadata loads we seek to 2 s (or 10 %
// of duration) so the browser paints that frame — no canvas / CORS required.
function VideoThumb({ src }) {
  const vidRef = useRef(null);

  function handleMeta() {
    const v = vidRef.current;
    if (v) v.currentTime = Math.min(2, (v.duration || 20) * 0.1);
  }

  return (
    <div className="tile-thumb tile-thumb-video">
      {src && (
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
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <span className="tile-thumb-tag">VIDEO</span>
    </div>
  );
}

// ── PDF thumbnail ─────────────────────────────────────────────────────────────
// Renders page 1 of the PDF to a canvas via PDF.js (loaded from CDN on demand).
// Falls back to the CSS document illustration if PDF.js is unavailable or the
// file can't be fetched (e.g. CORS / network error).
function PdfThumb({ src }) {
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    if (!src) return;
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
        // CSS fallback shown automatically when imgUrl stays null
      }
    })();

    return () => { cancelled = true; };
  }, [src]);

  return (
    <div className="tile-thumb tile-thumb-pdf">
      {!imgUrl && (
        <div className="tile-doc-page tile-doc-page-fallback">
          <div className="tile-doc-corner" />
          <div className="tile-doc-header" />
          <div className="tile-doc-line" />
          <div className="tile-doc-line short" />
          <div className="tile-doc-line" />
          <div className="tile-doc-line medium" />
        </div>
      )}
      {imgUrl && (
        <img
          src={imgUrl}
          className="tile-pdf-img tile-pdf-img-ready"
          alt=""
          aria-hidden="true"
        />
      )}
      <span className="tile-thumb-tag tile-thumb-tag-pdf">PDF</span>
    </div>
  );
}

// ── Generic document thumbnail (CSS-drawn fallback) ───────────────────────────
function DocThumb() {
  return (
    <div className="tile-thumb tile-thumb-pdf">
      <div className="tile-doc-page tile-doc-page-fallback">
        <div className="tile-doc-corner" />
        <div className="tile-doc-header" />
        <div className="tile-doc-line" />
        <div className="tile-doc-line short" />
        <div className="tile-doc-line" />
        <div className="tile-doc-line medium" />
      </div>
      <span className="tile-thumb-tag tile-thumb-tag-pdf">FILE</span>
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
export default function ResourceTile({ resource, showProject = true }) {
  const { type_key, file_url } = resource;
  const typeLabel = resource.type_label || TYPE_LABELS[type_key] || type_key;
  const typeClass = TYPE_CLASS[type_key] || "";

  let thumb;
  if (type_key === "vid") {
    thumb = <VideoThumb src={file_url} />;
  } else if (isPdf(file_url)) {
    thumb = <PdfThumb src={file_url} />;
  } else {
    thumb = <DocThumb />;
  }

  const body = (
    <>
      {thumb}
      <div className="tile-body">
        <span className={`res-type-badge ${typeClass}`}>{typeLabel}</span>
        <h3 className="tile-title">{resource.name}</h3>
        {showProject && <span className="tile-project">{resource.project_name}</span>}
        {resource.description && <p className="tile-desc">{resource.description}</p>}
      </div>
    </>
  );

  return (
    <Link to={`/resources/${resource.id}`} className="resource-tile">
      {body}
    </Link>
  );
}
