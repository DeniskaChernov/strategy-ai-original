import { describe, it, expect } from "vitest";
import sharedTiers from "../shared/tiers.json";
import { TIERS } from "../client/lib/tiers";
import { CONTENT_PLAN_TIERS } from "../server/lib/tierFlags";

describe("tiers contract", () => {
  it("client TIERS maps limits from shared/tiers.json", () => {
    for (const key of Object.keys(sharedTiers)) {
      const json = sharedTiers[key as keyof typeof sharedTiers];
      const client = TIERS[key as keyof typeof TIERS];
      expect(client).toBeDefined();
      expect(client.maps).toBe(json.maps >= 999999 ? Infinity : json.maps);
      expect(client.projects).toBe(json.projects >= 999999 ? Infinity : json.projects);
      expect(client.members).toBe(json.members >= 999999 ? Infinity : json.members);
    }
  });

  it("CONTENT_PLAN_TIERS matches pro/team/enterprise", () => {
    expect(CONTENT_PLAN_TIERS.has("pro")).toBe(true);
    expect(CONTENT_PLAN_TIERS.has("team")).toBe(true);
    expect(CONTENT_PLAN_TIERS.has("enterprise")).toBe(true);
    expect(CONTENT_PLAN_TIERS.has("free")).toBe(false);
    expect(CONTENT_PLAN_TIERS.has("starter")).toBe(false);
  });

  it("starter has 3 members per JSON", () => {
    expect(sharedTiers.starter.members).toBe(3);
    expect(TIERS.starter.members).toBe(3);
  });

  it("pro has 5 members per JSON", () => {
    expect(sharedTiers.pro.members).toBe(5);
    expect(TIERS.pro.members).toBe(5);
  });
});
