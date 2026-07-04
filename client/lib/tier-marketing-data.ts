/** Маркетинговые копирайты и таблица сравнения тарифов (экран выбора + профиль). */

export const ALL_FEATURES = [
  { key: "ai", label: "AI-советник", free: "Базовый", str: "Базовый+риски", pro: "OKR·SWOT·Конкурент", team: "McKinsey-уровень", ent: "Стратег+Финансист+Инвестор" },
  { key: "proj", label: "Проектов", free: "1", str: "3", pro: "10", team: "25", ent: "∞" },
  { key: "maps", label: "Карт на проект", free: "1", str: "3", pro: "5", team: "15", ent: "∞" },
  { key: "users", label: "Участников", free: "1", str: "3", pro: "5", team: "10", ent: "∞" },
  { key: "scen", label: "Сценарии & симуляция", free: false, str: "2", pro: "5", team: "15", ent: "∞" },
  { key: "inter", label: "AI-интервью при создании", free: true, str: true, pro: true, team: true, ent: true },
  { key: "gantt", label: "Gantt таймлайн", free: true, str: true, pro: true, team: true, ent: true },
  { key: "clone", label: "Клонирование карт", free: false, str: false, pro: true, team: true, ent: true },
  { key: "tmpls", label: "Шаблоны стратегий", free: false, str: false, pro: false, team: true, ent: true },
  { key: "compet", label: "Конкурентный анализ AI", free: false, str: false, pro: true, team: true, ent: true },
  { key: "econ", label: "Unit economics разбор", free: false, str: false, pro: false, team: true, ent: true },
  { key: "auto", label: "AI авто-связи на карте", free: false, str: false, pro: false, team: true, ent: true },
  { key: "png", label: "Экспорт PNG", free: true, str: true, pro: true, team: true, ent: true },
  { key: "pptx", label: "Экспорт в PowerPoint", free: false, str: false, pro: false, team: false, ent: true },
  { key: "report", label: "Ежемесячный AI-отчёт", free: false, str: false, pro: false, team: false, ent: true },
  { key: "api", label: "API-доступ к картам", free: false, str: false, pro: false, team: false, ent: true },
  { key: "bcg", label: "BCG·Porter·Blue Ocean", free: false, str: false, pro: false, team: false, ent: true },
  { key: "wl", label: "White-label", free: false, str: false, pro: false, team: false, ent: true },
  { key: "supp", label: "Приоритетная поддержка", free: false, str: false, pro: false, team: false, ent: true },
] as const;

export type TierFeatureRow = (typeof ALL_FEATURES)[number];

export const TIER_MKT: Record<
  string,
  {
    icon: string;
    color: string;
    badge: string | null;
    headline: string;
    sub: string;
    accent: string;
    features: string[];
    missing: string[];
    gradient: string;
    glow: string;
    popular: boolean;
    highlight?: boolean;
  }
> = {
  free: {
    icon: "⬡",
    color: "#9088b0",
    badge: null,
    headline: "Попробуй бесплатно",
    sub: "Без карты. Навсегда.",
    accent: "Для первых шагов",
    features: ["1 проект", "1 карта", "AI-интервью", "Gantt таймлайн", "Экспорт PNG"],
    missing: ["Команда", "Сценарии", "Конкурентный анализ"],
    gradient: "linear-gradient(135deg,#9088b022,#9088b008)",
    glow: "#9088b0",
    popular: false,
  },
  starter: {
    icon: "◈",
    color: "#12c482",
    badge: "🌱 Новинка",
    headline: "Первый платный шаг",
    sub: "Мягкий вход в стратегию",
    accent: "Лучший старт за $9",
    features: ["3 проекта", "3 карты", "3 участника", "2 сценария", "Анализ рисков AI", "Gantt + PNG"],
    missing: ["Команда", "Конкурентный анализ", "Шаблоны"],
    gradient: "linear-gradient(135deg,#12c48218,#12c48208)",
    glow: "#12c482",
    popular: false,
  },
  pro: {
    icon: "◆",
    color: "#a050ff",
    badge: "🔥 Популярный",
    headline: "Для профессионала",
    sub: "Полная стратегическая мощь",
    accent: "73% платящих выбирают Pro",
    features: ["10 проектов", "5 карт", "5 участников", "Конкурентный анализ AI", "OKR·SWOT·Риски", "Клонирование карт"],
    missing: ["Unit economics", "Шаблоны", "McKinsey-AI"],
    gradient: "linear-gradient(135deg,#a050ff18,#a050ff08)",
    glow: "#a050ff",
    popular: true,
  },
  team: {
    icon: "✦",
    color: "#f09428",
    badge: "⭐ Лучшая ценность",
    headline: "Для команд",
    sub: "Стратегия на уровне McKinsey",
    accent: "В 2× больше функций чем Pro",
    features: ["25 проектов", "15 карт", "10 участников", "Unit economics разбор", "AI авто-связи", "Шаблоны стратегий"],
    missing: ["BCG·Porter·Blue Ocean", "PowerPoint экспорт", "AI-отчёты"],
    gradient: "linear-gradient(135deg,#f0942818,#f0942808)",
    glow: "#f09428",
    popular: false,
    highlight: true,
  },
  enterprise: {
    icon: "💎",
    color: "#06b6d4",
    badge: "💎 Топ-уровень",
    headline: "Без компромиссов",
    sub: "AI-директор по стратегии",
    accent: "Окупается за 1 решение",
    features: ["∞ проектов и карт", "∞ участников", "AI = стратег+финансист+инвестор", "BCG·Porter·Blue Ocean", "PowerPoint экспорт", "API-доступ"],
    missing: [],
    gradient: "linear-gradient(135deg,#06b6d418,#06b6d408)",
    glow: "#06b6d4",
    popular: false,
  },
};

export const TIER_PRICES: Record<string, string> = {
  free: "Бесплатно",
  starter: "$9/мес",
  pro: "$29/мес",
  team: "$59/мес",
  enterprise: "$149+/мес",
};

export const TIER_PRICE_NUM: Record<string, string> = {
  free: "0",
  starter: "9",
  pro: "29",
  team: "59",
  enterprise: "149+",
};

export const TIER_ORDER = ["free", "starter", "pro", "team", "enterprise"] as const;

export type TierOrderKey = (typeof TIER_ORDER)[number];

export const TIER_FEAT_KEY: Record<TierOrderKey, "free" | "str" | "pro" | "team" | "ent"> = {
  free: "free",
  starter: "str",
  pro: "pro",
  team: "team",
  enterprise: "ent",
};
