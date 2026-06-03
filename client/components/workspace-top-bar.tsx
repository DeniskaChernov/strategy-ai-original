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
        <button
          type="button"
          className="sa-workspace-search"
          onClick={onSearchClick}
          aria-label={searchPlaceholder}
        >
          <span className="sa-workspace-search__ic" aria-hidden>⌕</span>
          <span className="sa-workspace-search__ph">{searchPlaceholder}</span>
          <kbd className="sa-workspace-search__kbd">⌘K</kbd>
        </button>
        {showNotifs && onNotifs ? <NotifBell unread={notifUnread} onClick={onNotifs} className="btn-ic sa-workspace-topbar__bell" /> : null}
        <button
          type="button"
          className="btn-ic sa-workspace-topbar__theme"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
        >
          {theme === "dark" ? "☀" : "☽"}
        </button>
        {onNewProject ? (
          <button type="button" className="sa-workspace-topbar__new" onClick={onNewProject}>
            <span aria-hidden>+</span> {newProjectLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}
