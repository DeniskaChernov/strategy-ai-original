import React from "react";
import { useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { TIERS } from "../lib/tiers";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "../../strategy-shell-sidebar";
import { WorkspaceTopBar } from "../components/workspace-top-bar";
import { ProfileModal } from "../strategy-modals/profile-modal";

/** Полноэкранные настройки (reference `#s-settings`) — desktop shell. */
export function SettingsPage({
  user,
  theme,
  palette,
  onToggleTheme,
  onPaletteChange,
  onUpdateUser,
  onChangeTier,
  onLogout,
  onShellNav,
  onOpenContentPlanHub,
}: {
  user: any;
  theme: string;
  palette: string;
  onToggleTheme: () => void;
  onPaletteChange: (p: string) => void;
  onUpdateUser: (u: any) => void;
  onChangeTier: (tier: string) => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onShellNav: (nav: StrategyShellNav) => void;
  onOpenContentPlanHub?: (() => void) | null;
}) {
  const { t, lang, setLang } = useLang();
  const isMobile = useIsMobile();
  const tier = TIERS[user?.tier || "free"] || TIERS.free;
  const shellUi = !!user && !isMobile;

  const panel = (
    <ProfileModal
      user={user}
      theme={theme}
      palette={palette}
      onPaletteChange={onPaletteChange}
      onClose={() => onShellNav("dashboard")}
      onUpdate={onUpdateUser}
      onChangeTier={onChangeTier}
      onLogout={onLogout}
      onToggleTheme={onToggleTheme}
      pageMode
      settingsShell
    />
  );

  if (!shellUi) {
    return (
      <div className={"sa-strategy-ui " + (theme === "dark" ? "dk" : "lt")} data-theme={theme} style={{ minHeight: "100vh", fontFamily: "'Inter',system-ui,sans-serif" }}>
        <StrategyShellBg />
        <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>{panel}</div>
      </div>
    );
  }

  return (
    <div className={"sa-strategy-ui sa-v-app " + (theme === "dark" ? "dk" : "lt")} data-theme={theme} style={{ width: "100%", height: "100%", minHeight: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter',system-ui,sans-serif", overflow: "hidden" }}>
      <StrategyShellBg />
      <div className="sa-app" style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <StrategyShellSidebar
          theme={theme}
          onToggleTheme={onToggleTheme}
          activeNav="settings"
          onNavigate={onShellNav}
          tierLabel={tier.label}
          tierColor={tier.color}
          onTierClick={() => onChangeTier(user?.tier || "free")}
          lang={lang}
          onLang={(code) => setLang(code)}
          userName={user.name || ""}
          userEmail={user.email || ""}
          onUserCard={() => onShellNav("settings")}
          onLogout={onLogout}
          showContentPlan={!!onOpenContentPlanHub}
          onContentPlan={onOpenContentPlanHub ? () => onOpenContentPlanHub() : undefined}
          showTrialBanner={(user?.tier || "free") === "free"}
          onLogoClick={() => onShellNav("dashboard")}
          t={t}
        />
        <div className="sa-main" style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <WorkspaceTopBar
            title={t("shell_settings", "Settings")}
            subtitle={user.email || ""}
            theme={theme}
            onToggleTheme={onToggleTheme}
            searchPlaceholder={t("dash_search_ph", "Search… (⌘K)")}
            showSearch={false}
            showNotifs={false}
            newProjectLabel={t("new_project", "New project")}
          />
          <div className="scr" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
            {panel}
          </div>
        </div>
      </div>
    </div>
  );
}
