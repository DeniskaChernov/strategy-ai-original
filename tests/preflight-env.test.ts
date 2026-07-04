import { describe, it, expect } from "vitest";
import { validateProductionEnv } from "../server/lib/preflightEnv.js";

describe("preflightEnv", () => {
  it("fails production without JWT secrets", () => {
    const r = validateProductionEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      ALLOWED_ORIGINS: "https://example.com",
    });
    expect(r.ok).toBe(false);
    expect(r.hard).toContain("JWT_SECRET");
    expect(r.hard).toContain("JWT_REFRESH_SECRET");
  });

  it("passes production with required vars", () => {
    const r = validateProductionEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      JWT_SECRET: "a".repeat(64),
      JWT_REFRESH_SECRET: "b".repeat(64),
      ALLOWED_ORIGINS: "https://example.com",
      APP_URL: "https://example.com",
    });
    expect(r.ok).toBe(true);
    expect(r.hard).toHaveLength(0);
  });

  it("warns on missing APP_URL in production", () => {
    const r = validateProductionEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      JWT_SECRET: "secret",
      JWT_REFRESH_SECRET: "refresh",
      ALLOWED_ORIGINS: "https://example.com",
    });
    expect(r.soft.some((s) => s.startsWith("APP_URL"))).toBe(true);
  });
});
