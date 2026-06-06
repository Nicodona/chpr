/**
 * App.jsx — updated for auth.
 *
 * Changes from original:
 * - Wrapped in <AuthProvider> so every page/component can useAuth().
 * - /login  → new Login page (public).
 * - /resources/new  → wrapped in <ProtectedRoute> (staff + admin only).
 * - All other routes remain public (view-only).
 */
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import AllResources from "./pages/AllResources";
import Project from "./pages/Project";
import AddResource from "./pages/AddResource";
import Login from "./pages/Login";

export default function App() {
  return (
    <AuthProvider>
      <Nav />
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/"                element={<Home />} />
        <Route path="/resources"       element={<AllResources />} />
        <Route path="/projects/:slug"  element={<Project />} />
        <Route path="/login"           element={<Login />} />

        {/* ── Protected routes (login required) ── */}
        <Route
          path="/resources/new"
          element={
            <ProtectedRoute>
              <AddResource />
            </ProtectedRoute>
          }
        />

        {/* ── Catch-all ── */}
        <Route path="*" element={<Home />} />
      </Routes>
      <Footer />
    </AuthProvider>
  );
}
