/** Parse notification link query params and invoke navigation callbacks. */
export type NotifNavHandlers = {
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
    if (open === "contentplan" && projectId && handlers.onContentPlan) {
      await handlers.onContentPlan(projectId);
      return true;
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
