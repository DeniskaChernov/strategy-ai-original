import React from "react";

export function AppTopBar({
  title,
  subtitle,
  flowHint,
  leftAddon,
  rightContent,
}: {
  title: string;
  subtitle?: string;
  flowHint?: string;
  leftAddon?: React.ReactNode;
  rightContent?: React.ReactNode;
}) {
  return (
    <header
      className="sa-shell-topbar"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 20px",
        borderBottom: "1px solid var(--glass-border-accent,var(--border))",
        background: "color-mix(in srgb,var(--bg) 82%,transparent)",
        backdropFilter: "blur(16px)",
        minHeight: 56,
        zIndex: 25,
      }}
    >
      {leftAddon}
      <div style={{ minWidth: 0, flex: "1 1 140px" }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text)", letterSpacing: -0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </div>
        ) : null}
        {flowHint ? (
          <div style={{ fontSize: 11, color: "var(--text5)", marginTop: 6, lineHeight: 1.45, maxWidth: 720 }}>{flowHint}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: "auto" }}>{rightContent}</div>
    </header>
  );
}
