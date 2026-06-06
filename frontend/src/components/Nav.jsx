/**
 * Nav component — updated for auth.
 *
 * Changes from original:
 * - "+ Add Resource" CTA is only shown when the user is logged in.
 * - Right side shows either "Sign in" link or the logged-in username + "Sign out" button.
 * - Logout calls AuthContext.logout() and stays on the current page (or "/" if the
 *   current page is protected, but that's handled by ProtectedRoute).
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Nav() {
  const [q, setQ]       = useState("");
  const { user, logout } = useAuth();
  const navigate        = useNavigate();

  function submitSearch(e) {
    if (e.key === "Enter" && q.trim()) {
      navigate(`/resources?search=${encodeURIComponent(q.trim())}`);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        <div className="nav-logo-mark">CH</div>
        <div className="nav-logo-text">
          CHPR Resources<span>Knowledge Hub</span>
        </div>
      </Link>

      <div className="nav-links">
        <Link to="/resources" className="nav-link">
          All Resources
        </Link>

        {/* Only staff/admin can see the Add Resource shortcut */}
        {user && (
          <Link to="/resources/new" className="nav-link nav-link-cta">
            + Add Resource
          </Link>
        )}
      </div>

      <div className="nav-search">
        <input
          type="text"
          placeholder="Search resources…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={submitSearch}
        />
      </div>

      {/* Auth controls */}
      <div className="nav-auth">
        {user ? (
          <>
            <span className="nav-user">
              {/* Small role badge */}
              <span className="nav-user-role">
                {user.role === "admin" ? "Admin" : "Staff"}
              </span>
              {user.username}
            </span>
            <button className="nav-logout-btn" onClick={handleLogout}>
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login" className="nav-link nav-link-signin">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
