import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { io as ioClient } from "socket.io-client";
import pptxgen from "pptxgenjs";
import { NW, NH, fmt, sleep, uid, snap } from "./client/lib/util";
import { consumePendingAiPrompt } from "./client/lib/ai-pending-prompt";
import {
  API_BASE,
  apiFetch,
  store,
  refreshUserAfterPayment,
  getJWT,
  clearJWT,
  clearRefreshToken,
  getSession,
  setSession,
  clearSession,
  seedDefault,
  normalizeUser,
  patchUser,
  hashPw,
  normalizeProject,
  getProjects,
  saveProject,
  addProjectMember,
  removeProjectMember,
  deleteProject,
} from "./client/api";
import { makeTfn } from "./client/i18n/makeTfn";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "./strategy-shell-sidebar";
const ReferenceLandingView = React.lazy(() =>
  import("./reference-landing").then((m) => ({ default: m.ReferenceLandingView }))
);
import { GlowCard } from "./client/glow-card";
import { FloatingAiAssistant } from "./client/floating-ai-assistant";
import { SplashLoaderScreen } from "./client/splash-loader";
import { GlassCalendar, dateToYMD } from "./client/glass-calendar";
import { parseMarketingPath } from "./client/spa-path";
import { applySeoForAppScreen } from "./client/seo-head";
import { LegalDocumentPage, NotFoundPage } from "./client/legal-pages";
import { trackSaEvent } from "./client/analytics";
import {
  UUID_RE,
  isUUID,
  normalizeMap,
  edgePt,
  defaultNodes,
  topSort,
} from "./client/lib/map-utils";
import { getMaps, getMapsByProject, saveMap, deleteMap, getContentPlan, saveContentPlan } from "./client/lib/maps-api";
import { AI_KNOWLEDGE, AI_STRICT_RULES, AI_TIER, OB_TIER, MAP_TIER } from "./client/lib/ai-prompts";
import { LangCtx, useLang } from "./client/lang-context";
import { useIsMobile } from "./client/hooks/use-is-mobile";
import { SheetSwipeHandle } from "./client/components/sheet-swipe-handle";
import { ConfirmDialog } from "./client/strategy-modals/confirm-dialog";
import { AiHubModal, NotificationsCenterModal } from "./client/strategy-modals/notifications-ai-hub-modals";
import { TIERS } from "./client/lib/tiers";
import { getROLES, getSTATUS, getPRIORITY, getSTATUSES, getPRIORITIES, getETYPE, getTierPrice } from "./client/lib/strategy-labels";
import { callAI } from "./client/lib/call-ai";
import { StatsPopup } from "./client/strategy-modals/stats-popup";
import { VersionHistoryModal } from "./client/strategy-modals/version-history-modal";
import { WeeklyBriefingModal } from "./client/strategy-modals/weekly-briefing-modal";
import { ScenarioTemplatesModal } from "./client/strategy-modals/scenario-templates-modal";
import { TemplateModal } from "./client/strategy-modals/template-modal";
import { useNotifications } from "./client/hooks/use-notifications";
import { sanitize } from "./client/lib/sanitize";
import { MainWorkspaceNav } from "./client/components/main-workspace-nav";
import { Toggle } from "./client/components/toggle";
import { IconButton } from "./client/components/icon-button";
import { OfflineBanner } from "./client/components/offline-banner";
import { CustomSelect } from "./client/components/custom-select";
import { Toast } from "./client/components/toast";
import { NotifBell } from "./client/components/notif-bell";
import { MapTour } from "./client/components/map-tour";
import { AppTopBar } from "./client/components/app-top-bar";
import { SimulationModal } from "./client/strategy-modals/simulation-modal";
import { PillGroup } from "./client/components/pill-group";
import { MapConflictModal } from "./client/strategy-modals/map-conflict-modal";
import { ALL_FEATURES, TIER_FEAT_KEY, TIER_ORDER, TIER_MKT } from "./client/lib/tier-marketing-data";
import { FeatureValue } from "./client/components/feature-value";
import { TierSelectionScreen } from "./client/components/tier-selection-screen";
import { SavingScreen } from "./client/components/saving-screen";
import { AuthModal } from "./client/strategy-modals/auth-modal";
import { CookieConsent } from "./client/components/cookie-consent";
import { MiniMap } from "./client/components/mini-map";
import { GanttView } from "./client/components/gantt-view";
import { ProfileModal } from "./client/strategy-modals/profile-modal";
import { IconTrash } from "./client/components/icons";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Onboarding } from "./client/onboarding/onboarding";
import { NodeCard } from "./client/map-editor/node-card";
import { RichEditorPanel } from "./client/map-editor/rich-editor-panel";
import { AiPanel } from "./client/map-editor/ai-panel";
import { MapEditor } from "./client/map-editor/map-editor";
import { DashboardPage } from "./client/dashboard/dashboard-page";
import { InsightsPage } from "./client/insights/insights-page";
import { AiAdvisorPage } from "./client/ai-advisor/ai-advisor-page";
import { ResetPasswordModal } from "./client/strategy-modals/reset-password-modal";
import { ProjectsPage, ProjectDetail } from './client/projects/projects';

const ROLES_C  ={owner:"#6836f5",editor:"#12c482",viewer:"#a8a4c8"};
const STATUS  ={planning:{c:"#6836f5"},active:{c:"#06b6d4"},completed:{c:"#12c482"},paused:{c:"#f09428"},blocked:{c:"#f04458"}};
const PRIORITY={low:{c:"#6c6480"},medium:{c:"#f09428"},high:{c:"#ea580c"},critical:{c:"#f04458"}};
const ETYPE_C ={requires:{c:"#6836f5",d:"none"},affects:{c:"#a050ff",d:"8,4"},blocks:{c:"#f04458",d:"4,3"},follows:{c:"#12c482",d:"12,4"}};

// utils карты и сетевой слой — см. client/lib/map-utils.ts и client/lib/maps-api.ts; callAI — client/lib/call-ai.ts

// AI-промпты, база знаний и готовые шаблоны — см. client/lib/ai-prompts.ts и client/lib/templates.ts



// ── Onboarding ── вынесен в client/onboarding/onboarding.tsx
// Импорт ниже; локальная копия (dead code) удалена в Шаге 21.

// RichEditorPanel + AiPanel → client/map-editor/rich-editor-panel.tsx, ai-panel.tsx

// ── EdgeLine ──
function EdgeLine({edge,nodes,selected,onClick,etypeMap}){
  const{t}=useLang();
  const ETYPE=etypeMap||getETYPE(t);
  const s=nodes.find(n=>n.id===edge.source);
  const tNode=nodes.find(n=>n.id===edge.target);
  if(!s||!t)return null;
  const sx=s.x+120,sy=s.y+64,tx2=tNode.x+120,ty2=tNode.y+64;
  const sp=edgePt(sx,sy,tx2,ty2);
  const ep=edgePt(tx2,ty2,sx,sy);
  const mx=(sp.x+ep.x)/2,my=(sp.y+ep.y)/2;
  const dx=ep.x-sp.x,dy=ep.y-sp.y,len=Math.sqrt(dx*dx+dy*dy)||1;
  const nx=-dy/len,ny=dx/len,bend=Math.min(60,len*.18);
  const cpx=mx+nx*bend,cpy=my+ny*bend;
  const et=ETYPE[edge.type]||ETYPE.requires;
  const d=`M${sp.x},${sp.y} Q${cpx},${cpy} ${ep.x},${ep.y}`;
  const mid_t=.5;
  const bmx=Math.pow(1-mid_t,2)*sp.x+2*(1-mid_t)*mid_t*cpx+mid_t*mid_t*ep.x;
  const bmy=Math.pow(1-mid_t,2)*sp.y+2*(1-mid_t)*mid_t*cpy+mid_t*mid_t*ep.y;
  const tang_t=.5;
  const tax=2*(1-tang_t)*(cpx-sp.x)+2*tang_t*(ep.x-cpx);
  const tay=2*(1-tang_t)*(cpy-sp.y)+2*tang_t*(ep.y-cpy);
  const ang=Math.atan2(tay,tax)*180/Math.PI;
  return(
    <g onClick={e=>{e.stopPropagation();onClick(edge);}} role="button" tabIndex={0} aria-label={edge.label||et.label||t("edge","связь")}
       onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick(edge);}}}>
      <path className="sa-edge-hit" d={d} fill="none" stroke="transparent" strokeWidth={14}/>
      <path className="sa-edge-line" d={d} fill="none" stroke={selected?"url(#sa-edge-grad)":et.c} strokeWidth={selected?2.6:Math.max(1.2,Math.min(3.6,(edge.weight||3)*0.6+0.4))} strokeDasharray={et.d==="none"?"none":et.d} opacity={selected?1:.68}/>
      <polygon points="-5,-3 5,0 -5,3" fill={selected?"var(--accent-1)":et.c} transform={`translate(${ep.x},${ep.y}) rotate(${ang})`} opacity={selected?1:.75} style={{transition:"opacity .2s ease"}}/>
      {edge.label&&<text x={bmx} y={bmy-6} textAnchor="middle" fontSize={9.5} fill="var(--text3)" style={{pointerEvents:"none",userSelect:"none"}}>{edge.label}</text>}
    </g>
  );
}

// ── NodeCard ── → client/map-editor/node-card.tsx

// ── TrialBanner ──
function TrialBanner({user,onUpgrade}:{user:any,onUpgrade:()=>void}){
  const{t}=useLang();
  const trialVal=user?.trialEndsAt??user?.trial_ends_at;
  if(!trialVal)return null;
  const trialEnd=new Date(trialVal);
  const now=new Date();
  if(trialEnd<=now)return null;
  const daysLeft=Math.ceil((trialEnd.getTime()-now.getTime())/(1000*60*60*24));
  return(
    <div role="status" className="sa-trial-banner" style={{position:"sticky",top:0,zIndex:5,background:"linear-gradient(90deg,var(--accent-soft),var(--accent-soft) 40%,rgba(104,54,245,.12))",borderBottom:"1px solid var(--accent-1)",padding:"8px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:13,flexWrap:"wrap"}}>
      <span style={{color:"var(--accent-2)",fontWeight:700,display:"inline-flex",alignItems:"center",gap:6}}>
        <span className="sa-trial-flash" aria-hidden>⚡</span>
        {t("trial_active","Пробный период активен")}
        <span style={{padding:"2px 8px",borderRadius:999,background:"var(--accent-1)",color:"#fff",fontSize:11,fontWeight:800,animation:"sa-trial-pulse 2.6s ease-in-out infinite"}}>{daysLeft} {t("trial_days_left","дней осталось")}</span>
      </span>
      <button type="button" className="btn-p" onClick={onUpgrade} style={{padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:800}}>{t("upgrade","Улучшить →")}</button>
    </div>
  );
}

// ── EmailVerifyBanner ──
function EmailVerifyBanner({user,onVerified}:{user:any,onVerified?:()=>void}){
  const{t}=useLang();
  const[sent,setSent]=useState(false);
  const[loading,setLoading]=useState(false);
  const dismissKey=`sa_email_banner_dismissed_${user?.email||""}`;
  const[dismissed,setDismissed]=useState<boolean>(()=>{try{return localStorage.getItem(dismissKey)==="1";}catch{return false;}});
  // Если email уже подтверждён или нет API — не показываем; либо пользователь скрыл вручную
  if(!API_BASE||user?.emailVerified!==false||dismissed)return null;
  async function resend(){
    if(loading||sent)return;
    setLoading(true);
    try{
      await apiFetch("/api/auth/resend-verification",{method:"POST"});
      setSent(true);
    }catch{}
    setLoading(false);
  }
  function dismiss(){
    try{localStorage.setItem(dismissKey,"1");}catch{}
    setDismissed(true);
  }
  return(
    <div role="status" style={{position:"relative",background:"linear-gradient(135deg,rgba(245,158,11,.12),rgba(239,68,68,.08))",borderBottom:"1px solid rgba(245,158,11,.35)",padding:"8px 40px 8px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:13,flexWrap:"wrap"}}>
      <span style={{color:"#f09428",fontWeight:700,display:"inline-flex",alignItems:"center",gap:6}}>
        <span aria-hidden>✉️</span>
        {t("verify_email_banner","Подтвердите ваш email для полного доступа.")}
      </span>
      {sent?(
        <span style={{color:"#12c482",fontWeight:700,fontSize:12}}>{t("verify_email_sent","Письмо отправлено! Проверьте почту.")}</span>
      ):(
        <button type="button" className="btn-p" onClick={resend} disabled={loading} style={{padding:"5px 14px",borderRadius:8,fontSize:12,fontWeight:800}}>
          {loading?"…":t("verify_email_resend","Отправить письмо")}
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label={t("dismiss","Скрыть")} title={t("dismiss","Скрыть")} style={{position:"absolute",top:"50%",right:8,transform:"translateY(-50%)",width:24,height:24,padding:0,border:"none",background:"transparent",color:"var(--text4)",cursor:"pointer",fontSize:14,lineHeight:1}}>×</button>
    </div>
  );
}

// ── DeadlineReminders ── (показывается если есть шаги с дедлайном в ближайшие 3 дня)
function DeadlineReminders({nodes,onGoToNode,onDismiss}:{nodes:any[],onGoToNode:(id:string)=>void,onDismiss?:()=>void}){
  const{t}=useLang();
  const now=new Date();
  const soon=nodes.filter(n=>{
    if(!n.deadline||n.status==="completed")return false;
    const d=new Date(n.deadline);
    const diff=(d.getTime()-now.getTime())/(1000*60*60*24);
    return diff>=0&&diff<=3;
  });
  const overdue=nodes.filter(n=>{
    if(!n.deadline||n.status==="completed")return false;
    return new Date(n.deadline)<now;
  });
  const all=[...overdue,...soon];
  if(all.length===0)return null;
  return(
    <div role="status" aria-live="polite" className="sa-deadline-rem" style={{position:"fixed",bottom:80,right:20,zIndex:350,width:280,background:"var(--surface)",border:`1px solid ${overdue.length?"rgba(239,68,68,.4)":"rgba(245,158,11,.35)"}`,borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,.3)",overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid var(--border)",background:overdue.length?"rgba(239,68,68,.08)":"rgba(245,158,11,.08)"}}>
        <span style={{fontSize:13,fontWeight:700,color:overdue.length?"#f04458":"#f09428"}}>⏰ {t("deadline_reminder","Напоминания")}{all.length>1?` · ${all.length}`:""}</span>
        <button onClick={()=>onDismiss?.()} title={t("dismiss","Скрыть")} aria-label={t("dismiss","Скрыть")} className="sa-dr-close" style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:16,lineHeight:1,padding:2,borderRadius:6}}>✕</button>
      </div>
      {all.slice(0,4).map(n=>{
        const d=new Date(n.deadline);
        const diff=Math.round((d.getTime()-now.getTime())/(1000*60*60*24));
        const isOverdue=d<now;
        return(
          <div key={n.id} onClick={()=>onGoToNode(n.id)} role="button" tabIndex={0}
            onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onGoToNode(n.id);}}}
            className="sa-dr-row"
            aria-label={`${n.title} · ${isOverdue?t("days_overdue","просрочено {n}д.").replace("{n}",String(Math.abs(diff))):t("days_left","{n}д.").replace("{n}",String(diff))}`}
            style={{padding:"10px 16px",borderBottom:"1px solid var(--border)",cursor:"pointer",transition:"background .15s",outline:"none"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:2}}>{n.title}</div>
            <div style={{fontSize:11,color:isOverdue?"#f04458":"#f09428",fontWeight:600}}>
              {isOverdue?t("days_overdue","просрочено {n}д.").replace("{n}",String(Math.abs(diff))):t("days_left","{n}д.").replace("{n}",String(diff))+" · "+n.deadline}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── Хаб контент-плана: те же проекты, что и в стратегии ──
function ContentPlanHubPage({user,theme,onBackToStrategy,onOpenProject,onLogout,onUpgrade,onProfile,onToggleTheme,aiChatMsgs,aiChatSetMsgs,onSelectProject,onOpenMap}){
  const{t,lang}=useLang();
  const isMobile=useIsMobile();
  const[projects,setProjects]=useState<any[]>([]);
  const[mapsByProj,setMapsByProj]=useState<Record<string,any[]>>({});
  const[loading,setLoading]=useState(true);
  const[showAIHub,setShowAIHub]=useState(false);
  const[showNotifs,setShowNotifs]=useState(false);
  const{notifs,setNotifs,notifUnread,setNotifUnread,notifLoading,loadNotifications}=useNotifications(showNotifs,user?.email);
  const tier=TIERS[user?.tier||"free"]||TIERS.free;

  useEffect(()=>{(async()=>{setLoading(true);try{const ps=await getProjects(user.email);setProjects(ps);setMapsByProj(await getMapsByProject(ps.map((p:any)=>p.id)));}catch{setProjects([]);setMapsByProj({});}finally{setLoading(false);}})();},[user?.email]);
  useEffect(()=>{document.title=t("cp_doc_hub_title","Strategy AI — Контент-план");},[t]);

  const allMapsForAI=Object.values(mapsByProj).flatMap((arr:any)=>Array.isArray(arr)?arr:[]);
  const aiNodes=allMapsForAI.flatMap((m:any)=>m.nodes||[]).slice(0,220);
  const aiEdges=allMapsForAI.flatMap((m:any)=>m.edges||[]).slice(0,260);
  const aiCtx=`Портфель (контент-план): ${(projects||[]).slice(0,20).map((p:any)=>`«${p.name||"Проект"}»`).join(", ")}. Проектов: ${(projects||[]).length}, карт загружено: ${allMapsForAI.length}.`;

  return(
    <div className={"sa-strategy-ui "+(theme==="dark"?"dk":"lt")} data-theme={theme} style={{width:"100%",maxWidth:"100%",boxSizing:"border-box",height:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden",position:"relative"}}>
      <StrategyShellBg/>
      <div style={{flex:1,minHeight:0,minWidth:0,display:"flex",flexDirection:"column",position:"relative",zIndex:1,overflow:"hidden"}}>
      <div className="sa-app-topbar">
        <div className="atb-cluster" style={{minWidth:0}}>
          <div className="land-logo" style={{gap:10}}>
            <div className="land-gem" style={{width:32,height:32,borderRadius:10,fontSize:12}}>SA</div>
            <span className="land-brand" style={{fontSize:15}}>Strategy AI</span>
          </div>
        </div>
        {!isMobile&&(
          <div style={{flex:1,display:"flex",justifyContent:"center",minWidth:0}}>
            <MainWorkspaceNav mode="contentPlan" onStrategy={onBackToStrategy} onContentPlan={()=>{}} t={t} isMobile={false}/>
          </div>
        )}
        <div className="atb-cluster" style={{marginLeft:isMobile?0:"auto"}}>
          <div className="tpill" onClick={onToggleTheme} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")onToggleTheme();}} aria-label={t("toggle_theme_tip","Сменить тему оформления")}>
            <div className={`tpi${theme==="dark"?" on":""}`}>☽</div>
            <div className={`tpi${theme==="light"?" on":""}`}>☀</div>
          </div>
          <button type="button" className="btn-g" onClick={()=>setShowAIHub(true)} title={t("ai_hub_title","✦ AI (единый чат)")} style={{height:32,fontSize:11.5,padding:"0 12px",display:"inline-flex",alignItems:"center",gap:6}}>
            <span aria-hidden>✦</span>{!isMobile&&t("ai_hub_btn_short","AI-чат")}
          </button>
          {API_BASE&&<NotifBell unread={notifUnread} onClick={()=>setShowNotifs(true)} className="btn-ic"/>}
          <button type="button" className="btn-g" onClick={onProfile} style={{height:32,padding:"0 12px",gap:8,display:"inline-flex",alignItems:"center",maxWidth:isMobile?44:220}}>
            <span style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,var(--acc),var(--acc2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>{(user.name||user.email||"?")[0].toUpperCase()}</span>
            {!isMobile&&<><span style={{fontSize:12,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name||user.email?.split("@")[0]||"?"}</span><span style={{fontSize:10,fontWeight:700,color:"var(--t3)",textTransform:"uppercase"}}>{tier.label}</span></>}
          </button>
          <button type="button" className="btn-g" onClick={onLogout} style={{height:32,fontSize:11.5,color:"var(--red)"}}>{t("logout","Выйти")}</button>
        </div>
      </div>
      {isMobile&&(
        <div style={{padding:"10px 16px",borderBottom:"1px solid var(--border)",background:"var(--bg2)",display:"flex",justifyContent:"center"}}>
          <MainWorkspaceNav mode="contentPlan" onStrategy={onBackToStrategy} onContentPlan={()=>{}} t={t} isMobile={true}/>
        </div>
      )}
      <div style={{flex:1,overflowY:"auto",padding:isMobile?16:28,position:"relative",zIndex:5}}>
        <div style={{maxWidth:"min(1240px,100%)",width:"100%",margin:"0 auto"}}>
          <GlowCard plain panelVariant glowColor="accent" customSize width="100%" className="sa-ref-panel sa-ref-panel--lift sa-page-reveal sa-pr-d1" style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <span className="sa-cp-hub-hero-ic" style={{width:44,height:44,borderRadius:14,background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 4px 20px var(--accent-glow)"}}>✍️</span>
              <div style={{flex:1,minWidth:0}}>
                <h1 style={{fontSize:isMobile?20:26,fontWeight:900,color:"var(--text)",letterSpacing:-.6,margin:0}}>{t("cp_hub_title","Контент-план")}</h1>
                <div style={{fontSize:13.5,color:"var(--text4)",marginTop:4,maxWidth:"min(720px,100%)"}}>{t("cp_hub_subtitle","Отдельный рабочий режим: публикации и календарь по проектам из вашей стратегии. Шаги карт подтягиваются для привязки идей.")}</div>
                <div style={{fontSize:12,color:"var(--text4)",marginTop:10,maxWidth:640,lineHeight:1.45}}>{t("cp_hub_nav_hint","Подсказка: переключатель «Стратегия» в шапке ведёт к списку проектов; оттуда же открываются карты и шаги.")}</div>
              </div>
            </div>
            {!tier.contentPlan&&(
              <div style={{marginTop:14,padding:"12px 16px",borderRadius:12,border:"1px dashed var(--border2)",background:"var(--surface)"}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text3)",marginBottom:6}}>{t("cp_hub_locked","Тариф Pro и выше")}</div>
                <div style={{fontSize:13,color:"var(--text5)",marginBottom:10}}>{t("cp_hub_locked_hint","Контент-план как услуга доступен с Pro — AI и вы наполняете ленту в связке со стратегическими шагами.")}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
                  {onUpgrade&&<button type="button" className="btn-interactive" onClick={onUpgrade} style={{padding:"9px 18px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 2px 14px var(--accent-glow)"}}>{t("upgrade_to_pro","Перейти на Pro")}</button>}
                  <button type="button" className="btn-interactive" onClick={onBackToStrategy} style={{padding:"9px 16px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",cursor:"pointer",fontSize:13,fontWeight:700}}>{t("cp_preview_strategy","Посмотреть стратегию")}</button>
                </div>
              </div>
            )}
          </GlowCard>
          {loading?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
              {[1,2,3].map(i=><div key={i} style={{height:130,borderRadius:16,background:"var(--surface)",animation:"pulse 1.5s ease infinite",border:"1px solid var(--border)"}}/>)}
            </div>
          ):projects.length===0?(
            <div style={{textAlign:"center",padding:48,border:"1px dashed var(--border2)",borderRadius:16,background:"var(--surface)"}}>
              <div style={{fontSize:36,marginBottom:8}}>📂</div>
              <div style={{fontSize:15,fontWeight:700,color:"var(--text3)"}}>{t("cp_no_projects","Пока нет проектов")}</div>
              <div style={{fontSize:13,color:"var(--text5)",marginTop:8,maxWidth:400,marginLeft:"auto",marginRight:"auto",lineHeight:1.5}}>{t("cp_create_in_strategy","Создайте проект в разделе «Стратегия» — он появится и здесь.")}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center",marginTop:20}}>
                <button type="button" className="btn-interactive" onClick={onBackToStrategy} style={{padding:"11px 22px",borderRadius:12,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:14,fontWeight:800,boxShadow:"0 4px 18px var(--accent-glow)"}}>{t("cp_go_strategy","Перейти в стратегию")}</button>
              </div>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(300px,1fr))",gap:18}}>
              {projects.map((p:any,i:number)=>{
                const maps=mapsByProj[p.id]||[];
                const nMaps=maps.length;
                const nNodes=maps.reduce((acc:number,m:any)=>acc+(m.nodes?.length||0),0);
                return(
                  <button key={p.id} type="button" className="btn-interactive card-stagger sa-cp-hub-card" disabled={!tier.contentPlan} aria-label={tier.contentPlan?t("cp_card_aria_open","Открыть контент-план проекта {name}").replace("{name}",p.name||""):t("cp_card_aria_locked","Разблокировать Pro для контент-плана")}
                    onClick={()=>{if(!tier.contentPlan){onUpgrade&&onUpgrade();return;}onOpenProject(p,maps);}} style={{textAlign:"left",padding:"20px 22px",borderRadius:18,border:"1px solid var(--glass-border-accent,var(--border))",background:"var(--surface)",cursor:tier.contentPlan?"pointer":"not-allowed",opacity:tier.contentPlan?1:.78,display:"flex",flexDirection:"column",gap:12,animationDelay:`${Math.min(i,8)*0.05}s`}}>
                    <div style={{fontSize:16,fontWeight:900,color:"var(--text)",letterSpacing:-.3}}>{p.name||t("untitled","Без названия")}</div>
                    <div style={{fontSize:12.5,color:"var(--text5)",display:"flex",gap:12,flexWrap:"wrap"}}>
                      <span>{t("cp_stat_maps","{n} карт").replace("{n}",String(nMaps))}</span>
                      <span>·</span>
                      <span>{t("cp_stat_steps","{n} шагов").replace("{n}",String(nNodes))}</span>
                    </div>
                    <div style={{marginTop:"auto",paddingTop:4}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:10,fontSize:12.5,fontWeight:800,border:tier.contentPlan?"none":"1px dashed var(--border2)",background:tier.contentPlan?"var(--gradient-accent)":"var(--surface2)",color:tier.contentPlan?"var(--accent-on-bg)":"var(--text4)",boxShadow:tier.contentPlan?"0 2px 12px var(--accent-glow)":"none"}}>
                        {tier.contentPlan?<>✍️ {t("cp_open_plan_btn","Открыть план")}</>:<>🔒 {t("cp_locked_cta_short","Нужен Pro")}</>}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showNotifs&&onSelectProject&&onOpenMap&&(
        <NotificationsCenterModal
          open={showNotifs}
          onClose={()=>setShowNotifs(false)}
          isMobile={isMobile}
          zIndex={220}
          notifs={notifs}
          setNotifs={setNotifs}
          notifUnread={notifUnread}
          setNotifUnread={setNotifUnread}
          notifLoading={notifLoading}
          lang={lang}
          t={t}
          loadNotifications={loadNotifications}
          onFollowLink={async(n:any)=>{
            if(!n.link)return;
            try{
              const u=new URL(n.link,window.location.origin);
              const open=(u.searchParams.get("open")||"").toLowerCase();
              const projectId=u.searchParams.get("projectId")||"";
              const mapId=u.searchParams.get("mapId")||"";
              const nodeId=u.searchParams.get("nodeId")||"";
              if(open==="contentplan"&&projectId){
                const p=projects.find((x:any)=>x.id===projectId);
                if(p){setShowNotifs(false);onOpenProject(p,mapsByProj[projectId]||[]);return;}
              }
              if(open==="project"&&projectId){
                const p=projects.find((x:any)=>x.id===projectId);
                if(p){setShowNotifs(false);onSelectProject(p);return;}
              }
              if(open==="map"&&projectId&&mapId){
                const p=projects.find((x:any)=>x.id===projectId);
                if(p){setShowNotifs(false);onOpenMap({id:mapId},p,false,false,nodeId||null);return;}
              }
            }catch{}
            window.location.href=n.link;
          }}
        />
      )}

      {showAIHub&&(
        <AiHubModal open={showAIHub} onClose={()=>setShowAIHub(false)} isMobile={isMobile} t={t} hint={t("ai_hub_hint_cp","Тот же чат, что в стратегии. Контекст — проекты и карты, открытые в разделе контент-плана.")}>
          <AiPanel embedded={true} isMobile={isMobile} nodes={aiNodes} edges={aiEdges} ctx={aiCtx} tier={user?.tier||"free"} projectName={t("cp_hub_title","Контент-план")} mapName="" userName={user?.name||user?.email||""} msgs={aiChatMsgs||[]} onMsgsChange={aiChatSetMsgs||(()=>{})} onAddNode={()=>{}} onClose={()=>{}} externalMsgs={[]} onClearExternal={()=>{}} onError={()=>{}} statusMap={getSTATUS(t)}/>
        </AiHubModal>
      )}
      <FloatingAiAssistant t={t} variant="app" onOpenFullChat={() => setShowAIHub(true)} />
    </div></div>
  );
}

// ── Контент-план одного проекта (полноэкранно, как карта) ──
function ContentPlanProjectPage({user,project,maps,theme,onBackToHub,onOpenStrategyProject,onLogout,onChangeTier,onUpgrade,onProfile,onToggleTheme,aiChatMsgs,aiChatSetMsgs,onSelectProject,onOpenMap,onSwitchContentPlanProject}){
  const{t,lang}=useLang();
  const isMobile=useIsMobile();
  const tier=TIERS[user?.tier||"free"]||TIERS.free;
  const[showAIHub,setShowAIHub]=useState(false);
  const[showNotifs,setShowNotifs]=useState(false);
  const{notifs,setNotifs,notifUnread,setNotifUnread,notifLoading,loadNotifications}=useNotifications(showNotifs,user?.email);
  const[allProjects,setAllProjects]=useState<any[]>([]);

  useEffect(()=>{document.title=`${project?.name||"Проект"} — ${t("cp_doc_suffix","Контент-план")}`;},[project?.name,t]);
  useEffect(()=>{(async()=>{try{setAllProjects(await getProjects(user.email));}catch{setAllProjects([]);}})();},[user?.email]);

  const aiNodes=(maps||[]).flatMap((m:any)=>m.nodes||[]).slice(0,220);
  const aiEdges=(maps||[]).flatMap((m:any)=>m.edges||[]).slice(0,260);
  const aiCtx=`Контент-план проекта «${project?.name||"Проект"}». Карты: ${(maps||[]).length}. Шагов стратегии в контексте: ${aiNodes.length}.`;

  return(
    <div className={"sa-strategy-ui "+(theme==="dark"?"dk":"lt")} data-theme={theme} style={{width:"100%",maxWidth:"100%",boxSizing:"border-box",height:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden",position:"relative"}}>
      <StrategyShellBg/>
      <div style={{flex:1,minHeight:0,minWidth:0,display:"flex",flexDirection:"column",position:"relative",zIndex:1,overflow:"hidden"}}>
      <div className="sa-app-topbar">
        <div className="atb-cluster" style={{minWidth:0,flex:isMobile?"1 1 100%":undefined}}>
          <button type="button" className="sa-back-ic" onClick={onBackToHub} title={t("cp_back_hub_tip","К списку проектов в контент-плане")} aria-label={t("cp_back_hub","Все проекты")}>←</button>
          <div style={{minWidth:0,maxWidth:isMobile?"calc(100% - 48px)":"280px"}}>
            <div className="tb-title" style={{fontSize:isMobile?14:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✍️ {project?.name||t("untitled","Проект")}</div>
            <div className="tb-sub">{t("cp_project_sub","Контент-план и календарь")}</div>
          </div>
        </div>
        {!isMobile&&(
          <div style={{flex:"1 1 200px",display:"flex",justifyContent:"center",minWidth:0}}>
            <MainWorkspaceNav mode="contentPlan" onStrategy={onOpenStrategyProject} onContentPlan={()=>{}} t={t} isMobile={false}/>
          </div>
        )}
        <div className="atb-cluster" style={{marginLeft:isMobile?0:"auto"}}>
          <button type="button" className="btn-g" onClick={onOpenStrategyProject} title={t("cp_open_strategy_tip","Картами и шагами в проекте")} style={{height:32,fontSize:11.5,padding:"0 12px",display:"inline-flex",alignItems:"center",gap:6,color:"var(--acc)"}}>
            <span aria-hidden>🗺</span>{isMobile?"":t("cp_open_strategy","Карты проекта")}
          </button>
          <div className="tpill" onClick={onToggleTheme} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")onToggleTheme();}} aria-label={t("toggle_theme_tip","Сменить тему оформления")}>
            <div className={`tpi${theme==="dark"?" on":""}`}>☽</div>
            <div className={`tpi${theme==="light"?" on":""}`}>☀</div>
          </div>
          <button type="button" className="btn-g" onClick={()=>setShowAIHub(true)} title={t("ai_hub_title","✦ AI (единый чат)")} style={{height:32,fontSize:11.5,padding:"0 12px",display:"inline-flex",alignItems:"center",gap:6}}>
            <span aria-hidden>✦</span>{!isMobile&&t("ai_hub_btn_short","AI-чат")}
          </button>
          {API_BASE&&<NotifBell unread={notifUnread} onClick={()=>setShowNotifs(true)} className="btn-ic"/>}
          <button type="button" className="btn-g" onClick={onProfile} style={{height:32,padding:"0 12px",gap:8,display:"inline-flex",alignItems:"center",maxWidth:isMobile?40:200}}>
            <span style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,var(--acc),var(--acc2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>{(user.name||user.email||"?")[0].toUpperCase()}</span>
            {!isMobile&&<><span style={{fontSize:12,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name||user.email?.split("@")[0]||"?"}</span><span style={{fontSize:10,fontWeight:700,color:"var(--t3)",textTransform:"uppercase"}}>{tier.label}</span></>}
          </button>
          <button type="button" className="btn-g" onClick={onLogout} style={{height:32,fontSize:11.5,color:"var(--red)"}}>{t("logout","Выйти")}</button>
        </div>
      </div>
      {isMobile&&(
        <div style={{padding:"8px 14px",borderBottom:".5px solid var(--b1)",background:"var(--top)",display:"flex",justifyContent:"center"}}>
          <MainWorkspaceNav mode="contentPlan" onStrategy={onOpenStrategyProject} onContentPlan={()=>{}} t={t} isMobile={true}/>
        </div>
      )}
      <div className="sa-page-reveal" style={{flex:1,overflow:"auto",padding:isMobile?"12px 14px":"18px 22px"}}>
        {!tier.contentPlan?(
          <div className="sa-ref-panel sa-ref-panel--lift sa-page-reveal sa-pr-d1" style={{textAlign:"center",padding:"40px 28px",maxWidth:440,margin:"0 auto",borderStyle:"dashed"}}>
            <div style={{fontSize:40,marginBottom:12,animation:"float 3s ease-in-out infinite"}}>🔒</div>
            <div className="modal-title" style={{marginBottom:8}}>{t("content_plan_locked_title","Контент-план доступен на Pro")}</div>
            <div className="modal-sub" style={{marginBottom:22}}>{t("content_plan_locked_hint_inline","Оформите Pro в профиле — откроются календарь, привязка к шагам стратегии и AI-подсказки по ленте.")}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:12,justifyContent:"center"}}>
              {onUpgrade&&<button type="button" className="btn-p lg" onClick={onUpgrade}>{t("upgrade_to_pro","Перейти на Pro")}</button>}
              <button type="button" className="btn-g lg" style={{minWidth:200,justifyContent:"center"}} onClick={onOpenStrategyProject}>{t("cp_back_to_maps_only","Только карты проекта")}</button>
            </div>
          </div>
        ):(
          <div className="sa-page-reveal sa-pr-d1"><ContentPlanTab projectId={project.id} projectName={project.name||""} maps={maps} user={user} theme={theme} lang={lang} t={t} onChangeTier={onChangeTier}/></div>
        )}
      </div>

      {showNotifs&&onSelectProject&&onOpenMap&&(
        <NotificationsCenterModal
          open={showNotifs}
          onClose={()=>setShowNotifs(false)}
          isMobile={isMobile}
          zIndex={220}
          notifs={notifs}
          setNotifs={setNotifs}
          notifUnread={notifUnread}
          setNotifUnread={setNotifUnread}
          notifLoading={notifLoading}
          lang={lang}
          t={t}
          loadNotifications={loadNotifications}
          onFollowLink={async(n:any)=>{
            if(!n.link)return;
            try{
              const u=new URL(n.link,window.location.origin);
              const open=(u.searchParams.get("open")||"").toLowerCase();
              const projectId=u.searchParams.get("projectId")||"";
              const mapId=u.searchParams.get("mapId")||"";
              const nodeId=u.searchParams.get("nodeId")||"";
              if(open==="contentplan"&&projectId&&onSwitchContentPlanProject){
                if(projectId===project?.id){setShowNotifs(false);return;}
                const p=allProjects.find((x:any)=>x.id===projectId);
                if(p){
                  setShowNotifs(false);
                  const ms=await getMaps(p.id);
                  onSwitchContentPlanProject(p,Array.isArray(ms)?ms:[]);
                  return;
                }
              }
              if(open==="project"&&projectId){
                const p=allProjects.find((x:any)=>x.id===projectId);
                if(p){setShowNotifs(false);onSelectProject(p);return;}
              }
              if(open==="map"&&projectId&&mapId){
                const p=allProjects.find((x:any)=>x.id===projectId);
                if(p){setShowNotifs(false);onOpenMap({id:mapId},p,false,false,nodeId||null);return;}
              }
            }catch{}
            window.location.href=n.link;
          }}
        />
      )}

      {showAIHub&&(
        <AiHubModal open={showAIHub} onClose={()=>setShowAIHub(false)} isMobile={isMobile} t={t} hint={t("ai_hub_hint_cp_project","Контекст — карты и шаги текущего проекта в режиме контент-плана.")}>
          <AiPanel embedded={true} isMobile={isMobile} nodes={aiNodes} edges={aiEdges} ctx={aiCtx} tier={user?.tier||"free"} projectName={project?.name||""} mapName={t("cp_doc_suffix","Контент-план")} userName={user?.name||user?.email||""} msgs={aiChatMsgs||[]} onMsgsChange={aiChatSetMsgs||(()=>{})} onAddNode={()=>{}} onClose={()=>{}} externalMsgs={[]} onClearExternal={()=>{}} onError={()=>{}} statusMap={getSTATUS(t)}/>
        </AiHubModal>
      )}
      <FloatingAiAssistant t={t} variant="app" onOpenFullChat={() => setShowAIHub(true)} />
    </div></div>
  );
}

// ── ContentPlanTab (Pro+): ведение контент-плана по проекту, связь с шагами стратегии ──
const CONTENT_TYPES=[{id:"post",labelKey:"content_type_post",fb:"Пост"},{id:"story",labelKey:"content_type_story",fb:"История"},{id:"email",labelKey:"content_type_email",fb:"Рассылка"},{id:"video",labelKey:"content_type_video",fb:"Видео"}];
const CONTENT_CHANNELS=[{id:"blog",labelKey:"content_channel_blog",fb:"Блог"},{id:"instagram",labelKey:"content_channel_instagram",fb:"Instagram"},{id:"telegram",labelKey:"content_channel_telegram",fb:"Telegram"},{id:"vk",labelKey:"content_channel_vk",fb:"ВКонтакте"},{id:"youtube",labelKey:"content_channel_youtube",fb:"YouTube"},{id:"email",labelKey:"content_channel_email",fb:"Email"}];
const CONTENT_STATUSES=[{id:"draft",labelKey:"content_status_draft",fb:"Черновик"},{id:"scheduled",labelKey:"content_status_scheduled",fb:"Запланировано"},{id:"published",labelKey:"content_status_published",fb:"Опубликовано"}];

function ContentPlanTab({projectId,projectName,maps,user,theme,lang,t,onChangeTier}:{projectId:string;projectName:string;maps:any[];user:any;theme:string;lang:string;t:(k:string,fb?:string)=>string;onChangeTier:(tier:string)=>void}){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [editId,setEditId]=useState<string|null>(null);
  const [filterStatus,setFilterStatus]=useState<string>("all");
  const _cpKey=projectId||"all";
  const _viewKey=`sa_cp_view_${_cpKey}`;
  const _dateKey=`sa_cp_date_${_cpKey}`;
  const [viewMode,setViewMode]=useState<"calendar"|"map"|"list"|"tree">(()=>{try{const v=localStorage.getItem(_viewKey);return(v==="calendar"||v==="map"||v==="list"||v==="tree")?v:"calendar";}catch{return"calendar";}});
  useEffect(()=>{try{localStorage.setItem(_viewKey,viewMode);}catch{}},[_viewKey,viewMode]);
  const [aiSuggesting,setAiSuggesting]=useState(false);
  const [pendingDeleteId,setPendingDeleteId]=useState<string|null>(null);
  const [cpCalendarDate,setCpCalendarDate]=useState<Date>(()=>{
    try{
      const s=localStorage.getItem(_dateKey);
      if(s){const d=new Date(s);if(!isNaN(d.getTime()))return d;}
    }catch{}
    return new Date();
  });
  useEffect(()=>{try{localStorage.setItem(_dateKey,cpCalendarDate.toISOString());}catch{}},[_dateKey,cpCalendarDate]);
  const [newItemPresetDate,setNewItemPresetDate]=useState<string>("");
  const [toast,setToast]=useState<{msg:string;type:string}|null>(null);
  const isMobile=useIsMobile();
  const treePrefsKey=`sa_cp_tree_${projectId}`;
  const [treeExpandedAll,setTreeExpandedAll]=useState<Record<string,boolean>>({});
  const [treeCollapsed,setTreeCollapsed]=useState<{channels:Record<string,boolean>,statuses:Record<string,boolean>}>(()=>{
    try{
      const raw=localStorage.getItem(treePrefsKey);
      const parsed=raw?JSON.parse(raw):null;
      if(parsed&&typeof parsed==="object") return {channels:parsed.channels||{},statuses:parsed.statuses||{}};
    }catch{}
    return {channels:{},statuses:{}};
  });
  useEffect(()=>{
    try{localStorage.setItem(treePrefsKey,JSON.stringify(treeCollapsed));}catch{}
  },[treePrefsKey,treeCollapsed]);

  useEffect(()=>{(async()=>{setLoading(true);const list=await getContentPlan(projectId);setItems(Array.isArray(list)?list:[]);setLoading(false);})();},[projectId]);
  useEffect(()=>{if(editId===null)setNewItemPresetDate("");},[editId]);
  // ── prefill из стратегии: «Создать пост из шага» ──
  const[cpPrefill,setCpPrefill]=useState<any>(null);
  useEffect(()=>{
    try{
      const raw=localStorage.getItem("sa_cp_prefill");
      if(!raw)return;
      const data=JSON.parse(raw);
      if(!data||(Date.now()-(data.ts||0))>10*60*1000){localStorage.removeItem("sa_cp_prefill");return;}
      setCpPrefill(data);
      setEditId("new");
      localStorage.removeItem("sa_cp_prefill");
    }catch{}
  },[]);

  const allNodes=maps.flatMap((m:any)=>(m.nodes||[]).map((n:any)=>({...n,mapName:m.name})));
  const filtered=filterStatus==="all"?items:items.filter((x:any)=>x.status===filterStatus);

  const CHANNEL_LABEL:any={blog:t("content_channel_blog","Блог"),telegram:t("content_channel_telegram","Telegram"),instagram:t("content_channel_instagram","Instagram"),vk:t("content_channel_vk","ВКонтакте"),youtube:t("content_channel_youtube","YouTube"),email:t("content_channel_email","Email")};
  const STATUS_LABEL:any={
    draft:t("content_status_draft","Черновик"),
    scheduled:t("content_status_scheduled","Запланировано"),
    published:t("content_status_published","Опубликовано"),
  };

  async function saveItem(item:any){
    const id=item.id||uid();
    const next={...item,id,updatedAt:Date.now()};
    let list=items.some((x:any)=>x.id===id)?items.map((x:any)=>x.id===id?next:x):[...items,next];
    // Recurring posts: при создании новой записи с recur — генерируем доп. копии вперёд.
    if(!item.id&&next.recur&&next.scheduledDate){
      const stepDays=next.recur==="weekly"?7:next.recur==="biweekly"?14:0;
      if(stepDays){
        const base=new Date(next.scheduledDate);
        if(!isNaN(base.getTime())){
          const copies:any[]=[];
          for(let i=1;i<=4;i++){
            const d=new Date(base.getTime()+stepDays*i*864e5);
            const ymd=d.toISOString().slice(0,10);
            copies.push({...next,id:uid(),scheduledDate:ymd,recur:"",updatedAt:Date.now(),recurParentId:id});
          }
          list=[...list,...copies];
        }
      }
    }
    setItems(list);
    await saveContentPlan(projectId,list);
    setEditId(null);
  }
  function removeItem(id:string){
    setPendingDeleteId(id);
  }
  function confirmRemoveItem(){
    const id=pendingDeleteId;
    if(!id)return;
    setPendingDeleteId(null);
    const list=items.filter((x:any)=>x.id!==id);
    setItems(list);
    saveContentPlan(projectId,list);
    if(editId===id)setEditId(null);
  }
  async function aiSuggest(){
    if(allNodes.length===0)return;
    setAiSuggesting(true);
    try{
      const stepsCtx=allNodes.slice(0,15).map((n:any)=>`«${n.title}»`).join(", ");
      const sys=`Ты помощник по контент-маркетингу. Проект: ${projectName}. Шаги стратегии: ${stepsCtx}. Предложи 3 конкретные идеи контента (пост/видео/рассылка) — заголовок, канал, краткий тезис. Формат: одна идея на строку: ЗАГОЛОВОК | канал | тезис`;
      const res=await callAI([{role:"user",content:"Предложи 3 идеи контента по шагам стратегии. Кратко: заголовок, канал, тезис."}],sys,600);
      const lines=res.split("\n").filter((l:string)=>l.trim().length>5).slice(0,3);
      const newItems=lines.map((line:string)=>{
        const parts=line.replace(/^[\d\.\-\*]\s*/i,"").split("|").map((s:string)=>s.trim());
        const title=parts[0]||"Идея";
        const ch=parts[1]?.toLowerCase()||"";
        const channel=ch.includes("inst")?"instagram":ch.includes("теле")||ch.includes("telegram")?"telegram":ch.includes("блог")?"blog":ch.includes("ютуб")||ch.includes("youtube")?"youtube":"blog";
        const brief=parts[2]||"";
        return {id:uid(),title,channel,type:"post",status:"draft",brief,scheduledDate:"",strategyStepId:"",strategyStepTitle:"",createdAt:Date.now()};
      });
      const list=[...items,...newItems];
      setItems(list);
      await saveContentPlan(projectId,list);
      setToast({msg:t("cp_ai_added","Добавлено идей: {n}").replace("{n}",String(newItems.length)),type:"success"});
      setTimeout(()=>setToast(null),3000);
    }catch(e:any){
      setToast({msg:e?.message||t("cp_ai_err","Не удалось получить идеи. Попробуйте ещё раз."),type:"error"});
      setTimeout(()=>setToast(null),4000);
    }
    setAiSuggesting(false);
  }

  function openNewPublication(presetDate=""){
    setNewItemPresetDate(presetDate);
    setEditId("new");
  }

  const editingItem=editId?items.find((x:any)=>x.id===editId):null;

  function ContentMap({filtered,CHANNEL_LABEL,CONTENT_TYPES,CONTENT_STATUSES,setEditId,removeItem,t,isMobile}:any){
    return(
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:20,padding:"4px 0"}} role="region" aria-label={t("content_map_aria","Карточки публикаций")}>
        {filtered.map((it:any)=>(
          <div key={it.id} className="glass-card btn-interactive sa-cp-card" role="button" tabIndex={0}
            aria-label={t("content_card_open_aria","Открыть публикацию: {title}").replace("{title}",String(it.title||t("untitled","Без названия")).slice(0,120))}
            onClick={()=>setEditId(it.id)}
            onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setEditId(it.id);}}}
            style={{padding:"20px 18px",borderRadius:16,border:"1px solid var(--glass-border-accent,var(--border))",cursor:"pointer",display:"flex",flexDirection:"column",gap:10,minHeight:120,transition:"transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .22s ease",position:"relative",outline:"none"}}>
            <div style={{fontSize:14,fontWeight:800,color:"var(--text)",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}} title={it.title}>{it.title||t("untitled","Без названия")}</div>
            <div style={{fontSize:12,color:"var(--text4)",display:"flex",gap:8,flexWrap:"wrap",marginTop:"auto"}}>
              <span>{t(CONTENT_TYPES.find((x:any)=>x.id===it.type)?.labelKey||"content_type_post",CONTENT_TYPES.find((x:any)=>x.id===it.type)?.fb||"Пост")}</span>
              <span>·</span>
              <span>{CHANNEL_LABEL[it.channel]||it.channel}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4,gap:8}}>
              <div style={{padding:"4px 10px",borderRadius:8,background:it.status==="published"?"rgba(16,185,129,.12)":it.status==="scheduled"?"var(--accent-soft)":"var(--surface2)",color:it.status==="published"?"#12c482":it.status==="scheduled"?"var(--accent-1)":"var(--text3)",fontSize:11.5,fontWeight:700}}>
                {t(CONTENT_STATUSES.find((x:any)=>x.id===it.status)?.labelKey||"content_status_draft",CONTENT_STATUSES.find((x:any)=>x.id===it.status)?.fb||"Черновик")}
              </div>
              <button type="button" className="btn-interactive" onClick={e=>{e.stopPropagation();removeItem(it.id);}} title={t("delete","Удалить")} aria-label={t("content_delete_item_aria","Удалить из плана: {title}").replace("{title}",String(it.title||"").slice(0,80))} style={{padding:"6px 10px",borderRadius:8,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"var(--red)",cursor:"pointer",fontSize:12,flexShrink:0,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><IconTrash/></button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function ContentCalendar({filtered,CHANNEL_LABEL,CONTENT_TYPES,CONTENT_STATUSES,setEditId,removeItem,t,isMobile,cpCalendarDate,setCpCalendarDate,openNewPublication,theme,lang}:any){
    const loc=lang==="en"?"en-US":lang==="uz"?"uz-UZ":"ru-RU";
    const selectedKey=dateToYMD(cpCalendarDate);
    const forSelected=filtered.filter((it:any)=>(it.scheduledDate||"")===selectedKey);
    const nodate=filtered.filter((it:any)=>!(it.scheduledDate||""));
    const otherDates=[...new Set(filtered.map((it:any)=>it.scheduledDate).filter(Boolean))].filter((d:string)=>d!==selectedKey).sort();
    const byDate:Record<string,any[]>={};
    otherDates.forEach((d:string)=>{byDate[d]=filtered.filter((it:any)=>(it.scheduledDate||"")===d);});
    const fmtDate=(s:string)=>s?new Date(s+"T12:00:00").toLocaleDateString(loc,{day:"numeric",month:"short",year:"numeric"}):"";
    const fmtLong=(d:Date)=>d.toLocaleDateString(loc,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    function row(it:any){
      return(
        <div key={it.id} className="btn-interactive" role="button" tabIndex={0}
          draggable
          onDragStart={e=>{
            e.dataTransfer.setData("application/x-sa-cp-id",it.id);
            e.dataTransfer.effectAllowed="move";
          }}
          aria-label={t("content_card_open_aria","Открыть публикацию: {title}").replace("{title}",String(it.title||t("untitled","Без названия")).slice(0,120))}
          style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:"1px solid var(--border)",background:"var(--surface)",cursor:"grab",outline:"none"}}
          onClick={()=>setEditId(it.id)}
          onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setEditId(it.id);}}}
          onFocus={e=>{e.currentTarget.style.boxShadow="0 0 0 2px var(--accent-1)";}}
          onBlur={e=>{e.currentTarget.style.boxShadow="none";}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13.5,fontWeight:700,color:"var(--text)",marginBottom:2}}>{it.title||t("untitled","Без названия")}</div>
            <div style={{fontSize:12,color:"var(--text4)",display:"flex",gap:8,flexWrap:"wrap"}}>
              <span>{t(CONTENT_TYPES.find((x:any)=>x.id===it.type)?.labelKey||"content_type_post",CONTENT_TYPES.find((x:any)=>x.id===it.type)?.fb||"Пост")}</span>
              <span>·</span>
              <span>{CHANNEL_LABEL[it.channel]||it.channel}</span>
              {it.strategyStepTitle&&<><span>·</span><span style={{color:"var(--accent-1)"}}>↗ {it.strategyStepTitle}</span></>}
            </div>
          </div>
          <div style={{padding:"4px 10px",borderRadius:8,background:it.status==="published"?"rgba(16,185,129,.12)":it.status==="scheduled"?"var(--accent-soft)":"var(--surface2)",color:it.status==="published"?"#12c482":it.status==="scheduled"?"var(--accent-1)":"var(--text3)",fontSize:12,fontWeight:700}}>
            {t(CONTENT_STATUSES.find((x:any)=>x.id===it.status)?.labelKey||"content_status_draft",CONTENT_STATUSES.find((x:any)=>x.id===it.status)?.fb||"Черновик")}
          </div>
          <button type="button" className="btn-interactive" onClick={e=>{e.stopPropagation();removeItem(it.id);}} title={t("delete","Удалить")} aria-label={t("content_delete_item_aria","Удалить из плана: {title}").replace("{title}",String(it.title||"").slice(0,80))} style={{padding:"6px 10px",borderRadius:8,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"var(--red)",cursor:"pointer",fontSize:12,flexShrink:0,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><IconTrash/></button>
        </div>
      );
    }
    return(
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:20,alignItems:"flex-start"}}>
        <div style={{flexShrink:0,width:"100%",maxWidth:360}}>
          <GlassCalendar
            selectedDate={cpCalendarDate}
            onDateSelect={(d:Date)=>setCpCalendarDate(d)}
            lang={lang}
            theme={theme==="dark"?"dark":"light"}
            highlightedDates={Array.from(new Set(filtered.filter((x:any)=>x.scheduledDate).map((x:any)=>x.scheduledDate)))}
            dropMime="application/x-sa-cp-id"
            onItemDrop={async(date:Date,id:string)=>{
              const ymd=dateToYMD(date);
              const next=items.map((x:any)=>x.id===id?{...x,scheduledDate:ymd,updatedAt:Date.now()}:x);
              setItems(next);
              await saveContentPlan(projectId,next);
            }}
            labels={{
              weekly:t("cp_cal_weekly","Неделя"),
              monthly:t("cp_cal_monthly","Месяц"),
              addNote:t("cp_cal_add_note","Заметка…"),
              newEvent:t("cp_cal_new_event","Событие"),
            }}
            onNewNote={()=>openNewPublication(dateToYMD(cpCalendarDate))}
            onNewEvent={()=>openNewPublication(dateToYMD(cpCalendarDate))}
          />
        </div>
        <div style={{flex:1,minWidth:0,width:"100%",display:"flex",flexDirection:"column",gap:16}}>
          <div className="glass-card" style={{padding:isMobile?"14px 14px":"18px 20px"}}>
            <div style={{fontSize:13,fontWeight:800,color:"var(--accent-1)",marginBottom:12}}>📅 {fmtLong(cpCalendarDate)}</div>
            {forSelected.length===0?(
              <div style={{fontSize:12.5,color:"var(--text5)",lineHeight:1.5}}>{t("cp_cal_empty_day","Нет публикаций на этот день")}</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>{forSelected.map((it:any)=>row(it))}</div>
            )}
          </div>
          {nodate.length>0&&(
            <div className="glass-card" style={{padding:isMobile?"14px 14px":"18px 20px"}}>
              <div style={{fontSize:13,fontWeight:800,color:"var(--text4)",marginBottom:12,textTransform:"uppercase",letterSpacing:.5}}>📋 {t("content_no_date","Без даты")}</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>{nodate.map((it:any)=>row(it))}</div>
            </div>
          )}
          {otherDates.map((d:string)=>(
            <div key={d} className="glass-card" style={{padding:isMobile?"14px 14px":"18px 20px"}}>
              <div style={{fontSize:13,fontWeight:800,color:"var(--accent-1)",marginBottom:12}}>📅 {fmtDate(d)}</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>{(byDate[d]||[]).map((it:any)=>row(it))}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function ContentTree(){
    // root → channel → status → items
    const byChannel:any = {};
    filtered.forEach((it:any)=>{
      const ch=it.channel||"blog";
      const st=it.status||"draft";
      byChannel[ch] ||= {};
      byChannel[ch][st] ||= [];
      byChannel[ch][st].push(it);
    });
    const channelOrder=["blog","telegram","instagram","vk","youtube","email"];
    const statusOrder=["draft","scheduled","published"];
    const channels = channelOrder.filter(ch=>byChannel[ch]).concat(Object.keys(byChannel).filter(ch=>!channelOrder.includes(ch)));
    if(channels.length===0) return null;

    return(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="glass-card" style={{padding:isMobile?"14px 14px":"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:"var(--text)"}}>🌳 {t("content_tree_title","Дерево контент‑плана")}</div>
            <div style={{fontSize:12,color:"var(--text4)",marginTop:2}}>{t("content_tree_hint","Проект → канал → статус → публикации. Нажмите на карточку, чтобы редактировать.")}</div>
          </div>
          <button type="button" className="btn-interactive" onClick={()=>openNewPublication()} title={t("add_content_item_tip","Новая запись в плане")} style={{padding:"8px 14px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:12.5,fontWeight:800,whiteSpace:"nowrap",boxShadow:"0 2px 12px var(--accent-glow)"}}>
            {t("add_content_item","+ Публикация")}
          </button>
        </div>

        {channels.map((ch:string,ci:number)=>(
          <div key={ch} className="glass-card list-item-in" style={{padding:isMobile?"12px 12px":"14px 16px",animationDelay:`${ci*0.05}s`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:"var(--accent-1)",boxShadow:"0 0 0 3px var(--accent-soft)"}}/>
                <div style={{fontSize:13.5,fontWeight:900,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{CHANNEL_LABEL[ch]||ch}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:12,color:"var(--text5)",fontWeight:700}}>{t("content_tree_count","{n} шт.").replace("{n}",String(Object.values(byChannel[ch]).reduce((s:any,a:any)=>s+(a?.length||0),0)))}</div>
                <button type="button" className="btn-interactive" aria-expanded={!treeCollapsed.channels[ch]} aria-label={treeCollapsed.channels[ch]?t("content_tree_expand_ch","Развернуть канал {ch}").replace("{ch}",CHANNEL_LABEL[ch]||ch):t("content_tree_collapse_ch","Свернуть канал {ch}").replace("{ch}",CHANNEL_LABEL[ch]||ch)} onClick={(e)=>{e.preventDefault();e.stopPropagation();setTreeCollapsed(p=>({channels:{...p.channels,[ch]:!p.channels[ch]},statuses:p.statuses}));}} style={{padding:"6px 10px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",cursor:"pointer",fontSize:12,fontWeight:800,minWidth:36}}>
                  {treeCollapsed.channels[ch]?"▸":"▾"}
                </button>
              </div>
            </div>

            {!treeCollapsed.channels[ch]&&(
              <div className="collapse-wrap collapse-in" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,minmax(0,1fr))",gap:10}}>
                {statusOrder.filter(st=>byChannel[ch][st]?.length).map((st:string,si:number)=>{
                  const statusKey=`${ch}:${st}`;
                  const collapsed=!!treeCollapsed.statuses[statusKey];
                  return(
                    <div key={st} style={{borderRadius:14,border:"1px solid var(--glass-border-accent,var(--border))",background:"rgba(255,255,255,.02)",padding:"10px 10px 12px",boxShadow:"var(--glass-shadow-accent,none)"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                          <div style={{fontSize:12.5,fontWeight:900,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{STATUS_LABEL[st]||st}</div>
                          <button type="button" className="btn-interactive" aria-expanded={!collapsed} aria-label={collapsed?t("content_tree_expand_st","Развернуть: {st}").replace("{st}",STATUS_LABEL[st]||st):t("content_tree_collapse_st","Свернуть: {st}").replace("{st}",STATUS_LABEL[st]||st)} onClick={(e)=>{e.preventDefault();e.stopPropagation();setTreeCollapsed(p=>({channels:p.channels,statuses:{...p.statuses,[statusKey]:!p.statuses[statusKey]}}));}} style={{padding:"4px 8px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text4)",cursor:"pointer",fontSize:12,fontWeight:900,flexShrink:0,minWidth:32}}>
                            {collapsed?"▸":"▾"}
                          </button>
                        </div>
                        <div style={{fontSize:12,color:"var(--text5)",fontWeight:800}}>{byChannel[ch][st].length}</div>
                      </div>
                      {!collapsed&&(
                        <div className="collapse-wrap collapse-in" style={{display:"flex",flexDirection:"column",gap:8}}>
                          {byChannel[ch][st].slice(0,treeExpandedAll[statusKey]?999:(isMobile?6:8)).map((it:any,ii:number)=>(
                            <button key={it.id} type="button" className="btn-interactive" onClick={()=>setEditId(it.id)} aria-label={t("content_card_open_aria","Открыть публикацию: {title}").replace("{title}",String(it.title||t("untitled","Без названия")).slice(0,120))} style={{textAlign:"left",padding:"10px 12px",borderRadius:12,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",cursor:"pointer",width:"100%"}}>
                              <div style={{fontSize:12.5,fontWeight:900,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.title||t("untitled","Без названия")}</div>
                              <div style={{fontSize:11.5,color:"var(--text4)",display:"flex",gap:8,flexWrap:"wrap",lineHeight:1.4}}>
                                {it.scheduledDate&&<span>📅 {it.scheduledDate}</span>}
                                {it.strategyStepTitle&&<span style={{color:"var(--accent-1)"}}>↗ {it.strategyStepTitle}</span>}
                                {it.brief&&<span style={{opacity:.9}}>{it.brief.slice(0,64)}{it.brief.length>64?"…":""}</span>}
                              </div>
                            </button>
                          ))}
                          {byChannel[ch][st].length>(isMobile?6:8)&&!treeExpandedAll[statusKey]&&(
                            <button type="button" className="btn-interactive" onClick={(e)=>{e.stopPropagation();setTreeExpandedAll(p=>({...p,[statusKey]:true}));}} title={t("content_show_all_tip","Показать все публикации в этой группе")} style={{fontSize:12,color:"var(--accent-1)",padding:"8px 10px",borderRadius:8,border:"1px dashed var(--border2)",background:"var(--surface2)",cursor:"pointer",fontWeight:700,textAlign:"left",width:"100%"}}>
                              {t("content_show_all","Показать все")} (+{byChannel[ch][st].length-(isMobile?6:8)})
                            </button>
                          )}
                        </div>
                      )}
                      {collapsed&&(
                        <div style={{fontSize:12.5,color:"var(--text5)",padding:"2px 6px"}}>{t("content_more","Ещё")}: {byChannel[ch][st].length}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  const viewModes:[typeof viewMode,string,string][]=[
    ["calendar","📅",t("content_view_calendar","Календарь")],
    ["map","🗺",t("content_view_map","Карта")],
    ["tree","🌳",t("content_view_tree","Дерево")],
    ["list","≡",t("content_view_list","Список")],
  ];
  const viewTips:Record<string,string>={
    calendar:t("content_view_tip_calendar","По датам публикации и без даты"),
    map:t("content_view_tip_map","Карточки по каналам и типам"),
    tree:t("content_view_tip_tree","Иерархия канал → статус"),
    list:t("content_view_tip_list","Компактный список со статусами"),
  };

  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:800,color:"var(--text)",marginBottom:4}}>✍️ {t("content_plan","Контент-план")}</div>
        <div style={{fontSize:13,color:"var(--text4)",lineHeight:1.45}}>{t("content_plan_intro","Планируйте посты, видео и рассылки. Переключайте вид: календарь по датам, по каналам или список.")}</div>
      </div>
      <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 220px",minWidth:0}}>
          <div style={{fontSize:11,fontWeight:800,color:"var(--text5)",textTransform:"uppercase",letterSpacing:.06,marginBottom:8}}>{t("content_view_group_label","Как показать план")}</div>
          <div role="tablist" aria-label={t("content_view_group_aria","Режим отображения контент-плана")} style={{display:"flex",gap:6,padding:4,borderRadius:12,border:"1px solid var(--border)",background:"var(--surface2)",flexWrap:isMobile?"nowrap":"wrap",overflowX:isMobile?"auto":"visible",WebkitOverflowScrolling:"touch",maxWidth:"100%"}}>
            {viewModes.map(([id,icon,label])=>(
              <button key={id} type="button" role="tab" aria-selected={viewMode===id} aria-pressed={viewMode===id} title={viewTips[id]} onClick={()=>setViewMode(id)} className="btn-interactive" style={{padding:isMobile?"8px 12px":"7px 12px",borderRadius:10,border:"none",background:viewMode===id?"var(--accent-soft)":"transparent",color:viewMode===id?"var(--accent-1)":"var(--text4)",cursor:"pointer",fontSize:isMobile?11.5:12,fontWeight:800,whiteSpace:"nowrap",flexShrink:0,boxShadow:viewMode===id?"inset 0 0 0 1px var(--glass-border-accent,var(--border))":"none"}}>
                <span aria-hidden>{icon}</span> {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:isMobile?"stretch":"flex-end",flex:"0 1 auto"}}>
          <div style={{fontSize:11,fontWeight:800,color:"var(--text5)",textTransform:"uppercase",letterSpacing:.06,alignSelf:isMobile?"flex-start":"flex-end"}}>{t("content_actions_label","Действия")}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:isMobile?"stretch":"flex-end"}}>
            {allNodes.length>0?(
              <button type="button" onClick={aiSuggest} disabled={aiSuggesting} title={t("content_ai_suggest_tip","Сгенерировать идеи из названий шагов на картах")} style={{padding:"8px 14px",borderRadius:10,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:"var(--accent-1)",cursor:aiSuggesting?"wait":"pointer",fontSize:13,fontWeight:700,opacity:aiSuggesting?.85:1}}>
                {aiSuggesting?"…":t("content_ai_suggest","✨ Предложить по стратегии")}
              </button>
            ):(
              <button type="button" disabled title={t("content_ai_suggest_disabled","Сначала добавьте шаги на картах проекта — тогда AI сможет предложить темы")} style={{padding:"8px 14px",borderRadius:10,border:"1px dashed var(--border2)",background:"var(--surface)",color:"var(--text5)",cursor:"not-allowed",fontSize:12.5,fontWeight:600,textAlign:"left",maxWidth:280}}>
                {t("content_ai_suggest_need_steps","✨ AI: нужны шаги на карте")}
              </button>
            )}
            <button type="button" className="btn-interactive" onClick={()=>openNewPublication()} title={t("add_content_item_tip","Новая запись в плане: пост, рассылка, видео…")} style={{padding:"8px 18px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 2px 12px var(--accent-glow)"}}>{t("add_content_item","+ Публикация")}</button>
          </div>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:800,color:"var(--text5)",textTransform:"uppercase",letterSpacing:.06,marginBottom:8}}>{t("content_filter_status_label","Фильтр по статусу")}</div>
        <div role="group" aria-label={t("content_filter_status_aria","Статус публикации")} style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["all",...CONTENT_STATUSES.map(s=>s.id)].map(s=>(
            <button key={s} type="button" aria-pressed={filterStatus===s} onClick={()=>setFilterStatus(s)} style={{padding:"7px 14px",borderRadius:10,border:`1px solid ${filterStatus===s?"var(--accent-1)":"var(--border)"}`,background:filterStatus===s?"var(--accent-soft)":"var(--surface)",color:filterStatus===s?"var(--accent-1)":"var(--text3)",cursor:"pointer",fontSize:12.5,fontWeight:filterStatus===s?800:600,transition:"border-color .15s, background .15s"}}>
              {s==="all"?t("all_statuses","Все"):t(CONTENT_STATUSES.find(x=>x.id===s)?.labelKey||"",CONTENT_STATUSES.find(x=>x.id===s)?.fb||s)}
            </button>
          ))}
        </div>
      </div>
      {loading?(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {[1,2,3].map(i=><div key={i} style={{height:100,borderRadius:14,background:"var(--surface)",animation:"pulse 1.5s ease infinite",border:"1px solid var(--border)"}}/>)}
        </div>
      ):filtered.length===0&&items.length>0?(
        <div className="glass-card" style={{textAlign:"center",padding:"40px 24px",border:"1px dashed var(--border2)",borderRadius:16}}>
          <div style={{fontSize:32,marginBottom:8}}>🔍</div>
          <div style={{fontSize:14,fontWeight:800,color:"var(--text)",marginBottom:6}}>{t("content_filter_empty_title","Нет публикаций с таким статусом")}</div>
          <div style={{fontSize:13,color:"var(--text5)",marginBottom:18,maxWidth:360,marginLeft:"auto",marginRight:"auto",lineHeight:1.5}}>{t("content_filter_empty_desc","Смените фильтр или добавьте публикацию в нужном статусе.")}</div>
          <button type="button" className="btn-interactive" onClick={()=>setFilterStatus("all")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 2px 12px var(--accent-glow)"}}>{t("content_filter_reset","Показать все статусы")}</button>
        </div>
      ):filtered.length===0?(
        <div className="glass-card" style={{textAlign:"center",padding:"44px 24px",border:"1px dashed var(--border2)",borderRadius:16}}>
          <div style={{fontSize:36,marginBottom:10}}>✍️</div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text3)",marginBottom:6}}>{t("content_plan_empty_title","Планируйте публикации")}</div>
          <div style={{fontSize:13,color:"var(--text5)",marginBottom:16,maxWidth:320,margin:"0 auto 16px",lineHeight:1.5}}>{t("content_plan_empty_desc","Добавьте посты, видео и рассылки. AI предложит идеи на основе шагов вашей стратегии.")}</div>
          <button type="button" className="btn-interactive" onClick={()=>openNewPublication()} style={{padding:"10px 22px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 2px 12px var(--accent-glow)"}}>{t("add_content_item","+ Публикация")}</button>
        </div>
      ):(
        viewMode==="calendar"
          ? <ContentCalendar filtered={filtered} CHANNEL_LABEL={CHANNEL_LABEL} CONTENT_TYPES={CONTENT_TYPES} CONTENT_STATUSES={CONTENT_STATUSES} setEditId={setEditId} removeItem={removeItem} t={t} isMobile={isMobile} cpCalendarDate={cpCalendarDate} setCpCalendarDate={setCpCalendarDate} openNewPublication={openNewPublication} theme={theme} lang={lang}/>
          : viewMode==="map"
          ? <ContentMap filtered={filtered} CHANNEL_LABEL={CHANNEL_LABEL} CONTENT_TYPES={CONTENT_TYPES} CONTENT_STATUSES={CONTENT_STATUSES} setEditId={setEditId} removeItem={removeItem} t={t} isMobile={isMobile}/>
          : viewMode==="tree"
          ? <ContentTree/>
          : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filtered.map((it:any,i:number)=>(
                <div key={it.id} className="glass-card list-item-in" style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",animationDelay:`${i*0.04}s`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:4}}>{it.title||t("untitled","Без названия")}</div>
                    <div style={{fontSize:12,color:"var(--text4)",display:"flex",gap:8,flexWrap:"wrap"}}>
                      <span>{t(CONTENT_TYPES.find(x=>x.id===it.type)?.labelKey||"content_type_post",CONTENT_TYPES.find(x=>x.id===it.type)?.fb||"Пост")}</span>
                      <span>·</span>
                      <span>{t(CONTENT_CHANNELS.find(x=>x.id===it.channel)?.labelKey||"content_channel_blog",CONTENT_CHANNELS.find(x=>x.id===it.channel)?.fb||"Блог")}</span>
                      {it.scheduledDate&&<><span>·</span><span>{it.scheduledDate}</span></>}
                      {it.strategyStepTitle&&<><span>·</span><span style={{color:"var(--accent-1)"}}>↗ {it.strategyStepTitle}</span></>}
                    </div>
                  </div>
                  <div style={{padding:"4px 10px",borderRadius:8,background:it.status==="published"?"rgba(16,185,129,.12)":it.status==="scheduled"?"var(--accent-soft)":"var(--surface2)",border:`1px solid ${it.status==="published"?"rgba(16,185,129,.3)":it.status==="scheduled"?"var(--glass-border-accent,var(--border))":"var(--border)"}`,color:it.status==="published"?"#12c482":it.status==="scheduled"?"var(--accent-1)":"var(--text3)",fontSize:12,fontWeight:700}}>
                    {t(CONTENT_STATUSES.find(x=>x.id===it.status)?.labelKey||"content_status_draft",CONTENT_STATUSES.find(x=>x.id===it.status)?.fb||"Черновик")}
                  </div>
                  <button type="button" onClick={()=>setEditId(it.id)} className="btn-interactive" title={t("edit","Редактировать")} aria-label={t("content_edit_item_aria","Редактировать: {title}").replace("{title}",(it.title||t("untitled","Без названия")).slice(0,80))} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text2)",cursor:"pointer",fontSize:12,fontWeight:700}}>✏️</button>
                  <button type="button" onClick={()=>removeItem(it.id)} className="btn-interactive" title={t("delete","Удалить")} aria-label={t("content_delete_item_aria","Удалить из плана: {title}").replace("{title}",(it.title||"").slice(0,80))} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"var(--red)",cursor:"pointer",fontSize:12,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><IconTrash/></button>
                </div>
              ))}
            </div>
          )
      )}

      {(editId==="new"||editingItem)&&(
        <ContentPlanItemModal
          formKey={editId||""}
          item={editingItem||{
            title:cpPrefill?.title||"",
            type:"post",
            channel:"blog",
            status:"draft",
            brief:cpPrefill?.brief||"",
            scheduledDate:newItemPresetDate||"",
            strategyStepId:cpPrefill?.strategyStepId||"",
            strategyStepTitle:cpPrefill?.strategyStepTitle||"",
          }}
          allNodes={allNodes}
          t={t}
          theme={theme}
          onSave={(item)=>{setCpPrefill(null);saveItem(editId==="new"?{...item,createdAt:Date.now()}:{...editingItem,...item});}}
          onClose={()=>{setCpPrefill(null);setEditId(null);}}
        />
      )}

      {pendingDeleteId&&(
        <ConfirmDialog
          title={t("content_delete_confirm_title","Удалить из контент-плана?")}
          message={t("content_delete_confirm_msg","Запись «{title}» будет удалена без восстановления.").replace("{title}",String((items.find((x:any)=>x.id===pendingDeleteId)?.title)||t("untitled","Без названия")).slice(0,120))}
          confirmLabel={t("delete","Удалить")}
          onConfirm={confirmRemoveItem}
          onCancel={()=>setPendingDeleteId(null)}
          danger={true}
        />
      )}
      {toast&&(
        <div role="status" style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:1500,padding:"12px 22px",borderRadius:14,border:`1px solid ${toast.type==="error"?"rgba(239,68,68,.4)":"rgba(16,185,129,.4)"}`,background:toast.type==="error"?"rgba(239,68,68,.15)":"rgba(16,185,129,.15)",color:toast.type==="error"?"#f87171":"#34d399",fontSize:13.5,fontWeight:700,boxShadow:"0 8px 32px rgba(0,0,0,.3)",backdropFilter:"blur(12px)"}}>
          {toast.type==="error"?"⚠ ":"✓ "}{toast.msg}
        </div>
      )}
    </div>
  );
}

function ContentPlanItemModal({formKey,item,allNodes,t,theme,onSave,onClose}:{formKey:string;item:any;allNodes:any[];t:(k:string,fb?:string)=>string;theme:string;onSave:(item:any)=>void;onClose:()=>void}){
  const [title,setTitle]=useState(item.title||"");
  const [type,setType]=useState(item.type||"post");
  const [channel,setChannel]=useState(item.channel||"blog");
  const [status,setStatus]=useState(item.status||"draft");
  const [brief,setBrief]=useState(item.brief||"");
  const [scheduledDate,setScheduledDate]=useState(item.scheduledDate||"");
  const [stepId,setStepId]=useState(item.strategyStepId||"");
  const [recur,setRecur]=useState(item.recur||"");
  const [dirty,setDirty]=useState(false);
  const [showDiscard,setShowDiscard]=useState(false);
  useEffect(()=>{
    setTitle(item.title||"");
    setType(item.type||"post");
    setChannel(item.channel||"blog");
    setStatus(item.status||"draft");
    setBrief(item.brief||"");
    setScheduledDate(item.scheduledDate||"");
    setStepId(item.strategyStepId||"");
    setRecur(item.recur||"");
    setDirty(false);
  },[formKey,item?.id]);
  const stepOptions=allNodes.map((n:any)=>({id:n.id,title:n.title,mapName:n.mapName}));
  function requestClose(){
    if(dirty){setShowDiscard(true);return;}
    onClose();
  }
  useEffect(()=>{
    if(!dirty)return;
    const h=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};
    window.addEventListener("beforeunload",h);
    return()=>window.removeEventListener("beforeunload",h);
  },[dirty]);
  function handleSave(){
    const stepTitle=stepOptions.find((s:any)=>s.id===stepId)?.title||"";
    onSave({title:title.trim()||"Без названия",type,channel,status,brief,scheduledDate,strategyStepId:stepId||"",strategyStepTitle:stepTitle,recur:recur||""});
  }
  return(
    <>
    <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"var(--modal-overlay-bg,rgba(0,0,0,.7))",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(12px)",padding:16}} onClick={e=>{if(e.target===e.currentTarget)requestClose();}}>
      <div className="glass-panel glass-panel-lg" data-theme={theme} style={{width:"min(96vw,440px)",maxHeight:"90vh",overflowY:"auto",borderRadius:20,padding:"24px"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:800,color:"var(--text)",marginBottom:18}}>✍️ {item.id?t("edit","Редактировать"):t("add_content_item","Публикация")}</div>
        <input placeholder={t("title","Название")} value={title} onChange={e=>{setTitle(e.target.value);setDirty(true);}} style={{width:"100%",padding:"10px 14px",fontSize:14,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:10,color:"var(--text)",marginBottom:10,outline:"none",fontFamily:"inherit"}}/>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text4)",marginBottom:6}}>{t("content_label_type","Тип контента")}</div>
        <div style={{marginBottom:12}}>
          <PillGroup items={CONTENT_TYPES} value={type} onChange={(v)=>{setType(v);setDirty(true);}} ariaLabel={t("content_label_type","Тип контента")}/>
        </div>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text4)",marginBottom:6}}>{t("content_label_channel","Канал публикации")}</div>
        <div style={{marginBottom:12}}>
          <PillGroup items={CONTENT_CHANNELS} value={channel} onChange={(v)=>{setChannel(v);setDirty(true);}} ariaLabel={t("content_label_channel","Канал публикации")}/>
        </div>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text4)",marginBottom:6}}>{t("content_label_status","Статус")}</div>
        <div style={{marginBottom:12}}>
          <PillGroup items={CONTENT_STATUSES} value={status} onChange={(v)=>{setStatus(v);setDirty(true);}} ariaLabel={t("content_label_status","Статус")}/>
        </div>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text4)",marginBottom:6}}>{t("scheduled_date_short","Дата публикации")}</div>
        <input type="date" value={scheduledDate} onChange={e=>{setScheduledDate(e.target.value);setDirty(true);}} style={{width:"100%",padding:"10px 14px",fontSize:14,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:10,color:"var(--text)",marginBottom:12,outline:"none",fontFamily:"inherit"}}/>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text4)",marginBottom:6}}>{t("recur_label","Повтор")}</div>
        <select value={recur} onChange={e=>{setRecur(e.target.value);setDirty(true);}} style={{width:"100%",padding:"10px 14px",fontSize:13,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:10,color:"var(--text)",marginBottom:12,outline:"none",fontFamily:"inherit"}}>
          <option value="">{t("recur_none","Однократно")}</option>
          <option value="weekly">{t("recur_weekly","Еженедельно (4 недели)")}</option>
          <option value="biweekly">{t("recur_biweekly","Раз в 2 недели (4 раза)")}</option>
        </select>
        {stepOptions.length>0&&(
          <>
            <div style={{fontSize:12,fontWeight:700,color:"var(--text4)",marginBottom:6}}>{t("content_link_step","Связать с шагом стратегии")}</div>
            <select value={stepId} onChange={e=>{setStepId(e.target.value);setDirty(true);}} style={{width:"100%",padding:"10px 14px",fontSize:13,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:10,color:"var(--text)",marginBottom:12,outline:"none",fontFamily:"inherit"}}>
              <option value="">— Не привязан</option>
              {stepOptions.map((s:any)=>(<option key={s.id} value={s.id}>{s.title} {s.mapName?`(${s.mapName})`:""}</option>))}
            </select>
          </>
        )}
        <div style={{fontSize:12,fontWeight:700,color:"var(--text4)",marginBottom:6}}>{t("brief","Тезис / описание")}</div>
        <textarea placeholder={t("brief","Краткое описание или тезис публикации")} value={brief} onChange={e=>{setBrief(e.target.value);setDirty(true);}} rows={3} style={{width:"100%",padding:"10px 14px",fontSize:13,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:10,color:"var(--text)",marginBottom:18,outline:"none",resize:"vertical",fontFamily:"inherit"}}/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
          <button type="button" onClick={requestClose} className="btn-interactive" style={{padding:"10px 20px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text2)",cursor:"pointer",fontSize:13,fontWeight:600}}>{t("cancel","Отмена")}</button>
          <button type="button" onClick={handleSave} className="btn-interactive" style={{padding:"10px 22px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 2px 12px var(--accent-glow)"}}>{t("save","Сохранить")}</button>
        </div>
      </div>
    </div>
    {showDiscard&&(
      <ConfirmDialog
        title={t("content_discard_title","Закрыть без сохранения?")}
        message={t("content_discard_msg","Изменения в публикации будут потеряны.")}
        confirmLabel={t("discard","Не сохранять")}
        danger={false}
        onConfirm={()=>{setShowDiscard(false);onClose();}}
        onCancel={()=>setShowDiscard(false)}
      />
    )}
    </>
  );
}

// ── InMapOnboarding ──
function InMapOnboarding({project,tier,theme="dark",onDone,onSkip}){
  const{t}=useLang();
  const tierData=TIERS[tier||"free"]||TIERS.free;
  const MAX_Q=6;
  const[msgs,setMsgs]=useState([]);
  const[inp,setInp]=useState("");
  const[loading,setLoading]=useState(false);
  const[generating,setGenerating]=useState(false);
  const[history,setHistory]=useState([]);
  const[qCount,setQCount]=useState(0);
  const[showSkipConfirm,setShowSkipConfirm]=useState(false);
  const[mapGenFailed,setMapGenFailed]=useState(false);
  const[lastAiQuestion,setLastAiQuestion]=useState("");
  const endRef=useRef(null);
  const inputRef=useRef(null);
  const tKey=tier||"free";
  const obFn=OB_TIER[tKey]||OB_TIER.free;
  const mapHint=MAP_TIER[tKey]||MAP_TIER.free;
  const sysPrompt=obFn(project?.name||"");
  const mapSys=`Создай стратегическую карту на основе интервью. МАКСИМАЛЬНАЯ ГЛУБИНА: учитывай ВСЁ из ответов — отрасль, этап, ресурсы, цели, риски, неявное.
${["pro","team","enterprise"].includes(tKey)?`БАЗА ЗНАНИЙ: ${AI_KNOWLEDGE}`:""}

Связи: requires (A нужен для B), affects, blocks, follows. Логичные зависимости. Избегай типичных ошибок (пропуск валидации, масштаб до PMF).
Верни ТОЛЬКО валидный JSON (без markdown):
{"nodes":[{"id":"n1","x":200,"y":270,"title":"...","reason":"...","metric":"...","status":"active","priority":"high","progress":35,"tags":[]}],"edges":[{"id":"e1","source":"n1","target":"n2","type":"requires","label":""}]}
${mapHint} X:150–900, Y:80–520.`;

  const scrollRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{askNext([]);},[]);
  useEffect(()=>{
    const el=scrollRef.current;if(!el)return;
    const reduced=typeof window!=="undefined"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({top:el.scrollHeight,behavior:reduced?"auto":"smooth"});
  },[msgs,loading]);
  useEffect(()=>{if(!loading&&!generating){const t=setTimeout(()=>inputRef.current?.focus(),80);return()=>clearTimeout(t);}},[loading,generating]);

  async function askNext(hist){
    setLoading(true);
    try{
      const reply=await callAI(hist.length===0?[{role:"user",content:"Начни интервью."}]:hist,sysPrompt,300);
      if(reply.trim()==="READY"||hist.length>=MAX_Q*2){await buildMap(hist);}
      else{const txt=reply.trim();setLastAiQuestion(txt);setMsgs(m=>[...m,{role:"ai",text:txt}]);setQCount(q=>q+1);setLoading(false);}
    }catch{
      setMsgs(m=>[...m,{role:"ai",text:t("ai_network_err","Не удалось получить ответ AI. Проверьте сеть и ключ API. Попробуйте ещё раз.")}]);
      setLoading(false);
    }
  }
  async function submit(){
    if(!inp.trim()||loading||generating)return;
    const text=inp.trim();setInp("");
    const newMsgs=[...msgs,{role:"user",text}];setMsgs(newMsgs);
    const newHist=[...history,{role:"assistant",content:lastAiQuestion},{role:"user",content:text}].filter(h=>h.content);
    setHistory(newHist);
    if(qCount>=MAX_Q){await buildMap(newHist);}else{await askNext(newHist);}
  }
  async function buildMap(hist){
    setGenerating(true);setMapGenFailed(false);
    setMsgs(m=>[...m,{role:"ai",text:t("building_map","Строю персональную карту…")}]);
    const ctx=hist.filter(h=>h.content).map(h=>(h.role==="user"?"Пользователь: ":"AI: ")+h.content).join("\n");
    try{
      const raw=await callAI([{role:"user",content:"Интервью:\n"+ctx+"\n\nСоздай карту."}],mapSys,1500);
      const clean=raw.replace(/```json|```/g,"").trim();
      const fallback=clean.match(/\{[\s\S]*\}/);
      const data=JSON.parse(fallback?fallback[0]:clean);
      onDone({nodes:data.nodes||[],edges:data.edges||[],ctx});
    }catch{
      setMapGenFailed(true);
      setMsgs(m=>[...m,{role:"ai",text:t("ai_map_fallback","AI не удалось создать карту. Нажмите «Повторить» или «Использовать шаблон».")}]);
    }finally{setGenerating(false);}
  }
  function useFallbackTemplate(){
    setMapGenFailed(false);
    const ctxFromHist=history.filter(h=>h.content).map(h=>(h.role==="user"?"Пользователь: ":"AI: ")+h.content).join("\n");
    onDone({nodes:defaultNodes(),edges:[],ctx:ctxFromHist||""});
  }
  const pct=Math.min(100,Math.round(qCount/MAX_Q*100));
  return(
    <div data-theme={theme} className="sa-onb-side" style={{position:"fixed",top:0,right:0,bottom:0,width:"min(440px,100vw)",background:"var(--bg2,var(--surface,rgba(12,9,28,.96)))",display:"flex",flexDirection:"column",zIndex:250,boxShadow:"-12px 0 40px rgba(0,0,0,.45)",borderLeft:"1px solid var(--border,rgba(255,255,255,.08))",animation:"saSlideInR .25s cubic-bezier(.34,1.56,.64,1)"}}>
<div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
        <div style={{width:28,height:28,borderRadius:8,background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--accent-on-bg)",fontWeight:900,boxShadow:"0 2px 12px var(--accent-glow)"}}>✦</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>AI создаёт карту · {project?.name}</div>
          <div style={{height:3,borderRadius:2,background:"var(--surface2)",marginTop:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:pct+"%",background:"var(--gradient-accent)",borderRadius:2,transition:"width .4s"}}/>
          </div>
        </div>
        <button onClick={()=>setShowSkipConfirm(true)} style={{padding:"5px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text4)",cursor:"pointer",fontSize:13}}>{t("skip","Пропустить")}</button>
      </div>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",overflowAnchor:"auto" as any,padding:"16px",display:"flex",flexDirection:"column",gap:12,width:"100%",scrollPaddingBottom:80}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:10}}>
            {m.role==="ai"&&<div style={{width:26,height:26,borderRadius:7,background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--accent-on-bg)",fontWeight:900,flexShrink:0,marginTop:2,boxShadow:"0 2px 10px var(--accent-glow)"}}>✦</div>}
            <div style={{maxWidth:"86%",padding:"10px 14px",borderRadius:m.role==="user"?"12px 12px 3px 12px":"3px 12px 12px 12px",background:m.role==="user"?"rgba(104,54,245,.18)":"var(--surface)",border:`1px solid ${m.role==="user"?"rgba(104,54,245,.3)":"var(--border)"}`,fontSize:13.5,lineHeight:1.65,color:"var(--text)",whiteSpace:"pre-wrap"}}>{m.text}</div>
          </div>
        ))}
        {(loading||generating)&&<div style={{display:"flex",gap:10,alignItems:"center",minHeight:40}}><div style={{width:26,height:26,borderRadius:7,background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--accent-on-bg)",fontWeight:900,boxShadow:"0 2px 10px var(--accent-glow)"}}>✦</div><div style={{display:"flex",gap:4,padding:"10px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"3px 12px 12px 12px"}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:"var(--accent-1)",animation:`thinkDot 1.4s ease ${i*.2}s infinite`}}/>)}</div></div>}
        <div ref={endRef}/>
      </div>
      {mapGenFailed&&(
        <div style={{padding:"12px 16px",borderTop:"1px solid var(--border)",display:"flex",gap:10,width:"100%",flexWrap:"wrap"}}>
          <button onClick={()=>{setMapGenFailed(false);buildMap(history);}} style={{padding:"10px 18px",borderRadius:10,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:"var(--accent-2)",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t("retry","Повторить")}</button>
          <button onClick={useFallbackTemplate} style={{padding:"10px 18px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>{t("use_template","Использовать шаблон")}</button>
        </div>
      )}
      {!generating&&!mapGenFailed&&(
        <div style={{padding:"12px 16px",borderTop:"1px solid var(--border)",display:"flex",gap:8,width:"100%"}}>
          <input ref={inputRef} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();}}} placeholder="Ваш ответ…" style={{flex:1,padding:"11px 14px",fontSize:14,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:12,color:"var(--text)",outline:"none",fontFamily:"inherit",minWidth:0}} disabled={loading}/>
          <button onClick={submit} disabled={!inp.trim()||loading} className="btn-interactive" style={{padding:"11px 16px",borderRadius:12,border:"none",background:inp.trim()&&!loading?"var(--gradient-accent)":"var(--surface)",color:inp.trim()&&!loading?"var(--accent-on-bg)":"var(--text4)",fontSize:14,fontWeight:900,cursor:inp.trim()&&!loading?"pointer":"not-allowed",boxShadow:inp.trim()&&!loading?"0 4px 18px var(--accent-glow)":"none",whiteSpace:"nowrap"}}>
            {qCount>=MAX_Q?t("create","Создать")+" ✦":t("answer","Ответить")+" →"}
          </button>
        </div>
      )}
      {showSkipConfirm&&(
        <div style={{position:"absolute",inset:0,background:"var(--modal-overlay-bg,rgba(0,0,0,.7))",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}>
          <div style={{background:"var(--bg2)",borderRadius:16,padding:"24px 28px",maxWidth:360,border:"1px solid var(--border)",animation:"scaleIn .2s ease",textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:12}}>⚠️</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:8}}>Пропустить интервью?</div>
            <div style={{fontSize:13.5,color:"var(--text3)",marginBottom:20}}>Карта будет создана с примерными шагами. AI-интервью помогает сделать её персонализированной.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setShowSkipConfirm(false)} style={{padding:"9px 20px",borderRadius:9,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",cursor:"pointer",fontSize:13,fontWeight:600}}>{t("continue_btn","Продолжить")}</button>
              <button onClick={onSkip} style={{padding:"9px 20px",borderRadius:9,border:"none",background:"rgba(239,68,68,.1)",color:"#f04458",cursor:"pointer",fontSize:13,fontWeight:700}}>{t("skip","Пропустить")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ImportJSON (helper) ──
function useImportJSON(onImport,onError?:(msg:string)=>void){
  const fileRef=useRef(null);
  const{t}=useLang();
  function trigger(){fileRef.current?.click();}
  function renderInput(){
    return(
      <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{
        const f=e.target.files[0];if(!f)return;
        const r=new FileReader();
        r.onload=ev=>{
          try{
            const raw=ev.target?.result;
            if(typeof raw!=="string")return;
            const d=JSON.parse(raw);
            if(d.nodes||d.edges){onImport({nodes:d.nodes||[],edges:d.edges||[],name:d.name||f.name.replace(".json","")});}
          }catch{
            const msg=t("json_invalid","Некорректный формат JSON");
            if(onError)onError(msg);
            else console.warn("Invalid JSON");
          }
          e.target.value="";
        };
        r.readAsText(f);
      }}/>
    );
  }
  return{trigger,renderInput};
}


// ── SplashScreen ──
function SplashScreen({onDone,theme,authReady=false}){
  const{t}=useLang();
  const[pct,setPct]=useState(0);
  const readyRef=useRef(false);
  useEffect(()=>{
    if(pct>=100&&authReady&&!readyRef.current){readyRef.current=true;setTimeout(onDone,150);}
  },[pct,authReady,onDone]);
  useEffect(()=>{
    let iv: ReturnType<typeof setInterval> | null = null;
    const tid = setTimeout(() => {
      let p = 0;
      iv = setInterval(() => {
        p += Math.random() * 18 + 8;
        setPct(Math.min(100, Math.round(p)));
      }, 100);
    }, 300);
    return () => {
      clearTimeout(tid);
      if (iv) clearInterval(iv);
    };
  },[]);
  const th=theme==="dark"?"dark":"light";
  const letterText=t("splash_loader_text","Loading");
  const brandLabel=t("splash_brand_name","Strategy AI");
  return(
    <SplashLoaderScreen theme={th} text={letterText} progressPct={pct} brandLabel={brandLabel} />
  );
}
// ── SparklesCanvas ──
function SparklesCanvas({color="#ffffff",density=120,speed=1.2,minSz=0.4,maxSz=1.4,style={}}){
  const cvs=useRef(null);
  useEffect(()=>{
    const el=cvs.current;if(!el)return;
    const ctx=el.getContext('2d');
    let W=el.offsetWidth,H=el.offsetHeight;
    el.width=W;el.height=H;
    const hex=color.replace('#','');
    const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
    const pts=Array.from({length:density},()=>({
      x:Math.random()*W,y:Math.random()*H,
      sz:minSz+Math.random()*(maxSz-minSz),op:Math.random(),
      dop:(Math.random()*.02+.005)*speed*(Math.random()<.5?1:-1),
      vx:(Math.random()-.5)*.22*speed,vy:(Math.random()-.5)*.22*speed,
    }));
    let raf,alive=true;
    const tick=()=>{
      if(!alive)return;
      ctx.clearRect(0,0,W,H);
      pts.forEach(p=>{
        p.op+=p.dop;
        if(p.op>1){p.op=1;p.dop*=-1;}if(p.op<.04){p.op=.04;p.dop*=-1;}
        p.x+=p.vx;p.y+=p.vy;
        if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
        ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);
        ctx.fillStyle=`rgba(${r},${g},${b},${p.op})`;ctx.fill();
      });
      raf=requestAnimationFrame(tick);
    };
    tick();
    const onR=()=>{W=el.offsetWidth;H=el.offsetHeight;el.width=W;el.height=H;pts.forEach(p=>{p.x=Math.random()*W;p.y=Math.random()*H;});};
    window.addEventListener('resize',onR);
    return()=>{alive=false;cancelAnimationFrame(raf);window.removeEventListener('resize',onR);};
  },[color,density,speed,minSz,maxSz]);
  return <canvas ref={cvs} style={{width:"100%",height:"100%",display:"block",pointerEvents:"none",...style}}/>;
}

function initialMarketingScreen(): string {
  if (typeof window === "undefined") return "splash";
  const mp = parseMarketingPath(window.location.pathname);
  if (mp.type === "privacy" || mp.type === "terms") return "legal";
  if (mp.type === "notFound") return "notFound";
  return "splash";
}

function initialLegalKind(): "privacy" | "terms" | null {
  if (typeof window === "undefined") return null;
  const mp = parseMarketingPath(window.location.pathname);
  if (mp.type === "privacy") return "privacy";
  if (mp.type === "terms") return "terms";
  return null;
}

// ── App ──
export default function App(){
  const[screen,setScreen]=useState(initialMarketingScreen);
  const[user,setUser]=useState<any>(null);
  const[theme,setTheme]=useState(()=>{
    try{
      const saved=localStorage.getItem("sa_theme");
      if(saved==="dark"||saved==="light")return saved;
      // Первый визит — уважаем системную тему пользователя
      if(typeof window!=="undefined"&&typeof window.matchMedia==="function"){
        return window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
      }
      return"dark";
    }catch{return"dark";}
  });
  const[palette,setPalette]=useState(()=>{try{return localStorage.getItem("sa_palette")||"indigo";}catch{return"indigo";}});
  const[project,setProject]=useState(null);
  const[cpProject,setCpProject]=useState<any>(null);
  const[cpMaps,setCpMaps]=useState<any[]>([]);
  const[mapData,setMapData]=useState(null);
  const[mapIsNew,setMapIsNew]=useState(false);
  const[mapReadOnly,setMapReadOnly]=useState(false);
  const[mapFocusNodeId,setMapFocusNodeId]=useState<string|null>(null);
  const[sharedMapData,setSharedMapData]=useState(null);
  const[showAuth,setShowAuth]=useState(false);
  const[authTab,setAuthTab]=useState<"login"|"register">("login");
  const[showProfile,setShowProfile]=useState(false);
  const[showTiers,setShowTiers]=useState(false);
  const[verifiedToast,setVerifiedToast]=useState(false);
  const[resetToken,setResetToken]=useState<string|null>(null);
  const[paymentToast,setPaymentToast]=useState(false);
  const[authChecked,setAuthChecked]=useState(false);
  const[loadError,setLoadError]=useState<string|null>(null);
  const[lang,setLang]=useState(()=>{try{return localStorage.getItem("sa_lang")||"ru";}catch{return"ru";}});
  const[legalKind,setLegalKind]=useState<"privacy"|"terms"|null>(initialLegalKind);
  function changeLang(l:string){setLang(l);localStorage.setItem("sa_lang",l);}

  // ── Global AI chat (единый диалог на всё приложение) ──
  const aiChatKey=`sa_ai_chat_${user?.email||"guest"}`;
  const[aiChatMsgs,setAiChatMsgs]=useState<any[]>(()=>{
    try{const s=localStorage.getItem(aiChatKey);if(s){const j=JSON.parse(s);return Array.isArray(j)?j:[];}}catch{}
    return [];
  });
  // При смене пользователя перечитываем его историю чата
  useEffect(()=>{
    try{
      const s=localStorage.getItem(aiChatKey);
      if(s){const j=JSON.parse(s);setAiChatMsgs(Array.isArray(j)?j:[]);}
      else setAiChatMsgs([]);
    }catch{setAiChatMsgs([]);}
  },[aiChatKey]);
  // Сохраняем историю чата постоянно (debounce)
  useEffect(()=>{
    try{
      const t=setTimeout(()=>{localStorage.setItem(aiChatKey,JSON.stringify(aiChatMsgs||[]));},250);
      return()=>clearTimeout(t);
    }catch{}
  },[aiChatKey,aiChatMsgs]);
  // Синхронизация темы и палитры из профиля пользователя (при загрузке с API и после сохранения)
  useEffect(()=>{
    if(!user?.theme&&!user?.palette)return;
    if(user.theme){setTheme(user.theme);try{localStorage.setItem("sa_theme",user.theme);}catch{}}
    if(user.palette){setPalette(user.palette);try{localStorage.setItem("sa_palette",user.palette);}catch{}}
  },[user?.email,user?.theme,user?.palette]);

  // Синхронизация темы и палитры с body до отрисовки — смена темы/палитры сразу меняет цвета (body[data-theme][data-palette] в CSS)
  const bodyPalette=screen==="landing"||screen==="legal"||screen==="notFound"?"indigo":(palette||"indigo");
  useLayoutEffect(()=>{
    const b=document.body;
    b.setAttribute("data-theme",theme);
    b.setAttribute("data-palette",bodyPalette);
  },[theme,bodyPalette]);
  useEffect(()=>{
    const b=document.body;
    if(b.getAttribute("data-theme")!==theme)b.setAttribute("data-theme",theme);
    if(b.getAttribute("data-palette")!==bodyPalette)b.setAttribute("data-palette",bodyPalette);
  },[theme,bodyPalette]);
  /* Лендинг: чёрный космос без орбов приложения — класс надёжнее CSS :has() */
  useLayoutEffect(()=>{
    const b=document.body;
    if(screen==="landing"||screen==="legal"||screen==="notFound")b.classList.add("sa-landing");
    else b.classList.remove("sa-landing");
    return()=>{b.classList.remove("sa-landing");};
  },[screen]);
  // t функция для LangCtx.Provider (App является корневым провайдером)
  const t = makeTfn(lang);

  const initRunningRef=useRef(false);
  const pendingDeepLinkRef=useRef<any>(null);

  async function openDeepLink(dl:any, userObj:any){
    try{
      if(!dl||!userObj?.email)return false;
      if(!API_BASE)return false;
      const ps=await getProjects(userObj.email);
      if(dl.open==="projects"){
        setScreen("projects");
        return true;
      }
      if(dl.open==="contentPlan"&&!dl.projectId){
        setScreen("contentPlanHub");
        return true;
      }
      const p=ps.find((x:any)=>x.id===dl.projectId);
      if(!p)return false;
      if(dl.open==="project"){
        setProject(p);setScreen("project");
        return true;
      }
      if(dl.open==="map"){
        const ms=await getMaps(p.id);
        const m=ms.find((x:any)=>x.id===dl.mapId);
        if(!m)return false;
        setProject(p);
        setMapData(m);
        setMapIsNew(false);
        setMapReadOnly(false);
        setMapFocusNodeId(dl.nodeId||null);
        setScreen("map");
        try{
          localStorage.setItem("sa_last_project",JSON.stringify({id:p.id,name:p.name}));
          localStorage.setItem("sa_last_map",JSON.stringify({id:m.id,name:m.name}));
        }catch{}
        return true;
      }
      if(dl.open==="contentPlan"){
        const ms=await getMaps(p.id);
        setCpProject(p);
        setCpMaps(ms||[]);
        setScreen("contentPlanProject");
        return true;
      }
    }catch{}
    return false;
  }

  async function initApp(){
    if(initRunningRef.current)return;
    initRunningRef.current=true;
    try{
      setLoadError(null);
      // Проверяем share-ссылку и deep-link в URL (поддерживаем query)
      const searchParams=new URLSearchParams(window.location.search);
      const shareFromQuery=searchParams.get("share");
      const openParam=(searchParams.get("open")||"").toLowerCase(); // projects | project | map | contentplan
      const dlProjectId=searchParams.get("projectId")||"";
      const dlMapId=searchParams.get("mapId")||"";
      const dlNodeId=searchParams.get("nodeId")||"";
      if(openParam==="projects"){
        pendingDeepLinkRef.current={open:openParam};
      } else if(openParam==="contentplan"){
        pendingDeepLinkRef.current=dlProjectId?{open:"contentPlan",projectId:dlProjectId}:{open:"contentPlan"};
      } else if((openParam==="project"||openParam==="map")&&dlProjectId){
        pendingDeepLinkRef.current={open:openParam,projectId:dlProjectId,mapId:dlMapId,nodeId:dlNodeId};
      }
      const hash=typeof window!=="undefined"?window.location.hash:"";
      const shareFromHash=hash.startsWith("#share=")?hash.slice(7).replace(/\?.*/,"").trim():"";
      const shareId=shareFromQuery||shareFromHash;
      const mp=parseMarketingPath(window.location.pathname);

      // Обработка успешной оплаты через Stripe (?payment=success&tier=pro)
      const paymentStatus=searchParams.get("payment");
      const paymentTierFromUrl=searchParams.get("tier");
      if(paymentStatus==="success"){
        window.history.replaceState({},"",window.location.pathname);
      }

      // Обработка ссылки сброса пароля (?reset=token)
      const resetTok=searchParams.get("reset");
      if(resetTok){
        setResetToken(resetTok);
        window.history.replaceState({},"",window.location.pathname);
      }

      // Обработка подтверждения email через ссылку
      const verifiedParam=searchParams.get("verified");
      if(verifiedParam==="1"){
        window.history.replaceState({},"",window.location.pathname);
        // Перечитываем пользователя чтобы получить обновлённый email_verified
        if(API_BASE){
          try{
            const d=await apiFetch("/api/auth/me");
            if(d.user)setUser(normalizeUser(d.user));
          }catch{}
        }
        setVerifiedToast(true);
        setTimeout(()=>setVerifiedToast(false),4000);
      }

      if(shareId){
        try{
          let data:any=null;
          if(API_BASE){
            const d=await apiFetch(`/api/shares/${shareId}`);
            data={map:d.map,projectName:d.projectName||""};
          } else {
            data=await store.get("sa_share_"+shareId);
          }
          if(data&&data.map){setSharedMapData(data);setScreen("sharedMap");setAuthChecked(true);return;}
        }catch{}
      }
      await seedDefault();
      if(API_BASE){
        // Один запрос /api/auth/me — и проверка сессии, и получение данных пользователя
        const jwt=getJWT();
        if(jwt){
          try{
            const d=await apiFetch("/api/auth/me");
            if(d.user){
              let uNorm=normalizeUser(d.user);
              if(paymentStatus==="success"){
                const synced=await refreshUserAfterPayment(paymentTierFromUrl);
                if(synced)uNorm=synced;
                setUser(uNorm);
                setPaymentToast(true);
                setTimeout(()=>setPaymentToast(false),4000);
              }else{
                setUser(uNorm);
              }
              // Если в URL был deep-link — пробуем открыть сразу после login
              if(pendingDeepLinkRef.current){
                const ok=await openDeepLink(pendingDeepLinkRef.current,uNorm);
                if(ok){
                  pendingDeepLinkRef.current=null;
                  window.history.replaceState({},"",window.location.pathname);
                  setAuthChecked(true);
                  return;
                }
              }
              if(mp.type==="privacy"){
                setLegalKind("privacy");setScreen("legal");setAuthChecked(true);return;
              }
              if(mp.type==="terms"){
                setLegalKind("terms");setScreen("legal");setAuthChecked(true);return;
              }
              if(mp.type==="notFound"){
                setScreen("notFound");setAuthChecked(true);return;
              }
              if(mp.type==="home"){
                try{window.history.replaceState({},"","/app");}catch{}
              }
              setScreen("projects");setAuthChecked(true);return;
            }
          }catch(e:any){
            if(e.message==="session_expired"){clearJWT();clearRefreshToken();}
          }
        }
      } else {
        try{
          const sess=await getSession();
          if(sess?.email){
            const accs=await store.get("sa_acc")||[];
            const u=(accs as any[]).find((a:any)=>a.email===sess.email);
            if(u){
              const merged={...u,theme:u.theme||(typeof localStorage!=="undefined"?localStorage.getItem("sa_theme"):null)||"dark",palette:u.palette||(typeof localStorage!=="undefined"?localStorage.getItem("sa_palette"):null)||"indigo"};
              setUser(merged);
              if(mp.type==="privacy"){
                setLegalKind("privacy");setScreen("legal");setAuthChecked(true);return;
              }
              if(mp.type==="terms"){
                setLegalKind("terms");setScreen("legal");setAuthChecked(true);return;
              }
              if(mp.type==="notFound"){
                setScreen("notFound");setAuthChecked(true);return;
              }
              if(mp.type==="home"){
                try{window.history.replaceState({},"","/app");}catch{}
              }
              setScreen("projects");setAuthChecked(true);return;
            }
          }
        }catch{}
      }
      if(mp.type==="privacy"){
        setLegalKind("privacy");setScreen("legal");setAuthChecked(true);return;
      }
      if(mp.type==="terms"){
        setLegalKind("terms");setScreen("legal");setAuthChecked(true);return;
      }
      if(mp.type==="notFound"){
        setScreen("notFound");setAuthChecked(true);return;
      }
      if(mp.type==="app"){
        try{window.history.replaceState({},"","/");}catch{}
        setAuthTab("register");
        setShowAuth(true);
      }
      setScreen("landing");
      setAuthChecked(true);
    }catch(e:any){
      setLoadError(e?.message||"Не удалось загрузить данные");
      setAuthChecked(true);
    }finally{
      initRunningRef.current=false;
    }
  }

  useEffect(()=>{initApp();},[]);

  // Глобальный обработчик истёкшей сессии
  useEffect(()=>{
    const orig=window.fetch.bind(window);
    (window as any).__sa_onSessionExpired=()=>{
      setUser(null);setProject(null);setMapData(null);setCpProject(null);setCpMaps([]);
      try{window.history.replaceState({},"","/");}catch{}
      setScreen("landing");setShowAuth(true);setAuthTab("login");
    };
    return()=>{};
  },[]);

  function goMarketingHome(){
    try{
      if(user){
        window.history.replaceState({},"","/app");
        setScreen("dashboard");
      }else{
        window.history.pushState({},"","/");
        setScreen("landing");
      }
    }catch{
      setScreen(user?"dashboard":"landing");
    }
  }

  async function handleAuth(u:any,isNew:boolean){
    trackSaEvent(isNew?"sign_up":"login",{method:"email"});
    setUser(u);setShowAuth(false);
    try{window.history.replaceState({},"","/app");}catch{}
    if(isNew){setShowTiers(true);}
    else{setScreen("dashboard");}
  }

  function handleGlobalNav(nav:StrategyShellNav){
    if(nav==="dashboard"){setMapData(null);setProject(null);setCpProject(null);setCpMaps([]);setScreen("dashboard");return;}
    if(nav==="projects"){setMapData(null);setProject(null);setScreen("projects");return;}
    if(nav==="contentPlan"){setScreen("contentPlanHub");return;}
    if(nav==="ai"){setScreen("ai");return;}
    if(nav==="insights"){setScreen("insights");return;}
    if(nav==="settings"||nav==="team"){setShowProfile(true);return;}
    // экраны map/scenarios/timeline открываются из рабочей области проекта
    setScreen("projects");
  }

  async function onChangeTier(t){
    if(!user)return;
    const updated=await patchUser(user.email,{tier:t});
    if(updated)setUser(updated);
    setShowTiers(false);
    if(screen!=="projects"&&screen!=="project"&&screen!=="map"&&screen!=="contentPlanHub"&&screen!=="contentPlanProject")setScreen("projects");
  }

  async function onLogout(){
    await clearSession();
    setUser(null);setProject(null);setMapData(null);setCpProject(null);setCpMaps([]);
    setAiChatMsgs([]);
    try{window.history.replaceState({},"","/");}catch{}
    setScreen("landing");
  }

  function onSelectProject(p){
    setProject(p);setScreen("project");
    try{localStorage.setItem("sa_last_project",JSON.stringify({id:p.id,name:p.name}));localStorage.removeItem("sa_last_map");}catch{}
  }

  async function onOpenMap(map,proj,isNew,readOnlyMap=false,focusNodeId:string|null=null){
    setProject(proj);
    const fresh=await getMaps(proj.id);
    const m=fresh.find(x=>x.id===map.id)||map;
    setMapData(m);setMapIsNew(isNew||false);setMapReadOnly(readOnlyMap);setMapFocusNodeId(focusNodeId);setScreen("map");
    try{localStorage.setItem("sa_last_project",JSON.stringify({id:proj.id,name:proj.name}));localStorage.setItem("sa_last_map",JSON.stringify({id:m.id,name:m.name}));}catch{}
  }

  function toggleTheme(){
    const next=t=>t==="dark"?"light":"dark";
    const apply=()=>setTheme(t=>{
      const n=next(t);
      try{localStorage.setItem("sa_theme",n);document.body.setAttribute("data-theme",n);}catch{}
      if(API_BASE&&user?.email)patchUser(user.email,{theme:n}).then(u=>u&&setUser(u)).catch(()=>{});
      return n;
    });
    // View Transitions API: красивый cross-fade темы в браузерах Chromium/Edge/Safari 18+
    const doc:any=typeof document!=="undefined"?document:null;
    const reduced=typeof window!=="undefined"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(doc&&typeof doc.startViewTransition==="function"&&!reduced){
      doc.startViewTransition(()=>apply());
    }else{
      apply();
    }
  }
  function changePalette(p:string){setPalette(p);try{localStorage.setItem("sa_palette",p);}catch{};try{document.body.setAttribute("data-palette",p);}catch{};if(API_BASE&&user?.email)patchUser(user.email,{palette:p}).then(u=>u&&setUser(u)).catch(()=>{});}

  if(showTiers){
    return(
      <LangCtx.Provider value={{lang,setLang:changeLang,t}}>
        <div className={"sa-strategy-ui "+(theme==="dark"?"dk":"lt")} data-theme={theme} data-palette={palette} style={{minHeight:"100vh",background:"var(--bg)",position:"relative",fontFamily:"'Inter',system-ui,sans-serif"}}>
          <StrategyShellBg/>
          <TierSelectionScreen isNew={true} currentUser={user} theme={theme} palette={palette}
            onSelect={onChangeTier}
            onBack={()=>{setShowTiers(false);setScreen("projects");}}
          />
        </div>
      </LangCtx.Provider>
    );
  }

  useEffect(()=>{
    applySeoForAppScreen(screen as "splash"|"landing"|"legal"|"notFound"|"projects"|"project"|"map"|"sharedMap"|"contentPlanHub"|"contentPlanProject",{legalKind});
  },[screen,legalKind]);

  useEffect(()=>{
    if(!["landing","legal","notFound"].includes(screen))return;
    const onPop=()=>{
      const mp=parseMarketingPath(window.location.pathname);
      if(mp.type==="privacy"){setLegalKind("privacy");setScreen("legal");return;}
      if(mp.type==="terms"){setLegalKind("terms");setScreen("legal");return;}
      if(mp.type==="notFound"){setScreen("notFound");return;}
      if(!user){
        if(mp.type==="app"){
          try{window.history.replaceState({},"","/");}catch{}
          setAuthTab("register");
          setShowAuth(true);
          setScreen("landing");
          return;
        }
        if(mp.type==="home"){setScreen("landing");return;}
      }else{
        if(mp.type==="home"){try{window.history.replaceState({},"","/app");}catch{}setScreen("dashboard");return;}
        if(mp.type==="app"){setScreen("dashboard");}
      }
    };
    window.addEventListener("popstate",onPop);
    return()=>window.removeEventListener("popstate",onPop);
  },[user,screen]);

  // Кнопка «Назад» в браузере
  useEffect(()=>{
    if(screen==="splash"||screen==="landing"||screen==="sharedMap")return;
    const h=()=>{
      if(screen==="map"&&project){setMapData(null);setScreen("project");}
      else if(screen==="project"&&project){setProject(null);setScreen("projects");}
      else if(screen==="contentPlanProject"&&cpProject){setCpProject(null);setCpMaps([]);setScreen("contentPlanHub");}
      else if(screen==="contentPlanHub"){setScreen("dashboard");}
      else if(screen==="projects"){setScreen("dashboard");}
    };
    window.addEventListener("popstate",h);
    return()=>window.removeEventListener("popstate",h);
  },[screen,project,cpProject]);
  useEffect(()=>{
    if(screen==="project"&&project&&history.state?.screen!=="project")history.pushState({screen:"project",projectId:project.id},"","");
    else if(screen==="map"&&mapData&&history.state?.screen!=="map")history.pushState({screen:"map",mapId:mapData.id},"","");
    else if(screen==="contentPlanHub"&&history.state?.screen!=="contentPlanHub")history.pushState({screen:"contentPlanHub"},"","");
    else if(screen==="contentPlanProject"&&cpProject&&history.state?.screen!=="contentPlanProject")history.pushState({screen:"contentPlanProject",projectId:cpProject.id},"","");
  },[screen,project?.id,mapData?.id,cpProject?.id]);

  const appPalette=screen==="landing"||screen==="legal"||screen==="notFound"?undefined:palette;

  if(loadError)return(
    <LangCtx.Provider value={{lang,setLang:changeLang,t}}>
      <div data-theme={theme} data-palette={palette} className="screen-enter" style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:24}}>
<div className="glass-card" style={{padding:"32px 40px",borderRadius:20,border:"1px solid var(--glass-border-accent,var(--border))",boxShadow:"var(--glass-shadow-accent,none),0 24px 64px rgba(0,0,0,.3)",display:"flex",flexDirection:"column",alignItems:"center",gap:20,maxWidth:480}}>
          <div style={{fontSize:36,marginBottom:4}}>⚠️</div>
          <div style={{fontSize:18,fontWeight:800,color:"var(--text)",textAlign:"center"}}>{loadError}</div>
          <button className="btn-interactive" onClick={()=>{setLoadError(null);initApp();}} style={{padding:"16px 32px",borderRadius:14,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 24px var(--accent-glow)",transition:"transform .2s ease, box-shadow .25s ease"}}>{t("retry","Повторить")}</button>
          <div style={{fontSize:13.5,color:"var(--text5)",textAlign:"center",lineHeight:1.6}}>
            {t("load_error_hint","Если это происходит снова — проверьте подключение к интернету и доступность API. В офлайн‑режиме можно войти в демо‑аккаунт без сервера.")}
          </div>
        </div>
      </div>
    </LangCtx.Provider>
  );

  return(
    <LangCtx.Provider value={{lang,setLang:changeLang,t}}>
      <div data-theme={theme} data-palette={appPalette} className="screen-wrap" style={{minHeight:"100vh",background:screen==="landing"||screen==="legal"||screen==="notFound"?"transparent":"var(--bg)",transition:"background .35s ease, color .35s ease"}}>
<OfflineBanner/>
      <>
        {screen==="splash"&&<SplashScreen onDone={()=>{
          const mp=parseMarketingPath(window.location.pathname);
          if(mp.type==="app"){
            setAuthTab("register");
            setShowAuth(true);
            try{window.history.replaceState({},"","/");}catch{}
          }
          setScreen(prev=>{
            if(prev==="projects")return prev;
            if(prev!=="splash")return prev;
            return"landing";
          });
        }} theme={theme} authReady={authChecked}/>}
        {screen==="landing"&&(
          <div className="screen-enter" style={{height:"100%",minHeight:"100vh",overflow:"hidden",position:"relative"}}>
            <React.Suspense fallback={<SplashLoaderScreen theme={theme==="light"?"light":"dark"} text={t("loading","Загрузка…")}/>}>
              <ReferenceLandingView
                t={t}
                lang={lang}
                onChangeLang={changeLang}
                theme={theme}
                onToggleTheme={toggleTheme}
                onSignIn={()=>{trackSaEvent("cta_sign_in_open");setAuthTab("login");setShowAuth(true);}}
                onGetStarted={()=>{
                  trackSaEvent("cta_get_started");
                  setAuthTab("register");
                  setShowAuth(true);
                  try{window.history.replaceState({},"","/");}catch{}
                }}
              />
            </React.Suspense>
            {showAuth&&<AuthModal initialTab={authTab} theme={theme} onClose={()=>setShowAuth(false)} onAuth={handleAuth}/>}
          </div>
        )}
        {screen==="legal"&&legalKind&&(
          <LegalDocumentPage kind={legalKind} theme={theme} t={t} onHome={goMarketingHome}/>
        )}
        {screen==="notFound"&&(
          <NotFoundPage theme={theme} t={t} onHome={goMarketingHome}/>
        )}
        {screen==="sharedMap"&&sharedMapData&&(
          <MapEditor
            user={null} mapData={sharedMapData.map} project={{name:sharedMapData.projectName||""}}
            isNew={false} theme={theme} readOnly={true} palette={palette}
            onBack={()=>{setSharedMapData(null);setScreen("landing");if(typeof window!=="undefined")window.history.replaceState("","",window.location.pathname);}}
            onProfile={()=>{}}
            onToggleTheme={toggleTheme}
            onShellGlobalNav={()=>{}}
            aiChatMsgs={aiChatMsgs}
            aiChatSetMsgs={setAiChatMsgs}
          />
        )}
        {screen==="dashboard"&&user&&(
          <div className="screen-enter" style={{height:"100%",display:"flex",flexDirection:"column",flex:1}}>
            <TrialBanner user={user} onUpgrade={()=>setShowProfile(true)}/>
            <EmailVerifyBanner user={user}/>
            <DashboardPage
              user={user} theme={theme}
              onToggleTheme={toggleTheme}
              onProfile={()=>setShowProfile(true)}
              onLogout={onLogout}
              onChangeTier={()=>setShowTiers(true)}
              onShellNav={handleGlobalNav}
              onOpenProject={onSelectProject}
              onOpenContentPlanHub={()=>setScreen("contentPlanHub")}
              aiChatMsgs={aiChatMsgs}
              aiChatSetMsgs={setAiChatMsgs}
            />
            {showProfile&&<ProfileModal user={user} theme={theme} palette={palette} onPaletteChange={changePalette} onClose={()=>setShowProfile(false)} onUpdate={(u:any)=>setUser(u)} onChangeTier={onChangeTier} onLogout={onLogout} onToggleTheme={toggleTheme}/>}
          </div>
        )}
        {screen==="insights"&&user&&(
          <div className="screen-enter" style={{height:"100%",display:"flex",flexDirection:"column",flex:1}}>
            <TrialBanner user={user} onUpgrade={()=>setShowProfile(true)}/>
            <EmailVerifyBanner user={user}/>
            <InsightsPage
              user={user} theme={theme}
              onToggleTheme={toggleTheme}
              onProfile={()=>setShowProfile(true)}
              onLogout={onLogout}
              onChangeTier={()=>setShowTiers(true)}
              onShellNav={handleGlobalNav}
              onOpenContentPlanHub={()=>setScreen("contentPlanHub")}
            />
            {showProfile&&<ProfileModal user={user} theme={theme} palette={palette} onPaletteChange={changePalette} onClose={()=>setShowProfile(false)} onUpdate={(u:any)=>setUser(u)} onChangeTier={onChangeTier} onLogout={onLogout} onToggleTheme={toggleTheme}/>}
          </div>
        )}
        {screen==="ai"&&user&&(
          <div className="screen-enter" style={{height:"100%",display:"flex",flexDirection:"column",flex:1}}>
            <TrialBanner user={user} onUpgrade={()=>setShowProfile(true)}/>
            <EmailVerifyBanner user={user}/>
            <AiAdvisorPage
              user={user} theme={theme}
              onToggleTheme={toggleTheme}
              onProfile={()=>setShowProfile(true)}
              onLogout={onLogout}
              onChangeTier={()=>setShowTiers(true)}
              onShellNav={handleGlobalNav}
              onOpenContentPlanHub={()=>setScreen("contentPlanHub")}
              aiChatMsgs={aiChatMsgs}
              aiChatSetMsgs={setAiChatMsgs}
            />
            {showProfile&&<ProfileModal user={user} theme={theme} palette={palette} onPaletteChange={changePalette} onClose={()=>setShowProfile(false)} onUpdate={(u:any)=>setUser(u)} onChangeTier={onChangeTier} onLogout={onLogout} onToggleTheme={toggleTheme}/>}
          </div>
        )}
        {screen==="projects"&&user&&(
          <div className="screen-enter" style={{height:"100%",display:"flex",flexDirection:"column",flex:1}}>
            <TrialBanner user={user} onUpgrade={()=>setShowProfile(true)}/>
            <EmailVerifyBanner user={user}/>
            <ProjectsPage
              user={user} theme={theme}
              onSelectProject={onSelectProject}
              onOpenMap={onOpenMap}
              onLogout={onLogout}
              onChangeTier={(t:string)=>onChangeTier(t)}
              onProfile={()=>setShowProfile(true)}
              onToggleTheme={toggleTheme}
              aiChatMsgs={aiChatMsgs}
              aiChatSetMsgs={setAiChatMsgs}
              onOpenContentPlanHub={()=>setScreen("contentPlanHub")}
              onOpenContentPlanProject={(p:any,m:any[])=>{setCpProject(p);setCpMaps(Array.isArray(m)?m:[]);setScreen("contentPlanProject");}}
              onGoToDashboard={()=>setScreen("dashboard")}
              onGoToAi={()=>setScreen("ai")}
              onGoToInsights={()=>setScreen("insights")}
            />
            {showProfile&&<ProfileModal user={user} theme={theme} palette={palette} onPaletteChange={changePalette} onClose={()=>setShowProfile(false)} onUpdate={(u:any)=>setUser(u)} onChangeTier={onChangeTier} onLogout={onLogout} onToggleTheme={toggleTheme}/>}
          </div>
        )}
        {screen==="contentPlanHub"&&user&&(
          <div className="screen-enter" style={{height:"100%",display:"flex",flexDirection:"column",flex:1}}>
            <TrialBanner user={user} onUpgrade={()=>setShowProfile(true)}/>
            <EmailVerifyBanner user={user}/>
            <ContentPlanHubPage
              user={user}
              theme={theme}
              onBackToStrategy={()=>setScreen("projects")}
              onOpenProject={(p:any,maps:any[])=>{setCpProject(p);setCpMaps(Array.isArray(maps)?maps:[]);setScreen("contentPlanProject");}}
              onLogout={onLogout}
              onProfile={()=>setShowProfile(true)}
              onToggleTheme={toggleTheme}
              onUpgrade={()=>setShowProfile(true)}
              aiChatMsgs={aiChatMsgs}
              aiChatSetMsgs={setAiChatMsgs}
              onSelectProject={onSelectProject}
              onOpenMap={onOpenMap}
            />
            {showProfile&&<ProfileModal user={user} theme={theme} palette={palette} onPaletteChange={changePalette} onClose={()=>setShowProfile(false)} onUpdate={(u:any)=>setUser(u)} onChangeTier={onChangeTier} onLogout={onLogout} onToggleTheme={toggleTheme}/>}
          </div>
        )}
        {screen==="contentPlanProject"&&user&&cpProject&&(
          <div className="screen-enter" style={{height:"100%",display:"flex",flexDirection:"column",flex:1}}>
            <TrialBanner user={user} onUpgrade={()=>setShowProfile(true)}/>
            <EmailVerifyBanner user={user}/>
            <ContentPlanProjectPage
              user={user}
              project={cpProject}
              maps={cpMaps}
              theme={theme}
              onBackToHub={()=>{setCpProject(null);setCpMaps([]);setScreen("contentPlanHub");}}
              onOpenStrategyProject={()=>{setProject(cpProject);setCpProject(null);setCpMaps([]);setScreen("project");}}
              onLogout={onLogout}
              onProfile={()=>setShowProfile(true)}
              onToggleTheme={toggleTheme}
              onChangeTier={onChangeTier}
              onUpgrade={()=>setShowProfile(true)}
              aiChatMsgs={aiChatMsgs}
              aiChatSetMsgs={setAiChatMsgs}
              onSelectProject={onSelectProject}
              onOpenMap={onOpenMap}
              onSwitchContentPlanProject={(p:any,m:any[])=>{setCpProject(p);setCpMaps(Array.isArray(m)?m:[]);}}
            />
            {showProfile&&<ProfileModal user={user} theme={theme} palette={palette} onPaletteChange={changePalette} onClose={()=>setShowProfile(false)} onUpdate={(u:any)=>setUser(u)} onChangeTier={onChangeTier} onLogout={onLogout} onToggleTheme={toggleTheme}/>}
          </div>
        )}
        {screen==="project"&&user&&project&&(
          <div className="screen-enter" style={{height:"100%",display:"flex",flexDirection:"column",flex:1}}>
            <ProjectDetail
              user={user} project={project} theme={theme}
              onBack={()=>setScreen("projects")}
              onOpenMap={onOpenMap}
              onProfile={()=>setShowProfile(true)}
              onToggleTheme={toggleTheme}
              onChangeTier={onChangeTier}
              onUpgrade={()=>setShowProfile(true)}
              onOpenContentPlanHub={()=>setScreen("contentPlanHub")}
              onOpenContentPlanProject={(p:any,m:any[])=>{setCpProject(p);setCpMaps(Array.isArray(m)?m:[]);setScreen("contentPlanProject");}}
              aiChatMsgs={aiChatMsgs}
              aiChatSetMsgs={setAiChatMsgs}
            />
            {showProfile&&<ProfileModal user={user} theme={theme} palette={palette} onPaletteChange={changePalette} onClose={()=>setShowProfile(false)} onUpdate={u=>setUser(u)} onChangeTier={onChangeTier} onLogout={onLogout} onToggleTheme={toggleTheme}/>}
          </div>
        )}
        {screen==="map"&&user&&mapData&&project&&(
          <div className="screen-enter" style={{height:"100%",display:"flex",flexDirection:"column",flex:1}}>
            <MapEditor
              user={user} mapData={mapData} project={project}
              isNew={mapIsNew} theme={theme} readOnly={mapReadOnly} palette={palette}
              onBack={()=>setScreen("project")}
              onProfile={()=>setShowProfile(true)}
              onToggleTheme={toggleTheme}
              onOpenContentPlanHub={()=>setScreen("contentPlanHub")}
              onOpenContentPlanProject={async()=>{
                if(!project?.id)return;
                try{
                  const ms=await getMaps(project.id);
                  setCpProject(project);
                  setCpMaps(Array.isArray(ms)?ms:[]);
                  setScreen("contentPlanProject");
                }catch{}
              }}
              onShellGlobalNav={(nav)=>{
                if(nav==="dashboard"){setMapData(null);setProject(null);setScreen("dashboard");return;}
                if(nav==="projects"){setMapData(null);setProject(null);setScreen("projects");return;}
                if(nav==="contentPlan")setScreen("contentPlanHub");
              }}
              aiChatMsgs={aiChatMsgs}
              aiChatSetMsgs={setAiChatMsgs}
              focusNodeId={mapFocusNodeId}
            />
            {showProfile&&<ProfileModal user={user} theme={theme} palette={palette} onPaletteChange={changePalette} onClose={()=>setShowProfile(false)} onUpdate={u=>setUser(u)} onChangeTier={onChangeTier} onLogout={onLogout} onToggleTheme={toggleTheme}/>}
          </div>
        )}
      {verifiedToast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"12px 22px",borderRadius:12,background:"rgba(16,185,129,.15)",border:"1px solid rgba(16,185,129,.4)",color:"#34d399",fontSize:14,fontWeight:700,boxShadow:"0 8px 32px rgba(0,0,0,.4)",animation:"slideUp .3s ease",backdropFilter:"blur(12px)"}}>
          ✓ {t("verify_email_done","Email подтверждён")}
        </div>
      )}
      {paymentToast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"12px 22px",borderRadius:12,background:"rgba(16,185,129,.15)",border:"1px solid rgba(16,185,129,.4)",color:"#34d399",fontSize:14,fontWeight:700,boxShadow:"0 8px 32px rgba(0,0,0,.4)",animation:"slideUp .3s ease",backdropFilter:"blur(12px)"}}>
          ✓ {t("payment_success","Оплата прошла успешно! Тариф обновлён.")}
        </div>
      )}
      {resetToken&&<ResetPasswordModal token={resetToken} theme={theme} onClose={()=>setResetToken(null)}/>}
      {(screen==="landing"||screen==="legal"||screen==="notFound")&&<CookieConsent/>}
      </>
      </div>
    </LangCtx.Provider>
  );
}

// ── Bootstrap — монтируем приложение в DOM ──
import ReactDOM from "react-dom/client";
const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<App />);
}
