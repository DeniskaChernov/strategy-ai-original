import React, { useEffect, useMemo, useState, useCallback } from "react";
import { API_BASE, getProjects } from "../api";
import { getMapsByProject } from "../lib/maps-api";
import { useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useCountUp } from "../hooks/use-count-up";
import { TIERS } from "../lib/tiers";
import { getSTATUS } from "../lib/strategy-labels";
import { useNotifications } from "../hooks/use-notifications";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "../../strategy-shell-sidebar";
import { WorkspaceTopBar } from "../components/workspace-top-bar";
import { NotifBell } from "../components/notif-bell";
import { NotificationsCenterModal, AiHubModal } from "../strategy-modals/notifications-ai-hub-modals";
import { AiPanel } from "../map-editor/ai-panel";
import { WeeklyBriefingModal } from "../strategy-modals/weekly-briefing-modal";
import { FloatingAiAssistant } from "../floating-ai-assistant";

type ProjLite = { id: string; name: string; owner?: string; updatedAt?: number; updated_at?: number };

function toMs(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Date.parse(String(v));
  return Number.isFinite(n) ? n : 0;
}

function trialDaysRemaining(user: any): number | null {
  const raw = user?.trialEndsAt ?? user?.trial_ends_at;
  if (!raw) return null;
  const end = new Date(raw);
  if (Number.isNaN(end.getTime()) || end <= new Date()) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

export function DashboardPage({
  user,
  theme,
  onToggleTheme,
  onProfile,
  onLogout,
  onChangeTier,
  onShellNav,
  onOpenProject,
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
  onOpenProject?: (project: any) => void;
  onOpenContentPlanHub?: (() => void) | null;
  aiChatMsgs?: any[];
  aiChatSetMsgs?: (m: any[]) => void;
}) {
  const { t, lang, setLang } = useLang();
  const isMobile = useIsMobile();
  const tier = TIERS[user?.tier || "free"] || TIERS.free;
  const STATUS = getSTATUS(t);

  const [projects, setProjects] = useState<ProjLite[]>([]);
  const [mapsByProj, setMapsByProj] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showAIHub, setShowAIHub] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const { notifs, setNotifs, notifUnread, setNotifUnread, notifLoading, loadNotifications } = useNotifications(showNotifs, user?.email);

  const trialDays = trialDaysRemaining(user);
  const showTrialCard = (user?.tier || "free") === "free" || trialDays != null;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ps = await getProjects(user.email);
        const list = Array.isArray(ps) ? ps : [];
        setProjects(list);
        setMapsByProj(await getMapsByProject(list.map((p: any) => p.id)));
      } catch { setProjects([]); setMapsByProj({}); }
      finally { setLoading(false); }
    })();
  }, [user?.email]);

  useEffect(() => { document.title = t("dash_doc_title", "Strategy AI — Обзор"); }, [t]);

  const allMaps = useMemo(() => Object.values(mapsByProj).flatMap((a) => (Array.isArray(a) ? a : [])), [mapsByProj]);
  const allNodes = useMemo(() => allMaps.flatMap((m: any) => m?.nodes || []), [allMaps]);

  const stats = useMemo(() => {
    const total = allNodes.length;
    const prog = total ? Math.round(allNodes.reduce((s: number, n: any) => s + (Number(n.progress) || 0), 0) / total) : 0;
    const onTrack = allNodes.filter((n: any) => n.status === "active" || n.status === "completed").length;
    const risks = allNodes.filter((n: any) => n.priority === "critical" || n.status === "blocked").length;
    const activeProjects = projects.filter((p) => ((mapsByProj[p.id] || []).length > 0)).length;
    return { projects: projects.length, activeProjects, nodes: total, progress: prog, onTrack, risks };
  }, [allNodes, projects, mapsByProj]);

  const briefingHint = useMemo(() => {
    if (loading) return t("loading_short", "Загрузка…");
    const health = stats.nodes
      ? Math.max(0, Math.min(100, Math.round(stats.progress * 0.7 + (stats.onTrack / stats.nodes) * 30 - stats.risks * 4)))
      : 0;
    return t("shell_briefing_health", "Здоровье стратегии · {n}%").replace("{n}", String(health));
  }, [loading, stats, t]);

  const goals = useMemo(() => {
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...allNodes]
      .filter((n: any) => n.status !== "completed")
      .sort((a: any, b: any) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2) || (Number(b.progress) || 0) - (Number(a.progress) || 0))
      .slice(0, 4);
  }, [allNodes]);

  const recent = useMemo(() => {
    return allMaps
      .filter((m: any) => m?.updatedAt || m?.updated_at)
      .map((m: any) => ({ name: m.name || t("untitled", "Без названия"), at: toMs(m.updatedAt || m.updated_at), nodes: (m.nodes || []).length }))
      .filter((m) => m.at > 0)
      .sort((a, b) => b.at - a.at)
      .slice(0, 5);
  }, [allMaps, t]);

  const aiNodes = allNodes.slice(0, 220);
  const aiEdges = allMaps.flatMap((m: any) => m?.edges || []).slice(0, 260);
  const aiCtx = `Портфель: ${projects.slice(0, 20).map((p) => `«${p.name}»`).join(", ")}. Проектов: ${projects.length}, узлов: ${allNodes.length}.`;

  const hour = new Date().getHours();
  const greet = hour < 6 ? t("greet_night", "Доброй ночи") : hour < 12 ? t("greet_morning", "Доброе утро") : hour < 18 ? t("greet_day", "Добрый день") : t("greet_evening", "Добрый вечер");
  const dateStr = new Date().toLocaleDateString(lang === "en" ? "en-US" : lang === "uz" ? "uz" : "ru-RU", { weekday: "long", day: "numeric", month: "long" });

  const shellUi = !!user && !isMobile;

  const openNewProject = useCallback(() => {
    try { sessionStorage.setItem("sa_open_new_project", "1"); } catch { /* — */ }
    onShellNav("projects");
  }, [onShellNav]);

  const openGlobalSearch = useCallback(() => {
    try { sessionStorage.setItem("sa_focus_search", "1"); } catch { /* — */ }
    onShellNav("projects");
  }, [onShellNav]);

  useEffect(() => {
    if (!shellUi) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openGlobalSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shellUi, openGlobalSearch]);

  function relTime(ts?: number) {
    if (!ts) return "";
    const diff = Date.now() - toMs(ts);
    if (!Number.isFinite(diff)) return "";
    const h = Math.floor(diff / 3.6e6);
    if (h < 1) return t("just_now", "только что");
    if (h < 24) return t("hours_ago", "{n} ч. назад").replace("{n}", String(h));
    const d = Math.floor(h / 24);
    if (d === 1) return t("yesterday", "вчера");
    return t("days_ago_n", "{n} дн. назад").replace("{n}", String(d));
  }

  const CountUp = ({ n, suffix = "", loading: ld }: { n: number; suffix?: string; loading?: boolean }) => {
    const v = useCountUp(ld ? 0 : n);
    if (ld) return <>—</>;
    return <>{Math.round(v)}{suffix}</>;
  };

  const KPI_CARDS = [
    {
      icon: "📁",
      color: "var(--acc)",
      value: <CountUp n={stats.projects} loading={loading} />,
      label: t("dash_projects_upper", "ПРОЕКТЫ"),
      trend: t("dash_projects_active_n", "↗ {n} активных").replace("{n}", String(stats.activeProjects)),
      trendCls: "neu" as const,
      onClick: () => onShellNav("projects"),
    },
    {
      icon: "🗺️",
      color: "var(--green)",
      value: <CountUp n={stats.nodes} loading={loading} />,
      label: t("dash_nodes_upper", "УЗЛЫ СТРАТЕГИИ"),
      trend: stats.onTrack > 0 ? `↑ ${stats.onTrack} ${t("dash_on_track_short", "в графике")}` : "→",
      trendCls: "up" as const,
      onClick: () => onShellNav("insights"),
    },
    {
      icon: "📈",
      color: "var(--amber)",
      value: <><CountUp n={stats.progress} suffix="%" loading={loading} /></>,
      label: t("dash_avg_progress_upper", "СРЕДНИЙ ПРОГРЕСС"),
      trend: stats.progress >= 50 ? `↑ ${t("dash_on_track_label", "В графике")}` : `↓ ${t("dash_review_needed", "Нужна проверка")}`,
      trendCls: (stats.progress >= 50 ? "up" : "dn") as const,
      onClick: () => onShellNav("insights"),
    },
    {
      icon: "⚠️",
      color: "var(--cyan)",
      value: <CountUp n={stats.risks} loading={loading} />,
      label: t("dash_active_risks_upper", "АКТИВНЫЕ РИСКИ"),
      trend: stats.risks ? `↓ ${t("dash_review_needed", "Нужна проверка")}` : `→ ${t("dash_all_clear_short", "Всё спокойно")}`,
      trendCls: (stats.risks ? "dn" : "neu") as const,
      onClick: () => onShellNav("ai"),
    },
  ];

  const ACTIVITY_STYLES = [
    { bg: "rgba(104,54,245,.12)", ic: "🎯" },
    { bg: "rgba(18,196,130,.12)", ic: "⚡" },
    { bg: "rgba(6,182,212,.12)", ic: "🤖" },
    { bg: "rgba(240,148,40,.12)", ic: "🔗" },
    { bg: "rgba(251,191,36,.12)", ic: "📈" },
  ];

  const displayName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "";

  const body = (
    <>
      {shellUi ? (
        <WorkspaceTopBar
          title={t("shell_dashboard", "Дашборд")}
          subtitle={t("dash_subtitle", "Ваша стратегия с одного экрана")}
          theme={theme}
          onToggleTheme={onToggleTheme}
          searchPlaceholder={t("dash_search_ph", "Поиск… (⌘K)")}
          onSearchClick={openGlobalSearch}
          notifUnread={notifUnread}
          onNotifs={() => setShowNotifs(true)}
          showNotifs={!!API_BASE}
          onSettings={onProfile}
          onNewProject={openNewProject}
          newProjectLabel={t("dash_new_project", "Новый проект")}
        />
      ) : (
        <div className="sa-app-topbar">
          <div className="atb-cluster" style={{ minWidth: 0 }}>
            <div className="land-logo" style={{ gap: 10 }}>
              <div className="land-gem" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 12 }}>SA</div>
              <span className="land-brand" style={{ fontSize: 15 }}>Strategy AI</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <button type="button" className="btn-g" onClick={openNewProject} style={{ height: 32, fontSize: 11.5, fontWeight: 800 }}>+ {t("project_short", "Проект")}</button>
            <button onClick={onToggleTheme} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text3)", cursor: "pointer", fontSize: 13 }}>{theme === "dark" ? "☀️" : "🌙"}</button>
            {API_BASE && <NotifBell unread={notifUnread} onClick={() => setShowNotifs(true)} className="btn-ic" />}
            <button type="button" className="btn-g" onClick={onProfile} style={{ height: 32, padding: "0 12px" }}>{(user?.name || user?.email || "?")[0].toUpperCase()}</button>
          </div>
        </div>
      )}

      <div className={shellUi ? "scr" : undefined} style={{ flex: 1, overflowY: "auto", padding: shellUi ? undefined : isMobile ? 16 : 24, position: "relative", zIndex: 5, minHeight: 0 }}>
        <div style={{ maxWidth: "min(1160px,100%)", width: "100%", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--t1)", letterSpacing: "-.03em" }}>
                {greet}, {displayName} <span aria-hidden>👋</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 3 }}>{dateStr}</div>
            </div>
            {shellUi && (
              <button type="button" className="btn-p" onClick={() => setShowBriefing(true)}>
                📋 {t("weekly_briefing", "Еженедельный брифинг")}
              </button>
            )}
          </div>

          <div className="dash-grid">
            {KPI_CARDS.map((k, i) => (
              <div key={i} className="dash-card glow-card" onClick={k.onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") k.onClick(); }}>
                <div style={{ fontSize: 20, marginBottom: 6 }} aria-hidden>{k.icon}</div>
                <div className="dc-val" style={{ color: k.color }}>{k.value}</div>
                <div className="dc-lbl">{k.label}</div>
                <div className={`dc-trend ${k.trendCls}`}>{k.trend}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div className="slbl">{t("dash_recent_activity", "Последняя активность")}</div>
              <div className="card">
                {loading ? (
                  <div className="act-text" style={{ color: "var(--t3)" }}>{t("loading_short", "Загрузка…")}</div>
                ) : recent.length === 0 ? (
                  <div className="act-text" style={{ color: "var(--t3)" }}>{t("dash_no_activity", "Пока нет активности — создайте карту.")}</div>
                ) : (
                  recent.map((r, i) => {
                    const st = ACTIVITY_STYLES[i % ACTIVITY_STYLES.length];
                    return (
                      <div key={i} className="activity-item">
                        <div className="act-icon" style={{ background: st.bg }} aria-hidden>{st.ic}</div>
                        <div className="act-text">
                          <strong>{r.name}</strong>{" "}
                          {t("dash_act_map_updated_plain", "обновлена · {n} узлов").replace("{n}", String(r.nodes))}
                        </div>
                        <div className="act-time">{relTime(r.at)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <div className="slbl">{t("dash_goals", "Цели")}</div>
              <div className="card">
                {loading ? (
                  <div style={{ color: "var(--t3)", fontSize: 12.5 }}>{t("loading_short", "Загрузка…")}</div>
                ) : goals.length === 0 ? (
                  <div style={{ color: "var(--t3)", fontSize: 12.5 }}>{t("dash_no_goals", "Нет шагов — добавьте их на карте.")}</div>
                ) : (
                  goals.map((n: any, i: number) => {
                    const pct = Math.max(0, Math.min(100, Number(n.progress) || 0));
                    const barColor = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--acc)" : "var(--amber)";
                    return (
                      <div
                        key={n.id || i}
                        style={{ padding: "10px 14px", borderBottom: ".5px solid var(--b0)", cursor: "pointer" }}
                        onClick={() => onShellNav("map")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onShellNav("map"); }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{n.title || t("untitled", "Без названия")}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--acc)" }}>{pct}%</div>
                        </div>
                        <div style={{ height: 3, background: "var(--b0)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: pct + "%", height: "100%", background: barColor, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNotifs && (
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
          onFollowLink={async (n: any) => { if (n.link) window.location.href = n.link; }}
        />
      )}
      {showAIHub && (
        <AiHubModal open={showAIHub} onClose={() => setShowAIHub(false)} isMobile={isMobile} t={t} hint={t("ai_hub_hint", "Этот чат общий для всего приложения. Здесь AI видит портфель проектов и загруженные карты.")}>
          <AiPanel
            embedded={true}
            isMobile={isMobile}
            nodes={aiNodes}
            edges={aiEdges}
            ctx={aiCtx}
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
        </AiHubModal>
      )}
      {showBriefing && (
        <WeeklyBriefingModal nodes={allNodes} mapName={t("all_projects", "Все проекты")} user={user} onClose={() => setShowBriefing(false)} theme={theme} onError={() => {}} />
      )}
      <FloatingAiAssistant t={t} variant="app" onOpenFullChat={() => setShowAIHub(true)} />
    </>
  );

  return shellUi ? (
    <div className={"sa-strategy-ui sa-v-app " + (theme === "dark" ? "dk" : "lt")} data-theme={theme} style={{ width: "100%", height: "100%", minHeight: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter',system-ui,sans-serif", overflow: "hidden" }}>
      <StrategyShellBg />
      <div className="sa-app" style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <StrategyShellSidebar
          theme={theme}
          onToggleTheme={onToggleTheme}
          activeNav="dashboard"
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
          showTrialBanner={showTrialCard}
          trialDaysLeft={trialDays}
          onWeeklyBriefing={() => setShowBriefing(true)}
          briefingHint={briefingHint}
          layoutMode="ref"
          onLogoClick={() => { try { document.querySelector(".sa-main .scr")?.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* — */ } }}
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
