import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import FAQButton from "./components/FAQButton";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import AllResources from "./pages/AllResources";
import ProjectsIndex from "./pages/ProjectsIndex";
import Project from "./pages/Project";
import AddResource from "./pages/AddResource";
import ManagePanel from "./pages/ManagePanel";
import ChangePassword from "./pages/ChangePassword";
import Login from "./pages/Login";
import ResourceDetail from "./pages/ResourceDetail";
import FAQ from "./pages/FAQ";
import { trackVisit } from "./api";

function TrackPageView() {
  const { pathname } = useLocation();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    const userType = !user ? "visitor" : user.role === "admin" ? "admin" : "staff";
    trackVisit(pathname, userType);
  }, [pathname, user, ready]);

  return null;
}

function AppInner() {
  return (
    <>
      <TrackPageView />
      <Nav />
      <div className="app-main">
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/"                element={<Home />} />
        <Route path="/resources"       element={<AllResources />} />
        <Route path="/resources/:id"   element={<ResourceDetail />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/faq"             element={<FAQ />} />

        {/* ── Protected routes (any authenticated user) ── */}
        {/* Projects are staff-only — guests are redirected to login. */}
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:slug"
          element={
            <ProtectedRoute>
              <Project />
            </ProtectedRoute>
          }
        />

        <Route
          path="/account/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* ── Admin-only routes ── */}
        <Route
          path="/resources/new"
          element={
            <ProtectedRoute adminOnly>
              <AddResource />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage"
          element={
            <ProtectedRoute adminOnly>
              <ManagePanel />
            </ProtectedRoute>
          }
        />

        {/* ── Catch-all ── */}
        <Route path="*" element={<Home />} />
      </Routes>
      </div>
      <Footer />
      <FAQButton />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
