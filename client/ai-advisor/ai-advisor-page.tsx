import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, getProjects } from "../api";
import { getMapsByProject } from "../lib/maps-api";
import { useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useNotifications } from "../hooks/use-notifications";
import { TIERS } from "../lib/tiers";
import { getSTATUS } from "../lib/strategy-labels";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "../../strategy-shell-sidebar";
import { WorkspaceTopBar } from "../components/workspace-top-bar";
import { NotifBell } from "../components/notif-bell";
import { ThemeTogglePill } from "../components/theme-toggle-pill";
import { NotificationsCenterModal } from "../strategy-modals/notifications-ai-hub-modals";
import { AiPanel } from "../map-editor/ai-panel";
import { followNotificationLink } from "../lib/notif-deep-link";

export function AiAdvisorPage({
  user,
  theme,
  onToggleTheme,
  onProfile,
  onLogout,
  onChangeTier,
  onShellNav,
  onOpenContentPlanHub,
  onOpenProject,
  onOpenMap,
  onOpenContentPlanProject,
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
  onOpenProject?: (p: any) => void;
  onOpenMap?: (map: any, project: any, isNew?: boolean, readOnly?: boolean, focusNodeId?: string | null) => void;
  onOpenContentPlanProject?: (p: any, maps: any[]) => void;
  aiChatMsgs?: any[];
  aiChatSetMsgs?: (m: any[]) => void;
}) {
  const { t, lang, setLang } = useLang();
  const isMobile = useIsMobile();
  const tier = TIERS[user?.tier || "free"] || TIERS.free;
  const STATUS = getSTATUS(t);

  const [projects, setProjects] = useState<any[]>([]);
  const [mapsByProj, setMapsByProj] = useState<Record<string, any[]>>({});
  const [allNodes, setAllNodes] = useState<any[]>([]);
  const [allEdges, setAllEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [aiQuickAsk, setAiQuickAsk] = useState<string | null>(null);
  const { notifs, setNotifs, notifUnread, setNotifUnread, notifLoading, loadNotifications } = useNotifications(showNotifs, user?.email);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setLoadErr(null);
      try {
        const ps = await getProjects(user.email);
        const list = Array.isArray(ps) ? ps : [];
        if (!alive) return;
        setProjects(list);
        const byProj = await getMapsByProject(list.map((p: any) => p.id));
        if (!alive) return;
        setMapsByProj(byProj || {});
        const ns: any[] = []; const es: any[] = [];
        for (const ms of Object.values(byProj)) {
          for (const mm of (ms || [])) { (mm.nodes || []).forEach((n: any) => ns.push(n)); (mm.edges || []).forEach((e: any) => es.push(e)); }
        }
        if (!alive) return;
        setAllNodes(ns); setAllEdges(es);
      } catch (e: any) {
        if (!alive) return;
        setProjects([]); setAllNodes([]); setAllEdges([]);
        setLoadErr(e?.message || t("ai_ctx_load_err", "Не удалось загрузить контекст портфеля"));
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [user?.email, reloadKey]);

  useEffect(() => { document.title = t("ai_doc_title", "Strategy AI — AI советник"); }, [t]);

  const ctx = useMemo(() => `Портфель: ${projects.slice(0, 20).map((p) => `«${p.name}»`).join(", ")}. Проектов: ${projects.length}, узлов: ${allNodes.length}.`, [projects, allNodes.length]);

  const shellUi = !!user && !isMobile;

  const ctxStrip = (
    <div style={{ maxWidth: "min(1040px,100%)", width: "100%", margin: "0 auto", padding: shellUi ? "0 24px 10px" : "0 12px 10px" }}>
      <div className="sa-page-reveal sa-ctx-strip">
        {loading ? (
          <><span className="sa-ai-ctx-dot" style={{ width: 8, height: 8, borderRadius: 999, background: "var(--acc,#a78bfa)", animation: "saPulseDot 1s ease-in-out infinite" }} aria-hidden />{t("ai_ctx_loading", "Загружаю контекст портфеля…")}</>
        ) : loadErr ? (
          <><span aria-hidden>⚠️</span><span style={{ color: "var(--text2)" }}>{loadErr}</span><button type="button" onClick={() => setReloadKey((k) => k + 1)} style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 10px", color: "var(--acc,#a78bfa)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{t("retry", "Повторить")}</button></>
        ) : (
          <><span aria-hidden style={{ color: "#34d399" }}>✦</span><span><b style={{ color: "var(--text2)" }}>{t("ai_ctx_ready", "AI видит ваш портфель")}:</b> {t("ai_ctx_summary", "{p} проектов · {n} узлов · {e} связей").replace("{p}", String(projects.length)).replace("{n}", String(allNodes.length)).replace("{e}", String(allEdges.length))}</span></>
        )}
      </div>
    </div>
  );

  const quickPortfolio = [
    t("ai_q_gaps", "📊 Analyze my strategy for gaps"),
    t("ai_q_risks", "⚠️ What are my top risks?"),
    t("ai_q_prioritize", "🎯 Prioritize Q2 initiatives"),
    t("ai_q_kpis", "📈 What KPIs should I track?"),
  ];

  const chat = (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: shellUi ? "row" : "column", overflow: "hidden" }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", maxWidth: shellUi ? undefined : "min(1040px,100%)", width: "100%", margin: shellUi ? undefined : "0 auto", padding: shellUi ? 0 : "0 12px 16px", borderRight: shellUi ? ".5px solid var(--b1)" : undefined, minWidth: 0 }}>
        {shellUi ? (
          <AiPanel
            referenceShell={true}
            embedded={true}
            isMobile={isMobile}
            nodes={allNodes.slice(0, 240)}
            edges={allEdges.slice(0, 280)}
            ctx={ctx}
            tier={user?.tier || "free"}
            projectName={t("all_projects", "All projects")}
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
            promptToSend={aiQuickAsk}
            onPromptSent={() => setAiQuickAsk(null)}
          />
        ) : (
          <div className="sa-ai-chat-shell sa-page-reveal sa-pr-d2" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <AiPanel embedded={true} isMobile={isMobile} nodes={allNodes.slice(0, 240)} edges={allEdges.slice(0, 280)} ctx={ctx} tier={user?.tier || "free"} projectName={t("all_projects", "Все проекты")} mapName="" userName={user?.name || user?.email || ""} msgs={aiChatMsgs || []} onMsgsChange={aiChatSetMsgs || (() => {})} onAddNode={() => {}} onClose={() => {}} externalMsgs={[]} onClearExternal={() => {}} onError={() => {}} statusMap={STATUS} />
          </div>
        )}
      </div>
      {shellUi && (
        <div className="ai-sidebar">
          <div className="ais-head">{t("ai_quick_questions", "Quick questions")}</div>
          <div className="ais-body">
            <div style={{ fontSize: 11.5, color: "var(--t2)", lineHeight: 1.6, background: "var(--card)", border: ".5px solid var(--b1)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>{t("all_projects", "All projects")}</div>
              <div>📁 {projects.length} {t("shell_projects", "projects")}</div>
              <div>◈ {allNodes.length} {t("steps_label", "nodes")}</div>
            </div>
            {quickPortfolio.map((q) => (
              <button key={q} type="button" className="qa-btn" onClick={() => setAiQuickAsk(q.replace(/^[^\s]+\s/, ""))}>{q}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const body = (
    <>
      {shellUi ? (
        <WorkspaceTopBar
          title={t("shell_ai_advisor", "AI Advisor")}
          subtitle={t("ai_subtitle", "Contextual advisor for your strategy")}
          theme={theme}
          onToggleTheme={onToggleTheme}
          searchPlaceholder={t("dash_search_ph", "Search… (⌘K)")}
          showSearch={false}
          notifUnread={notifUnread}
          onNotifs={() => setShowNotifs(true)}
          showNotifs={!!API_BASE}
          onSettings={onProfile}
          newProjectLabel={t("new_project", "New project")}
        />
      ) : (
        <div className="sa-app-topbar">
          <div className="atb-cluster" style={{ minWidth: 0 }}>
            <div className="land-logo" style={{ gap: 10 }}><div className="land-gem" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 12 }}>SA</div><span className="land-brand" style={{ fontSize: 15 }}>Strategy AI</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            {API_BASE && <NotifBell unread={notifUnread} onClick={() => setShowNotifs(true)} className="btn-ic" />}
            <ThemeTogglePill theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      )}
      {ctxStrip}
      <div className={shellUi ? "sa-screen-ai scr" : undefined} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingTop: shellUi ? 0 : 12 }}>{chat}</div>
    </>
  );

  const notifsModal = showNotifs ? (
    <NotificationsCenterModal
      open={showNotifs}
      onClose={() => setShowNotifs(false)}
      isMobile={isMobile}
      zIndex={260}
      notifs={notifs}
      setNotifs={setNotifs}
      notifUnread={notifUnread}
      setNotifUnread={setNotifUnread}
      notifLoading={notifLoading}
      lang={lang}
      t={t}
      loadNotifications={loadNotifications}
      showItemMeta={false}
      deleteGlyph="×"
      onFollowLink={async (n: any) => {
        if (!n.link) return;
        setShowNotifs(false);
        const ok = await followNotificationLink(n.link, {
          onContentPlan: (pid) => { const p = projects.find((x: any) => x.id === pid); if (p && onOpenContentPlanProject) onOpenContentPlanProject(p, mapsByProj[pid] || []); else if (onOpenContentPlanHub) onOpenContentPlanHub(); },
          onProject: (pid) => { const p = projects.find((x: any) => x.id === pid); if (p && onOpenProject) onOpenProject(p); },
          onMap: (pid, mid, nid) => { const p = projects.find((x: any) => x.id === pid); if (p && onOpenMap) onOpenMap({ id: mid }, p, false, false, nid); },
        });
        if (!ok) window.location.href = n.link;
      }}
    />
  ) : null;

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
          onWeeklyBriefing={() => setAiQuickAsk(t("ai_q_gaps", "Analyze my strategy for gaps"))}
          briefingHint={t("shell_briefing_sub", "Strategy health")}
          onLogoClick={() => onShellNav("dashboard")}
          layoutMode="reference"
          t={t}
        />
        <div className="sa-main" style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>{body}</div>
      </div>
      {notifsModal}
    </div>
  ) : (
    <div className={"sa-strategy-ui " + (theme === "dark" ? "dk" : "lt")} data-theme={theme} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter',system-ui,sans-serif", overflow: "hidden", position: "relative" }}>
      <StrategyShellBg />
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", position: "relative", zIndex: 1, overflow: "hidden" }}>{body}</div>
      {notifsModal}
    </div>
  );
}
