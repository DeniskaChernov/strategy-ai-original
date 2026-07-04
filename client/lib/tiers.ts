import sharedTiers from "../../shared/tiers.json";

export type TierKey = "free" | "starter" | "pro" | "team" | "enterprise";

export type TierDef = {
  label: string;
  price: number;
  currency: string;
  maps: number;
  projects: number;
  members: number;
  scenarios: number;
  ai_messages: number;
  features: string[];
  color: string;
  users: number;
  templates: boolean;
  contentPlan: boolean;
  pptx: boolean;
};

const COLORS: Record<TierKey, string> = {
  free: "#9088b0",
  starter: "#12c482",
  pro: "#a050ff",
  team: "#f09428",
  enterprise: "#06b6d4",
};

function lim(n: number): number {
  return n >= 999999 ? Infinity : n;
}

function build(): Record<TierKey, TierDef> {
  const keys = Object.keys(sharedTiers) as TierKey[];
  const out = {} as Record<TierKey, TierDef>;
  for (const k of keys) {
    const r = sharedTiers[k];
    out[k] = {
      label: r.label,
      price: r.price,
      currency: r.currency,
      maps: lim(r.maps),
      projects: lim(r.projects),
      members: lim(r.members),
      scenarios: lim(r.scenarios),
      ai_messages: r.ai_messages,
      features: r.features,
      color: COLORS[k],
      users: lim(r.members),
      templates: k === "team" || k === "enterprise",
      contentPlan: k === "pro" || k === "team" || k === "enterprise",
      pptx: k === "enterprise",
    };
  }
  return out;
}

export const TIERS = build();
