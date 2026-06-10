import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUser } from "../api";
import { DEPARTMENT_OPTIONS } from "../constants";

const EMPTY = {
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  role: "staff",
  department: "lab",
};

export default function CreateUser() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.email.trim()) return setError("Email is required.");
    if (!form.username.trim()) return setError("Username is required.");

    setSaving(true);
    try {
      const created = await createUser(form);
      setSuccess(
        `Account created for ${created.first_name || created.username}. ` +
        `A login email has been sent to ${created.email}.`
      );
      setForm(EMPTY);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="main">
      <Link to="/" className="back-link">← Back to Hub</Link>

      <div className="section-header">
        <div>
          <span className="section-eyebrow">Admin</span>
          <h2 className="section-title">Create User Account</h2>
        </div>
      </div>

      <div className="form-wrap">
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          A random password will be generated and emailed to the user. They should
          change it on first login.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="field-error" style={{ display: "block" }}>{error}</div>}
          {success && (
            <div className="field-success">
              {success}{" "}
              <button
                type="button"
                className="btn-link"
                onClick={() => { setSuccess(""); setError(""); }}
              >
                Create another
              </button>
            </div>
          )}

          <div className="form-row">
            <div className="field">
              <label className="field-label">First name</label>
              <input
                className="field-input"
                type="text"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="field">
              <label className="field-label">Last name</label>
              <input
                className="field-input"
                type="text"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Email <span className="field-required">*</span>
            </label>
            <input
              className="field-input"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="user@chprhealth.org"
              required
            />
            <p className="field-hint">The random password will be sent to this address.</p>
          </div>

          <div className="field">
            <label className="field-label">
              Username <span className="field-required">*</span>
            </label>
            <input
              className="field-input"
              type="text"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="e.g. jdoe"
              required
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label">Role</label>
              <select
                className="field-select"
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
              >
                <option value="staff">Staff — can add / edit resources</option>
                <option value="admin">Admin — full access + create users</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label">Department</label>
              <select
                className="field-select"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
              >
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <p className="field-hint">Determines which targeted resources this user can see.</p>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate("/")}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
