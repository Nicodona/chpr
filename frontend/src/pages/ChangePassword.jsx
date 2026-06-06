import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { changePassword } from "../api";

export default function ChangePassword() {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.current_password) return setError("Please enter your current password.");
    if (!form.new_password) return setError("Please enter a new password.");
    if (form.new_password.length < 8) return setError("New password must be at least 8 characters.");
    if (form.new_password !== form.confirm_password)
      return setError("New passwords do not match.");

    setSaving(true);
    try {
      await changePassword(form);
      setSuccess(true);
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <main className="main">
        <div className="form-wrap" style={{ textAlign: "center", paddingTop: "2rem" }}>
          <div className="field-success" style={{ fontSize: "1rem", marginBottom: "1.5rem" }}>
            Your password has been changed successfully.
          </div>
          <button className="btn-primary" onClick={() => navigate("/")}>
            Go to Hub
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <Link to="/" className="back-link">← Back to Hub</Link>

      <div className="section-header">
        <div>
          <span className="section-eyebrow">Account</span>
          <h2 className="section-title">Change Password</h2>
        </div>
      </div>

      <div className="form-wrap">
        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="field-error" style={{ display: "block" }}>{error}</div>}

          <div className="field">
            <label className="field-label">
              Current password <span className="field-required">*</span>
            </label>
            <input
              className="field-input"
              type="password"
              value={form.current_password}
              onChange={(e) => set("current_password", e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="field">
            <label className="field-label">
              New password <span className="field-required">*</span>
            </label>
            <input
              className="field-input"
              type="password"
              value={form.new_password}
              onChange={(e) => set("new_password", e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div className="field">
            <label className="field-label">
              Confirm new password <span className="field-required">*</span>
            </label>
            <input
              className="field-input"
              type="password"
              value={form.confirm_password}
              onChange={(e) => set("confirm_password", e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate("/")}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
