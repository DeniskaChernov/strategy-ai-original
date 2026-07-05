import { describe, expect, it, vi } from "vitest";
import { followNotificationLink } from "../client/lib/notif-deep-link";

describe("followNotificationLink", () => {
  it("routes contentplan open", async () => {
    const onContentPlan = vi.fn();
    const ok = await followNotificationLink("https://example.com/app?open=contentplan&projectId=p1", { onContentPlan });
    expect(ok).toBe(true);
    expect(onContentPlan).toHaveBeenCalledWith("p1");
  });

  it("routes contentplan hub without projectId", async () => {
    const onContentPlanHub = vi.fn();
    const ok = await followNotificationLink("/app?open=contentplan", { onContentPlanHub });
    expect(ok).toBe(true);
    expect(onContentPlanHub).toHaveBeenCalled();
  });

  it("routes project open", async () => {
    const onProject = vi.fn();
    const ok = await followNotificationLink("/app?open=project&projectId=abc", { onProject });
    expect(ok).toBe(true);
    expect(onProject).toHaveBeenCalledWith("abc");
  });

  it("routes map open with node", async () => {
    const onMap = vi.fn();
    const ok = await followNotificationLink("/?open=map&projectId=p&mapId=m&nodeId=n1", { onMap });
    expect(ok).toBe(true);
    expect(onMap).toHaveBeenCalledWith("p", "m", "n1");
  });

  it("returns false for unknown links", async () => {
    const ok = await followNotificationLink("/app", {});
    expect(ok).toBe(false);
  });
});
