// Defensive fallback so data.js still works if js/i18n.js failed to load.
// (On every page i18n.js is included BEFORE this file, so these are normally
// the real implementations.)
if (typeof t === "undefined") {
  window.t = (k, vars) => (vars && typeof k === "string" ? k : k);
  window.tCount = (n) => `${n} resource${n !== 1 ? "s" : ""}`;
  window.getLang = () => "en";
  window.setLang = () => {};
  window.applyI18n = () => {};
}

const PROJECTS = [
  {
    id: "breathe",
    name: "BREATHE Cameroon",
    shortName: "BREATHE",
    description: "Evidence-based clinical algorithms, job aids, and specialized respiratory health resources for screening and diagnosis.",
    color: "#0054A6",
    lightColor: "#e6f1fb",
    status: "active",
    page: "breathe.html",
  },
  {
    id: "prompttb",
    name: "PROMPT TB",
    shortName: "PROMPT TB",
    description: "TB diagnostics, community detection algorithms, and field tools supporting active case finding across sites.",
    color: "#0f6e56",
    lightColor: "#e1f5ee",
    status: "active",
    page: "prompttb.html",
  }
];

// ---------- Project status (active / completed) ----------
// The admin panel writes project statuses to this localStorage key; the public
// site reads them here so a project marked "completed" in admin shows that way
// on the hub. Keys are project ids ("breathe", "prompttb").
const PROJECT_STATUS_KEY = "chpr_project_status";
(function hydrateProjectStatus() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(PROJECT_STATUS_KEY)) || {}; }
  catch { stored = {}; }
  for (const p of PROJECTS) {
    if (stored[p.id] === "completed" || stored[p.id] === "active") p.status = stored[p.id];
  }
})();
function projectStatus(id) {
  const p = PROJECTS.find(x => x.id === id);
  return p ? p.status : "active";
}
// Localized status label ("Active" / "Completed").
function statusLabel(status) {
  return t(status === "completed" ? "status.completed" : "status.active");
}

const RESOURCES = [
  // BREATHE
  { id: 1, project: "breathe", projectName: "BREATHE Cameroon", name: "Adult Respiratory Screening Algorithm", type: "Algorithm", typeKey: "alg", activity: "hf", url: "#" },
  { id: 2, project: "breathe", projectName: "BREATHE Cameroon", name: "Paediatric Respiratory Screening Algorithm", type: "Algorithm", typeKey: "alg", activity: "hf", url: "#" },
  { id: 3, project: "breathe", projectName: "BREATHE Cameroon", name: "Health Camp Screening Job Aid", type: "Job Aid", typeKey: "job", activity: "hc", url: "#" },
  { id: 4, project: "breathe", projectName: "BREATHE Cameroon", name: "Spirometry Operating Job Aid", type: "Job Aid", typeKey: "job", activity: "hf", url: "#" },
  { id: 5, project: "breathe", projectName: "BREATHE Cameroon", name: "Asthma Awareness Community Poster", type: "Poster", typeKey: "pos", activity: "hc", url: "#" },
  { id: 6, project: "breathe", projectName: "BREATHE Cameroon", name: "Auscultation Technique Training Video", type: "Video", typeKey: "vid", activity: "hf", url: "#" },
  { id: 7, project: "breathe", projectName: "BREATHE Cameroon", name: "COPD Management Job Aid", type: "Job Aid", typeKey: "job", activity: "hf", url: "#" },

  // PROMPT TB
  { id: 8, project: "prompttb", projectName: "PROMPT TB", name: "TB Case Detection Algorithm", type: "Algorithm", typeKey: "alg", activity: "hf", url: "#" },
  { id: 9, project: "prompttb", projectName: "PROMPT TB", name: "Community Screening Job Aid", type: "Job Aid", typeKey: "job", activity: "hc", url: "#" },
  { id: 10, project: "prompttb", projectName: "PROMPT TB", name: "Sputum Collection Job Aid", type: "Job Aid", typeKey: "job", activity: "hf", url: "#" },
  { id: 11, project: "prompttb", projectName: "PROMPT TB", name: "TB Awareness Community Poster", type: "Poster", typeKey: "pos", activity: "hc", url: "#" },
  { id: 12, project: "prompttb", projectName: "PROMPT TB", name: "Contact Tracing Algorithm", type: "Algorithm", typeKey: "alg", activity: "hc", url: "#" },
  { id: 13, project: "prompttb", projectName: "PROMPT TB", name: "PAL Resources Navigation Guide", type: "Job Aid", typeKey: "job", activity: "hf", url: "#" },

  // ---- Pool testing (Expert Pool / Trunat / HIV Pool) ----
  { id: 14, project: "prompttb", projectName: "PROMPT TB", name: "Xpert MTB/RIF Pooled Testing Protocol", type: "Expert Pool", typeKey: "expert", activity: "hf", url: "#" },
  { id: 15, project: "prompttb", projectName: "PROMPT TB", name: "Truenat Pooled Sample Workflow", type: "Trunat", typeKey: "trunat", activity: "hf", url: "#" },
  { id: 16, project: "prompttb", projectName: "PROMPT TB", name: "HIV Pooled Viral Load Testing Algorithm", type: "HIV Pool", typeKey: "hiv", activity: "hf", url: "#" },
  { id: 17, project: "breathe", projectName: "BREATHE Cameroon", name: "Sputum Pooling for Xpert — Expert Pool Guide", type: "Expert Pool", typeKey: "expert", activity: "hf", url: "#" },
];

// Type key to CSS class map. The three pool-testing categories (Expert Pool,
// Trunat, HIV Pool) are first-class resource types alongside the originals.
const TYPE_CLASS = { alg: "type-alg", job: "type-job", vid: "type-vid", pos: "type-pos", expert: "type-expert", trunat: "type-trunat", hiv: "type-hiv" };
const TYPE_LABEL = { alg: "Algorithm", job: "Job Aid", vid: "Video", pos: "Poster", expert: "Expert Pool", trunat: "Trunat", hiv: "HIV Pool" };
// The pool-testing categories, used by the "Pool Tests" quick link to show all three at once.
const POOL_TYPES = ["expert", "trunat", "hiv"];
function isPoolType(typeKey) { return POOL_TYPES.includes(typeKey); }
// Localized resource-type label by type key (falls back to the English map).
function typeLabel(typeKey) {
  const key = `type.${typeKey}`;
  const translated = t(key);
  return translated === key ? (TYPE_LABEL[typeKey] || typeKey) : translated;
}

// ---------- User-posted resource store (localStorage) ----------
const USER_RES_KEY = "chpr_user_resources";

function loadUserResources() {
  try { return JSON.parse(localStorage.getItem(USER_RES_KEY)) || []; }
  catch { return []; }
}
function saveUserResources(list) {
  localStorage.setItem(USER_RES_KEY, JSON.stringify(list));
}

// Merge persisted user-posted resources into the live RESOURCES array on script load
(function hydrateUserResources() {
  const stored = loadUserResources();
  for (const r of stored) {
    if (!RESOURCES.some(x => String(x.id) === String(r.id))) RESOURCES.push(r);
  }
})();

function getResourceById(id) {
  return RESOURCES.find(r => String(r.id) === String(id));
}

// ---------- Shared sample assets (used as a stand-in for every seeded resource) ----------
// In this prototype every seeded document resource opens the same PDF, and
// every seeded video resource opens the same MP4. Paths resolve correctly from
// both the root (index.html) and pages/* depth.
const SAMPLE_PDF_FILE = "JA on how to use QR code.pdf";
const SAMPLE_VIDEO_FILE = "Video Aid on how to use QR code.mp4";

function _assetPrefix() {
  const inPagesDir = location.pathname.replace(/\\/g, "/").includes("/pages/");
  return inPagesDir ? "../" : "";
}
function samplePdfUrl() { return _assetPrefix() + encodeURI(SAMPLE_PDF_FILE); }
function sampleVideoUrl() { return _assetPrefix() + encodeURI(SAMPLE_VIDEO_FILE); }

// True when the resource has no uploaded asset and should fall back to the sample PDF
function shouldUseSamplePdf(r) {
  return !r.dataUrl;
}

// Lazily load PDF.js from CDN on first use. Worker is configured to the same CDN.
const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
let _pdfjsPromise = null;

function loadPdfJs() {
  if (window.pdfjsLib) {
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
    }
    return Promise.resolve(window.pdfjsLib);
  }
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS_CDN;
    s.onload = () => {
      if (!window.pdfjsLib) { reject(new Error("pdfjsLib failed to expose")); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(s);
  });
  return _pdfjsPromise;
}

// Cache each PDF's rendered first-page thumbnail by source URL, so a given PDF
// is only put through PDF.js once even when it appears on many tiles.
const _pdfThumbCache = new Map();    // pdfUrl -> data URL of the first page
const _pdfThumbPromises = new Map(); // pdfUrl -> in-flight render promise

// PDF.js accepts a plain URL string, but an uploaded PDF arrives as a (possibly
// large) data: URL — decode those to bytes so rendering doesn't depend on a
// fetch of the data URI.
function _pdfDocSource(pdfUrl) {
  if (typeof pdfUrl === "string" && pdfUrl.startsWith("data:")) {
    const base64 = pdfUrl.slice(pdfUrl.indexOf(",") + 1);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { data: bytes };
  }
  return pdfUrl;
}

function renderPdfThumbToDataUrl(pdfUrl) {
  if (_pdfThumbCache.has(pdfUrl)) return Promise.resolve(_pdfThumbCache.get(pdfUrl));
  if (_pdfThumbPromises.has(pdfUrl)) return _pdfThumbPromises.get(pdfUrl);

  const promise = (async () => {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument(_pdfDocSource(pdfUrl)).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    _pdfThumbCache.set(pdfUrl, dataUrl);
    return dataUrl;
  })().catch(err => { _pdfThumbPromises.delete(pdfUrl); throw err; });

  _pdfThumbPromises.set(pdfUrl, promise);
  return promise;
}

// After tiles render, fill each <img class="tile-pdf-img"> with the first page
// of its own PDF (data-pdf-url). Images are grouped by source so each distinct
// PDF is rendered once and shared across any tiles that point at it.
function initPdfThumbs() {
  const els = document.querySelectorAll("img.tile-pdf-img[data-pdf-url]");
  if (!els.length) return;
  const byUrl = new Map();
  els.forEach(el => {
    const url = el.dataset.pdfUrl;
    if (!url) return;
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(el);
  });
  byUrl.forEach((imgs, url) => {
    renderPdfThumbToDataUrl(url).then(dataUrl => {
      imgs.forEach(el => { el.src = dataUrl; el.classList.add("tile-pdf-img-ready"); });
    }).catch(() => {
      // PDF.js unavailable or this PDF failed — leave the CSS document fallback visible
    });
  });
}

// ---------- Resource comments (localStorage, keyed by resource id) ----------
const RES_COMMENTS_KEY = "chpr_resource_comments";

function _readResComments() {
  try { return JSON.parse(localStorage.getItem(RES_COMMENTS_KEY)) || {}; }
  catch { return {}; }
}
function _writeResComments(map) {
  localStorage.setItem(RES_COMMENTS_KEY, JSON.stringify(map));
}

function getResourceComments(resourceId) {
  const all = _readResComments();
  return all[String(resourceId)] || [];
}

function addResourceComment(resourceId, { body, authorUsername, authorName, authorRole, authorColor, authorInitials }) {
  const all = _readResComments();
  const key = String(resourceId);
  const list = all[key] || [];
  const comment = {
    id: `c${Date.now()}${Math.floor(Math.random() * 1000)}`,
    body: String(body || "").trim(),
    authorUsername, authorName, authorRole, authorColor, authorInitials,
    date: new Date().toISOString(),
  };
  list.push(comment);
  all[key] = list;
  _writeResComments(all);
  return comment;
}

function addUserResource({ name, project, typeKey, description, dataUrl, mimeType, fileName, postedBy }) {
  const proj = PROJECTS.find(p => p.id === project);
  const id = `u${Date.now()}`;
  const resource = {
    id,
    project,
    projectName: proj?.name || project,
    name: name.trim(),
    type: TYPE_LABEL[typeKey] || typeKey,
    typeKey,
    activity: "hf",
    url: viewerHref(id),
    description: (description || "").trim(),
    dataUrl: dataUrl || null,
    mimeType: mimeType || null,
    fileName: fileName || null,
    postedBy: postedBy || null,
    postedAt: new Date().toISOString(),
    isUserPosted: true,
  };
  RESOURCES.push(resource);
  const stored = loadUserResources();
  stored.push(resource);
  saveUserResources(stored);
  return resource;
}

// Compute the viewer URL relative to the current page (root vs pages/*)
function viewerHref(id) {
  const inPagesDir = location.pathname.replace(/\\/g, "/").includes("/pages/");
  return `${inPagesDir ? "" : "pages/"}viewer.html?id=${encodeURIComponent(id)}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Build the visual thumbnail at the top of each tile.
// Uploaded videos/images get their actual preview; seeded video resources use
// the shared sample video; everything else falls back to the shared sample
// PDF's first page (rendered by initPdfThumbs).
function buildTileThumb(r) {
  const isUploadedVideo = r.mimeType && r.mimeType.startsWith("video/");
  const isImage = r.mimeType && r.mimeType.startsWith("image/");
  const isSeededVideo = !r.dataUrl && r.typeKey === "vid";

  if (r.dataUrl && isUploadedVideo) {
    return `
      <div class="tile-thumb tile-thumb-video">
        <video class="tile-thumb-img" muted preload="metadata" src="${r.dataUrl}#t=0.5"></video>
        <div class="tile-thumb-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <span class="tile-thumb-tag">VIDEO</span>
      </div>`;
  }

  if (isSeededVideo) {
    return `
      <div class="tile-thumb tile-thumb-video">
        <video class="tile-thumb-img" muted preload="metadata" src="${sampleVideoUrl()}#t=0.5"></video>
        <div class="tile-thumb-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <span class="tile-thumb-tag">VIDEO</span>
      </div>`;
  }

  if (r.dataUrl && isImage) {
    return `
      <div class="tile-thumb tile-thumb-doc">
        <img src="${r.dataUrl}" alt="" class="tile-thumb-img"/>
      </div>`;
  }

  // Default: show the first page of the resource's PDF as the preview. An
  // uploaded PDF samples its own file; seeded documents fall back to the shared
  // sample PDF. The <img> is populated by initPdfThumbs() once PDF.js finishes;
  // until then the CSS document mock underneath is shown as a graceful fallback.
  const isUploadedPdf = r.dataUrl && r.mimeType === "application/pdf";
  const pdfUrl = isUploadedPdf ? r.dataUrl : samplePdfUrl();
  return `
    <div class="tile-thumb tile-thumb-pdf">
      <div class="tile-doc-page tile-doc-page-fallback">
        <div class="tile-doc-corner"></div>
        <div class="tile-doc-header"></div>
        <div class="tile-doc-line"></div>
        <div class="tile-doc-line short"></div>
        <div class="tile-doc-line"></div>
        <div class="tile-doc-line medium"></div>
        <div class="tile-doc-line"></div>
        <div class="tile-doc-line short"></div>
      </div>
      <img class="tile-pdf-img" data-pdf-url="${pdfUrl}" alt="${escapeHtml(r.name)} preview" loading="lazy"/>
      <span class="tile-thumb-tag tile-thumb-tag-pdf">PDF</span>
    </div>`;
}

// Build a resource tile HTML string (card layout)
function buildResourceTile(r, showProject = true) {
  const href = viewerHref(r.id);
  const proj = PROJECTS.find(p => p.id === r.project);
  const accent = proj?.color || "var(--primary)";
  const description = r.description ? `<p class="tile-desc">${escapeHtml(r.description)}</p>` : "";
  const postedTag = r.isUserPosted ? `<span class="tile-posted">Posted by ${escapeHtml(r.postedBy || "team")}</span>` : "";
  return `
    <a href="${href}" class="resource-tile" style="--tile-accent:${accent}">
      ${buildTileThumb(r)}
      <div class="tile-body">
        <span class="res-type-badge ${TYPE_CLASS[r.typeKey]}">${escapeHtml(typeLabel(r.typeKey))}</span>
        <h3 class="tile-title">${escapeHtml(r.name)}</h3>
        ${showProject ? `<span class="tile-project">${escapeHtml(r.projectName)}</span>` : ""}
        ${description}
        ${postedTag}
      </div>
    </a>`;
}

// Render an array of resources as a tile grid
function renderResourceTiles(items, showProject = true) {
  if (!items.length) {
    return `<div class="empty-state"><p>No resources match the selected filters.</p></div>`;
  }
  const html = `<div class="resources-grid">${items.map(r => buildResourceTile(r, showProject)).join("")}</div>`;
  // Defer to next frame so the markup is in the DOM before we hydrate PDF previews
  requestAnimationFrame(() => { try { initPdfThumbs(); } catch (_) {} });
  return html;
}

// Backwards-compatible alias for older calls
const buildResourceRow = buildResourceTile;

// Read the current public-site session user (set by the internal login)
function navGetUser() {
  try { return JSON.parse(sessionStorage.getItem("chpr_user")); }
  catch { return null; }
}

// Logout from the public nav: clear session and reload current page so the nav re-renders
function navLogout() {
  sessionStorage.removeItem("chpr_user");
  window.location.reload();
}

// Language switcher inside the signed-in user dropdown (matches the
// "Language: ◉ English ○ Français" affordance requested under the user icon).
function renderLangMenuRow() {
  const lang = getLang();
  return `
    <div class="nav-menu-divider"></div>
    <div class="nav-lang-row">
      <span class="nav-lang-label">${t("nav.language")}</span>
      <div class="nav-lang-toggle" role="group" aria-label="${t("nav.language")}">
        <button type="button" class="nav-lang-opt ${lang === "en" ? "active" : ""}" onclick="setLang('en')">English</button>
        <button type="button" class="nav-lang-opt ${lang === "fr" ? "active" : ""}" onclick="setLang('fr')">Français</button>
      </div>
    </div>`;
}

// Compact globe toggle shown in the nav for visitors who aren't signed in
// (they have no user icon, but should still be able to switch language).
function renderLangGlobe() {
  const lang = getLang();
  const next = lang === "en" ? "fr" : "en";
  return `
    <button type="button" class="nav-lang-globe" onclick="setLang('${next}')" title="${t("nav.language")}" aria-label="${t("nav.language")}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>
      <span>${lang === "en" ? "FR" : "EN"}</span>
    </button>`;
}

// Render the shared nav. The post modal markup is only included for admins
// (the only role allowed to publish new resources).
function renderNav(activePage) {
  const user = navGetUser();
  const isAdmin = user && user.role === "admin";

  const links = [
    { href: "../pages/all-resources.html", label: t("nav.allResources"), key: "resources" },
    { href: "../pages/breathe.html",       label: "BREATHE",       key: "breathe" },
    { href: "../pages/prompttb.html",      label: "PROMPT TB",     key: "prompttb" },
  ];
  const initials = user ? (user.initials || user.name.slice(0, 2).toUpperCase()) : "";
  const firstName = user ? user.name.split(" ")[0] : "";

  let authBlock;
  if (!user) {
    authBlock = `
       <div class="nav-auth">
         ${renderLangGlobe()}
         <button type="button" class="nav-cta nav-cta-secondary" onclick="openContactModal()">${t("nav.contact")}</button>
         <a href="../internal/index.html?return=public" class="nav-cta">${t("nav.signIn")}</a>
       </div>`;
  } else if (isAdmin) {
    authBlock = `
       <div class="nav-auth">
         <button type="button" class="nav-cta" onclick="openPostModal()">${t("nav.postResource")}</button>
         <div class="nav-user-menu">
           <button type="button" class="nav-user-trigger" onclick="toggleUserMenu(event)">
             <span class="nav-user-avatar" style="background:${user.color || 'var(--primary)'}">${initials}</span>
             <span class="nav-user-name">${firstName}</span>
           </button>
           <div class="nav-user-dropdown" id="navUserDropdown">
             <div class="nav-user-header">
               <span class="nav-user-header-name">${user.name}</span>
               <span class="nav-user-header-role">${user.role}</span>
             </div>
             <button type="button" class="nav-menu-item" onclick="openPostModal();closeUserMenu()">${t("nav.postResourceMenu")}</button>
             <a href="../internal/pages/dashboard.html" class="nav-menu-item">${t("nav.managementPortal")}</a>
             ${renderLangMenuRow()}
             <div class="nav-menu-divider"></div>
             <button type="button" class="nav-menu-item nav-menu-item-danger" onclick="navLogout()">${t("nav.signOut")}</button>
           </div>
         </div>
       </div>`;
  } else {
    // Staff / viewer — no post button, no management portal. Just a slim user menu.
    authBlock = `
       <div class="nav-auth">
         <div class="nav-user-menu">
           <button type="button" class="nav-user-trigger" onclick="toggleUserMenu(event)">
             <span class="nav-user-avatar" style="background:${user.color || 'var(--primary)'}">${initials}</span>
             <span class="nav-user-name">${firstName}</span>
           </button>
           <div class="nav-user-dropdown" id="navUserDropdown">
             <div class="nav-user-header">
               <span class="nav-user-header-name">${user.name}</span>
               <span class="nav-user-header-role">${user.role}</span>
             </div>
             ${renderLangMenuRow()}
             <div class="nav-menu-divider"></div>
             <button type="button" class="nav-menu-item nav-menu-item-danger" onclick="navLogout()">${t("nav.signOut")}</button>
           </div>
         </div>
       </div>`;
  }

  return `
  <nav class="nav">
    <a href="../index.html" class="nav-logo">
      <div class="nav-logo-mark">CH</div>
      <div class="nav-logo-text">CHPR Resources<span>${t("nav.logoSub")}</span></div>
    </a>
    <div class="nav-links">
      ${links.map(l => `<a href="${l.href}" class="nav-link ${activePage === l.key ? 'active' : ''}">${l.label}</a>`).join('')}
    </div>
    <div class="nav-search">
      <input type="text" placeholder="${t("nav.searchPlaceholder")}" id="navSearchInput" />
    </div>
    ${authBlock}
  </nav>
  ${isAdmin ? renderPostModal() : ""}
  ${!user ? renderContactModal() : ""}`;
}

function renderPostModal() {
  return `
  <div class="modal-overlay" id="postModalOverlay" onclick="if(event.target===this)closePostModal()">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="postModalTitle">
      <div class="modal-head">
        <h2 id="postModalTitle">${t("post.title")}</h2>
        <p>${t("post.sub")}</p>
      </div>
      <div class="modal-body">
        <div class="field-error" id="postFormError"></div>

        <div class="field">
          <label class="field-label" for="postName">${t("post.resourceTitle")}</label>
          <input class="field-input" type="text" id="postName" placeholder="${t("post.resourceTitlePh")}"/>
        </div>

        <div class="field">
          <label class="field-label" for="postProject">${t("post.project")}</label>
          <select class="field-select" id="postProject">
            ${PROJECTS.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="postType">${t("post.type")}</label>
          <select class="field-select" id="postType">
            <option value="alg">${typeLabel("alg")}</option>
            <option value="job">${typeLabel("job")}</option>
            <option value="vid">${typeLabel("vid")}</option>
            <option value="pos">${typeLabel("pos")}</option>
            <option value="expert">${typeLabel("expert")}</option>
            <option value="trunat">${typeLabel("trunat")}</option>
            <option value="hiv">${typeLabel("hiv")}</option>
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="postDescription">${t("post.description")}</label>
          <textarea class="field-textarea" id="postDescription" placeholder="${t("post.descriptionPh")}"></textarea>
        </div>

        <div class="field">
          <label class="field-label">${t("post.attachFile")}</label>
          <div class="field-file">
            <label class="field-file-btn" for="postFile">${t("post.chooseFile")}</label>
            <input type="file" id="postFile" accept="image/*,application/pdf,video/mp4,video/webm" onchange="updatePostFileName(this)"/>
            <span class="field-file-name" id="postFileName">${t("post.noFile")}</span>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn-secondary" onclick="closePostModal()">${t("post.cancel")}</button>
        <button type="button" class="btn-primary" id="postSubmit" onclick="submitPostForm()">${t("post.publish")}</button>
      </div>
    </div>
  </div>`;
}

function openPostModal() {
  const overlay = document.getElementById("postModalOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("postName")?.focus(), 50);
}
function closePostModal() {
  const overlay = document.getElementById("postModalOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  document.getElementById("postFormError").style.display = "none";
}

// ---------- Contact us (guests only) ----------
// Emails go to a FormSubmit.co endpoint built per-recipient. The visitor picks
// which team they want to reach and the message is routed to that team's
// address. Each address must be activated with FormSubmit once (the first
// submission to it triggers a one-time activation email). Replies from the team
// land directly in the visitor's inbox because we set _replyto.
const CONTACT_ADMIN_EMAIL = "njein@chprhealth.org";

// Recipients shown in the "Who would you like to reach?" searchable dropdown.
// NOTE: lab@ and data@ are PLACEHOLDERS — replace them with the real
// distribution lists or personal addresses for each team.
const CONTACT_TEAMS = [
  { id: "admin", label: "Admin / General", email: CONTACT_ADMIN_EMAIL },
  { id: "lab",   label: "Lab Team",        email: "lab@chprhealth.org" },   // TODO: replace placeholder
  { id: "data",  label: "Data Team",       email: "data@chprhealth.org" },  // TODO: replace placeholder
];

function getContactTeam(id) {
  return CONTACT_TEAMS.find(t => t.id === id) || null;
}
function contactFormsubmitUrl(email) {
  return `https://formsubmit.co/ajax/${encodeURIComponent(email)}`;
}
const CONTACT_INBOX_KEY = "chpr_contact_messages";

function _readContactInbox() {
  try { return JSON.parse(localStorage.getItem(CONTACT_INBOX_KEY)) || []; }
  catch { return []; }
}
function _writeContactInbox(list) {
  localStorage.setItem(CONTACT_INBOX_KEY, JSON.stringify(list));
}
function saveContactMessageLocally(entry) {
  const list = _readContactInbox();
  list.unshift({ id: `m${Date.now()}`, sentAt: new Date().toISOString(), ...entry });
  _writeContactInbox(list);
}

function renderContactModal() {
  // If the visitor is on a resource viewer, pre-fill the resource title so the
  // admin knows exactly what they're being asked about.
  return `
  <div class="modal-overlay" id="contactModalOverlay" onclick="if(event.target===this)closeContactModal()">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="contactModalTitle">
      <div class="modal-head">
        <h2 id="contactModalTitle">${t("contact.title")}</h2>
        <p>${t("contact.sub")}</p>
      </div>
      <div class="modal-body">
        <div class="field-error" id="contactFormError"></div>
        <div class="field-success" id="contactFormSuccess" style="display:none"></div>

        <div class="field">
          <label class="field-label" for="contactName">${t("contact.yourName")} <span class="field-required" aria-hidden="true">*</span></label>
          <input class="field-input" type="text" id="contactName" placeholder="${t("contact.yourNamePh")}" autocomplete="name" required/>
        </div>

        <div class="field">
          <label class="field-label" for="contactEmail">${t("contact.yourEmail")} <span class="field-required" aria-hidden="true">*</span></label>
          <input class="field-input" type="email" id="contactEmail" placeholder="${t("contact.yourEmailPh")}" autocomplete="email" required/>
          <p class="field-hint">${t("contact.replyTo")}</p>
        </div>

        <div class="field">
          <label class="field-label" for="contactTeam">${t("contact.whoReach")} <span class="field-required" aria-hidden="true">*</span></label>
          <div class="combobox" id="contactTeamCombo">
            <input class="field-input combobox-input" type="text" id="contactTeam" placeholder="${t("contact.whoReachPh")}"
                   autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="contactTeamList" required/>
            <input type="hidden" id="contactTeamValue"/>
            <svg class="combobox-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            <ul class="combobox-list" id="contactTeamList" role="listbox"></ul>
          </div>
          <p class="field-hint">${t("contact.routed")}</p>
        </div>

        <div class="field" id="contactResourceField" style="display:none">
          <label class="field-label" for="contactResource">${t("contact.resource")}</label>
          <input class="field-input" type="text" id="contactResource" readonly/>
        </div>

        <div class="field">
          <label class="field-label" for="contactMessage">${t("contact.message")} <span class="field-required" aria-hidden="true">*</span></label>
          <textarea class="field-textarea" id="contactMessage" rows="5" placeholder="${t("contact.messagePh")}" required></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn-secondary" onclick="closeContactModal()">${t("contact.cancel")}</button>
        <button type="button" class="btn-primary" id="contactSubmit" onclick="submitContactForm()">${t("contact.send")}</button>
      </div>
    </div>
  </div>`;
}

function openContactModal(prefill = {}) {
  const overlay = document.getElementById("contactModalOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  // Reset state from any prior submission
  const err = document.getElementById("contactFormError");
  const ok = document.getElementById("contactFormSuccess");
  if (err) err.style.display = "none";
  if (ok) ok.style.display = "none";
  const submit = document.getElementById("contactSubmit");
  if (submit) { submit.disabled = false; submit.textContent = "Send message"; }

  // Reset & wire the searchable team dropdown
  const teamInput = document.getElementById("contactTeam");
  const teamValue = document.getElementById("contactTeamValue");
  if (teamInput) teamInput.value = "";
  if (teamValue) teamValue.value = "";
  initContactTeamCombo();

  // Auto-fill from a viewer page if a resource id is in the URL
  const params = new URLSearchParams(location.search);
  const id = prefill.resourceId || params.get("id");
  const resource = id ? getResourceById(id) : null;
  const resourceField = document.getElementById("contactResourceField");
  const resourceInput = document.getElementById("contactResource");
  if (resource && resourceField && resourceInput) {
    resourceInput.value = `${resource.name} (${resource.projectName})`;
    resourceField.style.display = "";
  } else if (resourceField) {
    resourceField.style.display = "none";
  }

  setTimeout(() => document.getElementById("contactName")?.focus(), 50);
}

function closeContactModal() {
  const overlay = document.getElementById("contactModalOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ---------- Searchable team dropdown (combobox) ----------
// A native <select> isn't searchable, so we drive a filterable list ourselves.
// The visible <input id="contactTeam"> holds the typed query / chosen label;
// the hidden <input id="contactTeamValue"> holds the selected team id.
let _contactComboWired = false;
let _contactComboActive = -1; // index of the keyboard-highlighted option

function _contactComboMatches() {
  const input = document.getElementById("contactTeam");
  const q = (input?.value || "").trim().toLowerCase();
  // Only filter while the typed text doesn't exactly match the chosen label,
  // so opening the list after a pick still shows every team.
  const chosen = getContactTeam(document.getElementById("contactTeamValue")?.value);
  const showAll = !q || (chosen && q === chosen.label.toLowerCase());
  return showAll ? CONTACT_TEAMS : CONTACT_TEAMS.filter(t => t.label.toLowerCase().includes(q));
}

function _renderContactComboList() {
  const list = document.getElementById("contactTeamList");
  if (!list) return;
  const matches = _contactComboMatches();
  if (!matches.length) {
    list.innerHTML = `<li class="combobox-empty" aria-disabled="true">No matching team</li>`;
    _contactComboActive = -1;
    return;
  }
  list.innerHTML = matches.map((t, i) => `
    <li class="combobox-option ${i === _contactComboActive ? "active" : ""}" role="option" data-team-id="${t.id}" data-idx="${i}">
      <span class="combobox-option-label">${escapeHtml(t.label)}</span>
    </li>`).join("");
}

function _openContactCombo() {
  const combo = document.getElementById("contactTeamCombo");
  const input = document.getElementById("contactTeam");
  if (!combo) return;
  _renderContactComboList();
  combo.classList.add("open");
  input?.setAttribute("aria-expanded", "true");
}

function _closeContactCombo() {
  const combo = document.getElementById("contactTeamCombo");
  const input = document.getElementById("contactTeam");
  if (!combo) return;
  combo.classList.remove("open");
  input?.setAttribute("aria-expanded", "false");
  _contactComboActive = -1;
}

function _pickContactTeam(id) {
  const team = getContactTeam(id);
  if (!team) return;
  document.getElementById("contactTeam").value = team.label;
  document.getElementById("contactTeamValue").value = team.id;
  _closeContactCombo();
}

function initContactTeamCombo() {
  const combo = document.getElementById("contactTeamCombo");
  const input = document.getElementById("contactTeam");
  const list = document.getElementById("contactTeamList");
  if (!combo || !input || !list) return;
  if (_contactComboWired) return; // listeners persist with the modal markup
  _contactComboWired = true;

  input.addEventListener("focus", _openContactCombo);
  input.addEventListener("input", () => {
    // Typing invalidates any prior selection until a new option is chosen
    document.getElementById("contactTeamValue").value = "";
    _contactComboActive = -1;
    _openContactCombo();
  });

  input.addEventListener("keydown", e => {
    const matches = _contactComboMatches();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!combo.classList.contains("open")) { _openContactCombo(); return; }
      _contactComboActive = Math.min(_contactComboActive + 1, matches.length - 1);
      _renderContactComboList();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      _contactComboActive = Math.max(_contactComboActive - 1, 0);
      _renderContactComboList();
    } else if (e.key === "Enter") {
      if (combo.classList.contains("open") && matches[_contactComboActive]) {
        e.preventDefault();
        _pickContactTeam(matches[_contactComboActive].id);
      }
    } else if (e.key === "Escape") {
      _closeContactCombo();
    }
  });

  // Pointer selection (mousedown beats blur so the pick registers)
  list.addEventListener("mousedown", e => {
    const opt = e.target.closest(".combobox-option");
    if (!opt) return;
    e.preventDefault();
    _pickContactTeam(opt.dataset.teamId);
  });

  // Click away closes the list
  document.addEventListener("click", e => {
    if (!combo.contains(e.target)) _closeContactCombo();
  });
}

async function submitContactForm() {
  const errEl = document.getElementById("contactFormError");
  const okEl = document.getElementById("contactFormSuccess");
  const showErr = m => { errEl.textContent = m; errEl.style.display = "block"; okEl.style.display = "none"; };
  errEl.style.display = "none";

  const name = document.getElementById("contactName").value.trim();
  const email = document.getElementById("contactEmail").value.trim();
  const message = document.getElementById("contactMessage").value.trim();
  const teamId = document.getElementById("contactTeamValue")?.value || "";
  const team = getContactTeam(teamId);
  const resourceLabel = document.getElementById("contactResource")?.value.trim() || "";

  if (!name) return showErr("Please tell us your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr("Please enter a valid email address.");
  if (!team) return showErr("Please choose the team you'd like to reach.");
  if (!message) return showErr("Please write a message before sending.");
  if (message.length > 4000) return showErr("Message is too long (4000 characters max).");

  const submit = document.getElementById("contactSubmit");
  submit.disabled = true;
  submit.textContent = "Sending…";

  const subject = resourceLabel
    ? `[CHPR Hub · ${team.label}] Question about "${resourceLabel}"`
    : `[CHPR Hub · ${team.label}] New message from ${name}`;

  // Always keep a local copy so the team can see it in the in-app inbox even if
  // the network call fails (or FormSubmit hasn't been activated yet).
  saveContactMessageLocally({ name, email, message, team: team.label, teamEmail: team.email, resource: resourceLabel, subject });

  try {
    const res = await fetch(contactFormsubmitUrl(team.email), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        name,
        email,
        team: team.label,
        message,
        resource: resourceLabel || "(general enquiry)",
        _subject: subject,
        _replyto: email,
        _captcha: "false",
        _template: "table",
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    okEl.textContent = `Sent to the ${team.label} — they'll reply to ${email}.`;
    okEl.style.display = "block";
    document.getElementById("contactMessage").value = "";
    if (typeof showToast === "function") showToast(`Message sent to the ${team.label}.`);
    setTimeout(closeContactModal, 1800);
  } catch (e) {
    // Network failure or FormSubmit not yet activated. The message is already
    // saved locally so the admin won't lose it — surface that to the visitor.
    showErr("Couldn't send right now, but your message has been saved and an admin will see it soon.");
  } finally {
    submit.disabled = false;
    submit.textContent = "Send message";
  }
}

function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById("navUserDropdown").classList.toggle("open");
}
function closeUserMenu() {
  document.getElementById("navUserDropdown")?.classList.remove("open");
}
document.addEventListener("click", () => closeUserMenu());

function updatePostFileName(input) {
  const f = input.files[0];
  document.getElementById("postFileName").textContent = f
    ? `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`
    : t("post.noFile");
}

function submitPostForm() {
  const errEl = document.getElementById("postFormError");
  const showErr = m => { errEl.textContent = m; errEl.style.display = "block"; };
  errEl.style.display = "none";

  const user = navGetUser();
  if (!user) { showErr("You must be signed in to post a resource."); return; }

  const name = document.getElementById("postName").value.trim();
  const project = document.getElementById("postProject").value;
  const typeKey = document.getElementById("postType").value;
  const description = document.getElementById("postDescription").value;
  const fileInput = document.getElementById("postFile");
  const file = fileInput.files[0] || null;

  if (!name) { showErr("Please give the resource a title."); return; }
  if (file && file.size > 4 * 1024 * 1024) {
    showErr("File is too large for this prototype (4 MB max). Try a smaller file."); return;
  }

  const submitBtn = document.getElementById("postSubmit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Publishing…";

  const finalize = (dataUrl, mimeType, fileName) => {
    try {
      const r = addUserResource({
        name, project, typeKey, description,
        dataUrl, mimeType, fileName,
        postedBy: user.username,
      });
      closePostModal();
      showToast(`"${r.name}" published.`);
      // Refresh the page so listings & counts update everywhere
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Publish resource";
      showErr("Could not save resource (storage may be full). Try a smaller file.");
    }
  };

  if (!file) {
    finalize(null, null, null);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => finalize(reader.result, file.type, file.name);
  reader.onerror = () => {
    submitBtn.disabled = false;
    submitBtn.textContent = "Publish resource";
    showErr("Could not read the selected file.");
  };
  reader.readAsDataURL(file);
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2900);
}

function renderFooter() {
  return `
  <footer class="footer">
    <p>${t("footer.org")}</p>
    <p style="margin-top:6px">${t("footer.rights", { year: new Date().getFullYear() })}</p>
  </footer>`;
}

// Nav search: redirect to search page
function initNavSearch(prefix = "../") {
  const input = document.getElementById("navSearchInput");
  if (!input) return;
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && input.value.trim()) {
      window.location.href = `${prefix}pages/search.html?q=${encodeURIComponent(input.value.trim())}`;
    }
  });
}
