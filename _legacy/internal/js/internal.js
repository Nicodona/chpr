// ============================================================
//  AUTH — localStorage-backed user store with admin validation
//  ------------------------------------------------------------
//  Storage keys:
//    chpr_users     : approved accounts that can sign in
//    chpr_pending   : registrations awaiting admin validation
//    chpr_emails    : simulated email outbox (notifications)
//    chpr_user      : sessionStorage current login
// ============================================================

const SEED_USERS = [
  { username: "nico",   password: "tb2026",   name: "Nico Test",    email: "nico@chprhealth.org",   role: "admin",  color: "#0054A6", initials: "NT" },
  { username: "njei",   password: "chpr2026", name: "Njei",         email: "njei@chprhealth.org",   role: "admin",  color: "#0f6e56", initials: "NJ" },
  { username: "nchang", password: "chpr2026", name: "Nchang Evon",  email: "nchang@chprhealth.org", role: "staff",  color: "#0f6e56", initials: "NE" },
  { username: "armand", password: "chpr2026", name: "Armand Forkwa",email: "armand@chprhealth.org", role: "staff",  color: "#854f0b", initials: "AF" },
  { username: "viewer", password: "view2026", name: "Guest Viewer", email: "viewer@chprhealth.org", role: "viewer", color: "#46556e", initials: "GV" },
];

// Usernames that should be removed if they exist in localStorage (so previously-seeded accounts go away on next page load)
const REMOVED_SEED_USERS = ["aromarick"];

const AVATAR_PALETTE = ["#0054A6", "#0f6e56", "#854f0b", "#3c3489", "#b91c1c", "#0d9488", "#7c3aed", "#c2410c"];

function _read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function _write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function authSeed() {
  if (!localStorage.getItem("chpr_pending")) _write("chpr_pending", []);
  if (!localStorage.getItem("chpr_emails")) _write("chpr_emails", []);
  // Idempotent merge: ensure every seeded user is present (so newly-added seeds flow into existing browsers)
  let existing = _read("chpr_users", []);
  let changed = !localStorage.getItem("chpr_users");
  // Drop any usernames that have been retired from the seed list
  const removed = new Set(REMOVED_SEED_USERS.map(u => u.toLowerCase()));
  const filtered = existing.filter(u => !removed.has(u.username.toLowerCase()));
  if (filtered.length !== existing.length) { existing = filtered; changed = true; }
  for (const seed of SEED_USERS) {
    if (!existing.some(u => u.username.toLowerCase() === seed.username.toLowerCase())) {
      existing.push(seed);
      changed = true;
    }
  }
  if (changed) _write("chpr_users", existing);
}
authSeed();

function authGetUsers()    { return _read("chpr_users", []); }
function authGetPending()  { return _read("chpr_pending", []); }
function authGetEmails()   { return _read("chpr_emails", []); }

// ============================================================
//  PROJECTS — status (active / completed) shared with the public site
//  ------------------------------------------------------------
//  The public hub (js/data.js) reads the same localStorage key, so a project
//  marked "completed" here is reflected on the public project cards & pages.
// ============================================================
const PROJECT_DEFS = [
  { id: "breathe",  name: "BREATHE Cameroon", short: "BR", color: "#0054A6" },
  { id: "prompttb", name: "PROMPT TB",        short: "PT", color: "#0f6e56" },
];
const PROJECT_STATUS_KEY = "chpr_project_status";

function getProjectStatuses() {
  const stored = _read(PROJECT_STATUS_KEY, {});
  const out = {};
  for (const p of PROJECT_DEFS) out[p.id] = stored[p.id] === "completed" ? "completed" : "active";
  return out;
}
function getProjectStatus(id) {
  return getProjectStatuses()[id] || "active";
}
function setProjectStatus(id, status) {
  const stored = _read(PROJECT_STATUS_KEY, {});
  stored[id] = status === "completed" ? "completed" : "active";
  _write(PROJECT_STATUS_KEY, stored);
}

function _initialsFromName(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase();
}
function _colorFor(seed) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// Send a simulated email — stored in localStorage for the demo inbox
function authSendEmail(to, subject, body) {
  const emails = authGetEmails();
  emails.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    to: to.trim().toLowerCase(),
    subject, body,
    sentAt: new Date().toISOString(),
  });
  _write("chpr_emails", emails);
}
function authGetEmailsFor(email) {
  const e = email.trim().toLowerCase();
  return authGetEmails().filter(m => m.to === e);
}

// Returns { ok: true, user } or { ok: false, reason, message }
function authLogin(username, password) {
  const u = (username || "").trim();
  const users = authGetUsers();
  const found = users.find(x => x.username.toLowerCase() === u.toLowerCase() && x.password === password);
  if (found) {
    sessionStorage.setItem("chpr_user", JSON.stringify(found));
    return { ok: true, user: found };
  }
  // Differentiate pending accounts from bad credentials
  const pending = authGetPending().find(x => x.username.toLowerCase() === u.toLowerCase());
  if (pending) {
    return { ok: false, reason: "pending", message: "Your account is awaiting administrator approval. You'll be notified by email once it's reviewed." };
  }
  return { ok: false, reason: "invalid", message: "Incorrect username or password." };
}

function authLogout() { sessionStorage.removeItem("chpr_user"); }

function authGetUser() {
  try { return JSON.parse(sessionStorage.getItem("chpr_user")); }
  catch { return null; }
}

function requireAuth(redirectTo = "../index.html") {
  const user = authGetUser();
  if (!user) { window.location.href = redirectTo; return null; }
  return user;
}

function requireRole(role, redirectTo = "dashboard.html") {
  const user = requireAuth("../index.html");
  if (user && user.role !== role) { window.location.href = redirectTo; return null; }
  return user;
}

// Returns { ok: true } or { ok: false, message }
function authRegister({ name, email, username, password }) {
  name = (name || "").trim();
  email = (email || "").trim().toLowerCase();
  username = (username || "").trim();

  if (!name || !email || !username || !password) {
    return { ok: false, message: "All fields are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Please enter a valid email address." };
  }
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
    return { ok: false, message: "Username must be 3–24 characters (letters, numbers, . _ - only)." };
  }
  if (password.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters." };
  }

  const taken = (list) => list.some(u =>
    u.username.toLowerCase() === username.toLowerCase() ||
    (u.email || "").toLowerCase() === email
  );
  if (taken(authGetUsers()) || taken(authGetPending())) {
    return { ok: false, message: "That username or email is already in use." };
  }

  const pending = authGetPending();
  pending.push({
    name, email, username, password,
    color: _colorFor(username),
    initials: _initialsFromName(name),
    registeredAt: new Date().toISOString(),
  });
  _write("chpr_pending", pending);

  // Notify the user that registration was received, and the admin(s) that there's a new pending account
  authSendEmail(
    email,
    "CHPR Hub — registration received",
    `Hi ${name},\n\nThanks for registering on the CHPR Resources Hub. Your account is pending administrator approval. You'll receive another email once the decision is made.\n\n— CHPR Resources Hub`
  );
  authGetUsers().filter(u => u.role === "admin").forEach(a => authSendEmail(
    a.email,
    `New registration awaiting approval: ${username}`,
    `${name} (${email}) has requested access to the CHPR Resources Hub.\n\nReview the request in the Admin → Account Validation page.`
  ));

  return { ok: true };
}

function authApprove(username) {
  const pending = authGetPending();
  const i = pending.findIndex(p => p.username === username);
  if (i === -1) return { ok: false, message: "Pending user not found." };
  const p = pending[i];
  pending.splice(i, 1);
  _write("chpr_pending", pending);

  const users = authGetUsers();
  users.push({
    username: p.username,
    password: p.password,
    name: p.name,
    email: p.email,
    role: "staff",
    color: p.color,
    initials: p.initials,
  });
  _write("chpr_users", users);

  authSendEmail(
    p.email,
    "CHPR Hub — your account has been approved",
    `Hi ${p.name},\n\nGood news — your account has been approved by the administrator. You can now sign in to the CHPR Resources Hub with your username "${p.username}" and the password you chose at registration.\n\n— CHPR Resources Hub`
  );
  return { ok: true };
}

function authReject(username, reason = "") {
  const pending = authGetPending();
  const i = pending.findIndex(p => p.username === username);
  if (i === -1) return { ok: false, message: "Pending user not found." };
  const p = pending[i];
  pending.splice(i, 1);
  _write("chpr_pending", pending);

  authSendEmail(
    p.email,
    "CHPR Hub — your registration was not approved",
    `Hi ${p.name},\n\nWe're sorry, your request for access to the CHPR Resources Hub was not approved by the administrator${reason ? ` (reason: ${reason})` : ""}. Your registration has been removed from our records. If you believe this is a mistake, please contact your CHPR coordinator.\n\n— CHPR Resources Hub`
  );
  return { ok: true };
}

// ============================================================
//  ONBOARDING — department templates + per-user onboarding state
//  ------------------------------------------------------------
//  Storage keys:
//    chpr_ob_templates : admin-managed task/resource templates,
//                        keyed by department. Mock-seeded but fully
//                        editable from Admin → Templates.
//    chpr_onboarding   : per-user onboarding records, keyed by
//                        username. Tasks/resources are snapshotted
//                        from the department template at assignment,
//                        so later template edits don't disturb people
//                        already onboarding.
// ============================================================

// Departments a new employee can be recruited into. Fixed set, but
// data-driven so the admin UI, templates, and badges stay in sync.
const OB_DEPARTMENTS = [
  { key: "administration", label: "Administration", color: "#7c3aed" },
  { key: "lab",            label: "Laboratory",      color: "#0d9488" },
  { key: "data",           label: "Data Management", color: "#0054A6" },
  { key: "research",       label: "Research",        color: "#b45309" },
];
function obDepartment(key)      { return OB_DEPARTMENTS.find(d => d.key === key) || null; }
function obDepartmentLabel(key) { return obDepartment(key)?.label || key; }
function obDepartmentColor(key) { return obDepartment(key)?.color || "#0054A6"; }

// Resource/training material types (label + chip class suffix)
const OB_RESOURCE_TYPES = [
  { key: "training", label: "Training" },
  { key: "document", label: "Document" },
  { key: "video",    label: "Video" },
  { key: "link",     label: "Link" },
];
function obResourceTypeLabel(key) { return (OB_RESOURCE_TYPES.find(t => t.key === key) || {}).label || "Document"; }

// Quiz ("test your understanding") rules: must answer every question correctly.
// After this many failed attempts the task locks for a study-and-retry cooldown.
const QUIZ_MAX_ATTEMPTS = 3;
const QUIZ_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes — adjust to taste

// Shared path prefixes from internal/pages/* to repo-root assets
const OB_QR_PDF   = "../../JA%20on%20how%20to%20use%20QR%20code.pdf";
const OB_QR_VIDEO = "../../Video%20Aid%20on%20how%20to%20use%20QR%20code.mp4";

// Seed templates — editable mock content the admin tailors per department.
const DEFAULT_OB_TEMPLATES = {
  administration: {
    tasks: [
      { id: "adm-t1", category: "Accounts & Access",   title: "Activate your CHPR email account",            desc: "Log in to your @chprhealth.org mailbox and set a permanent password." },
      { id: "adm-t2", category: "Accounts & Access",   title: "Get access to the shared drive & calendar",   desc: "Request shared-drive and team-calendar access from IT." },
      { id: "adm-t3", category: "Accounts & Access",   title: "Set up your office phone / extension",         desc: "Collect your desk phone or extension number from the front office." },
      { id: "adm-t4", category: "Orientation",         title: "Read the CHPR mission, vision & org chart",    desc: "Understand how CHPR is structured and who leads each programme." },
      { id: "adm-t5", category: "Orientation",         title: "Meet your mentor & line manager",              desc: "Schedule a 30-minute kickoff with your mentor and supervisor." },
      { id: "adm-t6", category: "Orientation",         title: "Complete a tour of the office & facilities",   desc: "Locate workstations, meeting rooms, and the equipment store." },
      { id: "adm-t7", category: "Compliance & Ethics", title: "Review & acknowledge the staff handbook",      desc: "Read CHPR's workplace policies and code of conduct." },
      { id: "adm-t8", category: "Compliance & Ethics", title: "Sign the confidentiality & data-protection agreement", desc: "Acknowledge CHPR's data-handling and privacy rules." },
      { id: "adm-t9", category: "Role-specific",       title: "Learn the procurement & petty-cash workflow",  desc: "Walk through how purchase requests and reimbursements are processed." },
      { id: "adm-t10", category: "Role-specific",      title: "Review filing & document-management procedures", desc: "Understand how records are named, stored, and archived." },
      { id: "adm-t11", category: "Role-specific",      title: "Shadow front-desk / reception duties",         desc: "Spend a session observing visitor and call handling." },
    ],
    resources: [
      { id: "adm-r1", type: "document", title: "CHPR Staff Handbook",            desc: "Policies, leave, conduct and workplace expectations.", url: "" },
      { id: "adm-r2", type: "document", title: "Organisation chart & directory", desc: "Who's who across programmes and support teams.",       url: "" },
      { id: "adm-r3", type: "link",     title: "Procurement request form",       desc: "Submit purchase and petty-cash requests.",             url: "" },
      { id: "adm-r4", type: "document", title: "IT & email setup guide",         desc: "Step-by-step account, mailbox and drive setup.",       url: "" },
    ],
  },
  lab: {
    tasks: [
      { id: "lab-t1", category: "Accounts & Access",   title: "Activate your CHPR email account",          desc: "Log in to your @chprhealth.org mailbox and set a permanent password." },
      { id: "lab-t2", category: "Accounts & Access",   title: "Set up your LIMS / lab database login",     desc: "Request access to the laboratory information system from the data team." },
      { id: "lab-t3", category: "Accounts & Access",   title: "Join the laboratory communication group",  desc: "Get added to the lab Teams / WhatsApp group." },
      { id: "lab-t4", category: "Orientation",         title: "Read the CHPR mission & org chart",         desc: "Understand how the lab fits into CHPR's programmes." },
      { id: "lab-t5", category: "Orientation",         title: "Meet your mentor & lab supervisor",         desc: "Schedule a kickoff and agree on follow-up check-ins." },
      { id: "lab-t6", category: "Orientation",         title: "Lab tour & sample-storage walkthrough",     desc: "Locate benches, fridges/freezers, and the sample store." },
      { id: "lab-t7", category: "Compliance & Ethics", title: "Complete biosafety (BSL-2) training",       desc: "Mandatory before handling any biological specimens." },
      { id: "lab-t8", category: "Compliance & Ethics", title: "Complete Good Clinical Laboratory Practice (GCLP)", desc: "Finish the GCLP module and upload your certificate." },
      { id: "lab-t9", category: "Compliance & Ethics", title: "Sign the confidentiality & data-protection agreement", desc: "Acknowledge specimen-data and participant-privacy rules." },
      { id: "lab-t10", category: "Role-specific",      title: "Review sample-handling & chain-of-custody SOPs", desc: "Learn how specimens are received, labelled, and tracked." },
      { id: "lab-t11", category: "Role-specific",      title: "Equipment-handling orientation",            desc: "Safe use of centrifuge, GeneXpert, and microscope." },
      { id: "lab-t12", category: "Role-specific",      title: "Shadow a specimen-processing session",      desc: "Observe an experienced technician end-to-end." },
      { id: "lab-t13", category: "Role-specific",      title: "Learn waste-disposal & spill procedures",   desc: "Know the colour-coding and emergency spill response." },
    ],
    resources: [
      { id: "lab-r1", type: "document", title: "Biosafety manual (BSL-2)",                desc: "Containment, PPE, and handling requirements.",        url: "" },
      { id: "lab-r2", type: "training", title: "GCLP training module",                    desc: "Good Clinical Laboratory Practice essentials.",       url: "" },
      { id: "lab-r3", type: "document", title: "Sample handling & chain-of-custody SOP",  desc: "Receipt, labelling, storage and tracking.",           url: "" },
      { id: "lab-r4", type: "video",    title: "GeneXpert operation video aid",           desc: "Loading cartridges and running an assay.",            url: "" },
      { id: "lab-r5", type: "document", title: "QR code specimen-labelling job aid",      desc: "Using QR codes for specimen identification.",         url: OB_QR_PDF },
      { id: "lab-r6", type: "video",    title: "QR code workflow — video aid",            desc: "Walkthrough of scanning and the QR data flow.",       url: OB_QR_VIDEO },
    ],
  },
  data: {
    tasks: [
      { id: "dat-t1", category: "Accounts & Access",   title: "Activate your CHPR email account",      desc: "Log in to your @chprhealth.org mailbox and set a permanent password." },
      { id: "dat-t2", category: "Accounts & Access",   title: "Set up your REDCap account",            desc: "Request access from the data lead and complete your first login." },
      { id: "dat-t3", category: "Accounts & Access",   title: "Get database / server access from IT",  desc: "Obtain credentials for the data servers and backup store." },
      { id: "dat-t4", category: "Accounts & Access",   title: "Join the data-management group",        desc: "Get added to the data-management Teams channel." },
      { id: "dat-t5", category: "Orientation",         title: "Read the CHPR mission & org chart",     desc: "See how data management supports each study." },
      { id: "dat-t6", category: "Orientation",         title: "Meet your mentor & data lead",          desc: "Schedule a kickoff and agree on follow-up check-ins." },
      { id: "dat-t7", category: "Compliance & Ethics", title: "Complete data-protection & confidentiality training", desc: "Understand CHPR's data-security obligations." },
      { id: "dat-t8", category: "Compliance & Ethics", title: "Complete human-subjects research ethics module", desc: "Required before working with participant data." },
      { id: "dat-t9", category: "Compliance & Ethics", title: "Complete Good Clinical Practice (GCP)", desc: "Finish the GCP module and upload your certificate." },
      { id: "dat-t10", category: "Role-specific",      title: "Review REDCap instrument-design SOPs",  desc: "Learn naming conventions and data-dictionary standards." },
      { id: "dat-t11", category: "Role-specific",      title: "REDCap data-entry & export training",   desc: "Practise entry, raw-vs-label exports, and reporting." },
      { id: "dat-t12", category: "Role-specific",      title: "Learn the data-cleaning & query workflow", desc: "How discrepancies are flagged and resolved with sites." },
      { id: "dat-t13", category: "Role-specific",      title: "Review backup & data-security procedures", desc: "Backup schedule, access control, and recovery." },
    ],
    resources: [
      { id: "dat-r1", type: "training", title: "REDCap data-entry essentials",       desc: "Core skills for accurate data capture.",          url: "" },
      { id: "dat-r2", type: "document", title: "Data dictionary & instrument guide", desc: "Standards for building REDCap instruments.",      url: "" },
      { id: "dat-r3", type: "document", title: "QR code data-collection job aid",    desc: "Using QR codes in the data-capture workflow.",    url: OB_QR_PDF },
      { id: "dat-r4", type: "video",    title: "QR code workflow — video aid",       desc: "Scanning and linking records via QR codes.",      url: OB_QR_VIDEO },
      { id: "dat-r5", type: "document", title: "Data security & backup policy",      desc: "Access control, backups, and recovery steps.",    url: "" },
    ],
  },
  research: {
    tasks: [
      { id: "res-t1", category: "Accounts & Access",   title: "Activate your CHPR email account",        desc: "Log in to your @chprhealth.org mailbox and set a permanent password." },
      { id: "res-t2", category: "Accounts & Access",   title: "Set up your REDCap account",              desc: "Request study access from the data team for your project." },
      { id: "res-t3", category: "Accounts & Access",   title: "Join your project group",                 desc: "Get added to PROMPT TB / BREATHE / RAPID TB 2 channels as assigned." },
      { id: "res-t4", category: "Orientation",         title: "Read the CHPR mission & org chart",       desc: "Understand the research programmes and reporting lines." },
      { id: "res-t5", category: "Orientation",         title: "Meet your mentor & principal investigator", desc: "Schedule a kickoff and agree on follow-up check-ins." },
      { id: "res-t6", category: "Orientation",         title: "Tour the office & study sites",           desc: "Visit relevant clinics, camps, or field locations." },
      { id: "res-t7", category: "Compliance & Ethics", title: "Complete Good Clinical Practice (GCP)",   desc: "Mandatory before any participant contact." },
      { id: "res-t8", category: "Compliance & Ethics", title: "Complete human-subjects protection (CITI)", desc: "Finish the CITI module and upload your certificate." },
      { id: "res-t9", category: "Compliance & Ethics", title: "Review protocol & informed-consent procedure", desc: "Understand consent steps for your assigned study." },
      { id: "res-t10", category: "Role-specific",      title: "Review your project's SOPs",              desc: "Read the standard operating procedures for your study." },
      { id: "res-t11", category: "Role-specific",      title: "Shadow a data-collection session / health camp", desc: "Observe an experienced team member during fieldwork." },
      { id: "res-t12", category: "Role-specific",      title: "Equipment-handling orientation",          desc: "Safe setup and use of study devices (e.g. spirometer)." },
      { id: "res-t13", category: "Role-specific",      title: "Learn recruitment & follow-up procedures", desc: "How participants are enrolled and retained." },
    ],
    resources: [
      { id: "res-r1", type: "training", title: "Good Clinical Practice (GCP) training", desc: "Ethical and scientific quality standards.",      url: "" },
      { id: "res-r2", type: "training", title: "Human-subjects protection (CITI)",      desc: "Protecting participant rights and welfare.",     url: "" },
      { id: "res-r3", type: "document", title: "Study protocol & SOP library",          desc: "Protocols and SOPs for active studies.",         url: "" },
      { id: "res-r4", type: "document", title: "Spirometry job aid (BREATHE)",          desc: "Quality checks for spirometry data collection.", url: "" },
      { id: "res-r5", type: "document", title: "QR code data-collection job aid",       desc: "Using QR codes during fieldwork.",               url: OB_QR_PDF },
      { id: "res-r6", type: "video",    title: "QR code workflow — video aid",          desc: "Scanning and the QR data flow in the field.",    url: OB_QR_VIDEO },
    ],
  },
};

// Enrich selected seed tasks with "how to complete" details, helper
// video/website links, and (for compliance tasks) a check-your-understanding
// quiz. Quizzes must be answered fully correctly to auto-complete the task.
(function enrichSeedTasks() {
  const find = (dept, id) => DEFAULT_OB_TEMPLATES[dept].tasks.find(t => t.id === id);
  const set = (dept, id, extra) => { const t = find(dept, id); if (t) Object.assign(t, extra); };

  set("research", "res-t7", {
    details: "Good Clinical Practice (GCP) is the international ethical and scientific quality standard for designing, conducting and reporting research that involves human participants. Work through the assigned GCP course, then take the short check below — you must answer every question correctly for this task to be marked complete.",
    resources: [
      { title: "ICH GCP — overview (website)", type: "link",  url: "https://www.who.int" },
      { title: "GCP training videos",          type: "video", url: "https://www.youtube.com/results?search_query=ICH+GCP+training" },
    ],
    quiz: [
      { q: "What is the primary purpose of Good Clinical Practice (GCP)?", options: ["To speed up recruitment", "To protect participants' rights, safety and data integrity", "To reduce study costs", "To replace the ethics committee"], answer: 1 },
      { q: "Before a person can take part in a study, you must first obtain:", options: ["Their informed consent", "A blood sample", "Their employer's approval", "A signed payment form"], answer: 0 },
      { q: "If you become aware of a serious adverse event, you should:", options: ["Ignore it if it seems minor", "Report it promptly following the protocol/SOP", "Wait until the study ends", "Tell only the participant"], answer: 1 },
    ],
  });

  set("research", "res-t8", {
    details: "Human-subjects protection training (CITI) covers the ethical principles that protect people who take part in research: respect for persons, beneficence and justice. Review the module, then complete the check below.",
    quiz: [
      { q: "Human-subjects protection is mainly concerned with:", options: ["Maximising publications", "Respect for persons, beneficence and justice", "Reducing paperwork", "Faster data entry"], answer: 1 },
      { q: "Participants who may be vulnerable require:", options: ["No additional safeguards", "Additional protections and especially careful consent", "Exclusion from all research", "Less information than others"], answer: 1 },
    ],
  });

  set("research", "res-t10", {
    details: "Standard Operating Procedures (SOPs) describe exactly how each study activity must be carried out so that work is consistent across the team and across sites. Read the SOPs for your assigned study and note any questions to raise with your mentor.",
  });

  set("data", "dat-t2", {
    details: "REDCap is the platform CHPR uses to capture and manage study data. Request access from the data lead, complete your first login, and set a strong password.",
    resources: [
      { title: "REDCap — getting started (website)", type: "link", url: "https://projectredcap.org/" },
    ],
  });

  set("data", "dat-t7", {
    details: "Participant and study data must be kept secure and confidential at all times. Review CHPR's data-protection policy, then complete the check below.",
    resources: [
      { title: "Data protection basics (website)", type: "link", url: "https://gdpr.eu/" },
    ],
    quiz: [
      { q: "Participant data should be shared:", options: ["Freely with anyone who asks", "Only with authorised staff on a need-to-know basis", "On social media", "With family members"], answer: 1 },
      { q: "A good way to protect study data is to:", options: ["Keep a shared password on a sticky note", "Use access controls and keep regular backups", "Email the database to yourself", "Turn off all passwords"], answer: 1 },
    ],
  });

  set("lab", "lab-t7", {
    details: "Biosafety Level 2 (BSL-2) practices keep you and your colleagues safe when handling potentially infectious specimens. Complete the biosafety briefing, then take the check below.",
    resources: [
      { title: "Laboratory biosafety (website)", type: "link",  url: "https://www.cdc.gov/labs/" },
    ],
    quiz: [
      { q: "BSL-2 work with potentially infectious specimens requires:", options: ["No special precautions", "Appropriate PPE and a biosafety cabinet where indicated", "Only a pair of gloves", "Working in an open corridor"], answer: 1 },
      { q: "A specimen spill should be:", options: ["Wiped with a dry tissue and ignored", "Managed using the documented spill procedure and disinfectant", "Left for the cleaning staff", "Reported the following week"], answer: 1 },
    ],
  });

  set("lab", "lab-t11", {
    details: "Before using any laboratory instrument, make sure you understand safe setup, operation and shutdown. Watch the equipment orientation video and have your supervisor sign off your first supervised run.",
    resources: [
      { title: "GeneXpert operation — video", type: "video", url: "https://www.youtube.com/results?search_query=genexpert+operation" },
    ],
  });

  set("administration", "adm-t7", {
    details: "The staff handbook sets out CHPR's workplace policies and code of conduct, including confidentiality expectations. Read it carefully, then complete the short check below.",
    quiz: [
      { q: "Confidential information about CHPR or its participants should be:", options: ["Discussed publicly", "Kept confidential and shared only when authorised", "Posted online", "Shared with outside parties"], answer: 1 },
    ],
  });
})();

function _obId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

// Ensure templates exist, every department has an entry, and newly-seeded
// task content (details / quizzes / helper links) is backfilled onto matching
// tasks — all idempotent and without clobbering the admin's own edits.
function obSeedTemplates() {
  const existing = _read("chpr_ob_templates", null);
  if (!existing) { _write("chpr_ob_templates", DEFAULT_OB_TEMPLATES); return; }
  let changed = false;
  for (const d of OB_DEPARTMENTS) {
    if (!existing[d.key]) {
      existing[d.key] = DEFAULT_OB_TEMPLATES[d.key] || { tasks: [], resources: [] };
      changed = true;
      continue;
    }
    const def = DEFAULT_OB_TEMPLATES[d.key];
    if (def && def.tasks) {
      const byId = {};
      (existing[d.key].tasks || []).forEach(t => { byId[t.id] = t; });
      def.tasks.forEach(dt => {
        const et = byId[dt.id];
        if (!et) return;
        if (dt.details && !et.details) { et.details = dt.details; changed = true; }
        if (dt.quiz && dt.quiz.length && !(et.quiz && et.quiz.length)) { et.quiz = dt.quiz; changed = true; }
        if (dt.resources && dt.resources.length && !(et.resources && et.resources.length)) { et.resources = dt.resources; changed = true; }
      });
    }
  }
  if (changed) _write("chpr_ob_templates", existing);
}
obSeedTemplates();

function obGetTemplates() { return _read("chpr_ob_templates", DEFAULT_OB_TEMPLATES); }
function obGetTemplate(dept) {
  const t = obGetTemplates()[dept];
  return { tasks: (t && t.tasks) || [], resources: (t && t.resources) || [] };
}
function _obWriteTemplates(all) { _write("chpr_ob_templates", all); }

function obTemplateAddTask(dept, { title, desc, category }) {
  title = (title || "").trim();
  if (!title) return { ok: false, message: "Task title is required." };
  const all = obGetTemplates();
  const t = all[dept] || (all[dept] = { tasks: [], resources: [] });
  (t.tasks = t.tasks || []).push({ id: _obId("t"), title, desc: (desc || "").trim(), category: (category || "General").trim() });
  _obWriteTemplates(all);
  return { ok: true };
}
function obTemplateRemoveTask(dept, taskId) {
  const all = obGetTemplates();
  if (!all[dept]) return;
  all[dept].tasks = (all[dept].tasks || []).filter(x => x.id !== taskId);
  _obWriteTemplates(all);
}
function obTemplateAddResource(dept, { title, desc, url, type }) {
  title = (title || "").trim();
  if (!title) return { ok: false, message: "Resource title is required." };
  const all = obGetTemplates();
  const t = all[dept] || (all[dept] = { tasks: [], resources: [] });
  (t.resources = t.resources || []).push({ id: _obId("r"), title, desc: (desc || "").trim(), url: (url || "").trim(), type: type || "document" });
  _obWriteTemplates(all);
  return { ok: true };
}
function obTemplateRemoveResource(dept, resId) {
  const all = obGetTemplates();
  if (!all[dept]) return;
  all[dept].resources = (all[dept].resources || []).filter(x => x.id !== resId);
  _obWriteTemplates(all);
}

// ---- Per-user onboarding records ----
function onboardingGetAll() { return _read("chpr_onboarding", {}); }
function _onboardingWrite(all) { _write("chpr_onboarding", all); }
function onboardingGet(username) {
  if (!username) return null;
  return onboardingGetAll()[username.toLowerCase()] || null;
}
function onboardingList() { return Object.values(onboardingGetAll()); }

// Approved users who can be enrolled (not admins, not already onboarding)
function onboardingAssignableUsers() {
  const enrolled = new Set(Object.keys(onboardingGetAll()));
  return authGetUsers().filter(u => u.role !== "admin" && !enrolled.has(u.username.toLowerCase()));
}
// Candidates that can act as a mentor (admins + staff)
function onboardingMentorCandidates(excludeUsername = "") {
  const ex = (excludeUsername || "").toLowerCase();
  return authGetUsers().filter(u => (u.role === "admin" || u.role === "staff") && u.username.toLowerCase() !== ex);
}

function onboardingAssign(username, { department, mentorUsername, assignedBy }) {
  const users = authGetUsers();
  const target = users.find(u => u.username.toLowerCase() === (username || "").toLowerCase());
  if (!target) return { ok: false, message: "Select an approved user to enrol." };
  if (!obDepartment(department)) return { ok: false, message: "Please choose a department." };

  const tmpl = obGetTemplate(department);
  let mentor = null;
  if (mentorUsername && mentorUsername.toLowerCase() !== target.username.toLowerCase()) {
    const m = users.find(u => u.username.toLowerCase() === mentorUsername.toLowerCase());
    if (m) mentor = { username: m.username, name: m.name, initials: m.initials, color: m.color, email: m.email };
  }

  const all = onboardingGetAll();
  const now = new Date().toISOString();
  all[target.username.toLowerCase()] = {
    username: target.username.toLowerCase(),
    displayUsername: target.username,
    name: target.name,
    email: target.email,
    color: target.color,
    initials: target.initials,
    department,
    mentor,
    assignedBy: assignedBy || null,
    assignedAt: now,
    startDate: now,
    tasks: tmpl.tasks.map(t => ({
      id: t.id, title: t.title, desc: t.desc, category: t.category || "General",
      details: t.details || "", resources: t.resources || [], quiz: t.quiz || [],
      done: false, custom: false, attempts: 0, lockedUntil: null, passed: false,
    })),
    resources: tmpl.resources.map(r => ({ id: r.id, title: r.title, desc: r.desc, url: r.url, type: r.type })),
  };
  _onboardingWrite(all);

  authSendEmail(
    target.email,
    "CHPR Hub — you've been enrolled in onboarding",
    `Hi ${target.name},\n\nYou have been assigned to onboarding for the ${obDepartmentLabel(department)} department${mentor ? `, with ${mentor.name} as your mentor` : ""}. Sign in to the CHPR Resources Hub and open the "Onboarding" tab in the navigation bar to see your tasks, training materials, and progress.\n\nWelcome to the team!\n\n— CHPR Resources Hub`
  );
  return { ok: true };
}

function onboardingRemove(username) {
  const all = onboardingGetAll();
  delete all[(username || "").toLowerCase()];
  _onboardingWrite(all);
}

function onboardingToggleTask(username, taskId, done) {
  const all = onboardingGetAll();
  const rec = all[(username || "").toLowerCase()];
  if (!rec) return;
  const task = (rec.tasks || []).find(t => t.id === taskId);
  if (!task) return;
  // Tasks with a quiz can only be completed by passing the quiz, not by hand
  const resolved = obResolveTask(rec, taskId);
  if (resolved && resolved.quiz && resolved.quiz.length) return;
  task.done = (typeof done === "boolean") ? done : !task.done;
  _onboardingWrite(all);
}

function onboardingAddTask(username, { title, desc, category }) {
  title = (title || "").trim();
  if (!title) return { ok: false, message: "Task title is required." };
  const all = onboardingGetAll();
  const rec = all[(username || "").toLowerCase()];
  if (!rec) return { ok: false, message: "User is not in onboarding." };
  rec.tasks.push({ id: _obId("t"), title, desc: (desc || "").trim(), category: (category || "Additional").trim(), details: "", resources: [], quiz: [], done: false, custom: true, attempts: 0, lockedUntil: null, passed: false });
  _onboardingWrite(all);
  return { ok: true };
}

function onboardingRemoveTask(username, taskId) {
  const all = onboardingGetAll();
  const rec = all[(username || "").toLowerCase()];
  if (!rec) return;
  rec.tasks = rec.tasks.filter(t => t.id !== taskId);
  _onboardingWrite(all);
}

function onboardingProgress(rec) {
  const total = (rec && rec.tasks) ? rec.tasks.length : 0;
  const done = (rec && rec.tasks) ? rec.tasks.filter(t => t.done).length : 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

// Merge a user's per-task progress with the live task content (from the
// department template, or inline for custom tasks). Snapshot fields win, with
// a fallback to the template so quizzes/details authored later still appear.
function obResolveTasks(rec) {
  if (!rec) return [];
  const byId = {};
  (obGetTemplate(rec.department).tasks || []).forEach(t => { byId[t.id] = t; });
  const arr = (a, b) => (a && a.length) ? a : (b || []);
  const str = (a, b) => (a != null && a !== "") ? a : (b || "");
  return (rec.tasks || []).map(rt => {
    const tpl = rt.custom ? rt : (byId[rt.id] || {});
    return {
      id: rt.id,
      title: rt.title || tpl.title || "Task",
      category: rt.category || tpl.category || "General",
      desc: str(rt.desc, tpl.desc),
      details: str(rt.details, tpl.details),
      resources: arr(rt.resources, tpl.resources),
      quiz: arr(rt.quiz, tpl.quiz),
      done: !!rt.done,
      passed: !!rt.passed,
      attempts: rt.attempts || 0,
      lockedUntil: rt.lockedUntil || null,
      custom: !!rt.custom,
    };
  });
}
function obResolveTask(rec, taskId) {
  return obResolveTasks(rec).find(t => t.id === taskId) || null;
}

// Quiz state for rendering. `task` is a resolved task (obResolveTask).
function obQuizState(task) {
  const now = Date.now();
  let attempts = task.attempts || 0;
  let lockedUntil = task.lockedUntil || null;
  if (lockedUntil && now >= lockedUntil) { attempts = 0; lockedUntil = null; } // cooldown elapsed
  const locked = !!(lockedUntil && now < lockedUntil);
  return {
    hasQuiz: !!(task.quiz && task.quiz.length),
    passed: !!task.passed,
    attempts,
    attemptsLeft: Math.max(0, QUIZ_MAX_ATTEMPTS - attempts),
    locked,
    lockedUntil,
    remainingMs: locked ? (lockedUntil - now) : 0,
  };
}

// Evaluate a quiz submission. `answers` is an array of selected option indices.
// All correct → task is passed and auto-completed. Otherwise an attempt is
// consumed; after QUIZ_MAX_ATTEMPTS the task locks for QUIZ_COOLDOWN_MS.
function obSubmitQuiz(username, taskId, answers) {
  const all = onboardingGetAll();
  const rec = all[(username || "").toLowerCase()];
  if (!rec) return { ok: false, message: "Not enrolled in onboarding." };
  const recTask = (rec.tasks || []).find(t => t.id === taskId);
  if (!recTask) return { ok: false, message: "Task not found." };
  const quiz = obResolveTask(rec, taskId).quiz || [];
  if (!quiz.length) return { ok: false, message: "This task has no quiz." };

  const now = Date.now();
  if (recTask.lockedUntil && now >= recTask.lockedUntil) { recTask.attempts = 0; recTask.lockedUntil = null; }
  if (recTask.lockedUntil && now < recTask.lockedUntil) {
    _onboardingWrite(all);
    return { ok: false, locked: true, remainingMs: recTask.lockedUntil - now, attemptsLeft: 0 };
  }

  let correct = 0;
  const perQ = quiz.map((q, i) => { const ok = Number(answers[i]) === Number(q.answer); if (ok) correct++; return ok; });
  const allCorrect = correct === quiz.length;

  if (allCorrect) {
    recTask.passed = true;
    recTask.done = true;
    recTask.lockedUntil = null;
    _onboardingWrite(all);
    return { ok: true, passed: true, correct, total: quiz.length, perQ };
  }

  recTask.attempts = (recTask.attempts || 0) + 1;
  let locked = false;
  if (recTask.attempts >= QUIZ_MAX_ATTEMPTS) { recTask.lockedUntil = now + QUIZ_COOLDOWN_MS; locked = true; }
  _onboardingWrite(all);
  return {
    ok: true, passed: false, correct, total: quiz.length, perQ,
    attemptsLeft: Math.max(0, QUIZ_MAX_ATTEMPTS - recTask.attempts),
    locked, remainingMs: locked ? QUIZ_COOLDOWN_MS : 0,
  };
}

// ---- Template task content editing (admin authoring) ----
function obTemplateGetTask(dept, taskId) {
  return (obGetTemplate(dept).tasks || []).find(t => t.id === taskId) || null;
}
function obTemplateUpdateTask(dept, taskId, data) {
  const all = obGetTemplates();
  const t = all[dept];
  if (!t) return { ok: false, message: "Department not found." };
  const task = (t.tasks || []).find(x => x.id === taskId);
  if (!task) return { ok: false, message: "Task not found." };
  if (data.title != null)    { const v = data.title.trim(); if (!v) return { ok: false, message: "Title is required." }; task.title = v; }
  if (data.category != null) task.category = data.category.trim() || "General";
  if (data.desc != null)     task.desc = data.desc.trim();
  if (data.details != null)  task.details = data.details.trim();
  if (data.resources != null) task.resources = data.resources;
  if (data.quiz != null)     task.quiz = data.quiz;
  _obWriteTemplates(all);
  return { ok: true };
}

// ============================================================
//  THREAD & COMMENT DATA (in-memory store)
// ============================================================
let THREADS = [
  {
    id: 1,
    title: "Setting up REDCap instruments for PROMPT TB Wave 11",
    body: "We've been working on getting the Wave 11 REDCap instruments configured correctly. There are a few issues with label-to-raw-value mapping that I want to flag for the team. The main problem is that certain instruments export raw numeric codes instead of the human-readable labels, which breaks our aggregation pipeline. Has anyone dealt with this before or found a clean workaround?\n\nI've started drafting a Data Dictionary mapping script in Python but would appreciate input from others who've worked with REDCap exports.",
    project: "prompttb",
    tags: ["discussion", "prompttb"],
    author: "aromarick",
    authorName: "Mbah Romarick",
    authorColor: "#0054A6",
    authorInitials: "MR",
    authorRole: "admin",
    date: "2026-04-28T09:15:00",
    comments: [
      {
        id: 101,
        body: "Yes — we ran into exactly this issue in Wave 9. The key is to export both raw and label versions and then join them on the record ID. Happy to share the export config we used.",
        author: "armand",
        authorName: "Armand Forkwa",
        authorColor: "#854f0b",
        authorInitials: "AF",
        authorRole: "staff",
        date: "2026-04-28T11:02:00",
      },
      {
        id: 102,
        body: "There is also a setting in the Data Dictionary export that lets you choose the variable display format — worth checking that before rebuilding the mapping script from scratch.",
        author: "nchang",
        authorName: "Nchang Evon",
        authorColor: "#0f6e56",
        authorInitials: "NE",
        authorRole: "staff",
        date: "2026-04-29T08:44:00",
      }
    ]
  },
  {
    id: 2,
    title: "PAL Resources website — proposal to consolidate under CHPR Hub",
    body: "Following the Ngaoundere planning meeting, I demonstrated the PAL Resources website to site personnel. The feedback was mostly positive but several people noted it was hard to find — they weren't sure where to look.\n\nMy recommendation is that we migrate or link PAL resources directly into the CHPR Resources Hub rather than maintaining a standalone site. This would reduce the number of separate URLs staff need to remember and give us one authoritative entry point.\n\nI'll be drafting a proposal document for this. Thoughts from the team?",
    project: "prompttb",
    tags: ["discussion", "prompttb"],
    author: "aromarick",
    authorName: "Mbah Romarick",
    authorColor: "#0054A6",
    authorInitials: "MR",
    authorRole: "admin",
    date: "2026-05-01T10:30:00",
    comments: [
      {
        id: 201,
        body: "Fully agree. A single consolidated hub makes a lot more sense operationally. The site team had the same feedback during the BREATHE rollout — too many URLs is a real barrier for field staff.",
        author: "nchang",
        authorName: "Nchang Evon",
        authorColor: "#0f6e56",
        authorInitials: "NE",
        authorRole: "staff",
        date: "2026-05-02T07:20:00",
      }
    ]
  },
  {
    id: 3,
    title: "Laptop maintenance training — key issues identified at Ngaoundere site",
    body: "During the training session on 21 April, I identified a few recurring hardware and software issues that site personnel were dealing with. The main ones were:\n\n1. Fan blockage causing overheating — most machines hadn't been cleaned in months.\n2. Outdated drivers causing Bluetooth issues with peripherals.\n3. Several units had low disk space due to accumulated REDCap export files never being archived.\n\nI've put together a basic maintenance checklist that I want to share with all sites. Can we find a good place to host it on the internal portal?",
    project: "general",
    tags: ["discussion", "general"],
    author: "aromarick",
    authorName: "Mbah Romarick",
    authorColor: "#0054A6",
    authorInitials: "MR",
    authorRole: "admin",
    date: "2026-05-06T14:00:00",
    comments: []
  },
  {
    id: 4,
    title: "BREATHE Cameroon — spirometry data quality issues at health camps",
    body: "We've noticed some inconsistencies in spirometry readings from the last two health camps. The values for FEV1/FVC ratios are outside expected ranges for a subset of patients. It could be a calibration issue or it could be operator technique — hard to tell from the data alone.\n\nI'm proposing we add a short quality check step to the job aid before the test is administered. Has the BREATHE team had a chance to review the raw exports from these camps?",
    project: "breathe",
    tags: ["discussion", "breathe"],
    author: "nchang",
    authorName: "Nchang Evon",
    authorColor: "#0f6e56",
    authorInitials: "NE",
    authorRole: "staff",
    date: "2026-05-03T16:45:00",
    comments: [
      {
        id: 401,
        body: "I reviewed the exports yesterday. The outliers are mostly from Camp 3 — same operator across all affected records. More likely a technique issue than calibration. Worth scheduling a refresher before the next camp.",
        author: "armand",
        authorName: "Armand Forkwa",
        authorColor: "#854f0b",
        authorInitials: "AF",
        authorRole: "staff",
        date: "2026-05-04T08:10:00",
      }
    ]
  }
];

let nextThreadId = 10;
let nextCommentId = 900;

function getThreads() { return THREADS; }

function getThread(id) { return THREADS.find(t => t.id === parseInt(id)); }

function createThread({ title, body, project, author, authorName, authorColor, authorInitials, authorRole }) {
  const tag = project === "general" ? "general" : project;
  const thread = {
    id: nextThreadId++,
    title, body, project,
    tags: ["discussion", tag],
    author, authorName, authorColor, authorInitials, authorRole,
    date: new Date().toISOString(),
    comments: []
  };
  THREADS.unshift(thread);
  return thread;
}

function addComment(threadId, { body, author, authorName, authorColor, authorInitials, authorRole }) {
  const thread = getThread(threadId);
  if (!thread) return null;
  const comment = {
    id: nextCommentId++,
    body, author, authorName, authorColor, authorInitials, authorRole,
    date: new Date().toISOString()
  };
  thread.comments.push(comment);
  return comment;
}

// ============================================================
//  UTILITIES
// ============================================================
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, "<br>");
}

const TAG_CLASS = {
  discussion: "tag-discussion",
  breathe:    "tag-breathe",
  prompttb:   "tag-prompttb",
  rapidtb:    "tag-rapidtb",
  general:    "tag-general",
};
const TAG_LABEL = {
  discussion: "Discussion",
  breathe:    "BREATHE",
  prompttb:   "PROMPT TB",
  rapidtb:    "RAPID TB 2",
  general:    "General",
};

function renderTags(tags) {
  return tags.map(t => `<span class="tag ${TAG_CLASS[t] || ''}">${TAG_LABEL[t] || t}</span>`).join("");
}

function avatarHtml(color, initials, size = 28) {
  return `<div class="mini-avatar" style="background:${color};width:${size}px;height:${size}px;font-size:${Math.round(size*0.38)}px">${initials}</div>`;
}

function roleBadge(role) {
  return `<span class="role-badge role-${role}">${role}</span>`;
}

// NAV
function renderInternalNav(user, activePage) {
  const canPost = user && (user.role === "admin" || user.role === "staff");
  const isAdmin = user && user.role === "admin";
  const pendingCount = isAdmin ? authGetPending().length : 0;
  // Discussions and Onboarding are unlinked. Admins land on the dashboard;
  // non-admins have no internal landing page, so route them to the public site.
  const homeHref = isAdmin ? "dashboard.html" : "../../index.html";
  return `
  <nav class="nav">
    <a href="${homeHref}" class="nav-logo">
      <div class="nav-logo-mark">CH</div>
      <div class="nav-logo-text">CHPR Internal<span>Staff Portal</span></div>
    </a>
    <div class="nav-links">
      ${isAdmin ? `<a href="dashboard.html" class="nav-link ${activePage==='dashboard'?'active':''}">Dashboard</a>` : ""}
      ${isAdmin ? `<a href="admin.html" class="nav-link ${activePage==='admin'?'active':''}">Admin${pendingCount ? ` <span class="nav-badge">${pendingCount}</span>` : ""}</a>` : ""}
    </div>
    <div class="nav-right">
      <a href="../../index.html" class="nav-public-link">
        Public site
      </a>
      <div class="nav-user">
        ${avatarHtml(user.color, user.initials, 30)}
        <span>${user.name.split(" ")[0]}</span>
        ${roleBadge(user.role)}
      </div>
      <button class="btn-logout" onclick="authLogout();window.location.href='../index.html?msg=logged_out'">Log out</button>
    </div>
  </nav>`;
}

function renderInternalFooter() {
  return `<footer class="footer"><p><strong>CHPR Internal Portal</strong> &mdash; For staff use only. © ${new Date().getFullYear()} CHPR.</p></footer>`;
}
