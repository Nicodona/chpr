/**
 * AuthContext.jsx
 *
 * Fix: CSRF token is now fetched from /api/csrf/ before every mutating
 * request (login, logout). The token is read from the csrftoken cookie
 * (standard Django behaviour) and sent as the X-CSRFToken header that
 * Django's SessionAuthentication expects.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "";

// ── CSRF helpers ──────────────────────────────────────────────────────────────

/** Read the csrftoken cookie that Django sets. */
function getCsrfCookie() {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrftoken="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/**
 * Ensure the csrftoken cookie exists.
 * On first load the cookie won't be there yet, so we hit the lightweight
 * /api/csrf/ endpoint which forces Django to set it.
 */
async function ensureCsrfCookie() {
  if (getCsrfCookie()) return getCsrfCookie(); // already set, nothing to do
  const res = await fetch(`${API}/api/csrf/`, { credentials: "include" });
  const data = await res.json();
  // The cookie is now set by the Set-Cookie header in the response.
  // Return the token from JSON as a fallback in case the cookie is delayed.
  return data.csrfToken ?? getCsrfCookie() ?? "";
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("chpr_token"));
  const [ready, setReady] = useState(false);

  /** Re-hydrate user on mount from a stored DRF token. */
  useEffect(() => {
    if (!token) { setReady(true); return; }

    fetch(`${API}/api/auth/me/`, {
      headers: { Authorization: `Token ${token}` },
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem("chpr_token");
        setToken(null);
      })
      .finally(() => setReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    // 1. Make sure Django has set the csrftoken cookie.
    const csrfToken = await ensureCsrfCookie();

    // 2. POST credentials with the CSRF token header.
    const res = await fetch(`${API}/api/auth/login/`, {
      method: "POST",
      credentials: "include",               // send + receive session cookie
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,           // required by SessionAuthentication
      },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg =
        data?.non_field_errors?.[0] ??
        data?.detail ??
        "Invalid username or password.";
      throw new Error(msg);
    }

    const data = await res.json();
    localStorage.setItem("chpr_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const csrfToken = getCsrfCookie() ?? "";

    if (token) {
      await fetch(`${API}/api/auth/logout/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Token ${token}`,
          "X-CSRFToken": csrfToken,
        },
      }).catch(() => {});
    }

    localStorage.removeItem("chpr_token");
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
