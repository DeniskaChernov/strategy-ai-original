import { describe, it, expect } from "vitest";
import { sanitize } from "../client/lib/sanitize";
import { topSort, isUUID, edgePt } from "../client/lib/map-utils";

describe("sanitize", () => {
  it("escapes HTML entities", () => {
    expect(sanitize('<script>"x"</script>')).toBe(
      "&lt;script&gt;&quot;x&quot;&lt;/script&gt;"
    );
  });

  it("handles null/undefined", () => {
    expect(sanitize(null)).toBe("");
    expect(sanitize(undefined)).toBe("");
  });
});

describe("map-utils", () => {
  it("validates UUID", () => {
    expect(isUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUUID("not-a-uuid")).toBe(false);
  });

  it("topSort orders nodes by edges", () => {
    const nodes = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
      { id: "c", x: 0, y: 0 },
    ];
    const edges = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ];
    const sorted = topSort(nodes, edges);
    expect(sorted.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("edgePt returns point on card boundary", () => {
    const pt = edgePt(100, 100, 200, 100);
    expect(pt.x).toBeGreaterThan(100);
    expect(pt.y).toBe(100);
  });
});
