import React, { useState, useCallback } from "react";

const COLLAPSE_KEY = "sa_sb_groups_v1";
type GroupKey = "workspace" | "ai" | "settings" | "project";
function loadGroups(): Record<GroupKey, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    if (raw) return { workspace: true, ai: true, settings: true, project: true, ...JSON.parse(raw) };
  } catch { /* — */ }
  return { workspace: true, ai: true, settings: true, project: true };
}
function saveGroups(g: Record<GroupKey, boolean>) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(g)); } catch { /* — */ }
}

export type StrategyShellNav =
  | "dashboard"
  | "projects"
  | "map"
  | "contentPlan"
  | "scenarios"
  | "timeline"
  | "ai"
  | "insights"
  | "team"
  | "settings";

type TFn = (key: string, fallback?: string) => string;

function Ni({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <div
      className={`ni${active ? " on" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      {children}
    </div>
  );
}

function SbLabel({ referenceLayout, open, onToggle, label }: { referenceLayout: boolean; open: boolean; onToggle?: () => void; label: string }) {
  if (referenceLayout) return <div className="sb-lbl">{label}</div>;
  return (
    <button type="button" className="sb-lbl sb-lbl--btn" onClick={onToggle} aria-expanded={open}>
      <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden style={{ transition: "transform .22s ease", transform: open ? "rotate(0deg)" : "rotate(-90deg)", opacity: .55, flexShrink: 0 }}>
        <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{label}</span>
    </button>
  );
}

export function StrategyShellSidebar({
  theme,
  onToggleTheme,
  activeNav,
  onNavigate,
  tierLabel,
  tierColor: _tierColor,
  onTierClick,
  lang,
  onLang,
  userName,
  userEmail,
  scenarioCount,
  projectCount,
  onUserCard,
  onCrmClick,
  onLogout,
  showContentPlan,
  onContentPlan,
  showTrialBanner,
  trialDaysLeft,
  onWeeklyBriefing,
  briefingHint,
  onLogoClick,
  collapsed,
  layoutMode = "full",
  showProjectNav = false,
  t,
}: {
  theme: string;
  onToggleTheme: () => void;
  activeNav: StrategyShellNav;
  onNavigate: (nav: StrategyShellNav) => void;
  tierLabel: string;
  tierColor: string;
  onTierClick: () => void;
  lang: string;
  onLang: (code: string) => void;
  userName: string;
  userEmail: string;
  scenarioCount?: number;
  projectCount?: number;
  onUserCard: () => void;
  onCrmClick?: () => void;
  onLogout?: () => void;
  showContentPlan?: boolean;
  onContentPlan?: () => void;
  showTrialBanner?: boolean;
  trialDaysLeft?: number | null;
  onWeeklyBriefing?: () => void;
  briefingHint?: string;
  onLogoClick?: () => void;
  collapsed?: boolean;
  /** full = legacy; ref | reference = HTML reference sidebar */
  layoutMode?: "full" | "ref" | "reference";
  showProjectNav?: boolean;
  t: TFn;
}) {
  const referenceLayout = layoutMode === "ref" || layoutMode === "reference";
  void _tierColor;
  const initial = (userName || userEmail || "?").trim().split(/\s+/).map(s => s[0]).join("").slice(0, 2).toUpperCase();
  const [groups, setGroups] = useState<Record<GroupKey, boolean>>(loadGroups);
  const toggleGroup = useCallback((k: GroupKey) => {
    setGroups((prev) => { const n = { ...prev, [k]: !prev[k] }; saveGroups(n); return n; });
  }, []);
  if (collapsed) return null;

  const workspaceOpen = referenceLayout || groups.workspace;
  const aiOpen = referenceLayout || groups.ai;
  const projectOpen = referenceLayout || groups.project;

  return (
    <aside className="sa-sb">
      <div
        className={"sb-logo" + (onLogoClick ? " sb-logo--click" : "")}
        onClick={onLogoClick}
        onKeyDown={e => { if (onLogoClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onLogoClick(); } }}
        role={onLogoClick ? "button" : undefined}
        tabIndex={onLogoClick ? 0 : undefined}
        aria-label={onLogoClick ? t("shell_logo_home", "Перейти к проектам") : undefined}
      >
        <div className="sb-gem">SA</div>
        <span className="sb-name">Strategy AI</span>
        {!referenceLayout && (
          <div className="tpill" onClick={onToggleTheme} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onToggleTheme(); }} aria-label={t("toggle_theme", "Тема")}>
            <div className={`tpi${theme === "dark" ? " on" : ""}`}>☽</div>
            <div className={`tpi${theme === "light" ? " on" : ""}`}>☀</div>
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div className={"sb-sect" + (workspaceOpen ? "" : " sb-sect--collapsed")}>
          <SbLabel referenceLayout={referenceLayout} open={groups.workspace} onToggle={() => toggleGroup("workspace")} label={t("shell_workspace", "Workspace")} />
          {workspaceOpen && (
            <>
              <Ni active={activeNav === "dashboard"} onClick={() => onNavigate("dashboard")} label={t("shell_dashboard", referenceLayout ? "Dashboard" : "Дашборд")}>
                <svg viewBox="0 0 15 15" fill="none" aria-hidden><rect x="1.5" y="1.5" width="5" height="6.5" rx="1.4" fill="currentColor" opacity=".75" /><rect x="1.5" y="9.5" width="5" height="4" rx="1.4" fill="currentColor" opacity=".4" /><rect x="8.5" y="1.5" width="5" height="4" rx="1.4" fill="currentColor" opacity=".4" /><rect x="8.5" y="7" width="5" height="6.5" rx="1.4" fill="currentColor" opacity=".6" /></svg>
                {t("shell_dashboard", referenceLayout ? "Dashboard" : "Дашборд")}
              </Ni>
              <Ni active={activeNav === "projects"} onClick={() => onNavigate("projects")} label={t("shell_projects", referenceLayout ? "Projects" : "Проекты")}>
                <svg viewBox="0 0 15 15" fill="none" aria-hidden><rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor" opacity=".7" /><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor" opacity=".5" /><rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" opacity=".5" /><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" opacity=".35" /></svg>
                {t("shell_projects", referenceLayout ? "Projects" : "Проекты")}
                {(projectCount ?? 0) > 0 && <span className="ni-badge">{Math.min(99, projectCount!)}</span>}
              </Ni>
              {!referenceLayout && (
                <>
                  <Ni active={activeNav === "map"} onClick={() => onNavigate("map")} label={t("shell_strategy_map", "Карта стратегии")}>
                    <svg viewBox="0 0 15 15" fill="none" aria-hidden><circle cx="3" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".7" /><circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".7" /><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".7" /><line x1="5" y1="7.5" x2="10" y2="3.8" stroke="currentColor" strokeWidth="1.1" opacity=".5" /><line x1="5" y1="7.5" x2="10" y2="11.2" stroke="currentColor" strokeWidth="1.1" opacity=".5" /></svg>
                    {t("shell_strategy_map", "Карта стратегии")}
                  </Ni>
                  {showContentPlan && onContentPlan && (
                    <Ni active={activeNav === "contentPlan"} onClick={() => onContentPlan()} label={t("nav_workspace_content", "Контент-план")}>
                      <svg viewBox="0 0 15 15" fill="none" aria-hidden><rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".6" /><path d="M4 6h7M4 9h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".5" /></svg>
                      {t("nav_workspace_content", "Контент-план")}
                    </Ni>
                  )}
                  <Ni active={activeNav === "scenarios"} onClick={() => onNavigate("scenarios")} label={t("shell_scenarios", "Сценарии")}>
                    <svg viewBox="0 0 15 15" fill="none" aria-hidden><path d="M2 4h11M2 7.5h8M2 11h5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".75" /></svg>
                    {t("shell_scenarios", "Сценарии")}
                    {(scenarioCount ?? 0) > 0 && <span className="ni-badge">{Math.min(99, scenarioCount!)}</span>}
                  </Ni>
                  <Ni active={activeNav === "timeline"} onClick={() => onNavigate("timeline")} label={t("shell_timeline", "Таймлайн")}>
                    <svg viewBox="0 0 15 15" fill="none" aria-hidden><rect x="1" y="3" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".5" /><rect x="3" y="8" width="4" height="2" rx="1" fill="currentColor" opacity=".65" /><rect x="8" y="8" width="3" height="2" rx="1" fill="currentColor" opacity=".4" /></svg>
                    {t("shell_timeline", "Таймлайн")}
                  </Ni>
                </>
              )}
            </>
          )}
        </div>

        {referenceLayout && showProjectNav && (
          <div className={"sb-sect" + (projectOpen ? "" : " sb-sect--collapsed")}>
            <SbLabel referenceLayout={referenceLayout} open={groups.project} onToggle={() => toggleGroup("project")} label={t("shell_current_project", "Current project")} />
            {projectOpen && (
              <>
                <Ni active={activeNav === "map"} onClick={() => onNavigate("map")} label={t("shell_strategy_map", "Strategy Map")}>
                  <svg viewBox="0 0 15 15" fill="none" aria-hidden><circle cx="3" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".7" /><circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".7" /><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".7" /><line x1="5" y1="7.5" x2="10" y2="3.8" stroke="currentColor" strokeWidth="1.1" opacity=".5" /><line x1="5" y1="7.5" x2="10" y2="11.2" stroke="currentColor" strokeWidth="1.1" opacity=".5" /></svg>
                  {t("shell_strategy_map", "Strategy Map")}
                </Ni>
                <Ni active={activeNav === "scenarios"} onClick={() => onNavigate("scenarios")} label={t("shell_scenarios", "Scenarios")}>
                  <svg viewBox="0 0 15 15" fill="none" aria-hidden><path d="M7.5 1.5v12M3 4.5l4.5-3 4.5 3M3 10.5l4.5 3 4.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".7" /></svg>
                  {t("shell_scenarios", "Scenarios")}
                  {(scenarioCount ?? 0) > 0 && <span className="ni-badge">{Math.min(99, scenarioCount!)}</span>}
                </Ni>
                <Ni active={activeNav === "timeline"} onClick={() => onNavigate("timeline")} label={t("shell_timeline", "Timeline")}>
                  <svg viewBox="0 0 15 15" fill="none" aria-hidden><line x1="1" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".5" /><rect x="2" y="6" width="5" height="2" rx=".8" fill="currentColor" opacity=".7" /><rect x="5" y="9" width="7" height="2" rx=".8" fill="currentColor" opacity=".55" /><rect x="8" y="12" width="4" height="2" rx=".8" fill="currentColor" opacity=".4" /></svg>
                  {t("shell_timeline", "Timeline")}
                </Ni>
                <Ni active={activeNav === "team"} onClick={() => onNavigate("team")} label={t("shell_team_nav", "Team")}>
                  <svg viewBox="0 0 15 15" fill="none" aria-hidden><circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".7" /><circle cx="10.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".5" /><path d="M1 12.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".7" /><path d="M10.5 8.5c1.5 0 3 .8 3 3" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".45" /></svg>
                  {t("shell_team_nav", "Team")}
                </Ni>
              </>
            )}
          </div>
        )}

        <div className={"sb-sect" + (aiOpen ? "" : " sb-sect--collapsed")}>
          <SbLabel referenceLayout={referenceLayout} open={groups.ai} onToggle={() => toggleGroup("ai")} label={t("shell_ai_insights_section", "AI & Insights")} />
          {aiOpen && (
            <>
              <Ni active={activeNav === "ai"} onClick={() => onNavigate("ai")} label={t("shell_ai_advisor", "AI Advisor")}>
                <svg viewBox="0 0 15 15" fill="none" aria-hidden><polygon points="7.5,1 9.3,5.5 14,5.5 10.4,8.4 11.8,13 7.5,10.2 3.2,13 4.6,8.4 1,5.5 5.7,5.5" fill="currentColor" opacity=".75" /></svg>
                {t("shell_ai_advisor", "AI Advisor")}
                <span className="ni-tag live">{t("shell_ai_live", "Live")}</span>
              </Ni>
              <Ni active={activeNav === "insights"} onClick={() => onNavigate("insights")} label={t("shell_insights", "Insights")}>
                <svg viewBox="0 0 15 15" fill="none" aria-hidden><polyline points="1,12 4,7 7.5,9.5 10.5,4.5 14,7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".75" /></svg>
                {t("shell_insights", "Insights")}
              </Ni>
              {(referenceLayout ? showContentPlan && onContentPlan : false) && (
                <Ni active={activeNav === "contentPlan"} onClick={() => onContentPlan!()} label={t("shell_content_plan", "Content Plan")}>
                  <svg viewBox="0 0 15 15" fill="none" aria-hidden><rect x="1" y="2" width="9" height="2" rx="1" fill="currentColor" opacity=".7" /><rect x="1" y="6" width="13" height="2" rx="1" fill="currentColor" opacity=".5" /><rect x="1" y="10" width="7" height="2" rx="1" fill="currentColor" opacity=".4" /></svg>
                  {t("shell_content_plan", "Content Plan")}
                </Ni>
              )}
            </>
          )}
        </div>

        {!referenceLayout && (
          <div className={"sb-sect" + (groups.settings ? "" : " sb-sect--collapsed")}>
            <button type="button" className="sb-lbl sb-lbl--btn" onClick={() => toggleGroup("settings")} aria-expanded={groups.settings}>
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden style={{ transition: "transform .22s ease", transform: groups.settings ? "rotate(0deg)" : "rotate(-90deg)", opacity: .55, flexShrink: 0 }}>
                <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{t("shell_settings_section", "Настройки")}</span>
            </button>
            {groups.settings && (
              <>
                <Ni active={activeNav === "team"} onClick={() => onNavigate("team")} label={t("shell_team_nav", "Команда")}>
                  <svg viewBox="0 0 15 15" fill="none" aria-hidden><circle cx="5.5" cy="4.5" r="2.5" fill="currentColor" opacity=".7" /><circle cx="10" cy="4.5" r="2" fill="currentColor" opacity=".45" /><path d="M1 12c0-2.5 2-4.5 4.5-4.5S10 9.5 10 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity=".5" /></svg>
                  {t("shell_team_nav", "Команда")}
                </Ni>
                <Ni active={activeNav === "settings"} onClick={() => onNavigate("settings")} label={t("shell_settings", "Настройки")}>
                  <svg viewBox="0 0 15 15" fill="none" aria-hidden><circle cx="7.5" cy="7.5" r="2.2" fill="currentColor" opacity=".65" /><path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.2 3.2l1.1 1.1M10.7 10.7l1.1 1.1M3.2 11.8l1.1-1.1M10.7 4.3l1.1-1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".5" /></svg>
                  {t("shell_settings", "Настройки")}
                </Ni>
              </>
            )}
          </div>
        )}
      </div>

      {onCrmClick && !referenceLayout && (
        <div className="crm-sync" onClick={onCrmClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onCrmClick(); }}>
          <div className="cs-head"><div className="cs-dot" /><span className="cs-title">{t("shell_crm_title", "CRM · демо")}</span></div>
          <div className="cs-sub">{t("shell_crm_sub", "Как в макете · интеграция позже")}</div>
        </div>
      )}
      <div className="sb-bottom">
        {onWeeklyBriefing && (
          <div className="briefing-badge" onClick={onWeeklyBriefing} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onWeeklyBriefing(); }}>
            <div className="bb-icon" aria-hidden>📋</div>
            <div>
              <div className="bb-title">{t("weekly_briefing", "Weekly Briefing")}</div>
              <div className="bb-sub">{briefingHint || t("shell_briefing_sub", "Strategy health")}</div>
            </div>
          </div>
        )}
        {showTrialBanner && (
          <div className="sb-trial" onClick={onTierClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onTierClick(); }}>
            <div className="sb-trial-title">
              {trialDaysLeft != null && trialDaysLeft > 0
                ? <>⚡ {t("shell_trial_label", "Trial")} · {t("shell_trial_days", "{n} days left").replace("{n}", String(trialDaysLeft))}</>
                : <>⚡ {t("shell_trial_title", "Upgrade plan")}</>}
            </div>
            <div className="sb-trial-sub">{t("shell_trial_sub", "Upgrade to keep Pro features")}</div>
          </div>
        )}
        <div className="lang-row sb-bottom-lang">
          {(["en", "ru", "uz"] as const).map(code => (
            <button key={code} type="button" className={`lang-btn${lang === code ? " on" : ""}`} onClick={() => onLang(code)}>{code.toUpperCase()}</button>
          ))}
        </div>
        <div className="sb-user" onClick={onUserCard} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onUserCard(); }}>
          <div className="u-av">{initial}</div>
          <div className="u-info">
            <div className="u-name">{userName || userEmail.split("@")[0]}</div>
            {referenceLayout ? <div className="u-role">{tierLabel}</div> : <span className="u-tier-pill">{tierLabel}</span>}
          </div>
          <div className="u-online" />
        </div>
      </div>
      {onLogout && !referenceLayout && (
        <button type="button" className="sa-shell-logout" onClick={onLogout}>{t("logout", "Log out")}</button>
      )}
    </aside>
  );
}

export function StrategyShellBg() {
  return (
    <>
      <div className="sa-bgd" aria-hidden><div className="orb o1" /><div className="orb o2" /><div className="orb o3" /></div>
      <div className="sa-bgl" aria-hidden><div className="base" /><div className="orb o1" /><div className="orb o2" /><div className="orb o3" /></div>
    </>
  );
}
