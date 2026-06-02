import React, { useEffect, useMemo, useState } from "react";
import { getProjects } from "../api";
import { getMaps } from "../lib/maps-api";
import { useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { TIERS } from "../lib/tiers";
import { getSTATUS } from "../lib/strategy-labels";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "../../strategy-shell-sidebar";
import { AppTopBar } from "../components/app-top-bar";
import { AiPanel } from "../map-editor/ai-panel";

export function AiAdvisorPage({
  user,
  theme,
  onToggleTheme,
  onProfile,
  onLogout,
  onChangeTier,
  onShellNav,
  onOpenContentPlanHub,
  aiChatMsgs,
  aiChatSetMsgs,
}: {
  user: any;
  theme: string;
  onToggleTheme: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onChangeTier?: () => void;
  onShellNav: (nav: StrategyShellNav) => void;
  onOpenContentPlanHub?: (() => void) | null;
  aiChatMsgs?: any[];
  aiChatSetMsgs?: (m: any[]) => void;
}) {
  const { t, lang, setLang } = useLang();
  const isMobile = useIsMobile();
  const tier = TIERS[user?.tier || "free"] || TIERS.free;
  const STATUS = getSTATUS(t);

  const [projects, setProjects] = useState<any[]>([]);
  const [allNodes, setAllNodes] = useState<any[]>([]);
  const [allEdges, setAllEdges] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const ps = await getProjects(user.email);
        setProjects(Array.isArray(ps) ? ps : []);
        const ns: any[] = []; const es: any[] = [];
        for (const p of (ps || [])) {
          try {
            const ms = await getMaps(p.id);
            for (const mm of (ms || [])) { (mm.nodes || []).forEach((n: any) => ns.push(n)); (mm.edges || []).forEach((e: any) => es.push(e)); }
          } catch { /* — */ }
        }
        setAllNodes(ns); setAllEdges(es);
      } catch { setProjects([]); setAllNodes([]); setAllEdges([]); }
    })();
  }, [user?.email]);

  useEffect(() => { document.title = t("ai_doc_title", "Strategy AI — AI советник"); }, [t]);

  const ctx = useMemo(() => `Портфель: ${projects.slice(0, 20).map((p) => `«${p.name}»`).join(", ")}. Проектов: ${projects.length}, узлов: ${allNodes.length}.`, [projects, allNodes.length]);

  const shellUi = !!user && !isMobile;

  const chat = (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", maxWidth: "min(1040px,100%)", width: "100%", margin: "0 auto", padding: shellUi ? "0 24px 16px" : 0 }}>
      <div className="glass-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
        <AiPanel
          embedded={true}
          isMobile={isMobile}
          nodes={allNodes.slice(0, 240)}
          edges={allEdges.slice(0, 280)}
          ctx={ctx}
          tier={user?.tier || "free"}
          projectName={t("all_projects", "Все проекты")}
          mapName=""
          userName={user?.name || user?.email || ""}
          msgs={aiChatMsgs || []}
          onMsgsChange={aiChatSetMsgs || (() => {})}
          onAddNode={() => {}}
          onClose={() => {}}
          externalMsgs={[]}
          onClearExternal={() => {}}
          onError={() => {}}
          statusMap={STATUS}
        />
      </div>
    </div>
  );

  const body = (
    <>
      {shellUi ? (
        <AppTopBar title={t("shell_ai_advisor", "AI советник")} subtitle={t("ai_subtitle", "Контекстный советник по вашей стратегии")} />
      ) : (
        <div className="sa-app-topbar">
          <div className="atb-cluster" style={{ minWidth: 0 }}>
            <div className="land-logo" style={{ gap: 10 }}><div className="land-gem" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 12 }}>SA</div><span className="land-brand" style={{ fontSize: 15 }}>Strategy AI</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <button onClick={onToggleTheme} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text3)", cursor: "pointer", fontSize: 13 }}>{theme === "dark" ? "☀️" : "🌙"}</button>
          </div>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingTop: shellUi ? 18 : 12 }}>{chat}</div>
    </>
  );

  return shellUi ? (
    <div className={"sa-strategy-ui sa-v-app " + (theme === "dark" ? "dk" : "lt")} data-theme={theme} style={{ width: "100%", height: "100%", minHeight: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter',system-ui,sans-serif", overflow: "hidden" }}>
      <StrategyShellBg />
      <div className="sa-app" style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <StrategyShellSidebar
          theme={theme}
          onToggleTheme={onToggleTheme}
          activeNav="ai"
          onNavigate={onShellNav}
          tierLabel={tier.label}
          tierColor={tier.color}
          onTierClick={onChangeTier || onProfile}
          lang={lang}
          onLang={(code) => setLang(code)}
          userName={user.name || ""}
          userEmail={user.email || ""}
          projectCount={projects.length}
          onUserCard={onProfile}
          onLogout={onLogout}
          showContentPlan={!!onOpenContentPlanHub}
          onContentPlan={onOpenContentPlanHub ? () => onOpenContentPlanHub() : undefined}
          showTrialBanner={(user?.tier || "free") === "free"}
          onLogoClick={() => onShellNav("dashboard")}
          t={t}
        />
        <div className="sa-main" style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>{body}</div>
      </div>
    </div>
  ) : (
    <div className={"sa-strategy-ui " + (theme === "dark" ? "dk" : "lt")} data-theme={theme} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter',system-ui,sans-serif", overflow: "hidden", position: "relative" }}>
      <StrategyShellBg />
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", position: "relative", zIndex: 1, overflow: "hidden" }}>{body}</div>
    </div>
  );
}
