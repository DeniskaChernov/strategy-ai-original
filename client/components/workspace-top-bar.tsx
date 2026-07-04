import React from "react";

export function WorkspaceTopBar({
  title,
  subtitle,
  theme,
  onToggleTheme,
  searchPlaceholder,
  onSearchClick,
  showSearch = true,
  notifUnread = 0,
  onNotifs,
  showNotifs = true,
  onSettings,
  onNewProject,
  newProjectLabel,
  onBack,
  primaryCta,
}: {
  title: string;
  subtitle?: string;
  theme: string;
  onToggleTheme: () => void;
  searchPlaceholder: string;
  onSearchClick?: () => void;
  /** When false, hides search affordance (e.g. offline / no API) */
  showSearch?: boolean;
  notifUnread?: number;
  onNotifs?: () => void;
  showNotifs?: boolean;
  onSettings?: () => void;
  onNewProject?: () => void;
  newProjectLabel: string;
  onBack?: () => void;
  primaryCta?: { label: string; onClick: () => void };
}) {
  const isDark = theme === "dark";

  return (
    <div className="sa-topbar">
      <div className="tb-l">
        {onBack ? (
          <button type="button" className="sa-back-ic" onClick={onBack} aria-label="Back" style={{ marginRight: 8 }}>
            ←
          </button>
        ) : null}
        <div className="tb-title-wrap">
          <div className="tb-title">{title}</div>
          {subtitle ? <div className="tb-sub">{subtitle}</div> : null}
        </div>
      </div>
      <div className="tb-r">
        {showSearch && onSearchClick ? (
        <div
          className="srch"
          onClick={onSearchClick}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && onSearchClick) {
              e.preventDefault();
              onSearchClick();
            }
          }}
          role="button"
          tabIndex={0}
          style={{ cursor: "pointer" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
            <line x1="7.8" y1="7.8" x2="11" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            readOnly
            placeholder={searchPlaceholder}
            onClick={onSearchClick}
            style={{
              cursor: "pointer",
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 12,
              color: "var(--t2)",
              width: 120,
              fontFamily: "inherit",
            }}
          />
        </div>
        ) : null}
        {showNotifs && onNotifs ? (
          <div
            className="btn-ic"
            onClick={onNotifs}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onNotifs();
            }}
            role="button"
            tabIndex={0}
            aria-label={notifUnread > 0 ? `Уведомления (${notifUnread})` : "Уведомления"}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
              <path
                d="M7.5 1.5A4.5 4.5 0 0 1 12 6v1.5L13.5 9h-12L3 7.5V6A4.5 4.5 0 0 1 7.5 1.5z"
                stroke="currentColor"
                strokeWidth="1.3"
                fill="none"
              />
              <path d="M5.5 9v.5a2 2 0 0 0 4 0V9" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
            {notifUnread > 0 ? <div className="ndot" /> : null}
          </div>
        ) : null}
        <div
          className="tpill"
          onClick={onToggleTheme}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onToggleTheme();
          }}
          role="button"
          tabIndex={0}
          aria-label={isDark ? "Светлая тема" : "Тёмная тема"}
        >
          <div className={"tpi" + (isDark ? " on" : "")}>☽</div>
          <div className={"tpi" + (!isDark ? " on" : "")}>☀</div>
        </div>
        {onSettings ? (
          <div
            className="btn-ic"
            onClick={onSettings}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSettings();
            }}
            role="button"
            tabIndex={0}
            aria-label="Настройки"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
              <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <path
                d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.9 2.9l1.1 1.1M11 11l1.1 1.1M2.9 12.1l1.1-1.1M11 4l1.1-1.1"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : null}
        {primaryCta ? (
          <button type="button" className="btn-p" onClick={primaryCta.onClick}>
            {primaryCta.label}
          </button>
        ) : onNewProject ? (
          <button type="button" className="btn-p" onClick={onNewProject}>
            + {newProjectLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
