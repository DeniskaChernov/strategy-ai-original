import React, { useState } from "react";

/** Slim canvas header — full-width map title, export/share, avatar (reference canvas UX). */
export function MapCanvasTopBar({
  title,
  saveLabel,
  userName,
  userEmail,
  onMenu,
  onBack,
  onExport,
  onShare,
  onProfile,
  readOnly,
  t,
}: {
  title: string;
  saveLabel?: string | null;
  userName?: string;
  userEmail?: string;
  onMenu: () => void;
  onBack?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onProfile?: () => void;
  readOnly?: boolean;
  t?: (key: string, fallback?: string) => string;
}) {
  const tr = t || ((_k: string, fb?: string) => fb || "");
  const initial = (userName || userEmail || "?").trim()[0]?.toUpperCase() || "?";
  return (
    <div className="map-canvas-topbar">
      <div className="mct-l">
        <button type="button" className="mct-menu" onClick={onMenu} aria-label="Menu">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
        {onBack ? (
          <button type="button" className="mct-back" onClick={onBack} aria-label="Back">
            ←
          </button>
        ) : null}
        <div className="mct-title">{title}</div>
        {saveLabel ? <span className="mct-save" role="status">{saveLabel}</span> : null}
      </div>
      <div className="mct-r">
        {onExport ? (
          <button type="button" className="btn-g mct-action" onClick={onExport}>
            <span aria-hidden>⬇</span> {tr("export_label", "Экспорт")}
          </button>
        ) : null}
        {!readOnly && onShare ? (
          <button type="button" className="btn-g mct-action" onClick={onShare}>
            <span aria-hidden>🔗</span> {tr("share_btn", "Поделиться")}
          </button>
        ) : null}
        {onProfile ? (
          <button type="button" className="mct-av" onClick={onProfile} aria-label="Profile">
            {initial}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Vertical tool rail on the right edge of the canvas. */
export function MapToolRail({
  connecting,
  showAI,
  readOnly,
  onSelect,
  onConnect,
  onAddNode,
  onToggleAI,
  onToggleMini,
  onStats,
  onShortcuts,
  t,
}: {
  connecting: boolean;
  showAI: boolean;
  readOnly?: boolean;
  onSelect: () => void;
  onConnect: () => void;
  onAddNode: () => void;
  onToggleAI: () => void;
  onToggleMini: () => void;
  onStats: () => void;
  onShortcuts: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="map-tool-rail" aria-label={t("map_tools", "Map tools")}>
      <button type="button" className={"mtr-btn"+(!connecting?" on":"")} onClick={onSelect} title={t("tool_select", "Select")} aria-label={t("tool_select", "Select")}>▣</button>
      {!readOnly && (
        <>
          <button type="button" className={"mtr-btn"+(connecting?" on":"")} onClick={onConnect} title={t("link_btn", "Connect")} aria-label={t("link_btn", "Connect")}>⇒</button>
          <button type="button" className="mtr-btn" onClick={onAddNode} title={t("add_step_hint", "Add step")} aria-label={t("step_short", "Step")}>+</button>
        </>
      )}
      <div className="mtr-sep" aria-hidden />
      <button type="button" className="mtr-btn" onClick={onToggleMini} title={t("minimap_hint", "Minimap")} aria-label={t("minimap_hint", "Minimap")}>🗺</button>
      <button type="button" className="mtr-btn" onClick={onStats} title={t("stats_title", "Stats")} aria-label={t("stats_title", "Stats")}>📊</button>
      <button type="button" className={"mtr-btn"+(showAI?" on":"")} onClick={onToggleAI} title={t("ai_consultant", "AI Advisor")} aria-label={t("ai_consultant", "AI Advisor")}>✦</button>
      <button type="button" className="mtr-btn" onClick={onShortcuts} title={t("shortcuts_title", "Shortcuts")} aria-label={t("shortcuts_title", "Shortcuts")}>⌨</button>
    </div>
  );
}

/** Bottom-right zoom + undo cluster. */
export function MapCornerControls({
  zoomPct,
  canUndo,
  canRedo,
  onZoomOut,
  onZoomIn,
  onFit,
  onUndo,
  onRedo,
  onShortcuts,
  t,
}: {
  zoomPct: number;
  canUndo: boolean;
  canRedo: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onShortcuts: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="map-corner-ctrl">
      <button type="button" className="mcc-btn" onClick={onUndo} disabled={!canUndo} title={t("undo", "Undo")} aria-label={t("undo", "Undo")}>↩</button>
      <button type="button" className="mcc-btn" onClick={onRedo} disabled={!canRedo} title={t("redo", "Redo")} aria-label={t("redo", "Redo")}>↪</button>
      <div className="mcc-sep" aria-hidden />
      <button type="button" className="mcc-btn" onClick={onZoomOut} title={t("zoom_out", "Zoom out")} aria-label={t("zoom_out", "Zoom out")}>−</button>
      <button type="button" className="mcc-zoom" onClick={onFit} title={t("fit_view_hint", "Fit view")}>{zoomPct}%</button>
      <button type="button" className="mcc-btn" onClick={onZoomIn} title={t("zoom_in", "Zoom in")} aria-label={t("zoom_in", "Zoom in")}>+</button>
      <button type="button" className="mcc-btn" onClick={onShortcuts} title={t("shortcuts_title", "Shortcuts")} aria-label={t("shortcuts_title", "Shortcuts")}>?</button>
    </div>
  );
}

/** Bottom-center AI prompt bar (canvas-first). */
export function MapCanvasPrompt({
  placeholder,
  readOnly,
  onSubmit,
  hint,
}: {
  placeholder: string;
  readOnly?: boolean;
  onSubmit: (text: string) => void;
  hint?: string;
}) {
  const [val, setVal] = useState("");
  return (
    <div className="map-canvas-prompt-wrap">
      {hint ? <div className="map-canvas-hint">{hint}</div> : null}
      <form
        className="map-canvas-prompt"
        onSubmit={(e) => {
          e.preventDefault();
          const q = val.trim();
          if (!q || readOnly) return;
          onSubmit(q);
          setVal("");
        }}
      >
        <button type="button" className="mcp-icon" tabIndex={-1} aria-hidden>+</button>
        <input
          className="mcp-inp"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          disabled={readOnly}
        />
        <button type="submit" className="mcp-send" disabled={readOnly || !val.trim()} aria-label="Send">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M1 7l12-6-6 12-1.5-5L1 7z" fill="currentColor" /></svg>
        </button>
      </form>
    </div>
  );
}
