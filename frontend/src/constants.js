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
