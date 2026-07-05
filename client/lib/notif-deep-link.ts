/** Parse notification link query params and invoke navigation callbacks. */
export type NotifNavHandlers = {
  onContentPlanHub?: () => void | Promise<void>;
  onContentPlan?: (projectId: string) => void | Promise<void>;
  onProject?: (projectId: string) => void | Promise<void>;
  onMap?: (projectId: string, mapId: string, nodeId?: string | null) => void | Promise<void>;
};

export async function followNotificationLink(
  link: string,
  handlers: NotifNavHandlers
): Promise<boolean> {
  try {
    const u = new URL(link, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const open = (u.searchParams.get("open") || "").toLowerCase();
    const projectId = u.searchParams.get("projectId") || "";
    const mapId = u.searchParams.get("mapId") || "";
    const nodeId = u.searchParams.get("nodeId") || "";
    if (open === "contentplan") {
      if (projectId && handlers.onContentPlan) {
        await handlers.onContentPlan(projectId);
        return true;
      }
      if (!projectId && handlers.onContentPlanHub) {
        await handlers.onContentPlanHub();
        return true;
      }
    }
    if (open === "project" && projectId && handlers.onProject) {
      await handlers.onProject(projectId);
      return true;
    }
    if (open === "map" && projectId && mapId && handlers.onMap) {
      await handlers.onMap(projectId, mapId, nodeId || null);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

/** Factory for NotificationsCenterModal.onFollowLink with optional fallback navigation. */
export function createNotifFollowHandler(
  handlers: NotifNavHandlers,
  opts?: { onSuccess?: () => void; fallback?: (link: string) => void }
) {
  const fallback = opts?.fallback ?? ((link: string) => {
    if (typeof window !== "undefined") window.location.href = link;
  });
  return async (n: { link?: string }) => {
    if (!n.link) return;
    const ok = await followNotificationLink(n.link, handlers);
    if (ok) opts?.onSuccess?.();
    else fallback(n.link);
  };
}
