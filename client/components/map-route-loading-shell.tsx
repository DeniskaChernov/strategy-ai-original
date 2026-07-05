import React from "react";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "../../strategy-shell-sidebar";
import { SplashLoaderVisual } from "../splash-loader";
import { TIERS } from "../lib/tiers";

/** Shell + inline loader while MapEditor chunk loads (avoids full-screen splash). */
export function MapRouteLoadingShell({
  user,
  theme,
  text,
  lang,
  onLang,
  onShellNav,
  onProfile,
  onLogout,
  onToggleTheme,
  t,
}: {
  user: any;
  theme: string;
  text: string;
  lang: string;
  onLang: (code: string) => void;
  onShellNav: (nav: StrategyShellNav) => void;
  onProfile: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const tier = TIERS[user?.tier || "free"] || TIERS.free;
  const dk = theme === "dark";
  return (
    <div
      className={"sa-strategy-ui sa-v-app " + (dk ? "dk" : "lt")}
      data-theme={theme}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        maxHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter',system-ui,sans-serif",
        overflow: "hidden",
      }}
    >
      <StrategyShellBg />
      <div className="sa-app" style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <StrategyShellSidebar
          theme={theme}
          onToggleTheme={onToggleTheme}
          activeNav="map"
          onNavigate={onShellNav}
          tierLabel={tier.label}
          tierColor={tier.color}
          onTierClick={onProfile}
          lang={lang}
          onLang={onLang}
          userName={user?.name || ""}
          userEmail={user?.email || ""}
          onUserCard={onProfile}
          onLogout={onLogout}
          showTrialBanner={(user?.tier || "free") === "free"}
          onLogoClick={() => onShellNav("dashboard")}
          layoutMode="reference"
          showProjectNav={true}
          t={t}
        />
        <div className="sa-main" style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="scr" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 280 }} role="status" aria-live="polite">
            <SplashLoaderVisual text={text} size={28} />
          </div>
        </div>
      </div>
    </div>
  );
}
