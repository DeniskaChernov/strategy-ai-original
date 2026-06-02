import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, getProjects } from "../api";
import { getMapsByProject } from "../lib/maps-api";
import { useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useCountUp } from "../hooks/use-count-up";
import { TIERS } from "../lib/tiers";
import { getSTATUS } from "../lib/strategy-labels";
import { useNotifications } from "../hooks/use-notifications";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "../../strategy-shell-sidebar";
import { AppTopBar } from "../components/app-top-bar";
import { NotifBell } from "../components/notif-bell";
import { NotificationsCenterModal, AiHubModal } from "../strategy-modals/notifications-ai-hub-modals";
import { AiPanel } from "../map-editor/ai-panel";
import { WeeklyBriefingModal } from "../strategy-modals/weekly-briefing-modal";
import { FloatingAiAssistant } from "../floating-ai-assistant";

type ProjLite = { id: string; name: string; owner?: string; updatedAt?: number; updated_at?: number };

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
    return { projects: projects.length, nodes: total, progress: prog, onTrack, risks };
  }, [allNodes, projects.length]);

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
      .map((m: any) => ({ name: m.name || t("untitled", "Без названия"), at: m.updatedAt || m.updated_at, nodes: (m.nodes || []).length }))
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .slice(0, 5);
  }, [allMaps, t]);

  const aiNodes = allNodes.slice(0, 220);
  const aiEdges = allMaps.flatMap((m: any) => m?.edges || []).slice(0, 260);
  const aiCtx = `Портфель: ${projects.slice(0, 20).map((p) => `«${p.name}»`).join(", ")}. Проектов: ${projects.length}, узлов: ${allNodes.length}.`;

  const hour = new Date().getHours();
  const greet = hour < 6 ? t("greet_night", "Доброй ночи") : hour < 12 ? t("greet_morning", "Доброе утро") : hour < 18 ? t("greet_day", "Добрый день") : t("greet_evening", "Добрый вечер");
  const dateStr = new Date().toLocaleDateString(lang === "en" ? "en-US" : lang === "uz" ? "uz" : "ru-RU", { weekday: "long", day: "numeric", month: "long" });

  const shellUi = !!user && !isMobile;

  function relTime(ts?: number) {
    if (!ts) return "";
    const diff = Date.now() - ts;
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

  const StatCard = ({ icon, value, label, sub, accent }: { icon: React.ReactNode; value: React.ReactNode; label: string; sub?: string; accent: string }) => (
    <div className="sa-dash-stat glass-card sa-lift" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, background: accent + "1f", color: accent }}>{icon}</div>
      <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: accent, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .8, textTransform: "uppercase", color: "var(--text4)" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );

  const body = (
    <>
      {shellUi && (
        <AppTopBar
          title={t("shell_dashboard", "Обзор")}
          subtitle={t("dash_subtitle", "Ваша стратегия с высоты птичьего полёта")}
          rightContent={
            <>
              <button type="button" className="btn-g" onClick={() => setShowBriefing(true)} style={{ height: 32, fontSize: 11.5, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <span aria-hidden>📋</span>{t("weekly_briefing_short", "Брифинг")}
              </button>
              <button type="button" className="btn-g" onClick={() => setShowAIHub(true)} title={t("ai_hub_title", "✦ AI (единый чат)")} style={{ height: 32, fontSize: 11.5, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden>✦</span>{t("ai_hub_btn_short", "AI-чат")}
              </button>
              {API_BASE && <NotifBell unread={notifUnread} onClick={() => setShowNotifs(true)} className="btn-ic" />}
            </>
          }
        />
      )}
      {!shellUi && (
        <div className="sa-app-topbar">
          <div className="atb-cluster" style={{ minWidth: 0 }}>
            <div className="land-logo" style={{ gap: 10 }}>
              <div className="land-gem" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 12 }}>SA</div>
              <span className="land-brand" style={{ fontSize: 15 }}>Strategy AI</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <button onClick={onToggleTheme} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text3)", cursor: "pointer", fontSize: 13 }}>{theme === "dark" ? "☀️" : "🌙"}</button>
            {API_BASE && <NotifBell unread={notifUnread} onClick={() => setShowNotifs(true)} className="btn-ic" />}
            <button type="button" className="btn-g" onClick={onProfile} style={{ height: 32, padding: "0 12px" }}>{(user?.name || user?.email || "?")[0].toUpperCase()}</button>
          </div>
        </div>
      )}

      <div className={shellUi ? "scr" : undefined} style={{ flex: 1, overflowY: "auto", padding: shellUi ? "26px 28px 60px" : isMobile ? 16 : 24, position: "relative", zIndex: 5, minHeight: 0 }}>
        <div style={{ maxWidth: "min(1240px,100%)", width: "100%", margin: "0 auto" }}>
          {/* greeting */}
          <div className="sa-page-reveal" style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: 14, marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: "var(--text)", letterSpacing: -.6, margin: 0 }}>{greet}, {user?.name?.split(" ")[0] || user?.email?.split("@")[0] || ""} <span aria-hidden>👋</span></h1>
              <div style={{ fontSize: 13.5, color: "var(--text3)", marginTop: 4, textTransform: "capitalize" }}>{dateStr}</div>
            </div>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn-grad" onClick={() => setShowBriefing(true)} style={{ height: 40, padding: "0 18px", borderRadius: 12, border: "none", background: "var(--gradient-accent)", color: "var(--accent-on-bg,#fff)", cursor: "pointer", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 2px 14px var(--accent-glow)" }}>
              <span aria-hidden>📋</span>{t("weekly_briefing", "Еженедельный брифинг")}
            </button>
          </div>

          {/* stat cards */}
          <div className="sa-page-reveal sa-pr-d1" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: isMobile ? 12 : 16, marginBottom: 24 }}>
            <StatCard icon={<>📁</>} value={<CountUp n={stats.projects} loading={loading} />} label={t("dash_projects", "Проекты")} sub={t("dash_projects_sub", "активные")} accent="#a78bfa" />
            <StatCard icon={<>◈</>} value={<CountUp n={stats.nodes} loading={loading} />} label={t("dash_nodes", "Узлы стратегии")} sub={t("dash_on_track", "{n} в работе").replace("{n}", String(stats.onTrack))} accent="#34d399" />
            <StatCard icon={<>📈</>} value={<CountUp n={stats.progress} suffix="%" loading={loading} />} label={t("dash_avg_progress", "Средний прогресс")} sub={t("dash_overall", "по всем картам")} accent="#fbbf24" />
            <StatCard icon={<>⚠️</>} value={<CountUp n={stats.risks} loading={loading} />} label={t("dash_active_risks", "Активные риски")} sub={stats.risks ? t("dash_review_needed", "нужна проверка") : t("dash_all_clear", "всё спокойно")} accent={stats.risks ? "#f87171" : "#34d399"} />
          </div>

          {/* two columns: recent activity + goals */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.05fr .95fr", gap: 16 }}>
            <div className="sa-page-reveal sa-pr-d2 glass-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .8, textTransform: "uppercase", color: "var(--text4)", marginBottom: 14 }}>{t("dash_recent_activity", "Недавняя активность")}</div>
              {loading ? (
                <div style={{ fontSize: 13, color: "var(--text5)", padding: "8px 0" }}>{t("loading_short", "Загрузка…")}</div>
              ) : recent.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text5)", padding: "8px 0" }}>{t("dash_no_activity", "Пока нет активности — создайте карту, чтобы начать.")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {recent.map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }} aria-hidden>🗺️</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text4)" }}>{t("dash_nodes_count", "{n} узлов").replace("{n}", String(r.nodes))}</div>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text5)", flexShrink: 0 }}>{relTime(r.at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sa-page-reveal sa-pr-d3 glass-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .8, textTransform: "uppercase", color: "var(--text4)" }}>{t("dash_goals", "Ключевые шаги")}</div>
                <button type="button" onClick={() => onShellNav("insights")} style={{ background: "none", border: "none", color: "var(--acc,#a78bfa)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{t("dash_all_insights", "Инсайты →")}</button>
              </div>
              {loading ? (
                <div style={{ fontSize: 13, color: "var(--text5)", padding: "8px 0" }}>{t("loading_short", "Загрузка…")}</div>
              ) : goals.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text5)", padding: "8px 0" }}>{t("dash_no_goals", "Нет шагов — добавьте их на карте стратегии.")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {goals.map((n: any, i: number) => {
                    const pct = Math.max(0, Math.min(100, Number(n.progress) || 0));
                    const c = (STATUS as any)[n.status]?.c || "var(--acc,#a78bfa)";
                    return (
                      <div key={n.id || i}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title || t("untitled", "Без названия")}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: c, flexShrink: 0 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: "var(--surface2)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: pct + "%", borderRadius: 4, background: c, transition: "width .5s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* quick links to projects */}
          {projects.length > 0 && (
            <div className="sa-page-reveal sa-pr-d3" style={{ marginTop: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .8, textTransform: "uppercase", color: "var(--text4)", marginBottom: 12 }}>{t("dash_jump_back", "Продолжить работу")}</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
                {projects.slice(0, 6).map((p) => {
                  const ms = mapsByProj[p.id] || [];
                  const ns = ms.flatMap((m: any) => m?.nodes || []);
                  const pct = ns.length ? Math.round(ns.reduce((s: number, n: any) => s + (Number(n.progress) || 0), 0) / ns.length) : 0;
                  return (
                    <button key={p.id} type="button" className="btn-interactive" onClick={() => onOpenProject?.(p)} style={{ textAlign: "left", padding: 16, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "var(--text2)" }}>{(p.name || "?")[0].toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text4)" }}>{t("dash_maps_count", "{n} карт").replace("{n}", String(ms.length))}</div>
                        </div>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: pct + "%", borderRadius: 3, background: "var(--gradient-accent)" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
          showTrialBanner={(user?.tier || "free") === "free"}
          onLogoClick={() => { try { document.querySelector(".sa-main .scr")?.scrollTo({ top: 0, behavior: "smooth" }); } catch {} }}
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
