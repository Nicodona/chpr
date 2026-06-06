import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function getCsrfCookie() {
  const match = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith("csrftoken="));
  if (match) return decodeURIComponent(match.split("=")[1]);
  const res = await fetch(`${BASE}/api/csrf/`, { credentials: "include" });
  const data = await res.json();
  return data.csrfToken ?? "";
}

function ContactModal({ user, onClose }) {
  const [form, setForm] = useState({
    name: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username : "",
    email: user?.email ?? "",
    message: "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.message.trim()) { setErr("Please enter a message."); return; }
    setSaving(true);
    setErr("");
    try {
      const csrf = await getCsrfCookie();
      const res = await fetch(`${BASE}/api/contact/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: JSON.stringify({ ...form, team: user?.role || "staff" }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setDone(true);
    } catch {
      setErr("Could not send message. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>Contact Admin</h2>
          <p>Send a message to the system administrator.</p>
        </div>
        {done ? (
          <div className="modal-body" style={{ paddingBottom: "1.5rem" }}>
            <div className="field-success" style={{ display: "block" }}>
              Message sent. An admin will get back to you.
            </div>
            <div className="modal-foot" style={{ paddingTop: "1rem" }}>
              <button className="btn-primary" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {err && <div className="field-error" style={{ display: "block" }}>{err}</div>}
              <div className="field-row-2">
                <div className="field">
                  <label className="field-label">Name</label>
                  <input className="field-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">Email</label>
                  <input className="field-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Message <span className="field-required">*</span></label>
                <textarea className="field-textarea" rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Describe your question or issue…" />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Sending…" : "Send message"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Nav() {
  const [q, setQ]               = useState("");
  const [menuOpen, setMenuOpen]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const { user, logout }        = useAuth();
  const navigate                 = useNavigate();
  const menuRef                  = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function submitSearch(e) {
    if (e.key === "Enter" && q.trim()) {
      navigate(`/resources?search=${encodeURIComponent(q.trim())}`);
    }
  }

  async function handleLogout() {
    setMenuOpen(false);
    setMobileOpen(false);
    await logout();
    navigate("/");
  }

  const initials = user
    ? ((user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "")).toUpperCase() ||
      user.username.slice(0, 2).toUpperCase()
    : "";

  const displayName = user
    ? (user.first_name || user.last_name
        ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
        : user.username)
    : "";

  return (
    <>
      <nav className="nav">
        <Link to="/" className="nav-logo">
          <div className="nav-logo-mark">CH</div>
          <div className="nav-logo-text">
            CHPR Resources<span>Knowledge Hub</span>
          </div>
        </Link>

        <div className="nav-links">
          <Link to="/resources" className="nav-link">All Resources</Link>
        </div>

        <div className="nav-search">
          <input
            type="text"
            placeholder="Search resources…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={submitSearch}
          />
        </div>

        <div className="nav-auth">
          {user ? (
            <div className="nav-user-menu" ref={menuRef}>
              <button
                className="nav-user-trigger"
                onClick={() => setMenuOpen(o => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                <div className="nav-user-avatar" style={{ background: user.role === "admin" ? "var(--primary)" : "var(--teal)" }}>
                  {initials}
                </div>
                <span className="nav-user-name">{displayName}</span>
                <svg className="nav-user-caret-icon" style={{ width:12, height:12, transition:"transform .15s", transform: menuOpen ? "rotate(180deg)" : "none" }} viewBox="0 0 12 12" fill="currentColor">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              </button>

              <div className={["nav-user-dropdown", menuOpen ? "open" : ""].join(" ")}>
                <div className="nav-user-header">
                  <span className="nav-user-header-name">{displayName}</span>
                  <span className="nav-user-header-role">
                    {user.role === "admin" ? "Administrator" : "Staff Member"}
                  </span>
                </div>

                {user.role === "admin" && (
                  <>
                    <Link to="/manage" className="nav-menu-item nav-menu-item-admin" onClick={() => setMenuOpen(false)}>
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{marginRight:8,flexShrink:0}}><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      Admin Panel
                    </Link>
                    <div className="nav-menu-divider" />
                  </>
                )}

                <Link to="/account/change-password" className="nav-menu-item" onClick={() => setMenuOpen(false)}>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{marginRight:8,flexShrink:0}}><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                  Change Password
                </Link>

                <button className="nav-menu-item" onClick={() => { setMenuOpen(false); setContactOpen(true); }}>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{marginRight:8,flexShrink:0}}><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                  Contact Admin
                </button>

                <div className="nav-menu-divider" />

                <button className="nav-menu-item nav-menu-item-danger" onClick={handleLogout}>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{marginRight:8,flexShrink:0}}><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/></svg>
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="nav-guest-btns">
              <button className="nav-contact-guest" onClick={() => setContactOpen(true)}>
                Contact
              </button>
              <Link to="/login" className="nav-cta nav-cta-secondary">Sign in</Link>
            </div>
          )}
        </div>

        {/* ── Mobile hamburger (hidden on desktop) ── */}
        <button
          className="nav-hamburger"
          onClick={() => setMobileOpen(o => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="20" height="20">
              <line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/>
            </svg>
          )}
        </button>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="nav-mobile-drawer">
            <Link to="/resources" className="nav-link" onClick={() => setMobileOpen(false)}>All Resources</Link>
            <div className="nav-menu-divider" />
            {user ? (
              <>
                <div className="nav-mobile-user">
                  <div className="nav-user-avatar" style={{ background: user.role === "admin" ? "var(--primary)" : "var(--teal)" }}>{initials}</div>
                  <div>
                    <div className="nav-mobile-user-name">{displayName}</div>
                    <div className="nav-mobile-user-role">{user.role === "admin" ? "Administrator" : "Staff Member"}</div>
                  </div>
                </div>
                {user.role === "admin" && (
                  <Link to="/manage" className="nav-menu-item nav-menu-item-admin" onClick={() => setMobileOpen(false)}>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{marginRight:8,flexShrink:0}}><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    Admin Panel
                  </Link>
                )}
                <Link to="/account/change-password" className="nav-menu-item" onClick={() => setMobileOpen(false)}>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{marginRight:8,flexShrink:0}}><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                  Change Password
                </Link>
                <button className="nav-menu-item" onClick={() => { setMobileOpen(false); setContactOpen(true); }}>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{marginRight:8,flexShrink:0}}><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                  Contact Admin
                </button>
                <div className="nav-menu-divider" />
                <button className="nav-menu-item nav-menu-item-danger" onClick={handleLogout}>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{marginRight:8,flexShrink:0}}><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/></svg>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button className="nav-menu-item" onClick={() => { setMobileOpen(false); setContactOpen(true); }}>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{marginRight:8,flexShrink:0}}><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                  Contact
                </button>
                <Link to="/login" className="nav-mobile-signin" onClick={() => setMobileOpen(false)}>Sign in</Link>
              </>
            )}
          </div>
        )}
      </nav>

      {contactOpen && <ContactModal user={user} onClose={() => setContactOpen(false)} />}
    </>
  );
}
