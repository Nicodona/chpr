import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchProjects, createResource } from "../api";
import { TYPE_LABELS, POOL_TYPES, AUDIENCE_OPTIONS } from "../constants";

const ACTIVITY_OPTIONS = [
  { value: "hf", label: "Health Facilities" },
  { value: "hc", label: "Health Camps" },
];

const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

const EMPTY = {
  project: "",
  name: "",
  type_key: "job",
  activity: "hf",
  audience: "all",
  description: "",
  posted_by: "",
  test_platform: "",
  sample_type: "",
  pool_size: "",
};

export default function AddResource() {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setError("Could not load projects. Is the backend running?"));
  }, []);

  const isPool = POOL_TYPES.includes(form.type_key);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.project) return setError("Please choose a project.");
    if (!form.name.trim()) return setError("Please enter a resource name.");

    const fields = {
      project: form.project,
      name: form.name.trim(),
      type_key: form.type_key,
      activity: form.activity,
      audience: form.audience,
      description: form.description.trim(),
      posted_by: form.posted_by.trim(),
      file,
    };
    if (isPool) {
      fields.test_platform = form.test_platform.trim();
      fields.sample_type = form.sample_type.trim();
      fields.pool_size = form.pool_size;
    }

    setSaving(true);
    try {
      const created = await createResource(fields);
      setSuccess(`“${created.name}” was added.`);
      setForm({ ...EMPTY, project: form.project, type_key: form.type_key, audience: form.audience });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
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
          <span className="section-eyebrow">Contribute</span>
          <h2 className="section-title">Add a Resource</h2>
        </div>
      </div>

      <div className="form-wrap">
        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="field-error" style={{ display: "block" }}>{error}</div>}
          {success && (
            <div className="field-success">
              {success}{" "}
              <Link to="/resources">View all resources →</Link>
            </div>
          )}

          <div className="field">
            <label className="field-label">
              Project <span className="field-required">*</span>
            </label>
            <select
              className="field-select"
              value={form.project}
              onChange={(e) => set("project", e.target.value)}
              required
            >
              <option value="" disabled>
                {projects.length ? "Select a project…" : "Loading projects…"}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label">
              Name <span className="field-required">*</span>
            </label>
            <input
              className="field-input"
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Enter the resource title"
              required
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label">Type</label>
              <select
                className="field-select"
                value={form.type_key}
                onChange={(e) => set("type_key", e.target.value)}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Setting</label>
              <select
                className="field-select"
                value={form.activity}
                onChange={(e) => set("activity", e.target.value)}
              >
                {ACTIVITY_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Target users</label>
            <select
              className="field-select"
              value={form.audience}
              onChange={(e) => set("audience", e.target.value)}
            >
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <p className="field-hint">
              Who can see this resource. “Everyone” is public; the rest are shown only to staff in the matching department (admins always see all).
            </p>
          </div>

          <div className="field">
            <label className="field-label">Description</label>
            <textarea
              className="field-textarea"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Short description of the resource…"
            />
          </div>

          {isPool && (
            <div className="form-row form-row-3">
              <div className="field">
                <label className="field-label">Test platform</label>
                <input
                  className="field-input"
                  type="text"
                  value={form.test_platform}
                  onChange={(e) => set("test_platform", e.target.value)}
                  placeholder="e.g. GeneXpert"
                />
              </div>
              <div className="field">
                <label className="field-label">Sample type</label>
                <input
                  className="field-input"
                  type="text"
                  value={form.sample_type}
                  onChange={(e) => set("sample_type", e.target.value)}
                  placeholder="e.g. sputum"
                />
              </div>
              <div className="field">
                <label className="field-label">Pool size</label>
                <input
                  className="field-input"
                  type="number"
                  min="1"
                  value={form.pool_size}
                  onChange={(e) => set("pool_size", e.target.value)}
                  placeholder="e.g. 4"
                />
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label">File (optional)</label>
            <div className="field-file">
              <button
                type="button"
                className="field-file-btn"
                onClick={() => fileInput.current?.click()}
              >
                Choose file
              </button>
              <span className="field-file-name">{file ? file.name : "No file selected"}</span>
              <input
                ref={fileInput}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <p className="field-hint">PDF, image, or video. Leave empty for a reference-only entry.</p>
          </div>

          <div className="field">
            <label className="field-label">Posted by (optional)</label>
            <input
              className="field-input"
              type="text"
              value={form.posted_by}
              onChange={(e) => set("posted_by", e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate("/resources")}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Add resource"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
