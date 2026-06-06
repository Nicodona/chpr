/**
 * ProtectedRoute
 *
 * Wraps any route that requires login. While the auth context is still
 * resolving the initial /me check (ready=false) we show nothing so the
 * user doesn't see a flash of the login screen. Once ready, unauthenticated
 * visitors are sent to /login with a `next` param so they're redirected back
 * after a successful login.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null; // still resolving — render nothing momentarily

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return children;
}
