import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, getProjects } from "../api";
import { getMapsByProject } from "../lib/maps-api";
import { useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useCountUp } from "../hooks/use-count-up";
import { TIERS } from "../lib/tiers";
import { getSTATUS, getPRIORITY } from "../lib/strategy-labels";
import { useNotifications } from "../hooks/use-notifications";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "../../strategy-shell-sidebar";
import { WorkspaceTopBar } from "../components/workspace-top-bar";
import { NotifBell } from "../components/notif-bell";
import { ThemeTogglePill } from "../components/theme-toggle-pill";
import { NotificationsCenterModal } from "../strategy-modals/notifications-ai-hub-modals";
import { FloatingAiAssistant } from "../floating-ai-assistant";

export function InsightsPage({
  user,
  theme,
  onToggleTheme,
  onProfile,
  onLogout,
  onChangeTier,
  onShellNav,
  onOpenContentPlanHub,
}: {
  user: any;
  theme: string;
  onToggleTheme: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onChangeTier?: () => void;
  onShellNav: (nav: StrategyShellNav) => void;
  onOpenContentPlanHub?: (() => void) | null;
}) {
  const { t, lang, setLang } = useLang();
  const isMobile = useIsMobile();
  const tier = TIERS[user?.tier || "free"] || TIERS.free;
  const STATUS = getSTATUS(t);
  const PRIORITY = getPRIORITY(t);

  const [projects, setProjects] = useState<any[]>([]);
  const [mapsByProj, setMapsByProj] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
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

  useEffect(() => { document.title = t("ins_doc_title", "Strategy AI — Инсайты"); }, [t]);

  const allMaps = useMemo(() => Object.values(mapsByProj).flatMap((a) => (Array.isArray(a) ? a : [])), [mapsByProj]);
  const allNodes = useMemo(() => allMaps.flatMap((m: any) => (m?.nodes || []).map((n: any) => ({ ...n, _map: m?.name }))), [allMaps]);

  const m = useMemo(() => {
    const total = allNodes.length;
    const avg = total ? Math.round(allNodes.reduce((s: number, n: any) => s + (Number(n.progress) || 0), 0) / total) : 0;
    const completed = allNodes.filter((n: any) => n.status === "completed").length;
    const active = allNodes.filter((n: any) => n.status === "active").length;
    const risks = allNodes.filter((n: any) => n.priority === "critical" || n.status === "blocked");
    const onTrack = allNodes.filter((n: any) => (Number(n.progress) || 0) >= 50 || n.status === "completed").length;
    const health = total ? Math.max(0, Math.min(100, Math.round(avg * 0.7 + (completed / total) * 100 * 0.3 - (risks.length / total) * 20))) : 0;
    return { total, avg, completed, active, risks, onTrack, health };
  }, [allNodes]);

  const byStatus = useMemo(() => {
    const order = ["active", "planning", "completed", "blocked", "paused"];
    return order.map((st) => {
      const items = allNodes.filter((n: any) => (n.status || "planning") === st);
      const avg = items.length ? Math.round(items.reduce((s: number, n: any) => s + (Number(n.progress) || 0), 0) / items.length) : 0;
      return { st, count: items.length, avg, label: (STATUS as any)[st]?.label || st, c: (STATUS as any)[st]?.c || "var(--acc,#a78bfa)" };
    }).filter((x) => x.count > 0);
  }, [allNodes, STATUS]);

  const aiInsights = useMemo(() => {
    const out: { tone: string; icon: string; title: string; text: string }[] = [];
    if (m.risks.length) {
      out.push({ tone: "#f87171", icon: "⚠️", title: t("ins_risk_title", "Риски требуют внимания"), text: t("ins_risk_text", "{n} узлов помечены как критичные или заблокированы. Разберите их в первую очередь на этой неделе.").replace("{n}", String(m.risks.length)) });
    }
    const laggards = [...allNodes].filter((n: any) => n.status !== "completed").sort((a: any, b: any) => (Number(a.progress) || 0) - (Number(b.progress) || 0))[0];
    if (laggards) {
      out.push({ tone: "#fbbf24", icon: "🐢", title: t("ins_lag_title", "Отстаёт по прогрессу"), text: t("ins_lag_text", "«{name}» — {p}%. Это самый медленный шаг. Заложите по 1–2 часа в день, чтобы выровнять темп.").replace("{name}", laggards.title || "—").replace("{p}", String(Number(laggards.progress) || 0)) });
    }
    const top = [...allNodes].filter((n: any) => n.status !== "completed").sort((a: any, b: any) => (Number(b.progress) || 0) - (Number(a.progress) || 0))[0];
    if (top) {
      out.push({ tone: "#34d399", icon: "🚀", title: t("ins_top_title", "Близко к финишу"), text: t("ins_top_text", "«{name}» уже на {p}%. Доведите до 100% — это быстрый выигрыш для общего здоровья стратегии.").replace("{name}", top.title || "—").replace("{p}", String(Number(top.progress) || 0)) });
    }
    out.push({ tone: "#a78bfa", icon: "✦", title: t("ins_advisor_title", "Совет AI"), text: t("ins_advisor_text", "Откройте AI-советника, чтобы получить персональный разбор стратегии и план на неделю.") });
    return out.slice(0, 4);
  }, [allNodes, m.risks.length, t]);

  const shellUi = !!user && !isMobile;

  const CountUp = ({ n, suffix = "", loading: ld }: { n: number; suffix?: string; loading?: boolean }) => {
    const v = useCountUp(ld ? 0 : n);
    if (ld) return <>—</>;
    return <>{Math.round(v)}{suffix}</>;
  };

  const StatCard = ({ icon, value, label, sub, accent }: { icon: React.ReactNode; value: React.ReactNode; label: string; sub?: string; accent: string }) => (
    <div className="sa-dash-stat sa-card-pro sa-lift" style={{ borderRadius: 20, padding: isMobile ? 16 : 22, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ fontSize: 18 }} aria-hidden>{icon}</div>
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
        <WorkspaceTopBar
          title={t("shell_insights", "Insights")}
          subtitle={t("ins_subtitle", "Strategy health · {p}%").replace("{p}", String(m.health))}
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
      )}
      {!shellUi && (
        <div className="sa-app-topbar">
          <div className="atb-cluster" style={{ minWidth: 0 }}>
            <div className="land-logo" style={{ gap: 10 }}><div className="land-gem" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 12 }}>SA</div><span className="land-brand" style={{ fontSize: 15 }}>Strategy AI</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <ThemeTogglePill theme={theme} onToggle={onToggleTheme} />
            <button type="button" className="btn-g" onClick={onProfile} style={{ height: 32, padding: "0 12px" }}>{(user?.name || user?.email || "?")[0].toUpperCase()}</button>
          </div>
        </div>
      )}

      <div className={shellUi ? "scr" : undefined} style={{ flex: 1, overflowY: "auto", padding: shellUi ? "26px 28px 60px" : isMobile ? 16 : 24, position: "relative", zIndex: 5, minHeight: 0 }}>
        <div style={{ maxWidth: "min(1240px,100%)", width: "100%", margin: "0 auto" }}>
          <div className="r4" style={{ marginBottom: 24 }}>
            <div className="kpi-card card">
              <div className="kglow" style={{ opacity: 0.35 }} aria-hidden />
              <div style={{ fontSize: 22, marginBottom: 6 }} aria-hidden>💚</div>
              <div className="kval" style={{ color: m.health >= 70 ? "#34d399" : m.health >= 40 ? "#fbbf24" : "#f87171" }}><CountUp n={m.health} suffix="%" loading={loading} /></div>
              <div className="klbl">{t("ins_health", "Strategy health")}</div>
              <div className="ksub neu">{m.health >= 70 ? t("ins_health_ok", "on track") : t("ins_health_attention", "needs attention")}</div>
            </div>
            <div className="kpi-card card">
              <div className="kglow" style={{ opacity: 0.35 }} aria-hidden />
              <div style={{ fontSize: 22, marginBottom: 6 }} aria-hidden>🎯</div>
              <div className="kval" style={{ color: "#a78bfa" }}>{loading ? "—" : <><CountUp n={m.onTrack} loading={loading} />/{m.total}</>}</div>
              <div className="klbl">{t("ins_on_track", "On track")}</div>
              <div className="ksub neu">{t("ins_avg_progress", "avg {p}%").replace("{p}", String(m.avg))}</div>
            </div>
            <div className="kpi-card card">
              <div className="kglow" style={{ opacity: 0.35 }} aria-hidden />
              <div style={{ fontSize: 22, marginBottom: 6 }} aria-hidden>⚡</div>
              <div className="kval" style={{ color: "#22d3ee" }}><CountUp n={m.active} loading={loading} /></div>
              <div className="klbl">{t("ins_active", "Active")}</div>
              <div className="ksub neu">{t("ins_completed_n", "{n} completed").replace("{n}", String(m.completed))}</div>
            </div>
            <div className="kpi-card card">
              <div className="kglow" style={{ opacity: 0.35 }} aria-hidden />
              <div style={{ fontSize: 22, marginBottom: 6 }} aria-hidden>⚠️</div>
              <div className="kval" style={{ color: m.risks.length ? "#f87171" : "#34d399" }}><CountUp n={m.risks.length} loading={loading} /></div>
              <div className="klbl">{t("ins_risks", "Risks")}</div>
              <div className="ksub neu">{m.risks.length ? t("ins_monitoring", "monitoring") : t("dash_all_clear", "all clear")}</div>
            </div>
          </div>

          <div className="slbl">{t("ins_ai_section", "AI insights")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><span aria-hidden>📊</span>{t("ins_progress_by_status", "Прогресс по статусам")}</div>
              {loading ? <div style={{ fontSize: 13, color: "var(--text5)" }}>{t("loading_short", "Загрузка…")}</div> : byStatus.length === 0 ? <div style={{ fontSize: 13, color: "var(--text5)" }}>{t("ins_no_data", "Нет данных — добавьте узлы на карте.")}</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {byStatus.map((s) => (
                    <div key={s.st}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)" }}>{s.label} <span style={{ color: "var(--text5)", fontWeight: 600 }}>({s.count})</span></span>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: s.c }}>{s.avg}%</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: "var(--surface2)", overflow: "hidden" }}><div style={{ height: "100%", width: s.avg + "%", borderRadius: 4, background: s.c }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {aiInsights.slice(0, 3).map((ins, i) => (
                <div key={i} className="insight-card" style={{ borderLeft: `3px solid ${ins.tone}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }} aria-hidden>{ins.icon}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{ins.title}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.65 }}>{ins.text}</div>
                  {i === 2 && (
                    <button type="button" onClick={() => onShellNav("ai")} className="btn-g" style={{ marginTop: 10, height: 32, fontSize: 12 }}>
                      {t("ins_ask_ai", "Ask AI →")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="sa-page-reveal sa-pr-d2 sa-panel" style={{ overflowX: "auto" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text)", marginBottom: 14 }}>{t("ins_all_nodes", "Все узлы — здоровье")}</div>
            {loading ? <div style={{ fontSize: 13, color: "var(--text5)" }}>{t("loading_short", "Загрузка…")}</div> : allNodes.length === 0 ? <div style={{ fontSize: 13, color: "var(--text5)" }}>{t("ins_no_data", "Нет данных — добавьте узлы на карте.")}</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead>
                  <tr style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase", color: "var(--text5)", textAlign: "left" }}>
                    <th style={{ padding: "0 8px 10px 0" }}>{t("ins_col_node", "Узел")}</th>
                    <th style={{ padding: "0 8px 10px" }}>{t("ins_col_status", "Статус")}</th>
                    <th style={{ padding: "0 8px 10px", width: 160 }}>{t("ins_col_progress", "Прогресс")}</th>
                    <th style={{ padding: "0 8px 10px" }}>{t("ins_col_priority", "Приоритет")}</th>
                    <th style={{ padding: "0 0 10px 8px" }}>{t("ins_col_deadline", "Дедлайн")}</th>
                  </tr>
                </thead>
                <tbody>
                  {allNodes.slice(0, 60).map((n: any, i: number) => {
                    const pct = Math.max(0, Math.min(100, Number(n.progress) || 0));
                    const sc = (STATUS as any)[n.status]?.c || "var(--text4)";
                    const pc = (PRIORITY as any)[n.priority]?.c || "var(--text4)";
                    const dl = n.deadline ? new Date(n.deadline) : null;
                    const overdue = dl && dl.getTime() < Date.now() && n.status !== "completed";
                    return (
                      <tr key={n.id || i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "11px 8px 11px 0", fontSize: 13, fontWeight: 700, color: "var(--text)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title || t("untitled", "Без названия")}</td>
                        <td style={{ padding: "11px 8px" }}><span style={{ fontSize: 11, fontWeight: 800, color: sc, background: sc + "1f", padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap" }}>{(STATUS as any)[n.status]?.label || n.status || "—"}</span></td>
                        <td style={{ padding: "11px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface2)", overflow: "hidden", minWidth: 60 }}><div style={{ height: "100%", width: pct + "%", borderRadius: 3, background: sc }} /></div>
                            <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text3)", minWidth: 30, textAlign: "right" }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 8px", fontSize: 12, fontWeight: 700, color: pc }}>{(PRIORITY as any)[n.priority]?.label || "—"}</td>
                        <td style={{ padding: "11px 0 11px 8px", fontSize: 12, fontWeight: 700, color: overdue ? "#f87171" : "var(--text4)", whiteSpace: "nowrap" }}>{dl ? dl.toLocaleDateString(lang === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short" }) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showNotifs && (
        <NotificationsCenterModal open={showNotifs} onClose={() => setShowNotifs(false)} isMobile={isMobile} zIndex={260} notifs={notifs} setNotifs={setNotifs} notifUnread={notifUnread} setNotifUnread={setNotifUnread} notifLoading={notifLoading} lang={lang} t={t} loadNotifications={loadNotifications} showItemMeta={false} deleteGlyph="×" onFollowLink={async (n: any) => { if (n.link) window.location.href = n.link; }} />
      )}
      <FloatingAiAssistant t={t} variant="app" onOpenFullChat={() => onShellNav("ai")} />
    </>
  );

  return shellUi ? (
    <div className={"sa-strategy-ui sa-v-app " + (theme === "dark" ? "dk" : "lt")} data-theme={theme} style={{ width: "100%", height: "100%", minHeight: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter',system-ui,sans-serif", overflow: "hidden" }}>
      <StrategyShellBg />
      <div className="sa-app" style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <StrategyShellSidebar
          theme={theme}
          onToggleTheme={onToggleTheme}
          activeNav="insights"
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
