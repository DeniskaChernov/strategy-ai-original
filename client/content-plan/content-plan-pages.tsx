import React, { useState, useEffect } from "react";
import { API_BASE, getProjects } from "../api";
import { getMaps, getMapsByProject } from "../lib/maps-api";
import { useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "../../strategy-shell-sidebar";
import { WorkspaceTopBar } from "../components/workspace-top-bar";
import { followNotificationLink } from "../lib/notif-deep-link";
import { MainWorkspaceNav } from "../components/main-workspace-nav";
import { NotifBell } from "../components/notif-bell";
import { useNotifications } from "../hooks/use-notifications";
import { AiHubModal, NotificationsCenterModal } from "../strategy-modals/notifications-ai-hub-modals";
import { TIERS } from "../lib/tiers";
import { getSTATUS } from "../lib/strategy-labels";
import { AiPanel } from "../map-editor/ai-panel";
import { FloatingAiAssistant } from "../floating-ai-assistant";
import { ContentPlanTab } from "./content-plan-tab";

// ── Хаб контент-плана: те же проекты, что и в стратегии ──
export function ContentPlanHubPage({user,theme,onBackToStrategy,onOpenProject,onLogout,onUpgrade,onProfile,onToggleTheme,aiChatMsgs,aiChatSetMsgs,onSelectProject,onOpenMap,onShellNav}:{user:any;theme:string;onBackToStrategy:()=>void;onOpenProject:(p:any,maps:any[])=>void;onLogout:()=>void;onUpgrade?:()=>void;onProfile:()=>void;onToggleTheme:()=>void;aiChatMsgs?:any[];aiChatSetMsgs?:(m:any[])=>void;onSelectProject?:(p:any)=>void;onOpenMap?:(map:any,project:any,isNew?:boolean,readOnly?:boolean,focusNodeId?:string|null)=>void;onShellNav?:(nav:StrategyShellNav)=>void;}){
  const{t,lang,setLang}=useLang();
  const isMobile=useIsMobile();
  const shellUi=!!user&&!isMobile;
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

  const hubScroll=(
    <div className={shellUi?"scr":undefined} style={{flex:1,overflowY:"auto",padding:shellUi?"26px 28px 60px":isMobile?16:28,position:"relative",zIndex:5,minHeight:0}}>
        <div style={{maxWidth:"min(1240px,100%)",width:"100%",margin:"0 auto"}}>
          <div className="sa-page-reveal sa-pr-d1 sa-panel" style={{marginBottom:24}}>
            <div className="sa-page-hero" style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <span className="sa-cp-hub-hero-ic" style={{width:44,height:44,borderRadius:14,background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 4px 20px var(--accent-glow)",flexShrink:0}}>✍️</span>
              <div style={{flex:1,minWidth:0}}>
                <h1 style={{margin:0}}>{t("cp_hub_title","Контент-план")}</h1>
                <div style={{fontSize:13.5,color:"var(--text3)",marginTop:4,maxWidth:"min(720px,100%)"}}>{t("cp_hub_subtitle","Отдельный рабочий режим: публикации и календарь по проектам из вашей стратегии. Шаги карт подтягиваются для привязки идей.")}</div>
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
          </div>
          {loading?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
              {[1,2,3].map(i=><div key={i} style={{height:130,borderRadius:16,background:"var(--surface)",animation:"pulse 1.5s ease infinite",border:"1px solid var(--border)"}}/>)}
            </div>
          ):projects.length===0?(
            <div className="sa-empty-state sa-page-reveal sa-pr-d2">
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
                  <button key={p.id} type="button" className="btn-interactive card-stagger sa-hub-card sa-lift" disabled={!tier.contentPlan} aria-label={tier.contentPlan?t("cp_card_aria_open","Открыть контент-план проекта {name}").replace("{name}",p.name||""):t("cp_card_aria_locked","Разблокировать Pro для контент-плана")}
                    onClick={()=>{if(!tier.contentPlan){onUpgrade&&onUpgrade();return;}onOpenProject(p,maps);}} style={{cursor:tier.contentPlan?"pointer":"not-allowed",opacity:tier.contentPlan?1:.78,animationDelay:`${Math.min(i,8)*0.05}s`}}>
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
  );

  async function handleNotifLink(n:any){
    if(!n.link)return;
    setShowNotifs(false);
    const ok=await followNotificationLink(n.link,{
      onContentPlan:(projectId)=>{const p=projects.find((x:any)=>x.id===projectId);if(p)onOpenProject(p,mapsByProj[projectId]||[]);},
      onProject:(projectId)=>{const p=projects.find((x:any)=>x.id===projectId);if(p&&onSelectProject)onSelectProject(p);},
      onMap:(projectId,mapId,nodeId)=>{const p=projects.find((x:any)=>x.id===projectId);if(p&&onOpenMap)onOpenMap({id:mapId},p,false,false,nodeId);},
    });
    if(!ok)window.location.href=n.link;
  }

  const hubBody=(
    <>
      {shellUi?(
        <WorkspaceTopBar
          title={t("shell_content_plan","Content Plan")}
          subtitle={t("cp_hub_subtitle_short","{n} projects").replace("{n}",String(projects.length))}
          theme={theme}
          onToggleTheme={onToggleTheme}
          searchPlaceholder={t("dash_search_ph","Search… (⌘K)")}
          showSearch={false}
          notifUnread={notifUnread}
          onNotifs={()=>setShowNotifs(true)}
          showNotifs={!!API_BASE}
          onSettings={onProfile}
          newProjectLabel={t("new_project","New project")}
        />
      ):(
        <>
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
        </>
      )}
      {hubScroll}
      {showNotifs&&onSelectProject&&onOpenMap&&(
        <NotificationsCenterModal open={showNotifs} onClose={()=>setShowNotifs(false)} isMobile={isMobile} zIndex={220} notifs={notifs} setNotifs={setNotifs} notifUnread={notifUnread} setNotifUnread={setNotifUnread} notifLoading={notifLoading} lang={lang} t={t} loadNotifications={loadNotifications} onFollowLink={handleNotifLink}/>
      )}
      {showAIHub&&(
        <AiHubModal open={showAIHub} onClose={()=>setShowAIHub(false)} isMobile={isMobile} t={t} hint={t("ai_hub_hint_cp","Тот же чат, что в стратегии. Контекст — проекты и карты, открытые в разделе контент-плана.")}>
          <AiPanel embedded={true} isMobile={isMobile} nodes={aiNodes} edges={aiEdges} ctx={aiCtx} tier={user?.tier||"free"} projectName={t("cp_hub_title","Контент-план")} mapName="" userName={user?.name||user?.email||""} msgs={aiChatMsgs||[]} onMsgsChange={aiChatSetMsgs||(()=>{})} onAddNode={()=>{}} onClose={()=>{}} externalMsgs={[]} onClearExternal={()=>{}} onError={()=>{}} statusMap={getSTATUS(t)}/>
        </AiHubModal>
      )}
      <FloatingAiAssistant t={t} variant="app" onOpenFullChat={()=>setShowAIHub(true)}/>
    </>
  );

  if(shellUi){
    return(
      <div className={"sa-strategy-ui sa-v-app "+(theme==="dark"?"dk":"lt")} data-theme={theme} style={{width:"100%",height:"100%",minHeight:"100vh",maxHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden"}}>
        <StrategyShellBg/>
        <div className="sa-app" style={{flex:1,minHeight:0,minWidth:0,display:"flex",overflow:"hidden",position:"relative",zIndex:1}}>
          <StrategyShellSidebar theme={theme} onToggleTheme={onToggleTheme} activeNav="contentPlan" onNavigate={(nav)=>{if(nav==="contentPlan")return;onShellNav?onShellNav(nav):onBackToStrategy();}} tierLabel={tier.label} tierColor={tier.color} onTierClick={onUpgrade||onProfile} lang={lang} onLang={code=>setLang(code)} userName={user.name||""} userEmail={user.email||""} projectCount={projects.length} onUserCard={onProfile} onLogout={onLogout} showContentPlan={true} onContentPlan={()=>{}} showTrialBanner={(user?.tier||"free")==="free"} onWeeklyBriefing={()=>setShowAIHub(true)} briefingHint={t("shell_briefing_sub","Strategy health")} onLogoClick={()=>onShellNav?.("dashboard")} layoutMode="reference" t={t}/>
          <div className="sa-main" style={{flex:1,minWidth:0,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>{hubBody}</div>
        </div>
      </div>
    );
  }

  return(
    <div className={"sa-strategy-ui "+(theme==="dark"?"dk":"lt")} data-theme={theme} style={{width:"100%",maxWidth:"100%",boxSizing:"border-box",height:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden",position:"relative"}}>
      <StrategyShellBg/>
      <div style={{flex:1,minHeight:0,minWidth:0,display:"flex",flexDirection:"column",position:"relative",zIndex:1,overflow:"hidden"}}>{hubBody}</div>
    </div>
  );
}

// ── Контент-план одного проекта (полноэкранно, как карта) ──
export function ContentPlanProjectPage({user,project,maps,theme,onBackToHub,onOpenStrategyProject,onLogout,onChangeTier,onUpgrade,onProfile,onToggleTheme,aiChatMsgs,aiChatSetMsgs,onSelectProject,onOpenMap,onSwitchContentPlanProject,onShellNav}:{user:any;project:any;maps:any[];theme:string;onBackToHub:()=>void;onOpenStrategyProject:()=>void;onLogout:()=>void;onChangeTier?:(tier:string)=>void;onUpgrade?:()=>void;onProfile:()=>void;onToggleTheme:()=>void;aiChatMsgs?:any[];aiChatSetMsgs?:(m:any[])=>void;onSelectProject?:(p:any)=>void;onOpenMap?:(map:any,project:any,isNew?:boolean,readOnly?:boolean,focusNodeId?:string|null)=>void;onSwitchContentPlanProject?:(p:any,maps:any[])=>void;onShellNav?:(nav:StrategyShellNav)=>void;}){
  const{t,lang,setLang}=useLang();
  const isMobile=useIsMobile();
  const shellUi=!!user&&!isMobile;
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

  async function handleNotifLink(n:any){
    if(!n.link)return;
    setShowNotifs(false);
    const ok=await followNotificationLink(n.link,{
      onContentPlan:(projectId)=>{if(projectId===project?.id)return;const p=allProjects.find((x:any)=>x.id===projectId);if(p&&onSwitchContentPlanProject){getMaps(p.id).then(ms=>onSwitchContentPlanProject(p,Array.isArray(ms)?ms:[]));}},
      onProject:(projectId)=>{const p=allProjects.find((x:any)=>x.id===projectId);if(p&&onSelectProject)onSelectProject(p);},
      onMap:(projectId,mapId,nodeId)=>{const p=allProjects.find((x:any)=>x.id===projectId);if(p&&onOpenMap)onOpenMap({id:mapId},p,false,false,nodeId);},
    });
    if(!ok)window.location.href=n.link;
  }

  const projectScroll=(
    <div className={shellUi?"scr":undefined} style={{flex:1,overflowY:"auto",padding:shellUi?"18px 22px 32px":isMobile?"12px 14px":"18px 22px",minHeight:0}}>
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
  );

  const projectBody=(
    <>
      {shellUi?(
        <WorkspaceTopBar title={`✍️ ${project?.name||t("untitled","Проект")}`} subtitle={t("cp_project_sub","Контент-план и календарь")} theme={theme} onToggleTheme={onToggleTheme} onBack={onBackToHub} searchPlaceholder={t("dash_search_ph","Search… (⌘K)")} showSearch={false} notifUnread={notifUnread} onNotifs={()=>setShowNotifs(true)} showNotifs={!!API_BASE} onSettings={onProfile} primaryCta={{label:`🗺 ${t("cp_open_strategy","Карты проекта")}`,onClick:onOpenStrategyProject}} newProjectLabel={t("new_project","New project")}/>
      ):(
        <>
          <div className="sa-app-topbar">
            <div className="atb-cluster" style={{minWidth:0,flex:isMobile?"1 1 100%":undefined}}>
              <button type="button" className="sa-back-ic" onClick={onBackToHub} aria-label={t("cp_back_hub","Все проекты")}>←</button>
              <div style={{minWidth:0,maxWidth:isMobile?"calc(100% - 48px)":"280px"}}>
                <div className="tb-title" style={{fontSize:isMobile?14:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✍️ {project?.name||t("untitled","Проект")}</div>
                <div className="tb-sub">{t("cp_project_sub","Контент-план и календарь")}</div>
              </div>
            </div>
            {!isMobile&&(<div style={{flex:"1 1 200px",display:"flex",justifyContent:"center",minWidth:0}}><MainWorkspaceNav mode="contentPlan" onStrategy={onOpenStrategyProject} onContentPlan={()=>{}} t={t} isMobile={false}/></div>)}
            <div className="atb-cluster" style={{marginLeft:isMobile?0:"auto"}}>
              <button type="button" className="btn-g" onClick={onOpenStrategyProject} style={{height:32,fontSize:11.5,padding:"0 12px",color:"var(--acc)"}}><span aria-hidden>🗺</span>{isMobile?"":t("cp_open_strategy","Карты проекта")}</button>
              <div className="tpill" onClick={onToggleTheme} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")onToggleTheme();}}><div className={`tpi${theme==="dark"?" on":""}`}>☽</div><div className={`tpi${theme==="light"?" on":""}`}>☀</div></div>
              <button type="button" className="btn-g" onClick={()=>setShowAIHub(true)} style={{height:32,fontSize:11.5,padding:"0 12px"}}><span aria-hidden>✦</span>{!isMobile&&t("ai_hub_btn_short","AI-чат")}</button>
              {API_BASE&&<NotifBell unread={notifUnread} onClick={()=>setShowNotifs(true)} className="btn-ic"/>}
              <button type="button" className="btn-g" onClick={onProfile} style={{height:32,padding:"0 12px"}}>{(user.name||user.email||"?")[0].toUpperCase()}</button>
              <button type="button" className="btn-g" onClick={onLogout} style={{height:32,fontSize:11.5,color:"var(--red)"}}>{t("logout","Выйти")}</button>
            </div>
          </div>
          {isMobile&&(<div style={{padding:"8px 14px",borderBottom:".5px solid var(--b1)",display:"flex",justifyContent:"center"}}><MainWorkspaceNav mode="contentPlan" onStrategy={onOpenStrategyProject} onContentPlan={()=>{}} t={t} isMobile={true}/></div>)}
        </>
      )}
      {projectScroll}
      {showNotifs&&onSelectProject&&onOpenMap&&(<NotificationsCenterModal open={showNotifs} onClose={()=>setShowNotifs(false)} isMobile={isMobile} zIndex={220} notifs={notifs} setNotifs={setNotifs} notifUnread={notifUnread} setNotifUnread={setNotifUnread} notifLoading={notifLoading} lang={lang} t={t} loadNotifications={loadNotifications} onFollowLink={handleNotifLink}/>)}
      {showAIHub&&(<AiHubModal open={showAIHub} onClose={()=>setShowAIHub(false)} isMobile={isMobile} t={t} hint={t("ai_hub_hint_cp_project","Контекст — карты и шаги текущего проекта в режиме контент-плана.")}><AiPanel embedded={true} isMobile={isMobile} nodes={aiNodes} edges={aiEdges} ctx={aiCtx} tier={user?.tier||"free"} projectName={project?.name||""} mapName={t("cp_doc_suffix","Контент-план")} userName={user?.name||user?.email||""} msgs={aiChatMsgs||[]} onMsgsChange={aiChatSetMsgs||(()=>{})} onAddNode={()=>{}} onClose={()=>{}} externalMsgs={[]} onClearExternal={()=>{}} onError={()=>{}} statusMap={getSTATUS(t)}/></AiHubModal>)}
      <FloatingAiAssistant t={t} variant="app" onOpenFullChat={()=>setShowAIHub(true)}/>
    </>
  );

  if(shellUi){
    return(
      <div className={"sa-strategy-ui sa-v-app "+(theme==="dark"?"dk":"lt")} data-theme={theme} style={{width:"100%",height:"100%",minHeight:"100vh",maxHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden"}}>
        <StrategyShellBg/>
        <div className="sa-app" style={{flex:1,minHeight:0,minWidth:0,display:"flex",overflow:"hidden",position:"relative",zIndex:1}}>
          <StrategyShellSidebar theme={theme} onToggleTheme={onToggleTheme} activeNav="contentPlan" onNavigate={(nav)=>{if(nav==="contentPlan")return;onShellNav?onShellNav(nav):onBackToHub();}} tierLabel={tier.label} tierColor={tier.color} onTierClick={onUpgrade||onProfile} lang={lang} onLang={code=>setLang(code)} userName={user.name||""} userEmail={user.email||""} projectCount={1} onUserCard={onProfile} onLogout={onLogout} showContentPlan={true} onContentPlan={()=>{}} showTrialBanner={(user?.tier||"free")==="free"} onWeeklyBriefing={()=>setShowAIHub(true)} briefingHint={t("shell_briefing_sub","Strategy health")} onLogoClick={()=>onShellNav?.("dashboard")} layoutMode="reference" showProjectNav={true} t={t}/>
          <div className="sa-main" style={{flex:1,minWidth:0,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>{projectBody}</div>
        </div>
      </div>
    );
  }

  return(
    <div className={"sa-strategy-ui "+(theme==="dark"?"dk":"lt")} data-theme={theme} style={{width:"100%",maxWidth:"100%",boxSizing:"border-box",height:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden",position:"relative"}}>
      <StrategyShellBg/>
      <div style={{flex:1,minHeight:0,minWidth:0,display:"flex",flexDirection:"column",position:"relative",zIndex:1,overflow:"hidden"}}>{projectBody}</div>
    </div>
  );
}
