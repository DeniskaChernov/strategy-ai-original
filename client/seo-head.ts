import type { MarketingPath } from "./spa-path";
import { marketingPathToUrl } from "./spa-path";

export type AppSeoScreen =
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
  | "contentPlanProject";

function baseUrl(): string {
  try {
    const u = window.__SA_CONFIG__?.siteUrl;
    if (u && /^https?:\/\//i.test(u)) return u.replace(/\/+$/, "");
  } catch {
    /* ignore */
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}

function setMetaName(name: string, content: string): void {
  if (typeof document === "undefined") return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaProperty(prop: string, content: string): void {
  if (typeof document === "undefined") return;
  let el = document.querySelector(`meta[property="${prop}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", prop);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string): void {
  if (typeof document === "undefined") return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function ogImageAbsolute(): string | null {
  try {
    const raw = window.__SA_CONFIG__?.ogImage;
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return baseUrl() + (raw.startsWith("/") ? raw : "/" + raw);
  } catch {
    return null;
  }
}

export function applySeoForAppScreen(
  screen: AppSeoScreen,
  opts?: { legalKind?: "privacy" | "terms" | null }
): void {
  if (typeof document === "undefined") return;
  const base = baseUrl();

  const defaultTitle = "Strategy AI — Визуальное стратегическое планирование с AI";
  const defaultDesc =
    "Карты целей, Gantt-план, AI-советник, симуляция сценариев. Для предпринимателей и команд.";

  let title = defaultTitle;
  let desc = defaultDesc;
  let path = "/";

  switch (screen) {
    case "landing":
    case "splash":
      path = "/";
      title = defaultTitle;
      desc = defaultDesc;
      break;
    case "dashboard":
      path = "/app";
      title = "Strategy AI — Дашборд";
      desc = "Обзор проектов, прогресса и быстрые действия в Strategy AI.";
      break;
    case "insights":
      path = "/app";
      title = "Strategy AI — Инсайты";
      desc = "Аналитика портфеля стратегий: прогресс, риски и дедлайны.";
      break;
    case "ai":
      path = "/app";
      title = "Strategy AI — AI-советник";
      desc = "Стратегический AI-чат с контекстом ваших проектов и карт.";
      break;
    case "projects":
    case "project":
    case "map":
    case "contentPlanHub":
    case "contentPlanProject":
      path = "/app";
      title =
        screen === "projects"
          ? "Strategy AI — Проекты"
          : screen === "map"
            ? "Strategy AI — Карта"
            : screen === "contentPlanHub"
              ? "Strategy AI — Контент-план"
              : screen === "contentPlanProject"
                ? "Strategy AI — Контент-план проекта"
                : "Strategy AI — Проект";
      desc = "Рабочее пространство Strategy AI: проекты, карты и сценарии.";
      break;
    case "legal":
      path = opts?.legalKind === "terms" ? "/terms" : "/privacy";
      title =
        opts?.legalKind === "terms"
          ? "Условия использования — Strategy AI"
          : "Политика конфиденциальности — Strategy AI";
      desc =
        opts?.legalKind === "terms"
          ? "Условия использования сервиса Strategy AI."
          : "Как Strategy AI обрабатывает персональные данные и cookies.";
      break;
    case "notFound":
      path = "/404";
      title = "Страница не найдена — Strategy AI";
      desc = "Запрошенная страница не существует.";
      break;
    case "sharedMap":
      path = "/";
      title = "Strategy AI — Просмотр карты";
      desc = defaultDesc;
      break;
    default:
      path = "/";
  }

  const absUrl = base + (path === "/" ? "/" : path);
  document.title = title;
  setMetaName("description", desc);
  setMetaProperty("og:title", title);
  setMetaProperty("og:description", desc);
  setMetaProperty("og:url", absUrl);
  const img = ogImageAbsolute();
  if (img) {
    setMetaProperty("og:image", img);
    let tw = document.querySelector('meta[name="twitter:image"]');
    if (!tw) {
      tw = document.createElement("meta");
      tw.setAttribute("name", "twitter:image");
      document.head.appendChild(tw);
    }
    tw.setAttribute("content", img);
  }
  setCanonical(absUrl);
}

export function applySeoForMarketingPath(mp: MarketingPath): void {
  const base = baseUrl();
  const path = marketingPathToUrl(mp);
  const absUrl = base + (path === "/" ? "/" : path);
  setCanonical(absUrl);
  setMetaProperty("og:url", absUrl);
}
