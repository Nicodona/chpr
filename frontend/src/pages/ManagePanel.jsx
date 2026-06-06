import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createUser,
  deleteResource,
  fetchProjects,
  updateResource,
} from "../api";

const BASE = import.meta.env.VITE_API_URL ?? "";

function getToken() { return localStorage.getItem("chpr_token"); }

async function authedGet(url) {
  const token = getToken();
  const res = await fetch(`${BASE}${url}`, {
    headers: token ? { Authorization: `Token ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function authedPost(url, body) {
  const token = getToken();
  const csrf  = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith("csrftoken="));
  const csrfToken = csrf ? decodeURIComponent(csrf.split("=")[1]) : "";
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail ?? JSON.stringify(e) ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

async function authedDelete(url) {
  const token = getToken();
  const csrf  = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith("csrftoken="));
  const csrfToken = csrf ? decodeURIComponent(csrf.split("=")[1]) : "";
  const res = await fetch(`${BASE}${url}`, {
    method: "DELETE",
    headers: { "X-CSRFToken": csrfToken, ...(token ? { Authorization: `Token ${token}` } : {}) },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

async function authedPatch(url, body) {
  const token = getToken();
  const csrf  = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith("csrftoken="));
  const csrfToken = csrf ? decodeURIComponent(csrf.split("=")[1]) : "";
  const res = await fetch(`${BASE}${url}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Type / activity labels ──────────────────────────────────────────────────
const TYPE_LABELS = { alg:"Algorithm", job:"Job Aid", vid:"Video", pos:"Poster", expert:"Expert Pool", trunat:"Trunat", hiv:"HIV Pool" };
const ACT_LABELS  = { hf:"Health Facilities", hc:"Health Camps", cr:"All" };

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ num, label, color }) {
  return (
    <div className="mp-stat">
      <span className="mp-stat-num" style={{ color }}>{num}</span>
      <span className="mp-stat-label">{label}</span>
    </div>
  );
}

// ── Quiz editor (inline per-resource) ────────────────────────────────────────
const EMPTY_Q_FORM = { question:"", option_a:"", option_b:"", option_c:"", option_d:"", correct:"a", explanation:"", order:0 };

function QuizEditor({ resourceId }) {
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [form,      setForm]      = useState(EMPTY_Q_FORM);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const loadQs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedGet(`/api/quiz-questions/?resource=${resourceId}`);
      setQuestions(data.results ?? data);
    } catch { setQuestions([]); }
    finally { setLoading(false); }
  }, [resourceId]);

  useEffect(() => { loadQs(); }, [loadQs]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.question.trim() || !form.option_a.trim() || !form.option_b.trim()) {
      setErr("Question, Option A and Option B are required.");
      return;
    }
    setSaving(true); setErr("");
    try {
      await authedPost("/api/quiz-questions/", { ...form, resource: resourceId });
      setForm({ ...EMPTY_Q_FORM, order: questions.length + 1 });
      setAdding(false);
      await loadQs();
    } catch (e) { setErr(e.message || "Failed to save."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this question?")) return;
    try { await authedDelete(`/api/quiz-questions/${id}/`); await loadQs(); }
    catch (e) { alert("Delete failed: " + e.message); }
  }

  return (
    <div className="mp-quiz-editor">
      <div className="mp-quiz-editor-hd">
        <span className="mp-quiz-count">{questions.length} quiz question{questions.length !== 1 ? "s" : ""}</span>
        <button className="mp-btn mp-btn-edit" onClick={() => { setAdding(a => !a); setErr(""); }}>
          {adding ? "Cancel" : "+ Add question"}
        </button>
      </div>

      {loading && <p className="mp-loading">Loading questions…</p>}

      {!loading && questions.map((q, i) => (
        <div key={q.id} className="mp-quiz-q-row">
          <span className="mp-quiz-q-num">{i + 1}</span>
          <div className="mp-quiz-q-main">
            <span className="mp-quiz-q-text">{q.question}</span>
            <div className="mp-quiz-q-opts">
              {["a","b","c","d"].filter(k => q[`option_${k}`]).map(k => (
                <span key={k} className={`mp-quiz-q-opt ${q.correct === k ? "correct" : ""}`}>
                  <strong>{k.toUpperCase()}.</strong> {q[`option_${k}`]}{q.correct === k ? " ✓" : ""}
                </span>
              ))}
            </div>
            {q.explanation && <span className="mp-quiz-q-exp">💡 {q.explanation}</span>}
          </div>
          <button className="mp-btn mp-btn-delete" onClick={() => handleDelete(q.id)}>Delete</button>
        </div>
      ))}

      {adding && (
        <form className="mp-quiz-add-form" onSubmit={handleAdd}>
          <h4 className="mp-quiz-form-title">New question</h4>
          {err && <div className="field-error" style={{display:"block",marginBottom:"0.5rem"}}>{err}</div>}

          <div className="field">
            <label className="field-label">Question <span className="field-required">*</span></label>
            <textarea className="field-textarea" rows={2} value={form.question}
              onChange={e => setForm(f=>({...f, question: e.target.value}))} required />
          </div>
          <div className="field-row-2">
            <div className="field"><label className="field-label">Option A <span className="field-required">*</span></label>
              <input className="field-input" value={form.option_a} onChange={e => setForm(f=>({...f,option_a:e.target.value}))} required /></div>
            <div className="field"><label className="field-label">Option B <span className="field-required">*</span></label>
              <input className="field-input" value={form.option_b} onChange={e => setForm(f=>({...f,option_b:e.target.value}))} required /></div>
          </div>
          <div className="field-row-2">
            <div className="field"><label className="field-label">Option C</label>
              <input className="field-input" value={form.option_c} onChange={e => setForm(f=>({...f,option_c:e.target.value}))} /></div>
            <div className="field"><label className="field-label">Option D</label>
              <input className="field-input" value={form.option_d} onChange={e => setForm(f=>({...f,option_d:e.target.value}))} /></div>
          </div>
          <div className="field-row-2">
            <div className="field"><label className="field-label">Correct answer <span className="field-required">*</span></label>
              <select className="field-select" value={form.correct} onChange={e => setForm(f=>({...f,correct:e.target.value}))}>
                {["a","b","c","d"].map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
              </select></div>
            <div className="field"><label className="field-label">Order</label>
              <input className="field-input" type="number" min={0} value={form.order}
                onChange={e => setForm(f=>({...f,order:parseInt(e.target.value)||0}))} /></div>
          </div>
          <div className="field">
            <label className="field-label">Explanation (optional)</label>
            <textarea className="field-textarea" rows={2} value={form.explanation}
              onChange={e => setForm(f=>({...f,explanation:e.target.value}))}
              placeholder="Explain why the correct answer is right…" />
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:"0.75rem"}}>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Add question"}</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Resources tab ───────────────────────────────────────────────────────────
function ResourcesTab({ projects }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [editId, setEditId]       = useState(null);
  const [editForm, setEditForm]   = useState({});
  const [saving, setSaving]       = useState(false);
  const [delId, setDelId]         = useState(null);
  const [quizId, setQuizId]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedGet("/api/resources/?page_size=200");
      setResources(data.results ?? data);
    } catch { setResources([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = resources.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.project_name || "").toLowerCase().includes(search.toLowerCase())
  );

  function startEdit(r) {
    setEditId(r.id);
    setEditForm({ name: r.name, description: r.description || "", type_key: r.type_key, activity: r.activity, posted_by: r.posted_by || "", project: r.project });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(editForm).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== "") body.append(k, v instanceof File ? v : String(v)); });
      await updateResource(editId, editForm);
      setEditId(null);
      await load();
    } catch (e) { alert("Save failed: " + e.message); }
    finally { setSaving(false); }
  }

  async function confirmDelete(id) {
    try { await deleteResource(id); setDelId(null); await load(); }
    catch (e) { alert("Delete failed: " + e.message); }
  }

  return (
    <div className="mp-tab-content">
      <div className="mp-toolbar">
        <input
          className="mp-search"
          type="text"
          placeholder="Search resources…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Link to="/resources/new" className="btn-primary mp-add-btn">+ Add Resource</Link>
      </div>

      {loading ? (
        <div className="mp-loading">Loading resources…</div>
      ) : filtered.length === 0 ? (
        <div className="mp-empty">No resources found.</div>
      ) : (
        <div className="mp-resource-list">
          {filtered.map(r => (
            <div key={r.id} className={"mp-resource-row" + (editId === r.id ? " mp-row-editing" : "")}>
              <div className="mp-row-main">
                <div className="mp-row-info">
                  <span className="mp-row-name">{r.name}</span>
                  <div className="mp-row-meta">
                    <span className="mp-tag mp-tag-type">{TYPE_LABELS[r.type_key] || r.type_key}</span>
                    <span className="mp-tag">{ACT_LABELS[r.activity] || r.activity}</span>
                    <span className="mp-tag mp-tag-project">{r.project_name}</span>
                    {r.file_url && <a href={r.file_url} target="_blank" rel="noopener" className="mp-tag mp-tag-file">View file ↗</a>}
                  </div>
                </div>
                <div className="mp-row-actions">
                  {editId === r.id ? (
                    <>
                      <button className="mp-btn mp-btn-save" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                      <button className="mp-btn mp-btn-cancel" onClick={() => setEditId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="mp-btn mp-btn-quiz" onClick={() => setQuizId(quizId === r.id ? null : r.id)}>
                        {quizId === r.id ? "Hide Quiz" : "Quiz"}
                      </button>
                      <button className="mp-btn mp-btn-edit" onClick={() => startEdit(r)}>Edit</button>
                      <button className="mp-btn mp-btn-delete" onClick={() => setDelId(r.id)}>Delete</button>
                    </>
                  )}
                </div>
              </div>

              {editId === r.id && (
                <div className="mp-edit-form">
                  <div className="field-row-2">
                    <div className="field">
                      <label className="field-label">Name</label>
                      <input className="field-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label className="field-label">Project</label>
                      <select className="field-select" value={editForm.project} onChange={e => setEditForm(f => ({ ...f, project: e.target.value }))}>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="field-row-2">
                    <div className="field">
                      <label className="field-label">Type</label>
                      <select className="field-select" value={editForm.type_key} onChange={e => setEditForm(f => ({ ...f, type_key: e.target.value }))}>
                        {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Setting</label>
                      <select className="field-select" value={editForm.activity} onChange={e => setEditForm(f => ({ ...f, activity: e.target.value }))}>
                        {Object.entries(ACT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Description</label>
                    <textarea className="field-textarea" rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
              )}

              {delId === r.id && (
                <div className="mp-confirm-delete">
                  <span>Delete <strong>{r.name}</strong>? This cannot be undone.</span>
                  <button className="mp-btn mp-btn-delete" onClick={() => confirmDelete(r.id)}>Yes, delete</button>
                  <button className="mp-btn mp-btn-cancel" onClick={() => setDelId(null)}>Cancel</button>
                </div>
              )}

              {quizId === r.id && <QuizEditor resourceId={r.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Users tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState({ first_name:"", last_name:"", email:"", username:"", role:"staff" });
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState("");
  const [err, setErr]           = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const data = await authedGet("/api/auth/users/");
      setUsers(data);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleCreate(e) {
    e.preventDefault();
    setErr(""); setSuccess("");
    if (!form.email || !form.username) { setErr("Email and username are required."); return; }
    setSaving(true);
    try {
      const created = await createUser(form);
      setSuccess(`Account created for ${created.username}. Credentials sent to ${form.email}.`);
      setForm({ first_name:"", last_name:"", email:"", username:"", role:"staff" });
      await loadUsers();
    } catch(e) { setErr(e.message || "Failed to create user."); }
    finally { setSaving(false); }
  }

  return (
    <div className="mp-tab-content">
      <div className="mp-panel-grid">
        <div className="mp-card">
          <h3 className="mp-card-title">Create New Account</h3>
          <p className="mp-card-sub">A random password will be emailed to the user.</p>
          {err     && <div className="field-error"   style={{display:"block"}}>{err}</div>}
          {success && <div className="field-success" style={{display:"block"}}>{success}</div>}
          <form onSubmit={handleCreate}>
            <div className="field-row-2">
              <div className="field">
                <label className="field-label">First name</label>
                <input className="field-input" value={form.first_name} onChange={e => setForm(f=>({...f,first_name:e.target.value}))} />
              </div>
              <div className="field">
                <label className="field-label">Last name</label>
                <input className="field-input" value={form.last_name} onChange={e => setForm(f=>({...f,last_name:e.target.value}))} />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Email <span className="field-required">*</span></label>
              <input className="field-input" type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="user@chprhealth.org" required />
            </div>
            <div className="field-row-2">
              <div className="field">
                <label className="field-label">Username <span className="field-required">*</span></label>
                <input className="field-input" value={form.username} onChange={e => setForm(f=>({...f,username:e.target.value}))} required />
              </div>
              <div className="field">
                <label className="field-label">Role</label>
                <select className="field-select" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:"1rem"}}>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create account"}</button>
            </div>
          </form>
        </div>

        <div className="mp-card">
          <h3 className="mp-card-title">Existing Users</h3>
          {loading ? <p className="mp-loading">Loading users…</p> : (
            <div className="mp-user-list">
              {users.map(u => (
                <div key={u.id} className="mp-user-row">
                  <div className="mp-user-avatar" style={{ background: u.role === "admin" ? "var(--primary)" : "var(--teal)" }}>
                    {((u.first_name?.[0] ?? "") + (u.last_name?.[0] ?? "")).toUpperCase() || u.username.slice(0,2).toUpperCase()}
                  </div>
                  <div className="mp-user-info">
                    <span className="mp-user-name">{u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}</span>
                    <span className="mp-user-email">{u.email}</span>
                  </div>
                  <span className={`mp-role-badge mp-role-${u.role}`}>{u.role || "staff"}</span>
                </div>
              ))}
              {users.length === 0 && <p className="mp-empty">No users found.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Projects tab ─────────────────────────────────────────────────────────────
const EMPTY_PROJ = {
  name: "", short_name: "", slug: "", description: "",
  color: "#0054A6", light_color: "#e6f1fb", status: "active", order: 0,
};

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_PROJ);
  const [editSlug, setEditSlug] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedGet("/api/projects/");
      setProjects(data.results ?? data);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(p) {
    setEditSlug(p.slug);
    setEditForm({
      name: p.name, short_name: p.short_name || "", description: p.description || "",
      color: p.color || "#0054A6", light_color: p.light_color || "#e6f1fb",
      status: p.status || "active", order: p.order ?? 0,
    });
    setErr("");
  }

  async function saveEdit() {
    setSaving(true); setErr("");
    try {
      await authedPatch(`/api/projects/${editSlug}/`, editForm);
      setEditSlug(null);
      await load();
    } catch (e) { setErr(e.message || "Save failed."); }
    finally { setSaving(false); }
  }

  async function toggleActive(p) {
    try {
      await authedPatch(`/api/projects/${p.slug}/`, { is_active: !p.is_active });
      await load();
    } catch (e) { alert("Update failed: " + e.message); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      setErr("Name and slug are required."); return;
    }
    setSaving(true); setErr("");
    try {
      await authedPost("/api/projects/", createForm);
      setCreateForm(EMPTY_PROJ);
      setCreating(false);
      await load();
    } catch (e) { setErr(e.message || "Create failed."); }
    finally { setSaving(false); }
  }

  return (
    <div className="mp-tab-content">
      <div className="mp-toolbar">
        <span className="mp-count">{projects.length} project{projects.length !== 1 ? "s" : ""}</span>
        <button
          className="btn-primary mp-add-btn"
          onClick={() => { setCreating(c => !c); setErr(""); setCreateForm(EMPTY_PROJ); }}
        >
          {creating ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {creating && (
        <div className="mp-card mp-create-form">
          <h3 className="mp-card-title">New Project</h3>
          {err && <div className="field-error" style={{display:"block",marginBottom:"0.75rem"}}>{err}</div>}
          <form onSubmit={handleCreate}>
            <div className="field-row-2">
              <div className="field">
                <label className="field-label">Name <span className="field-required">*</span></label>
                <input className="field-input" value={createForm.name}
                  onChange={e => {
                    const name = e.target.value;
                    setCreateForm(f => ({
                      ...f, name,
                      slug: (f.slug === slugify(f.name) || !f.slug) ? slugify(name) : f.slug,
                    }));
                  }} required />
              </div>
              <div className="field">
                <label className="field-label">Short Name</label>
                <input className="field-input" value={createForm.short_name}
                  onChange={e => setCreateForm(f => ({...f, short_name: e.target.value}))}
                  placeholder="e.g. BREATHE" />
              </div>
            </div>
            <div className="field-row-2">
              <div className="field">
                <label className="field-label">Slug <span className="field-required">*</span></label>
                <input className="field-input" value={createForm.slug}
                  onChange={e => setCreateForm(f => ({...f, slug: e.target.value}))}
                  placeholder="e.g. breathe" required />
                <span className="field-hint">Lowercase letters, numbers, hyphens — used in URLs</span>
              </div>
              <div className="field">
                <label className="field-label">Status</label>
                <select className="field-select" value={createForm.status}
                  onChange={e => setCreateForm(f => ({...f, status: e.target.value}))}>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="field-label">Description</label>
              <textarea className="field-textarea" rows={2} value={createForm.description}
                onChange={e => setCreateForm(f => ({...f, description: e.target.value}))} />
            </div>
            <div className="field-row-2">
              <div className="field">
                <label className="field-label">Accent color</label>
                <div className="mp-color-row">
                  <input type="color" className="mp-color-pick" value={createForm.color}
                    onChange={e => setCreateForm(f => ({...f, color: e.target.value}))} />
                  <input className="field-input" value={createForm.color}
                    onChange={e => setCreateForm(f => ({...f, color: e.target.value}))} placeholder="#0054A6" />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Light color</label>
                <div className="mp-color-row">
                  <input type="color" className="mp-color-pick" value={createForm.light_color}
                    onChange={e => setCreateForm(f => ({...f, light_color: e.target.value}))} />
                  <input className="field-input" value={createForm.light_color}
                    onChange={e => setCreateForm(f => ({...f, light_color: e.target.value}))} placeholder="#e6f1fb" />
                </div>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:"1rem",gap:"0.5rem"}}>
              <button type="button" className="mp-btn mp-btn-cancel"
                onClick={() => { setCreating(false); setErr(""); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="mp-loading">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="mp-empty">No projects yet. Create your first project above.</div>
      ) : (
        <div className="mp-resource-list">
          {projects.map(p => (
            <div key={p.slug} className={"mp-resource-row" + (editSlug === p.slug ? " mp-row-editing" : "")}>
              <div className="mp-row-main">
                <div className="mp-row-info">
                  <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                    <span className="mp-project-swatch" style={{background: p.color}} />
                    <span className="mp-row-name">{p.name}</span>
                    {p.short_name && <span className="mp-tag">{p.short_name}</span>}
                  </div>
                  <div className="mp-row-meta">
                    <span className="mp-tag mp-tag-type">{p.status}</span>
                    <span className="mp-tag">{p.resource_count} resource{p.resource_count !== 1 ? "s" : ""}</span>
                    <span className="mp-tag" style={{fontFamily:"monospace",fontSize:"0.72rem"}}>/{p.slug}</span>
                    <span className={`mp-tag ${p.is_active ? "mp-tag-active" : "mp-tag-inactive"}`}>
                      {p.is_active ? "Visible" : "Hidden"}
                    </span>
                  </div>
                </div>
                <div className="mp-row-actions">
                  {editSlug === p.slug ? (
                    <>
                      <button className="mp-btn mp-btn-save" onClick={saveEdit} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button className="mp-btn mp-btn-cancel" onClick={() => { setEditSlug(null); setErr(""); }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={`mp-btn ${p.is_active ? "mp-btn-delete" : "mp-btn-save"}`}
                        onClick={() => toggleActive(p)}
                        title={p.is_active ? "Hide from site" : "Show on site"}
                      >
                        {p.is_active ? "Hide" : "Show"}
                      </button>
                      <button className="mp-btn mp-btn-edit" onClick={() => startEdit(p)}>Edit</button>
                    </>
                  )}
                </div>
              </div>

              {editSlug === p.slug && (
                <div className="mp-edit-form">
                  {err && <div className="field-error" style={{display:"block",marginBottom:"0.5rem"}}>{err}</div>}
                  <div className="field-row-2">
                    <div className="field">
                      <label className="field-label">Name</label>
                      <input className="field-input" value={editForm.name}
                        onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
                    </div>
                    <div className="field">
                      <label className="field-label">Short Name</label>
                      <input className="field-input" value={editForm.short_name}
                        onChange={e => setEditForm(f => ({...f, short_name: e.target.value}))} />
                    </div>
                  </div>
                  <div className="field-row-2">
                    <div className="field">
                      <label className="field-label">Status</label>
                      <select className="field-select" value={editForm.status}
                        onChange={e => setEditForm(f => ({...f, status: e.target.value}))}>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Display order</label>
                      <input className="field-input" type="number" min={0} value={editForm.order}
                        onChange={e => setEditForm(f => ({...f, order: parseInt(e.target.value)||0}))} />
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Description</label>
                    <textarea className="field-textarea" rows={2} value={editForm.description}
                      onChange={e => setEditForm(f => ({...f, description: e.target.value}))} />
                  </div>
                  <div className="field-row-2">
                    <div className="field">
                      <label className="field-label">Accent color</label>
                      <div className="mp-color-row">
                        <input type="color" className="mp-color-pick" value={editForm.color}
                          onChange={e => setEditForm(f => ({...f, color: e.target.value}))} />
                        <input className="field-input" value={editForm.color}
                          onChange={e => setEditForm(f => ({...f, color: e.target.value}))} />
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">Light color</label>
                      <div className="mp-color-row">
                        <input type="color" className="mp-color-pick" value={editForm.light_color}
                          onChange={e => setEditForm(f => ({...f, light_color: e.target.value}))} />
                        <input className="field-input" value={editForm.light_color}
                          onChange={e => setEditForm(f => ({...f, light_color: e.target.value}))} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Messages tab ─────────────────────────────────────────────────────────────
function MessagesTab() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all"); // "all" | "unhandled" | "handled"
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedGet("/api/contact/");
      setMessages(data.results ?? data);
    } catch { setMessages([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleHandled(msg) {
    try {
      await authedPatch(`/api/contact/${msg.id}/`, { handled: !msg.handled });
      await load();
    } catch (e) { alert("Update failed: " + e.message); }
  }

  const filtered = messages.filter(m =>
    filter === "all" ? true :
    filter === "handled" ? m.handled :
    !m.handled
  );

  return (
    <div className="mp-tab-content">
      <div className="mp-toolbar">
        <div className="mp-filter-tabs">
          {["all","unhandled","handled"].map(f => (
            <button key={f} className={"mp-filter-tab" + (filter===f ? " active" : "")} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "unhandled" && messages.filter(m=>!m.handled).length > 0 && (
                <span className="mp-badge">{messages.filter(m=>!m.handled).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="mp-loading">Loading messages…</div> : (
        <div className="mp-message-list">
          {filtered.length === 0 && <div className="mp-empty">No messages.</div>}
          {filtered.map(m => (
            <div key={m.id} className={`mp-message-card${m.handled ? " mp-msg-handled" : ""}`}>
              <div className="mp-msg-header" onClick={() => setExpanded(expanded===m.id ? null : m.id)}>
                <div className="mp-msg-from">
                  <span className="mp-msg-name">{m.name}</span>
                  <span className="mp-msg-email">{m.email}</span>
                  {m.team && <span className="mp-tag">{m.team}</span>}
                </div>
                <div className="mp-msg-right">
                  <span className="mp-msg-date">{new Date(m.created_at).toLocaleDateString()}</span>
                  <span className={`mp-status-dot${m.handled ? " handled" : ""}`} title={m.handled ? "Handled" : "Pending"} />
                  <button
                    className={`mp-btn ${m.handled ? "mp-btn-cancel" : "mp-btn-save"}`}
                    onClick={e => { e.stopPropagation(); toggleHandled(m); }}
                  >
                    {m.handled ? "Reopen" : "Mark handled"}
                  </button>
                  <span className="mp-expand-icon">{expanded===m.id ? "▲" : "▼"}</span>
                </div>
              </div>
              {expanded === m.id && (
                <div className="mp-msg-body">
                  <p>{m.message}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ManagePanel() {
  const { user, ready } = useAuth();
  const navigate        = useNavigate();
  const [tab, setTab]   = useState("resources");
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (ready && (!user || user.role !== "admin")) navigate("/", { replace: true });
  }, [ready, user, navigate]);

  useEffect(() => { fetchProjects().then(setProjects).catch(console.error); }, []);

  if (!ready || !user) return null;

  return (
    <main className="main">
      <Link to="/" className="back-link">← Back to Hub</Link>

      <div className="mp-header">
        <div className="mp-header-left">
          <span className="section-eyebrow">Administrator</span>
          <h1 className="mp-title">Management Panel</h1>
        </div>
        <a href="/admin/" target="_blank" rel="noopener noreferrer" className="mp-django-btn">
          Django Admin ↗
        </a>
      </div>

      <div className="mp-tabs">
        {[
          { key:"resources", label:"Resources" },
          { key:"projects",  label:"Projects" },
          { key:"users",     label:"Users" },
          { key:"messages",  label:"Messages" },
        ].map(t => (
          <button
            key={t.key}
            className={"mp-tab" + (tab===t.key ? " active" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resources" && <ResourcesTab projects={projects} />}
      {tab === "projects"  && <ProjectsTab />}
      {tab === "users"     && <UsersTab />}
      {tab === "messages"  && <MessagesTab />}
    </main>
  );
}
