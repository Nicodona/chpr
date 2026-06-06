/**
 * api.js — centralised fetch helpers.
 *
 * Changes from original:
 * - `authedFetch()` reads the DRF token from localStorage and adds the
 *   `Authorization: Token …` header automatically so callers don't have
 *   to think about it.
 * - `createResource()` now uses authedFetch (POST requires authentication).
 * - All GET helpers remain public (no auth needed).
 */

const BASE = import.meta.env.VITE_API_URL ?? "";

// ── helpers ──────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem("chpr_token");
}

/** Wrapper around fetch that injects the auth token when present. */
async function authedFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers ?? {}) };
  if (token) headers["Authorization"] = `Token ${token}`;

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
  const res = await fetch(`${BASE}${url}`);
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
  const token = getToken();
  const headers = {};
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetch(`${BASE}/api/resources/${id}/`, {
    method: "DELETE",
    headers,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  // 204 No Content — nothing to parse.
}
