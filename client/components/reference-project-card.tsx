import React from "react";

const PROJECT_EMOJIS = ["🚀", "📊", "🎯", "💡", "🛡️", "🔗", "⚡", "🌍", "💰", "📈", "🏆", "🔬"];
const PROJECT_COLORS = [
  "rgba(104,54,245,.15)",
  "rgba(18,196,130,.12)",
  "rgba(240,148,40,.15)",
  "rgba(6,182,212,.15)",
  "rgba(240,68,88,.12)",
  "rgba(168,85,247,.15)",
];

const AVATAR_PALETTE = [
  { c: "rgba(104,54,245,.2)", tc: "#a278ff" },
  { c: "rgba(18,196,130,.2)", tc: "rgba(18,196,130,.9)" },
  { c: "rgba(240,148,40,.2)", tc: "rgba(240,148,40,.9)" },
  { c: "rgba(6,182,212,.15)", tc: "rgba(6,182,212,.9)" },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function projectVisual(id: string, storedIcon?: string, storedColor?: string) {
  const h = hashStr(id || "p");
  return {
    emoji: storedIcon || PROJECT_EMOJIS[h % PROJECT_EMOJIS.length],
    color: storedColor || PROJECT_COLORS[h % PROJECT_COLORS.length],
  };
}

export function memberAvatarStyle(email: string, index: number) {
  const h = hashStr(email || String(index));
  const p = AVATAR_PALETTE[h % AVATAR_PALETTE.length];
  const initials = (email || "?")
    .trim()
    .split(/[@.\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2) || "?";
  return { initials, bg: p.c, color: p.tc };
}

export function ReferenceProjectCard({
  name,
  roleLabel,
  desc,
  iconEmoji,
  iconColor,
  maps,
  scenarios,
  steps,
  members,
  progress,
  editedLabel,
  memberAvatars,
  mapsLabel,
  scenariosLabel,
  stepsLabel,
  membersLabel,
  progressLabel,
  onClick,
  ariaLabel,
}: {
  name: string;
  roleLabel: string;
  desc?: string;
  iconEmoji: string;
  iconColor: string;
  maps: number;
  scenarios: number;
  steps: number;
  members: number;
  progress: number;
  editedLabel: string;
  memberAvatars: Array<{ initials: string; bg: string; color: string }>;
  mapsLabel: string;
  scenariosLabel: string;
  stepsLabel: string;
  membersLabel: string;
  progressLabel: string;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <div
      className="proj-card"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel || name}
    >
      <div className="proj-header">
        <div className="proj-icon" style={{ background: iconColor }}>
          {iconEmoji}
        </div>
        <div>
          <div className="proj-title">{name}</div>
          <div className="proj-role">{roleLabel}</div>
        </div>
      </div>
      {desc ? <div className="proj-desc">{desc}</div> : null}
      <div className="proj-stats">
        <div className="ps-item">
          <div className="ps-val">{maps}</div>
          <div className="ps-lbl">{mapsLabel}</div>
        </div>
        <div className="ps-item">
          <div className="ps-val">{scenarios}</div>
          <div className="ps-lbl">{scenariosLabel}</div>
        </div>
        <div className="ps-item">
          <div className="ps-val">{steps}</div>
          <div className="ps-lbl">{stepsLabel}</div>
        </div>
        <div className="ps-item">
          <div className="ps-val">{members}</div>
          <div className="ps-lbl">{membersLabel}</div>
        </div>
      </div>
      <div className="proj-progress">
        <div className="pp-row">
          <span className="pp-lbl">{progressLabel}</span>
          <span className="pp-pct">{progress}%</span>
        </div>
        <div className="pp-bar">
          <div className="pp-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      </div>
      <div className="proj-footer">
        <span className="proj-date">{editedLabel}</span>
        <div className="proj-members">
          {memberAvatars.slice(0, 4).map((a, i) => (
            <div
              key={i}
              className="proj-av"
              style={{ background: a.bg, color: a.color, border: "1.5px solid var(--bg)" }}
            >
              {a.initials}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
