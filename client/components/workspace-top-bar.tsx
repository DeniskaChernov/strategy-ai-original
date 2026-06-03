import React from "react";
import { NotifBell } from "./notif-bell";

export function WorkspaceTopBar({
  title,
  subtitle,
  theme,
  onToggleTheme,
  searchPlaceholder,
  onSearchClick,
  notifUnread = 0,
  onNotifs,
  showNotifs = true,
  onNewProject,
  newProjectLabel,
}: {
  title: string;
  subtitle?: string;
  theme: string;
  onToggleTheme: () => void;
  searchPlaceholder: string;
  onSearchClick?: () => void;
  notifUnread?: number;
  onNotifs?: () => void;
  showNotifs?: boolean;
  onNewProject?: () => void;
  newProjectLabel: string;
}) {
  return (
    <header className="sa-workspace-topbar">
      <div className="sa-workspace-topbar__title">
        <div className="sa-workspace-topbar__h">{title}</div>
        {subtitle ? <div className="sa-workspace-topbar__sub">{subtitle}</div> : null}
      </div>
      <div className="sa-workspace-topbar__actions">
        <button type="button" className="sa-workspace-search" onClick={onSearchClick} aria-label={searchPlaceholder}>
          <svg className="sa-workspace-search__svg" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="sa-workspace-search__ph">{searchPlaceholder}</span>
          <kbd className="sa-workspace-search__kbd">⌘K</kbd>
        </button>
        {showNotifs && onNotifs ? <NotifBell unread={notifUnread} onClick={onNotifs} className="btn-ic sa-workspace-ic" /> : null}
        <button type="button" className="btn-ic sa-workspace-ic sa-workspace-ic--ghost" aria-label="Навигация">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden>
            <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="btn-ic sa-workspace-ic sa-workspace-ic--ghost"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
        >
          {theme === "dark" ? (
            <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          ) : (
            <span aria-hidden>☽</span>
          )}
        </button>
        {onNewProject ? (
          <button type="button" className="sa-workspace-topbar__new" onClick={onNewProject}>
            + {newProjectLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}
