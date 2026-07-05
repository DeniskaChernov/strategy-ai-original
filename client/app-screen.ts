/** Типизированные экраны SPA-оркестратора. */
export type AppScreen =
  | "splash"
  | "landing"
  | "legal"
  | "notFound"
  | "dashboard"
  | "insights"
  | "ai"
  | "projects"
  | "project"
  | "map"
  | "sharedMap"
  | "contentPlanHub"
  | "contentPlanProject"
  | "settings";

export const AUTHENTICATED_SCREENS: AppScreen[] = [
  "dashboard",
  "insights",
  "ai",
  "projects",
  "project",
  "map",
  "contentPlanHub",
  "contentPlanProject",
  "settings",
];

export function isAuthenticatedScreen(screen: AppScreen): boolean {
  return AUTHENTICATED_SCREENS.includes(screen);
}
