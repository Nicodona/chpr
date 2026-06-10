// Resource type metadata, mirroring the Django Resource.Type choices.
export const TYPE_LABELS = {
  alg: "Algorithm",
  job: "Job Aid",
  vid: "Video",
  pos: "Poster",
  expert: "Expert Pool",
  trunat: "Trunat",
  hiv: "HIV Pool",
};

export const TYPE_CLASS = {
  alg: "type-alg",
  job: "type-job",
  vid: "type-vid",
  pos: "type-pos",
  expert: "type-expert",
  trunat: "type-trunat",
  hiv: "type-hiv",
};

export const POOL_TYPES = ["expert", "trunat", "hiv"];

// Staff departments, mirroring StaffProfile.Department choices.
export const DEPARTMENT_OPTIONS = [
  { value: "lab", label: "Lab" },
  { value: "data", label: "Data Team" },
  { value: "admin", label: "Admin" },
  { value: "volunteer", label: "Volunteer" },
];

// Resource target audiences, mirroring Resource.Audience choices.
// The department-specific keys (lab/data/admin/volunteer) match the
// StaffProfile.Department keys so the backend can match them directly.
export const AUDIENCE_OPTIONS = [
  { value: "all", label: "Everyone (public)" },
  { value: "staff", label: "All Staff" },
  { value: "lab", label: "Lab only" },
  { value: "data", label: "Data Team only" },
  { value: "admin", label: "Admin only" },
  { value: "volunteer", label: "Volunteer only" },
];

// Type filter buttons shown across the resource views (pool categories are
// separate top-level filters, matching the mockup).
export const TYPE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "alg", label: "Algorithms" },
  { value: "job", label: "Job Aids" },
  { value: "vid", label: "Videos" },
  { value: "pos", label: "Posters" },
  { value: "expert", label: "Expert Pool" },
  { value: "trunat", label: "Trunat" },
  { value: "hiv", label: "HIV Pool" },
];
