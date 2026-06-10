const BASE = import.meta.env.VITE_API_URL ?? "";

// ── helpers ──────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem("chpr_token");
}

/**
 * Headers for public GET requests that should still identify the user when
 * logged in. The backend uses this to scope resources to the user's
 * department; anonymous callers just get the public (audience=all) resources.
 */
function optionalAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

/** Read the csrftoken cookie Django sets. */
function getCsrfCookie() {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrftoken="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/**
 * Fetch the CSRF token from the server if the cookie isn't set yet.
 * This is rare after first login but guards against cold-start edge cases.
 */
async function ensureCsrfToken() {
  const existing = getCsrfCookie();
  if (existing) return existing;
  const res = await fetch(`${BASE}/api/csrf/`, { credentials: "include" });
  const data = await res.json();
  return data.csrfToken ?? getCsrfCookie() ?? "";
}

/**
 * Wrapper around fetch that injects the auth token and CSRF token.
 * Every mutating request (POST/PATCH/PUT/DELETE) needs both so that
 * DRF's SessionAuthentication CSRF check passes.
 */
async function authedFetch(url, options = {}) {
  const token = getToken();
  const csrfToken = await ensureCsrfToken();
  const headers = { ...(options.headers ?? {}) };
  if (token) headers["Authorization"] = `Token ${token}`;
  headers["X-CSRFToken"] = csrfToken;

  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message =
        data?.detail ??
        Object.values(data).flat().join(" ") ??
        message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  // 204 No Content has no body
  if (res.status === 204) return null;
  return res.json();
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function fetchProjects() {
  const res = await fetch(`${BASE}/api/projects/`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  const data = await res.json();
  return data.results ?? data;
}

export async function fetchProject(slug) {
  const res = await fetch(`${BASE}/api/projects/${slug}/`);
  if (!res.ok) throw new Error("Failed to fetch project");
  return res.json();
}

// ── Resources ─────────────────────────────────────────────────────────────────

/**
 * Fetch resources with optional filters.
 * @param {{ type?: string, project?: string, activity?: string, search?: string }} params
 */
export async function fetchResources(params = {}) {
  const qs = new URLSearchParams();
  if (params.type && params.type !== "all")         qs.set("type",     params.type);
  if (params.project && params.project !== "all")   qs.set("project",  params.project);
  if (params.activity && params.activity !== "all") qs.set("activity", params.activity);
  if (params.search)                                qs.set("search",   params.search);

  const url = `/api/resources/${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(`${BASE}${url}`, {
    headers: optionalAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch resources");
  const data = await res.json();
  return data.results ?? data;
}

/**
 * Create a new resource (requires authentication).
 * Sends as multipart/form-data so file uploads work.
 */
export async function createResource(fields) {
  const body = new FormData();

  // Append every non-null, non-empty field.
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    // Files are appended directly; everything else is stringified.
    body.append(key, value instanceof File ? value : String(value));
  }

  return authedFetch("/api/resources/", {
    method: "POST",
    // Do NOT set Content-Type — the browser sets it with the correct boundary
    // when using FormData.
    body,
  });
}

/**
 * Update an existing resource (requires authentication).
 */
export async function updateResource(id, fields) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    body.append(key, value instanceof File ? value : String(value));
  }
  return authedFetch(`/api/resources/${id}/`, { method: "PATCH", body });
}

/**
 * Delete a resource (requires authentication).
 */
export async function deleteResource(id) {
  await authedFetch(`/api/resources/${id}/`, { method: "DELETE" });
}

// ── User management ───────────────────────────────────────────────────────────

/**
 * Admin creates a new staff/admin account.
 * The server generates a random password and emails it to the user.
 */
export async function createUser(fields) {
  return authedFetch("/api/auth/create-user/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

/**
 * Authenticated user changes their own password.
 */
export async function changePassword(fields) {
  return authedFetch("/api/auth/change-password/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function listUsers() {
  return authedFetch("/api/auth/users/");
}

export async function fetchMessages() {
  return authedFetch("/api/contact/");
}

export async function patchMessage(id, fields) {
  return authedFetch(`/api/contact/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

// ── Resource detail ───────────────────────────────────────────────────────────

export async function fetchResource(id) {
  const res = await fetch(`${BASE}/api/resources/${id}/`, {
    headers: optionalAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Resource not found");
  return res.json();
}

export async function fetchComments(resourceId) {
  const res = await fetch(`${BASE}/api/comments/?resource=${resourceId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch comments");
  const data = await res.json();
  return data.results ?? data;
}

export async function postComment(fields) {
  return authedFetch("/api/comments/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function fetchQuizQuestions(resourceId) {
  const res = await fetch(`${BASE}/api/quiz-questions/?resource=${resourceId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch questions");
  const data = await res.json();
  return data.results ?? data;
}

export async function createQuizQuestion(fields) {
  return authedFetch("/api/quiz-questions/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function updateQuizQuestion(id, fields) {
  return authedFetch(`/api/quiz-questions/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export async function deleteQuizQuestion(id) {
  await authedFetch(`/api/quiz-questions/${id}/`, { method: "DELETE" });
}

export async function submitQuiz(resourceId, answers) {
  return authedFetch(`/api/resources/${resourceId}/submit-quiz/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export async function fetchFAQs() {
  const res = await fetch(`${BASE}/api/faq/`);
  if (!res.ok) throw new Error("Failed to fetch FAQs");
  const data = await res.json();
  return data.results ?? data;
}

// ── Analytics & Tracking ──────────────────────────────────────────────────────

function getSessionKey() {
  let key = sessionStorage.getItem("chpr_session");
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem("chpr_session", key);
  }
  return key;
}

export async function trackVisit(page, userType = "visitor") {
  try {
    await fetch(`${BASE}/api/analytics/track/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ page, user_type: userType, session_key: getSessionKey() }),
    });
  } catch {
    // tracking errors must never break the UI
  }
}

export async function trackInteraction(resourceId, interactionType, userType = "visitor") {
  try {
    await fetch(`${BASE}/api/analytics/interaction/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        resource: resourceId,
        interaction_type: interactionType,
        user_type: userType,
        session_key: getSessionKey(),
      }),
    });
  } catch {
    // tracking errors must never break the UI
  }
}

export async function fetchAnalytics(period = "last_7_days") {
  return authedFetch(`/api/analytics/?period=${period}`);
}
