import { describe, it, expect } from "vitest";
import { presentTypeKeys, availableTypeFilters, filterByType, hasPoolResources } from "./filters";

const RES = [
  { id: 1, type_key: "alg" },
  { id: 2, type_key: "alg" },
  { id: 3, type_key: "vid" },
  { id: 4, type_key: "pos" },
];

describe("presentTypeKeys", () => {
  it("returns the distinct type keys present", () => {
    expect(presentTypeKeys(RES)).toEqual(new Set(["alg", "vid", "pos"]));
  });
  it("is empty for no resources", () => {
    expect(presentTypeKeys([])).toEqual(new Set());
    expect(presentTypeKeys(undefined)).toEqual(new Set());
  });
});

describe("availableTypeFilters", () => {
  it("keeps 'All types' plus only the types that exist", () => {
    const vals = availableTypeFilters(RES).map((t) => t.value);
    expect(vals).toEqual(["all", "alg", "vid", "pos"]);
  });
  it("drops the always-empty pool filters when no pool resources exist", () => {
    const vals = availableTypeFilters(RES).map((t) => t.value);
    expect(vals).not.toContain("expert");
    expect(vals).not.toContain("trunat");
    expect(vals).not.toContain("hiv");
  });
  it("only shows 'All types' when there are no resources", () => {
    expect(availableTypeFilters([]).map((t) => t.value)).toEqual(["all"]);
  });
  it("surfaces a pool filter once a pool resource exists", () => {
    const vals = availableTypeFilters([...RES, { id: 9, type_key: "hiv" }]).map((t) => t.value);
    expect(vals).toContain("hiv");
  });
});

describe("filterByType", () => {
  it("returns everything for 'all' or empty", () => {
    expect(filterByType(RES, "all")).toHaveLength(4);
    expect(filterByType(RES, "")).toHaveLength(4);
  });
  it("filters to a single type", () => {
    expect(filterByType(RES, "alg").map((r) => r.id)).toEqual([1, 2]);
  });
  it("treats 'pool' as the group of pool-testing types", () => {
    const set = [...RES, { id: 9, type_key: "hiv" }, { id: 10, type_key: "trunat" }];
    expect(filterByType(set, "pool").map((r) => r.id)).toEqual([9, 10]);
  });
});

describe("hasPoolResources", () => {
  it("is false without pool types and true with one", () => {
    expect(hasPoolResources(RES)).toBe(false);
    expect(hasPoolResources([...RES, { id: 9, type_key: "expert" }])).toBe(true);
  });
});
