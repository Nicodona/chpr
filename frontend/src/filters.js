import { TYPE_FILTERS, POOL_TYPES } from "./constants";

// The set of resource type keys actually present in a result set.
export function presentTypeKeys(resources) {
  return new Set((resources || []).map((r) => r.type_key));
}

// TYPE_FILTERS trimmed to the types that actually exist in `resources`.
// "All types" is always kept. Hides perpetually-empty filters (e.g. the
// pool-testing types when no pool resources have been added yet).
export function availableTypeFilters(resources) {
  const present = presentTypeKeys(resources);
  return TYPE_FILTERS.filter((t) => t.value === "all" || present.has(t.value));
}

// Client-side type filtering. Handles the "pool" group pseudo-type used by the
// homepage "Pool Tests" quick link (any of the pool-testing types).
export function filterByType(resources, type) {
  if (!type || type === "all") return resources || [];
  if (type === "pool") return (resources || []).filter((r) => POOL_TYPES.includes(r.type_key));
  return (resources || []).filter((r) => r.type_key === type);
}

// Whether any pool-testing resources exist (drives the "Pool Tests" tile).
export function hasPoolResources(resources) {
  return (resources || []).some((r) => POOL_TYPES.includes(r.type_key));
}
