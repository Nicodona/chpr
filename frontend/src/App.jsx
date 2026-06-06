import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import AllResources from "./pages/AllResources";
import Project from "./pages/Project";
import AddResource from "./pages/AddResource";
import ManagePanel from "./pages/ManagePanel";
import ChangePassword from "./pages/ChangePassword";
import Login from "./pages/Login";
import ResourceDetail from "./pages/ResourceDetail";

export default function App() {
  return (
    <AuthProvider>
      <Nav />
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/"                element={<Home />} />
        <Route path="/resources"       element={<AllResources />} />
        <Route path="/resources/:id"   element={<ResourceDetail />} />
        <Route path="/projects/:slug"  element={<Project />} />
        <Route path="/login"           element={<Login />} />

        {/* ── Protected routes (any authenticated user) ── */}
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
      <Footer />
    </AuthProvider>
  );
}
