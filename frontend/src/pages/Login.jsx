/**
 * Login.jsx — CHPR Resources Hub
 * Fixed: canvas animation now uses useRef + useEffect (not a hook-as-ref-callback).
 * Fixed: page renders full-screen by hiding the Nav/Footer via a body class.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const cx = (...args) => args.filter(Boolean).join(" ");

export default function Login() {
  const { user, login }             = useAuth();
  const navigate                    = useNavigate();
  const [searchParams]              = useSearchParams();
  const next                        = searchParams.get("next") || "/";

  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [showPw,   setShowPw]       = useState(false);
  const [error,    setError]        = useState("");
  const [loading,  setLoading]      = useState(false);
  const [msLoading,setMsLoading]    = useState(false);
  const [mounted,  setMounted]      = useState(false);

  const usernameRef = useRef(null);
  const canvasRef   = useRef(null);

  /* Hide the app's Nav + Footer while on this page */
  useEffect(() => {
    document.body.classList.add("lp-fullscreen-page");
    return () => document.body.classList.remove("lp-fullscreen-page");
  }, []);

  /* Entrance animation */
  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => usernameRef.current?.focus(), 420);
    return () => clearTimeout(t);
  }, []);

  /* Redirect if already logged in */
  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  /* ── Canvas animation ─────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let W, H, dots;

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      dots = Array.from({ length: 40 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.8 + 0.8,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      dots.forEach((d) => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > W) d.vx *= -1;
        if (d.y < 0 || d.y > H) d.vy *= -1;
      });
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 115) {
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.16 * (1 - dist / 115)})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      dots.forEach((d) => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  /* ── Credentials submit ───────────────────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* ── Microsoft SSO ────────────────────────────────────────── */
  function handleMicrosoft() {
    setError("");
    setMsLoading(true);
    window.location.href = "/api/auth/microsoft/login/?next=" + encodeURIComponent(next);
  }

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <>
      <style>{CSS}</style>

      <div className={cx("lp-root", mounted && "lp-mounted")}>

        {/* LEFT — brand panel */}
        <div className="lp-brand">
          <canvas ref={canvasRef} className="lp-canvas" />

          <div className="lp-brand-content">
            <div className="lp-brand-mark"><span>CHPR</span></div>
            <h1 className="lp-brand-name">CHPR</h1>
            <p className="lp-brand-full">
              Centre for Health Promotion<br />and Research
            </p>
            <div className="lp-brand-divider" />
            <p className="lp-brand-tagline">Knowledge Hub video aids, Job aids, Guides etc</p>

            <div className="lp-brand-stats">
              <div className="lp-stat">
                <span className="lp-stat-num">2+</span>
                <span className="lp-stat-label">Projects</span>
              </div>
              <div className="lp-stat-sep" />
              <div className="lp-stat">
                <span className="lp-stat-num">Staff</span>
                <span className="lp-stat-label">Portal</span>
              </div>
              <div className="lp-stat-sep" />
              <div className="lp-stat">
                <span className="lp-stat-num">CMR</span>
                <span className="lp-stat-label">Region</span>
              </div>
            </div>
          </div>

          <Link to="/" className="lp-brand-back">← Back to hub</Link>
        </div>

        {/* RIGHT — form panel */}
        <div className="lp-form-panel">
          <div className="lp-form-wrap">

            {/* Mobile-only logo row */}
            <div className="lp-mobile-logo">
              <div className="lp-brand-mark lp-brand-mark-sm"><span>CH</span></div>
              <span className="lp-mobile-logo-text">CHPR Resources Hub</span>
            </div>

            <div className="lp-form-header">
              <h2 className="lp-form-title">Sign in</h2>
              <p className="lp-form-sub">continue with organization account</p>
            </div>

            {/* Microsoft SSO */}
            <button
              type="button"
              className="lp-ms-btn"
              onClick={handleMicrosoft}
              disabled={msLoading || loading}
            >
              {msLoading ? <span className="lp-spinner" /> : <MsIcon />}
              <span>{msLoading ? "Redirecting…" : "Continue with Microsoft"}</span>
            </button>

            {/* Divider */}
            <div className="lp-divider"><span>or sign in with username</span></div>

            {/* Credentials form */}
            <form onSubmit={handleSubmit} noValidate className="lp-creds-form">
              {error && (
                <div className="lp-error" role="alert">
                  <ErrorIcon /><span>{error}</span>
                </div>
              )}

              <div className="lp-field">
                <label htmlFor="lp-username" className="lp-label">Username</label>
                <div className="lp-input-wrap">
                  <UserIcon className="lp-input-icon" />
                  <input
                    id="lp-username"
                    ref={usernameRef}
                    className="lp-input"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(""); }}
                    placeholder="Your username"
                    required
                  />
                </div>
              </div>

              <div className="lp-field">
                <label htmlFor="lp-password" className="lp-label">Password</label>
                <div className="lp-input-wrap">
                  <LockIcon className="lp-input-icon" />
                  <input
                    id="lp-password"
                    className="lp-input lp-input-pw"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="lp-pw-toggle"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="lp-submit"
                disabled={loading || msLoading}
              >
                {loading
                  ? <><span className="lp-spinner lp-spinner-light" /> Signing in…</>
                  : <>Sign in <ArrowIcon /></>
                }
              </button>
            </form>

            <p className="lp-footer-note">
              This portal is for CHPR staff only.{" "}
              <Link to="/" className="lp-footer-link">Browse public resources →</Link>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}

/* ── Icons ───────────────────────────────────────────────────── */
function MsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}
function UserIcon({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}
function LockIcon({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}
function ErrorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

/* ── CSS ─────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Serif+Display&display=swap');

/* Hide app Nav + Footer when the login page is open */
body.lp-fullscreen-page .nav,
body.lp-fullscreen-page .footer { display: none !important; }

/* Reset margin that the app shell may add */
body.lp-fullscreen-page { margin: 0; padding: 0; }

/* ── Root layout ─────────────────────────────────────────── */
.lp-root {
  display: flex;
  min-height: 100vh;
  font-family: 'DM Sans', sans-serif;
  opacity: 0;
  transition: opacity 0.45s ease;
}
.lp-mounted { opacity: 1; }

/* ── LEFT BRAND PANEL ────────────────────────────────────── */
.lp-brand {
  position: relative;
  width: 42%;
  flex-shrink: 0;
  min-height: 100vh;
  background: linear-gradient(148deg, #081e3f 0%, #0b3566 42%, #0d5c47 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3rem 3.5rem;
  overflow: hidden;
}

.lp-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: block;
}

.lp-brand-content { position: relative; z-index: 1; }

.lp-brand-mark {
  width: 54px;
  height: 54px;
  background: rgba(255,255,255,0.12);
  border: 1.5px solid rgba(255,255,255,0.25);
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  backdrop-filter: blur(6px);
}
.lp-brand-mark span {
  font-family: 'DM Serif Display', serif;
  font-size: 1.2rem;
  color: #fff;
  letter-spacing: 0.04em;
}
.lp-brand-mark-sm { width: 34px; height: 34px; border-radius: 8px; margin-bottom: 0; }
.lp-brand-mark-sm span { font-size: 0.8rem; }

.lp-brand-name {
  font-family: 'DM Serif Display', serif;
  font-size: 3.4rem;
  color: #fff;
  margin: 0 0 0.2rem;
  line-height: 1;
  letter-spacing: -0.02em;
}
.lp-brand-full {
  font-size: 0.93rem;
  color: rgba(255,255,255,0.65);
  margin: 0 0 1.5rem;
  line-height: 1.65;
  font-weight: 300;
}
.lp-brand-divider {
  width: 36px;
  height: 2px;
  background: rgba(255,255,255,0.28);
  margin-bottom: 0.9rem;
}
.lp-brand-tagline {
  font-size: 0.74rem;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0 0 2.8rem;
}
.lp-brand-stats { display: flex; align-items: center; gap: 1.2rem; }
.lp-stat { display: flex; flex-direction: column; gap: 0.18rem; }
.lp-stat-num  { font-size: 1.05rem; font-weight: 600; color: #fff; line-height: 1; }
.lp-stat-label {
  font-size: 0.67rem;
  color: rgba(255,255,255,0.42);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.lp-stat-sep { width: 1px; height: 26px; background: rgba(255,255,255,0.14); }

.lp-brand-back {
  position: absolute;
  bottom: 2rem;
  left: 3.5rem;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.4);
  text-decoration: none;
  z-index: 1;
  transition: color 0.2s;
}
.lp-brand-back:hover { color: rgba(255,255,255,0.82); }

/* ── RIGHT FORM PANEL ────────────────────────────────────── */
.lp-form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 2rem;
  background: #f4f6f9;
  min-height: 100vh;
  box-sizing: border-box;
}

.lp-form-wrap {
  width: 100%;
  max-width: 390px;
  animation: lp-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 0.12s;
}
@keyframes lp-rise {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Mobile logo */
.lp-mobile-logo {
  display: none;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 2rem;
}
.lp-mobile-logo-text {
  font-weight: 600;
  font-size: 0.92rem;
  color: #0a1f3c;
}

/* Form header */
.lp-form-header { margin-bottom: 1.75rem; }
.lp-form-title {
  font-family: 'DM Serif Display', serif;
  font-size: 1.85rem;
  color: #0a1f3c;
  margin: 0 0 0.3rem;
  letter-spacing: -0.02em;
}
.lp-form-sub { font-size: 0.86rem; color: #6b7280; margin: 0; }

/* Microsoft button */
.lp-ms-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  padding: 0.78rem 1rem;
  background: #fff;
  border: 1.5px solid #d1d5db;
  border-radius: 10px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.88rem;
  font-weight: 500;
  color: #111827;
  cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.14s;
  margin-bottom: 1.4rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.lp-ms-btn:hover:not(:disabled) {
  border-color: #0078d4;
  box-shadow: 0 0 0 3px rgba(0,120,212,0.1), 0 2px 8px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}
.lp-ms-btn:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
.lp-ms-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Divider */
.lp-divider {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 1.4rem;
  color: #9ca3af;
  font-size: 0.76rem;
  letter-spacing: 0.03em;
}
.lp-divider::before,
.lp-divider::after { content:''; flex:1; height:1px; background:#e5e7eb; }

/* Fields */
.lp-creds-form { display:flex; flex-direction:column; gap:0.95rem; }
.lp-field      { display:flex; flex-direction:column; gap:0.38rem; }
.lp-label {
  font-size: 0.78rem;
  font-weight: 500;
  color: #374151;
  letter-spacing: 0.025em;
}
.lp-input-wrap { position:relative; display:flex; align-items:center; }
.lp-input-icon {
  position: absolute;
  left: 0.85rem;
  color: #9ca3af;
  pointer-events: none;
  flex-shrink: 0;
}
.lp-input {
  width: 100%;
  padding: 0.72rem 0.85rem 0.72rem 2.5rem;
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 9px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.88rem;
  color: #111827;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
  box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.lp-input::placeholder { color: #c4c9d4; }
.lp-input:focus {
  border-color: #0b3566;
  box-shadow: 0 0 0 3px rgba(11,53,102,0.1);
}
.lp-input-pw { padding-right: 2.7rem; }

.lp-pw-toggle {
  position: absolute;
  right: 0.7rem;
  background: none;
  border: none;
  padding: 0.25rem;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.18s;
  line-height: 0;
}
.lp-pw-toggle:hover { color: #374151; }

/* Error banner */
.lp-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.68rem 0.85rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 0.83rem;
  color: #b91c1c;
  animation: lp-shake 0.32s ease;
}
@keyframes lp-shake {
  0%,100% { transform:translateX(0); }
  20%     { transform:translateX(-5px); }
  60%     { transform:translateX(5px); }
}

/* Submit button */
.lp-submit {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.8rem 1rem;
  background: #0a1f3c;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.91rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.35rem;
  transition: background 0.18s, transform 0.13s, box-shadow 0.18s;
  position: relative;
  overflow: hidden;
}
.lp-submit::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%);
  pointer-events: none;
}
.lp-submit:hover:not(:disabled) {
  background: #0b3566;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(10,31,60,0.28);
}
.lp-submit:active:not(:disabled) { transform:translateY(0); box-shadow:none; }
.lp-submit:disabled { opacity:0.6; cursor:not-allowed; }
.lp-submit svg { transition: transform 0.18s; flex-shrink: 0; }
.lp-submit:hover:not(:disabled) svg { transform: translateX(3px); }

/* Spinner */
.lp-spinner {
  display: inline-block;
  width: 15px;
  height: 15px;
  border: 2px solid rgba(10,31,60,0.18);
  border-top-color: #0a1f3c;
  border-radius: 50%;
  animation: lp-spin 0.65s linear infinite;
  flex-shrink: 0;
}
.lp-spinner-light {
  border-color: rgba(255,255,255,0.28);
  border-top-color: #fff;
}
@keyframes lp-spin { to { transform: rotate(360deg); } }

/* Footer */
.lp-footer-note {
  margin-top: 1.6rem;
  font-size: 0.78rem;
  color: #9ca3af;
  text-align: center;
  line-height: 1.55;
}
.lp-footer-link { color:#0b3566; text-decoration:none; font-weight:500; }
.lp-footer-link:hover { text-decoration:underline; }

/* ── Mobile ──────────────────────────────────────────────── */
@media (max-width: 760px) {
  .lp-brand { display: none; }
  .lp-form-panel {
    background: #fff;
    padding: 2.5rem 1.5rem;
    align-items: flex-start;
  }
  .lp-mobile-logo { display: flex; }
  .lp-form-wrap { max-width: 100%; }
}
`;
