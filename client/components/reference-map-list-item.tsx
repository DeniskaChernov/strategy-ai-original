import React from "react";

/** Row in project overview/maps tab — reference `.map-list-item`. */
export function ReferenceMapListItem({
  icon,
  name,
  meta,
  progress,
  onClick,
  trailing,
  dashed,
}: {
  icon?: string;
  name: React.ReactNode;
  meta?: React.ReactNode;
  progress?: number;
  onClick?: () => void;
  trailing?: React.ReactNode;
  dashed?: boolean;
}) {
  if (dashed) {
    return (
      <div
        className="map-list-item"
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
          }
        }}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{ borderStyle: "dashed", background: "var(--inp)", justifyContent: "center", gap: 8 }}
      >
        {name}
      </div>
    );
  }
  return (
    <div
      className="map-list-item"
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="map-icon" style={{ background: "rgba(104,54,245,.12)" }}>
        {icon || "🗺"}
      </div>
      <div className="map-item-info">
        <div className="map-item-name">{name}</div>
        {meta ? <div className="map-item-meta">{meta}</div> : null}
      </div>
      {progress != null ? (
        <div className="map-item-prog">
          <div className="map-item-prog-bar">
            <div className="map-item-prog-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
          <div className="map-item-prog-pct">{progress}%</div>
        </div>
      ) : null}
      {trailing}
    </div>
  );
}
