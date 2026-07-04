import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { NW, NH, fmt, sleep, uid, snap } from "../lib/util";
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
} from "../api";
import { makeTfn } from "../i18n/makeTfn";
import { StrategyShellSidebar, StrategyShellBg, type StrategyShellNav } from "../../strategy-shell-sidebar";
const ReferenceLandingView = React.lazy(() =>
  import("../../reference-landing").then((m) => ({ default: m.ReferenceLandingView }))
);
import { GlowCard } from "../glow-card";
import { FloatingAiAssistant } from "../floating-ai-assistant";
import { SplashLoaderScreen } from "../splash-loader";
import { GlassCalendar, dateToYMD } from "../glass-calendar";
import { parseMarketingPath } from "../spa-path";
import { applySeoForAppScreen } from "../seo-head";
import { LegalDocumentPage, NotFoundPage } from "../legal-pages";
import { trackSaEvent } from "../analytics";
import {
  UUID_RE,
  isUUID,
  normalizeMap,
  edgePt,
  defaultNodes,
  topSort,
} from "../lib/map-utils";
import { getMaps, getMapsByProject, saveMap, deleteMap, getContentPlan, saveContentPlan } from "../lib/maps-api";
import { AI_KNOWLEDGE, AI_STRICT_RULES, AI_TIER, OB_TIER, MAP_TIER } from "../lib/ai-prompts";
import { LangCtx, useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { SheetSwipeHandle } from "../components/sheet-swipe-handle";
import { ConfirmDialog } from "../strategy-modals/confirm-dialog";
import { AiHubModal, NotificationsCenterModal } from "../strategy-modals/notifications-ai-hub-modals";
import { TIERS } from "../lib/tiers";
import { getROLES, getSTATUS, getPRIORITY, getSTATUSES, getPRIORITIES, getETYPE, getTierPrice } from "../lib/strategy-labels";
import { callAI } from "../lib/call-ai";
import { StatsPopup } from "../strategy-modals/stats-popup";
import { VersionHistoryModal } from "../strategy-modals/version-history-modal";
import { WeeklyBriefingModal } from "../strategy-modals/weekly-briefing-modal";
import { ScenarioTemplatesModal } from "../strategy-modals/scenario-templates-modal";
import { TemplateModal } from "../strategy-modals/template-modal";
import { useNotifications } from "../hooks/use-notifications";
import { sanitize } from "../lib/sanitize";
import { MainWorkspaceNav } from "../components/main-workspace-nav";
import { Toggle } from "../components/toggle";
import { IconButton } from "../components/icon-button";
import { OfflineBanner } from "../components/offline-banner";
import { CustomSelect } from "../components/custom-select";
import { Toast } from "../components/toast";
import { NotifBell } from "../components/notif-bell";
import { ThemeTogglePill } from "../components/theme-toggle-pill";
import { MapTour } from "../components/map-tour";
import { WorkspaceTopBar } from "../components/workspace-top-bar";
import { ReferenceProjectCard, projectVisual, memberAvatarStyle } from "../components/reference-project-card";
import { NewProjectModal } from "../strategy-modals/new-project-modal";
import { GlobalSearchOverlay } from "../components/global-search-overlay";
import { SimulationModal } from "../strategy-modals/simulation-modal";
import { PillGroup } from "../components/pill-group";
import { MapConflictModal } from "../strategy-modals/map-conflict-modal";
import { ALL_FEATURES, TIER_FEAT_KEY, TIER_ORDER, TIER_MKT } from "../lib/tier-marketing-data";
import { FeatureValue } from "../components/feature-value";
import { TierSelectionScreen } from "../components/tier-selection-screen";
import { SavingScreen } from "../components/saving-screen";
import { AuthModal } from "../strategy-modals/auth-modal";
import { CookieConsent } from "../components/cookie-consent";
import { MiniMap } from "../components/mini-map";
import { GanttView } from "../components/gantt-view";
import { ProfileModal } from "../strategy-modals/profile-modal";
import { IconTrash } from "../components/icons";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Onboarding } from "../onboarding/onboarding";
import { AiPanel } from "../map-editor/ai-panel";
import { ContentPlanTab } from "../content-plan/content-plan-tab";


// ── ProjectsPage ──
type ProjectLite={id:string;name:string;owner:string;members?:Array<{email:string;role:string}>;createdAt?:number;created_at?:number};
type MapLite={id:string;name?:string;isScenario?:boolean;nodes?:any[];edges?:any[]};

function toMs(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Date.parse(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function ProjectsPage({user,onSelectProject,onOpenMap,onLogout,onChangeTier,onProfile,theme,onToggleTheme,aiChatMsgs,aiChatSetMsgs,onOpenContentPlanHub,onOpenContentPlanProject,onGoToDashboard,onGoToAi,onGoToInsights}:any){
  const{t,lang,setLang}=useLang();
  const isMobile=useIsMobile();
  const ROLES=getROLES(t);
  const[projects,setProjects]=useState<ProjectLite[]>([]);
  const[maps,setMaps]=useState<Record<string,MapLite[]>>({});
  const[toast,setToast]=useState<{msg:string;type:string}|null>(null);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[searching,setSearching]=useState(false);
  const[searchResults,setSearchResults]=useState<any[]>([]);
  const[showMobileSearch,setShowMobileSearch]=useState(false);
  const[creating,setCreating]=useState(false);
  const[newName,setNewName]=useState("");
  const[delId,setDelId]=useState<string|null>(null);
  const[showNotifs,setShowNotifs]=useState(false);
  const{notifs,setNotifs,notifUnread,setNotifUnread,notifLoading,loadNotifications}=useNotifications(showNotifs,user?.email);
  const[showAIHub,setShowAIHub]=useState(false);
  const[showBriefing,setShowBriefing]=useState(false);
  const tier=TIERS[user?.tier||"free"]||TIERS.free;
  const[kebabId,setKebabId]=useState<string|null>(null);
  const[renameId,setRenameId]=useState<string|null>(null);
  const[renameDraft,setRenameDraft]=useState("");
  const[sortMode,setSortMode]=useState<string>(()=>{try{return localStorage.getItem("sa_proj_sort")||"recent";}catch{return"recent";}});
  const[roleFilter,setRoleFilter]=useState<string>(()=>{try{return localStorage.getItem("sa_proj_role")||"all";}catch{return"all";}});
  useEffect(()=>{try{localStorage.setItem("sa_proj_sort",sortMode);}catch{}},[sortMode]);
  useEffect(()=>{try{localStorage.setItem("sa_proj_role",roleFilter);}catch{}},[roleFilter]);
  useEffect(()=>{
    if(!kebabId)return;
    const close=(e:any)=>{if(!e.target.closest?.(".sa-proj-kebab"))setKebabId(null);};
    window.addEventListener("click",close);
    return()=>window.removeEventListener("click",close);
  },[kebabId]);
  async function duplicateProject(p:ProjectLite){
    const tier2=TIERS[user.tier]||TIERS.free;
    if(projects.filter(x=>x.owner===user.email).length>=tier2.projects){
      setToast({msg:t("project_limit","Лимит проектов"),type:"error"});setTimeout(()=>setToast(null),3000);return;
    }
    const copy={id:uid(),name:(p.name||"Проект")+" — копия",owner:user.email,members:[{email:user.email,role:"owner"}],createdAt:Date.now()} as any;
    try{
      const saved=await saveProject(copy);
      const finalP=saved||copy;
      setProjects(ps=>[...ps,finalP]);
      setMaps(m=>({...m,[finalP.id]:[]}));
      setToast({msg:t("project_duplicated","Проект скопирован"),type:"success"});setTimeout(()=>setToast(null),2400);
    }catch(e:any){setToast({msg:e?.message||t("save_error","Ошибка сохранения"),type:"error"});setTimeout(()=>setToast(null),3000);}
  }
  async function renameProject(id:string,name:string){
    const p=projects.find(x=>x.id===id);
    if(!p||!name.trim())return;
    const next={...p,name:name.trim()} as any;
    try{
      await saveProject(next);
      setProjects(ps=>ps.map(x=>x.id===id?next:x));
    }catch(e:any){setToast({msg:e?.message||t("save_error","Ошибка сохранения"),type:"error"});setTimeout(()=>setToast(null),3000);}
  }

  const[loadErr,setLoadErr]=useState<string|null>(null);
  async function loadProjects(){
    setLoadErr(null);setLoading(true);
    try{
      const ps=await getProjects(user.email);setProjects(ps);
      setMaps(await getMapsByProject(ps.map((p:any)=>p.id)) as Record<string,MapLite[]>);
    }catch(e:any){setLoadErr(e?.message||t("load_error","Ошибка загрузки"));setProjects([]);setMaps({});}
    finally{setLoading(false);}
  }
  useEffect(()=>{loadProjects();},[]);

  useEffect(()=>{
    try{
      if(sessionStorage.getItem("sa_open_new_project")==="1"){
        sessionStorage.removeItem("sa_open_new_project");
        setCreating(true);
      }
      if(sessionStorage.getItem("sa_focus_search")==="1"){
        sessionStorage.removeItem("sa_focus_search");
        setShowMobileSearch(true);
      }
    }catch{/* — */}
  },[]);

  useEffect(()=>{document.title=loading?t("doc_title_loading","Strategy AI — Загрузка…"):t("doc_title_projects","Strategy AI — Проекты");},[loading,t]);

  useEffect(()=>{
    if(!API_BASE){setSearchResults([]);return;}
    const q=(search||"").trim();
    if(q.length<2){setSearchResults([]);setSearching(false);return;}
    setSearching(true);
    const t=setTimeout(async()=>{
      try{
        const d=await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
        setSearchResults(Array.isArray(d?.results)?d.results:[]);
      }catch{setSearchResults([]);}
      setSearching(false);
    },250);
    return()=>clearTimeout(t);
  },[search]);
  useEffect(()=>{
    if(!showMobileSearch)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setShowMobileSearch(false);};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[showMobileSearch]);

  function openSearchResult(r:any){
    try{
      const proj=projects.find((p:any)=>p.id===r.projectId)||{id:r.projectId,name:r.subtitle||"Проект"};
      if(r.type==="map")onOpenMap({id:r.id},proj,false,false);
      else if(r.type==="node")onOpenMap({id:r.mapId},proj,false,false,r.id);
      setSearchResults([]);
      setSearch("");
      setShowMobileSearch(false);
    }catch{}
  }

  async function createProject(fromModal?: { name: string; description?: string; icon?: string; color?: string }){
    const projectName=(fromModal?.name??newName).trim();
    if(!projectName)return;
    if(projects.filter(p=>p.owner===user.email).length>=tier.projects){setToast({msg:t("project_limit","Лимит проектов"),type:"error"});setTimeout(()=>setToast(null),3000);return;}
    const p: any={id:uid(),name:projectName,owner:user.email,members:[{email:user.email,role:"owner"}],createdAt:Date.now()};
    if(fromModal?.description)p.description=fromModal.description;
    if(fromModal?.icon)p.icon=fromModal.icon;
    if(fromModal?.color)p.color=fromModal.color;
    try{
      const saved=await saveProject(p);
      const finalP=saved||p;
      setProjects(ps=>[...ps,finalP]);
      setMaps(m=>({...m,[finalP.id]:[]}));
      setNewName("");setCreating(false);
      setToast({msg:t("project_created","Проект создан"),type:"success"});setTimeout(()=>setToast(null),3000);
    }catch(e:any){setToast({msg:e?.message||t("save_error","Ошибка сохранения"),type:"error"});setTimeout(()=>setToast(null),4000);}
  }
  async function deleteProj(id){
    try{
      await deleteProject(id);setProjects(ps=>ps.filter(p=>p.id!==id));
      const nm={...maps};delete nm[id];setMaps(nm);setDelId(null);
    }catch(e:any){setDelId(null);setToast({msg:e?.message||t("delete_project_err","Ошибка при удалении проекта"),type:"error"});setTimeout(()=>setToast(null),4000);}
  }

  const filtered=(()=>{
    let arr=projects.filter((p:ProjectLite)=>p.name.toLowerCase().includes(search.toLowerCase()));
    if(roleFilter==="owner")arr=arr.filter(p=>p.owner===user.email);
    else if(roleFilter==="member")arr=arr.filter(p=>p.owner!==user.email);
    const sorted=[...arr];
    if(sortMode==="name")sorted.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    else if(sortMode==="oldest")sorted.sort((a,b)=>((a as any).createdAt||0)-((b as any).createdAt||0));
    else sorted.sort((a,b)=>((b as any).createdAt||0)-((a as any).createdAt||0));
    return sorted;
  })();
  const myCount=projects.filter((p:ProjectLite)=>p.owner===user.email).length;
  const atLimit=myCount>=tier.projects;
  const lastProj=useMemo<ProjectLite|null>(()=>{try{const s=localStorage.getItem("sa_last_project");if(!s)return null;const j=JSON.parse(s);return projects.find((p:ProjectLite)=>p.id===j.id||p.name===j.name)||null;}catch{return null;}},[projects]);
  const lastMapData=useMemo<MapLite|null>(()=>{if(!lastProj)return null;try{const s=localStorage.getItem("sa_last_map");if(!s)return null;const j=JSON.parse(s);const ms=maps[lastProj.id]||[];return ms.find((m:MapLite)=>m.id===j.id||m.name===j.name)||null;}catch{return null;}},[lastProj,maps]);
  const allMapsForAI=Object.values(maps||{}).flatMap((arr:any)=>Array.isArray(arr)?arr:[]);
  const aiNodes=allMapsForAI.flatMap((m:any)=>m.nodes||[]).slice(0,220);
  const aiEdges=allMapsForAI.flatMap((m:any)=>m.edges||[]).slice(0,260);
  const aiCtx=`Портфель проектов пользователя: ${(projects||[]).slice(0,20).map((p:any)=>`«${p.name||"Проект"}»`).join(", ")}. Всего проектов: ${(projects||[]).length}. Всего карт загружено: ${allMapsForAI.length}.`;

  function handleProjectsShellNav(nav:StrategyShellNav){
    if(nav==="projects")return;
    if(nav==="dashboard"){onGoToDashboard?.();return;}
    if(nav==="insights"){onGoToInsights?.();return;}
    if(nav==="settings"){onProfile();return;}
    if(nav==="map"){
      if(lastMapData&&lastProj)onOpenMap(lastMapData,lastProj,false,false);
      else if(lastProj)onSelectProject(lastProj);
      else{setToast({msg:t("shell_open_map_hint","Создайте проект и откройте карту."),type:"error"});setTimeout(()=>setToast(null),3200);}
      return;
    }
    if(nav==="contentPlan"){onOpenContentPlanHub?.();return;}
    if(nav==="ai"){onGoToAi?.()??setShowAIHub(true);return;}
    if(nav==="scenarios"){setToast({msg:t("shell_scenarios_hint","Откройте карту проекта — там доступна симуляция сценариев."),type:"info"});setTimeout(()=>setToast(null),3500);return;}
    if(nav==="timeline"){setToast({msg:t("shell_timeline_hint","Откройте карту — диаграмма Gantt на панели инструментов."),type:"info"});setTimeout(()=>setToast(null),3500);return;}
    if(nav==="team"){setToast({msg:t("shell_team_hint","Участники отображаются в карточке каждого проекта."),type:"info"});setTimeout(()=>setToast(null),3500);return;}
  }
  const shellUi=!isMobile;
  const scenarioBadgeCount=allMapsForAI.filter((m:any)=>m.isScenario).length;
  const openGlobalSearch=useCallback(()=>setShowMobileSearch(true),[]);
  useEffect(()=>{
    if(!shellUi)return;
    const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openGlobalSearch();}};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[shellUi,openGlobalSearch]);

  function renderReferenceProjectCard(p: ProjectLite, i: number){
    const pm=maps[p.id]||[];
    const myRole=p.owner===user.email?"owner":p.members?.find(m=>m.email===user.email)?.role||"owner";
    const roleLabel=shellUi?myRole:(ROLES[myRole]?.label||myRole);
    const vis=projectVisual(p.id,(p as any).icon,(p as any).color);
    const mapsCount=pm.filter(m=>!m.isScenario).length;
    const scenCount=pm.filter(m=>m.isScenario).length;
    const allNodes=pm.flatMap(m=>m.nodes||[]);
    const stepsCount=allNodes.length;
    const membersList=p.members?.length?p.members:[{email:p.owner,role:"owner"}];
    const pct=stepsCount?Math.round(allNodes.reduce((s,n)=>s+(Number(n.progress)||0),0)/stepsCount):0;
    const editedTs=toMs((p as any).updatedAt||(p as any).updated_at||p.createdAt||p.created_at);
    const editedLabel=editedTs?(()=>{const diff=Date.now()-editedTs;const d=Math.floor(diff/864e5);if(d<=0)return t("edited_today_ref","Edited today");if(d===1)return t("edited_yesterday_ref","Edited yesterday");return t("edited_on_ref","Edited {d}").replace("{d}",new Date(editedTs).toLocaleDateString(lang==="en"?"en-US":lang==="uz"?"uz-UZ":"ru",{day:"numeric",month:"short"}));})():"—";
    const memberAvatars=membersList.map((mem:any,mi:number)=>memberAvatarStyle(mem.email||String(mi),mi));
    return(
      <ReferenceProjectCard
        key={p.id}
        name={p.name}
        roleLabel={roleLabel}
        desc={(p as any).description||""}
        iconEmoji={vis.emoji}
        iconColor={vis.color}
        maps={mapsCount}
        scenarios={scenCount}
        steps={stepsCount}
        members={membersList.length}
        progress={pct}
        editedLabel={editedLabel}
        memberAvatars={memberAvatars}
        mapsLabel={t("maps_cap","Maps")}
        scenariosLabel={t("scenarios_cap","Scenarios")}
        stepsLabel={t("steps_cap","Steps")}
        membersLabel={t("members_cap","Members")}
        progressLabel={t("overall_progress","Overall progress")}
        onClick={()=>onSelectProject(p)}
      />
    );
  }

  const _projMain=(
    <>
{toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"14px 24px",borderRadius:14,border:`1px solid ${toast.type==="error"?"rgba(239,68,68,.4)":"rgba(16,185,129,.4)"}`,background:toast.type==="error"?"rgba(239,68,68,.15)":"rgba(16,185,129,.15)",color:toast.type==="error"?"#f87171":"#34d399",fontSize:14,fontWeight:700,boxShadow:"0 8px 32px rgba(0,0,0,.3)",animation:"slideUp .3s ease",backdropFilter:"blur(12px)"}}>
          {toast.type==="error"?"⚠ ":"✓ "}{toast.msg}
        </div>
      )}
      {!shellUi&&(
      <div className="sa-app-topbar">
        <div className="atb-cluster" style={{minWidth:0}}>
          <div className="land-logo" style={{gap:10}}>
            <div className="land-gem" style={{width:32,height:32,borderRadius:10,fontSize:12}}>SA</div>
            <span className="land-brand" style={{fontSize:15}}>Strategy AI</span>
          </div>
        </div>
        {!isMobile&&onOpenContentPlanHub&&(
          <div style={{flex:1,display:"flex",justifyContent:"center",minWidth:0}}>
            <MainWorkspaceNav mode="strategy" onStrategy={()=>{}} onContentPlan={onOpenContentPlanHub} t={t} isMobile={false}/>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:isMobile?6:8,flexShrink:0}}>
          {isMobile&&(
            <button type="button" className="btn-g" onClick={()=>setShowMobileSearch(true)} title={t("search_projects_hint","Поиск по проектам и картам…")} aria-label={t("search_projects_hint","Поиск по проектам и картам…")} style={{height:32,padding:"0 10px",fontSize:13}}>
              🔍
            </button>
          )}
          <ThemeTogglePill theme={theme} onToggle={onToggleTheme} />
          <button type="button" className="btn-interactive" onClick={()=>setShowAIHub(true)} title={t("ai_hub_title","✦ AI (единый чат)")} style={{padding:"6px 12px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",cursor:"pointer",fontSize:12,fontWeight:800,display:"inline-flex",alignItems:"center",gap:6}}>
            <span aria-hidden>✦</span>{t("ai_hub_btn_short","AI-чат")}
          </button>
          {API_BASE&&<NotifBell unread={notifUnread} onClick={()=>setShowNotifs(true)} className="btn-ic"/>}
          <button type="button" className="btn-g" onClick={onProfile} style={{height:32,padding:"0 12px",gap:8,display:"inline-flex",alignItems:"center",maxWidth:isMobile?44:220}}>
            <span style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,var(--acc),var(--acc2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>{(user.name||user.email||"?")[0].toUpperCase()}</span>
            {!isMobile&&<><span style={{fontSize:12,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name||user.email?.split("@")[0]||"?"}</span><span style={{fontSize:10,fontWeight:700,color:"var(--t3)",textTransform:"uppercase"}}>{tier.label}</span></>}
          </button>
          <button type="button" className="btn-g" onClick={onLogout} style={{height:32,fontSize:11.5,color:"var(--red)"}}>{t("logout","Выйти")}</button>
        </div>
      </div>
      )}
      {showMobileSearch&&(
        <GlobalSearchOverlay
          open={showMobileSearch}
          onClose={()=>setShowMobileSearch(false)}
          search={search}
          onSearchChange={setSearch}
          searching={searching}
          searchResults={searchResults}
          onSelectResult={openSearchResult}
          t={t}
          variant={shellUi?"desktop":"mobile"}
        />
      )}
      {shellUi&&(
        <WorkspaceTopBar
          title={t("shell_projects","Projects")}
          subtitle={t("projects_subtitle","Your strategic workspace")}
          theme={theme}
          onToggleTheme={onToggleTheme}
          searchPlaceholder={t("dash_search_ph","Search… (⌘K)")}
          onSearchClick={openGlobalSearch}
          notifUnread={notifUnread}
          onNotifs={()=>setShowNotifs(true)}
          showNotifs={!!API_BASE}
          onSettings={onProfile}
          onNewProject={atLimit?undefined:()=>setCreating(true)}
          newProjectLabel={t("new_project","New project")}
        />
      )}
      <div className={shellUi?"scr":undefined} style={{flex:1,overflowY:"auto",padding:shellUi?undefined:isMobile?16:24,paddingBottom:isMobile?96:undefined,position:"relative",zIndex:5,minHeight:0}}>
        {shellUi?(
          <>
            {creating&&<NewProjectModal t={t} onClose={()=>{setCreating(false);setNewName("");}} onCreate={(data)=>createProject(data)}/>}
            {loadErr?(
              <div style={{padding:"32px 24px",textAlign:"center"}}>
                <div style={{fontSize:15,color:"var(--t3)",marginBottom:12}}>{loadErr}</div>
                <button type="button" className="btn-p" onClick={loadProjects}>{t("retry","Retry")}</button>
              </div>
            ):loading?(
              <>
                <div className="slbl">{t("all_projects","All projects")}</div>
                <div className="proj-grid">{[1,2,3,4].map(i=>(<div key={i} className="proj-card" style={{pointerEvents:"none",minHeight:180}}><div className="sa-skel" style={{height:120,borderRadius:12}}/></div>))}</div>
              </>
            ):(
              <>
                <div className="slbl">{t("all_projects","All projects")} <span style={{color:"var(--acc)",fontWeight:700}}>{filtered.length}</span></div>
                <div className="proj-grid">
                  {filtered.map((p,i)=>renderReferenceProjectCard(p,i))}
                  {!atLimit&&(
                    <div className="proj-card new-card" onClick={()=>setCreating(true)} onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" ")setCreating(true);}} role="button" tabIndex={0}>
                      <div className="proj-new-icon">+</div>
                      <div className="proj-new-lbl">{t("new_project","New project")}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ):(
        <div style={{maxWidth:960,width:"100%",margin:"0 auto"}}>
          {isMobile&&onOpenContentPlanHub&&(
            <div style={{marginBottom:18}}>
              <MainWorkspaceNav mode="strategy" onStrategy={()=>{}} onContentPlan={onOpenContentPlanHub} t={t} isMobile={true}/>
            </div>
          )}
          <div className="sa-projects-sticky-head sa-page-hero" style={{display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"stretch":"center",gap:20,marginBottom:24,position:"sticky",top:0,zIndex:20,padding:"14px 4px",margin:"0 -4px 24px",background:"color-mix(in srgb,var(--bg) 72%,transparent)",backdropFilter:"blur(18px)",borderBottom:".5px solid var(--b1)"}}>
            <div>
              <h1 style={{marginBottom:2}}>{t("your_projects","Мои проекты")}</h1>
              <div style={{fontSize:13.5,color:"var(--text3)"}}>{t("projects_of_limit","{cur} из {max} проектов").replace("{cur}",String(myCount)).replace("{max}",!Number.isFinite(tier.projects)?"∞":String(tier.projects))}</div>
            </div>
            {!isMobile&&<div style={{flex:1}}/>}
            <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} title={t("filter_role","Фильтр по роли")} style={{padding:"9px 12px",fontSize:13,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:10,color:"var(--text)",fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
                <option value="all">{t("filter_all","Все")}</option>
                <option value="owner">{t("filter_owner","Мои")}</option>
                <option value="member">{t("filter_member","Где я участник")}</option>
              </select>
              <select value={sortMode} onChange={e=>setSortMode(e.target.value)} title={t("sort_label","Сортировка")} style={{padding:"9px 12px",fontSize:13,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:10,color:"var(--text)",fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
                <option value="recent">{t("sort_recent","Недавние")}</option>
                <option value="oldest">{t("sort_oldest","Старые")}</option>
                <option value="name">{t("sort_name","По имени")}</option>
              </select>
              <div style={{position:"relative",flex:isMobile?1:undefined}}>
                {isMobile?(
                  <button type="button" className="btn-interactive" onClick={()=>setShowMobileSearch(true)} style={{height:38,padding:"0 12px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",cursor:"pointer",fontSize:12.5,fontWeight:700,minWidth:170,textAlign:"left"}}>
                    🔍 {search?search:t("search_projects_hint","Поиск по проектам и картам…")}
                  </button>
                ):(
                  <>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("search_projects_hint","Поиск по проектам и картам…")} className="input-smooth" style={{padding:"10px 16px",fontSize:14,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:12,color:"var(--text)",outline:"none",width:220,minWidth:140,fontFamily:"inherit"}}/>
                    {API_BASE&&((search||"").trim().length>=2)&&(searching||searchResults.length>0)&&(
                      <div className="glass-panel drop-panel" style={{position:"absolute",top:"calc(100% + 8px)",left:0,right:0,zIndex:50,borderRadius:14,border:"1px solid var(--glass-border-accent,var(--border))",overflow:"hidden",boxShadow:"var(--glass-shadow-accent,none),0 22px 60px rgba(0,0,0,.35)"}}>
                        <div style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:"var(--surface)"}}>
                          <div style={{fontSize:12.5,fontWeight:900,color:"var(--text)"}}>{t("search_results","Результаты поиска")}</div>
                          <div style={{fontSize:12,color:"var(--text5)"}}>{searching?t("loading_short","Загрузка…"):`${searchResults.length}`}</div>
                        </div>
                        <div style={{maxHeight:360,overflow:"auto",padding:"8px 8px 10px",background:"var(--surface)"}}>
                          {searching&&searchResults.length===0?(
                            <div style={{padding:"10px 8px",fontSize:12.5,color:"var(--text5)"}}>{t("loading_short","Загрузка…")}</div>
                          ):searchResults.length===0?(
                            <div style={{padding:"10px 8px",fontSize:12.5,color:"var(--text5)"}}>{t("search_empty","Ничего не найдено")}</div>
                          ):(
                            <div style={{display:"flex",flexDirection:"column",gap:8}}>
                              {searchResults.slice(0,24).map((r:any)=>(
                                <button key={`${r.type}:${r.id}`} className="btn-interactive" onClick={()=>openSearchResult(r)} style={{textAlign:"left",padding:"10px 12px",borderRadius:12,border:"1px solid var(--border)",background:"var(--surface)",cursor:"pointer",display:"flex",gap:10,alignItems:"flex-start"}}>
                                  <div style={{width:26,height:26,borderRadius:9,background:"var(--surface2)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,color:"var(--text4)"}}>
                                    {r.type==="map"?"M":"N"}
                                  </div>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:13,fontWeight:900,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title||t("untitled","Без названия")}</div>
                                    <div style={{fontSize:12.5,color:"var(--text5)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.subtitle||""}</div>
                                    {r.highlight&&<div style={{fontSize:12.5,color:"var(--text4)",marginTop:6,lineHeight:1.4,opacity:.95}}>{String(r.highlight)}</div>}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <button onClick={()=>{if(atLimit){return;}setCreating(true);}} className="btn-smooth" style={{padding:"8px 18px",borderRadius:10,border:"none",background:atLimit?"var(--surface)":"var(--gradient-accent)",color:atLimit?"var(--text4)":"var(--accent-on-bg)",cursor:atLimit?"not-allowed":"pointer",fontSize:13,fontWeight:700,flexShrink:0,boxShadow:atLimit?"none":"0 2px 12px var(--accent-glow)"}} title={atLimit?t("projects_limit_tip","Лимит {n} проектов для {tier}").replace("{n}",String(tier.projects)).replace("{tier}",tier.label):t("new_project","+ Новый проект")}>+ {t("project_short","Проект")}</button>
            </div>
          </div>
          {atLimit&&<div role="status" style={{padding:"10px 16px",borderRadius:10,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",color:"#f09428",fontSize:13.5,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>⚠️ {t("projects_limit_banner","Лимит проектов для тарифа {tier}.").replace("{tier}",tier.label)} <button onClick={onProfile} style={{border:"none",background:"none",color:"var(--accent-1)",cursor:"pointer",fontWeight:700,fontSize:13.5}}>{t("upgrade_tier_arrow","Улучшить тариф →")}</button></div>}
          {lastProj&&!loading&&onOpenMap&&(
            <div className="card-stagger" style={{display:"flex",flexDirection:isMobile?"column":"row",gap:14,marginBottom:20,alignItems:"stretch",animationDelay:".05s"}}>
              <div className="glass-card icard" style={{flex:1,minWidth:0,padding:"16px 20px",borderRadius:16,border:"1px solid var(--glass-border-accent,var(--border))",background:"linear-gradient(135deg,var(--accent-soft),color-mix(in srgb,var(--accent-soft) 70%,transparent))",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",cursor:"default"}}>
                <span style={{fontSize:12.5,color:"var(--text3)",fontWeight:600,letterSpacing:".02em",textTransform:"uppercase"}}>{t("continue_last","Продолжить с")}</span>
                <button className="btn-smooth" onClick={()=>lastMapData?onOpenMap(lastMapData,lastProj,false,false):onSelectProject(lastProj)} style={{padding:"9px 18px",borderRadius:12,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:"0 4px 16px var(--accent-glow)"}}>
                  {lastMapData?`${lastProj.name} → ${lastMapData.name}`:lastProj.name}
                </button>
              </div>
              {lastMapData&&(
                <div className="glass-card icard" style={{flex:1,minWidth:0,padding:"16px 20px",borderRadius:16,border:"1px solid var(--glass-border-accent,var(--border))",background:"var(--surface)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:isMobile?"wrap":"nowrap",cursor:"default"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,color:"var(--text4)",marginBottom:4,fontWeight:600,letterSpacing:".02em",textTransform:"uppercase"}}>{t("projects_briefing_cta","Брифинг по последней карте")}</div>
                    <div style={{fontSize:14,fontWeight:800,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lastMapData.name||"—"}</div>
                  </div>
                  <button type="button" className="btn-smooth btn-interactive" onClick={()=>setShowBriefing(true)} style={{padding:"10px 16px",borderRadius:12,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:"var(--accent-2)",cursor:"pointer",fontSize:13,fontWeight:800,whiteSpace:"nowrap",flexShrink:0}}>
                    📋 {t("weekly_briefing","Еженедельный брифинг")}
                  </button>
                </div>
              )}
            </div>
          )}
          {creating&&(
            <div style={{padding:"16px 18px",borderRadius:14,background:"var(--surface)",border:"1px solid var(--border2)",marginBottom:16,display:"flex",gap:10,alignItems:"center",animation:"slideUp .2s ease"}}>
              <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")createProject();if(e.key==="Escape"){setCreating(false);setNewName("");}}} placeholder={t("new_project_name_ph","Название проекта…")} style={{flex:1,padding:"9px 13px",fontSize:13.5,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:10,color:"var(--text)",outline:"none",fontFamily:"inherit"}}/>
              <button onClick={()=>createProject()} disabled={!newName.trim()} style={{padding:"9px 20px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:newName.trim()?"pointer":"not-allowed",fontSize:13,fontWeight:700,opacity:newName.trim()?1:.5}}>{t("create_map_btn","Создать")}</button>
              <button onClick={()=>{setCreating(false);setNewName("");}} style={{padding:"9px 14px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",cursor:"pointer",fontSize:13}}>{t("cancel","Отмена")}</button>
            </div>
          )}
          {loadErr?(
            <div style={{padding:"32px 24px",textAlign:"center",background:"var(--surface)",borderRadius:18,border:"1px solid var(--border)"}}>
              <div style={{fontSize:15,color:"var(--text3)",marginBottom:12}}>{loadErr}</div>
              <button onClick={loadProjects} className="btn-interactive" style={{padding:"12px 24px",borderRadius:12,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",fontSize:14,fontWeight:700,cursor:"pointer"}}>{t("retry","Повторить")}</button>
            </div>
          ):loading?(
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":`repeat(auto-fill,minmax(${shellUi?300:260}px,1fr))`,gap:isMobile?16:20}}>
              {[1,2,3,4].map(i=>(
                <div key={i} className="glass-card card-stagger" style={{padding:"22px 22px 18px",borderRadius:18,border:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:14,animationDelay:`${i*0.05}s`}}>
                  <div style={{display:"flex",gap:14}}>
                    <div className="sa-skel" style={{width:40,height:40,borderRadius:12}}/>
                    <div style={{flex:1}}>
                      <div className="sa-skel" style={{height:14,borderRadius:7,width:"70%",marginBottom:8}}/>
                      <div className="sa-skel" style={{height:10,borderRadius:5,width:"40%"}}/>
                    </div>
                  </div>
                  <div className="sa-skel" style={{height:8,borderRadius:999}}/>
                  <div style={{display:"flex",gap:6}}>
                    <div className="sa-skel" style={{height:20,width:60,borderRadius:999}}/>
                    <div className="sa-skel" style={{height:20,width:70,borderRadius:999}}/>
                  </div>
                </div>
              ))}
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":`repeat(auto-fill,minmax(${shellUi?300:260}px,1fr))`,gap:isMobile?16:20}}>
              {filtered.map((p,i)=>{
                const pm=maps[p.id]||[];
                const myRole=p.owner===user.email?"owner":p.members?.find(m=>m.email===user.email)?.role;
                const roleLabel=ROLES[myRole]?.label||"";
                const icon=((p.name||"P").trim()[0]||"P").toUpperCase();
                const mapsCount=pm.filter(m=>!m.isScenario).length;
                const scenCount=pm.filter(m=>m.isScenario).length;
                const allNodes=pm.flatMap(m=>m.nodes||[]);
                const stepsCount=allNodes.length;
                const membersList=p.members?.length?p.members:[{email:p.owner,role:"owner"}];
                const membersCount=membersList.length;
                const pct=stepsCount?Math.round(allNodes.reduce((s,n)=>s+(Number(n.progress)||0),0)/stepsCount):0;
                const editedTs=toMs((p as any).updatedAt||(p as any).updated_at||p.createdAt||p.created_at);
                const editedLabel=editedTs?(()=>{const diff=Date.now()-editedTs;const d=Math.floor(diff/864e5);if(d<=0)return t("edited_today","Изменён сегодня");if(d===1)return t("edited_yesterday","Изменён вчера");return t("edited_on","Изменён {d}").replace("{d}",new Date(editedTs).toLocaleDateString(lang==="en"?"en-US":lang==="uz"?"uz-UZ":"ru",{day:"numeric",month:"short"}));})():"—";
                const desc=(p as any).description||"";
                const StatBox=({n,label}:{n:number;label:string})=>(
                  <div className="sa-stat-chip">
                    <div style={{fontSize:16,fontWeight:900,color:"var(--text)",lineHeight:1}}>{n}</div>
                    <div style={{fontSize:9.5,fontWeight:800,letterSpacing:.5,textTransform:"uppercase",color:"var(--text5)",marginTop:3}}>{label}</div>
                  </div>
                );
                return(
                  <div key={p.id} onClick={()=>onSelectProject(p)} className="icard card-stagger card-interactive sa-card-pro sa-lift"
                    style={{padding:"20px 20px 16px",borderRadius:20,cursor:"pointer",position:"relative",display:"flex",flexDirection:"column",gap:14,animationDelay:`${i*0.06}s`}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:13}}>
                      <div className="sa-proj-card-icon" style={{width:44,height:44,borderRadius:13,background:"linear-gradient(135deg,var(--accent-soft),transparent)",border:"1px solid var(--glass-border-accent,var(--border))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,color:"var(--accent-1,var(--text2))",fontWeight:900}}>{icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="icard-title" style={{fontSize:15,fontWeight:800,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{p.name}</div>
                        <div style={{fontSize:10,fontWeight:800,letterSpacing:.5,textTransform:"uppercase",color:"var(--text5)",marginTop:3}}>{roleLabel||t("role_owner","Владелец")}</div>
                      </div>
                      <div className="sa-proj-kebab" style={{position:"relative"}}>
                        <button type="button" aria-haspopup="menu" aria-expanded={kebabId===p.id} aria-label={t("more_actions","Действия")} onClick={(e)=>{e.stopPropagation();setKebabId(kebabId===p.id?null:p.id);}} style={{width:28,height:28,borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:16,lineHeight:1,padding:0}}>⋯</button>
                        {kebabId===p.id&&(
                          <div role="menu" onClick={e=>e.stopPropagation()} style={{position:"absolute",top:32,right:0,minWidth:180,padding:6,borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",boxShadow:"0 12px 32px rgba(0,0,0,.25)",zIndex:50,display:"flex",flexDirection:"column",gap:2}}>
                            <button role="menuitem" onClick={()=>{setKebabId(null);onSelectProject(p);}} style={{textAlign:"left",padding:"8px 10px",borderRadius:8,border:"none",background:"transparent",color:"var(--text)",cursor:"pointer",fontSize:13}}>↗ {t("open","Открыть")}</button>
                            {p.owner===user.email&&(
                              <button role="menuitem" onClick={()=>{setKebabId(null);setRenameId(p.id);setRenameDraft(p.name||"");}} style={{textAlign:"left",padding:"8px 10px",borderRadius:8,border:"none",background:"transparent",color:"var(--text)",cursor:"pointer",fontSize:13}}>✎ {t("rename","Переименовать")}</button>
                            )}
                            <button role="menuitem" onClick={()=>{setKebabId(null);duplicateProject(p);}} style={{textAlign:"left",padding:"8px 10px",borderRadius:8,border:"none",background:"transparent",color:"var(--text)",cursor:"pointer",fontSize:13}}>⎘ {t("duplicate","Дублировать")}</button>
                            {p.owner===user.email&&(
                              <button type="button" role="menuitem" onClick={()=>{setKebabId(null);setDelId(p.id);}} style={{textAlign:"left",padding:"8px 10px",borderRadius:8,border:"none",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:13,display:"inline-flex",alignItems:"center",gap:8}}><IconTrash/> {t("delete","Удалить")}</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {desc&&<div style={{fontSize:12.5,color:"var(--text3)",lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{desc}</div>}
                    <div style={{display:"flex",gap:7}}>
                      <StatBox n={mapsCount} label={t("maps","карт")}/>
                      <StatBox n={scenCount} label={t("scenarios_short","сцен.")}/>
                      <StatBox n={stepsCount} label={t("steps_label","шагов")}/>
                      <StatBox n={membersCount} label={t("members","уч.")}/>
                    </div>
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{fontSize:12,color:"var(--text5)"}}>{t("overall_progress","Общий прогресс")}</span>
                        <span style={{fontSize:12,fontWeight:800,color:"var(--accent-1,#a78bfa)"}}>{pct}%</span>
                      </div>
                      <div className="sa-proj-progress" style={{height:6}}>
                        <div className="sa-proj-progress__fill" style={{width:"100%",["--pp" as any]:(pct/100).toFixed(3)}}/>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:"auto"}}>
                      <span style={{fontSize:11.5,color:"var(--text5)"}}>{editedLabel}</span>
                      <div style={{display:"flex",alignItems:"center"}}>
                        {membersList.slice(0,4).map((mem:any,mi:number)=>{
                          const mInit=((mem.email||"?").trim()[0]||"?").toUpperCase();
                          return<div key={mi} title={mem.email} style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,var(--acc,#a78bfa),var(--acc2,#7c5cff))",border:"1.5px solid var(--card)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9.5,fontWeight:800,color:"#fff",marginLeft:mi?-7:0,flexShrink:0}}>{mInit}</div>;
                        })}
                        {membersList.length>4&&<div style={{width:22,height:22,borderRadius:"50%",background:"var(--surface2)",border:"1.5px solid var(--card)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"var(--text4)",marginLeft:-7}}>+{membersList.length-4}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!loading&&filtered.length>0&&!atLimit&&(
                <button type="button" onClick={()=>setCreating(true)} className="card-stagger" style={{minHeight:200,borderRadius:18,background:"transparent",border:"1.5px dashed var(--border)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:"var(--text4)",transition:"border-color .2s, color .2s"}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--accent-1,#a78bfa)";(e.currentTarget as HTMLElement).style.color="var(--accent-1,#a78bfa)";}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--text4)";}}>
                  <div style={{width:44,height:44,borderRadius:13,border:"1.5px solid currentColor",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:300,lineHeight:1}}>+</div>
                  <div style={{fontSize:13.5,fontWeight:800}}>{t("new_project","Новый проект")}</div>
                </button>
              )}
              {!filtered.length&&!loading&&(
                <div className="card-stagger" style={{gridColumn:"1/-1",textAlign:"center",padding:"64px 24px",color:"var(--text4)",display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
                  <div aria-hidden style={{width:88,height:88,borderRadius:26,background:"linear-gradient(135deg,var(--accent-soft),transparent 80%)",border:"1px solid var(--glass-border-accent,var(--border))",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                    <span style={{position:"absolute",inset:"-30%",background:"radial-gradient(circle,var(--accent-glow),transparent 55%)",animation:"saEmptyPulse 3.6s ease-in-out infinite",pointerEvents:"none"}}/>
                    <span style={{fontSize:36,lineHeight:1,zIndex:1,filter:"drop-shadow(0 2px 8px var(--accent-glow))"}}>✦</span>
                  </div>
                  <div style={{fontSize:16,fontWeight:800,color:"var(--text)",marginTop:4}}>{search.trim()?t("search_empty","Ничего не найдено"):t("no_projects","Нет проектов")}</div>
                  <div style={{fontSize:13.5,maxWidth:340,lineHeight:1.5,color:"var(--text3)"}}>{search.trim()?t("search_try_other","Попробуйте другой запрос или очистите поиск."):t("click_new_project","Нажмите «+ Проект» чтобы начать")}</div>
                  {!search.trim()&&!atLimit&&(
                    <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
                      <button onClick={()=>setCreating(true)} className="btn-smooth" style={{marginTop:8,padding:"11px 22px",borderRadius:12,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:14,fontWeight:700,boxShadow:"0 6px 20px var(--accent-glow)"}}>+ {t("new_project","Новый проект")}</button>
                      <button onClick={()=>setShowAIHub(true)} className="btn-smooth" style={{marginTop:8,padding:"11px 22px",borderRadius:12,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:"var(--accent-1)",cursor:"pointer",fontSize:14,fontWeight:700}}>✦ {t("ask_ai_to_help","Спросить AI с чего начать")}</button>
                    </div>
                  )}
                  {!search.trim()&&projects.length===0&&(
                    <div style={{marginTop:16,maxWidth:520,fontSize:13,color:"var(--text4)",lineHeight:1.6,textAlign:"left"}}>
                      <div style={{fontWeight:800,color:"var(--text2)",marginBottom:8}}>{t("onboard_steps_title","Как начать за 3 шага:")}</div>
                      <div>1. {t("onboard_step1","Создайте проект — это контейнер для карт и контент-плана.")}</div>
                      <div>2. {t("onboard_step2","Откройте карту, добавьте узлы или примените шаблон.")}</div>
                      <div>3. {t("onboard_step3","Запустите AI-чат — он подскажет следующий шаг.")}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>
      {isMobile&&(
        <div role="tablist" aria-label={t("workspace_nav_aria","Разделы приложения")} style={{position:"fixed",left:12,right:12,bottom:10,zIndex:330,display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,padding:8,borderRadius:16,background:"color-mix(in srgb,var(--surface) 92%, transparent)",backdropFilter:"blur(14px)",border:"1px solid var(--border)",boxShadow:"0 10px 28px rgba(0,0,0,.28)"}}>
          <button type="button" role="tab" aria-selected={true} className="btn-interactive" style={{height:42,borderRadius:10,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:"var(--accent-2)",fontSize:11.5,fontWeight:800}}>{t("shell_projects","Проекты")}</button>
          <button type="button" role="tab" aria-selected={false} className="btn-interactive" onClick={()=>onOpenContentPlanHub?.()} style={{height:42,borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",fontSize:11.5,fontWeight:700}}>{t("nav_workspace_content","Контент-план")}</button>
          <button type="button" role="tab" aria-selected={false} className="btn-interactive" onClick={()=>setShowAIHub(true)} style={{height:42,borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",fontSize:11.5,fontWeight:700}}>✦ AI</button>
          <button type="button" role="tab" aria-selected={false} className="btn-interactive" onClick={onProfile} style={{height:42,borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",fontSize:11.5,fontWeight:700}}>{t("profile_title","Профиль")}</button>
        </div>
      )}
      {delId&&<ConfirmDialog title={t("delete_project","Удалить проект?")} message={t("delete_project_desc","Все карты и данные проекта будут удалены без возможности восстановления.")} confirmLabel={t("delete","Удалить")} onConfirm={()=>deleteProj(delId)} onCancel={()=>setDelId(null)} danger={true}/>}
      {renameId&&(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"var(--modal-overlay-bg,rgba(0,0,0,.7))",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(12px)",padding:16}} onClick={e=>{if(e.target===e.currentTarget){setRenameId(null);setRenameDraft("");}}} onKeyDown={e=>{if(e.key==="Escape"){setRenameId(null);setRenameDraft("");}}}>
          <div className="glass-panel" role="dialog" aria-modal="true" aria-label={t("rename_project","Переименовать проект")} data-theme={theme} style={{width:"min(96vw,420px)",borderRadius:18,padding:22}}>
            <div style={{fontSize:15,fontWeight:800,color:"var(--text)",marginBottom:14}}>✎ {t("rename_project","Переименовать проект")}</div>
            <input autoFocus value={renameDraft} onChange={e=>setRenameDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){renameProject(renameId,renameDraft);setRenameId(null);}else if(e.key==="Escape"){setRenameId(null);setRenameDraft("");}}} placeholder={t("project_name","Название")} style={{width:"100%",padding:"10px 14px",fontSize:14,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:10,color:"var(--text)",outline:"none",fontFamily:"inherit",marginBottom:14}}/>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button type="button" onClick={()=>{setRenameId(null);setRenameDraft("");}} style={{padding:"9px 18px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text2)",cursor:"pointer",fontSize:13,fontWeight:600}}>{t("cancel","Отмена")}</button>
              <button type="button" disabled={!renameDraft.trim()} onClick={()=>{renameProject(renameId,renameDraft);setRenameId(null);}} style={{padding:"9px 22px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:renameDraft.trim()?"pointer":"not-allowed",fontSize:13,fontWeight:800,opacity:renameDraft.trim()?1:.5}}>{t("save","Сохранить")}</button>
            </div>
          </div>
        </div>
      )}
      {showBriefing&&lastMapData&&(
        <WeeklyBriefingModal
          nodes={lastMapData.nodes||[]}
          mapName={lastMapData.name||t("map_default","Карта")}
          user={user}
          onClose={()=>setShowBriefing(false)}
          theme={theme}
          onError={(msg)=>{setToast({msg,type:"error"});setTimeout(()=>setToast(null),4000);}}
        />
      )}

      {showNotifs&&(
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
              if(open==="contentplan"){
                if(!projectId&&onOpenContentPlanHub){setShowNotifs(false);onOpenContentPlanHub();return;}
                if(projectId&&onOpenContentPlanProject){
                  const p=projects.find((x:any)=>x.id===projectId);
                  if(p){setShowNotifs(false);onOpenContentPlanProject(p,(maps as any)[p.id]||[]);return;}
                }
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
        <AiHubModal open={showAIHub} onClose={()=>setShowAIHub(false)} isMobile={isMobile} t={t} hint={t("ai_hub_hint","Этот чат общий для всего приложения. Здесь AI видит портфель проектов и загруженные карты.")}>
          <AiPanel
            embedded={true}
            isMobile={isMobile}
            nodes={aiNodes}
            edges={aiEdges}
            ctx={aiCtx}
            tier={user?.tier||"free"}
            projectName={t("all_projects","Все проекты")}
            mapName=""
            userName={user?.name||user?.email||""}
            msgs={aiChatMsgs||[]}
            onMsgsChange={aiChatSetMsgs||(()=>{})}
            onAddNode={()=>{}}
            onClose={()=>{}}
            externalMsgs={[]}
            onClearExternal={()=>{}}
            onError={()=>{}}
            statusMap={getSTATUS(t)}
          />
        </AiHubModal>
      )}
      <FloatingAiAssistant t={t} variant="app" onOpenFullChat={() => setShowAIHub(true)} />
    </>
  );
  return shellUi?(
    <div className={"sa-strategy-ui sa-v-app "+(theme==="dark"?"dk":"lt")} data-theme={theme} style={{width:"100%",height:"100%",minHeight:"100vh",maxHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden"}}>
      <StrategyShellBg/>
      <div className="sa-app" style={{flex:1,minHeight:0,minWidth:0,display:"flex",overflow:"hidden",position:"relative",zIndex:1}}>
        <StrategyShellSidebar
          theme={theme}
          onToggleTheme={onToggleTheme}
          activeNav="projects"
          onNavigate={handleProjectsShellNav}
          tierLabel={tier.label}
          tierColor={tier.color}
          onTierClick={onProfile}
          lang={lang}
          onLang={code=>setLang(code)}
          userName={user.name||""}
          userEmail={user.email||""}
          scenarioCount={scenarioBadgeCount}
          projectCount={myCount}
          onUserCard={onProfile}
          onLogout={onLogout}
          showContentPlan={!!onOpenContentPlanHub}
          onContentPlan={onOpenContentPlanHub?()=>onOpenContentPlanHub():undefined}
          showTrialBanner={(user?.tier||"free")==="free"}
          onLogoClick={() => { try { document.querySelector(".sa-main .scr")?.scrollTo({ top: 0, behavior: "smooth" }); } catch {} }}
          t={t}
        />
        <div className="sa-main" style={{flex:1,minWidth:0,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>{_projMain}</div>
      </div>
    </div>
  ):(
    <div className={"sa-strategy-ui "+(theme==="dark"?"dk":"lt")} data-theme={theme} style={{width:"100%",maxWidth:"100%",boxSizing:"border-box",height:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden",position:"relative"}}>
      <StrategyShellBg/>
      <div style={{flex:1,minHeight:0,minWidth:0,display:"flex",flexDirection:"column",position:"relative",zIndex:1,overflow:"hidden"}}>{_projMain}</div>
    </div>
  );
}

// ── ProjectDetail ──
export function ProjectDetail({user,project,onBack,onOpenMap,onProfile,theme,onToggleTheme,onChangeTier,onUpgrade,onOpenContentPlanHub,onOpenContentPlanProject,aiChatMsgs,aiChatSetMsgs}){
  const{t,lang}=useLang();
  const isMobile=useIsMobile();
  const[maps,setMaps]=useState<MapLite[]>([]);
  const[loading,setLoading]=useState(true);
  const[tab,setTab]=useState<"maps"|"scenarios"|"content"|"ai"|"team"|"settings">("maps");
  const[proj,setProj]=useState<ProjectLite>(project);
  const[newMember,setNewMember]=useState("");
  const[nmRole,setNmRole]=useState("editor");
  const[showTmpls,setShowTmpls]=useState(false);
  const[showScChoice,setShowScChoice]=useState(false);
  const[showScTmpls,setShowScTmpls]=useState(false);
  const[projCtx,setProjCtx]=useState("");
  const[toast,setToast]=useState<{msg:string;type:string}|null>(null);
  const[delMapId,setDelMapId]=useState<string|null>(null);
  const[delProjConfirm,setDelProjConfirm]=useState(false);
  const[showNotifs,setShowNotifs]=useState(false);
  const{notifs,setNotifs,notifUnread,setNotifUnread,notifLoading,loadNotifications}=useNotifications(showNotifs,user?.email);
  const creatingRef=useRef(false);

  const tier=TIERS[user.tier]||TIERS.free;
  const ROLES=getROLES(t);
  const isOwner=proj.owner===user.email;
  const myRole=proj.members?.find(m=>m.email===user.email)?.role||"owner";
  const canEdit=myRole==="owner"||myRole==="editor";

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const ms=await getMaps(proj.id);
    setMaps(ms);
    const first=ms.find(m=>!m.isScenario);
    if(first?.ctx)setProjCtx(first.ctx);
    setLoading(false);
  }

  async function createMap(tmpl=null){
    if(creatingRef.current)return;
    creatingRef.current=true;
    try{
      const cur=await getMaps(proj.id);
      const reg=cur.filter(m=>!m.isScenario);
      if(reg.length>=tier.maps){setToast({msg:t("map_limit_tier","Лимит карт для {tier}: {n}").replace("{tier}",tier.label).replace("{n}",String(fmt(tier.maps))),type:"warn"});return;}
      const map={id:uid(),name:tmpl?tmpl.name:t("map_default_n","Карта {n}").replace("{n}",String(reg.length+1)),nodes:tmpl?.nodes||[],edges:tmpl?.edges||[],ctx:"",isScenario:false,createdAt:Date.now()};
      const saved=await saveMap(proj.id,map);
      if(tmpl){await load();setToast({msg:t("template_applied","Шаблон «{name}» применён!").replace("{name}",tmpl.name),type:"success"});}
      else onOpenMap(saved,proj,true,myRole==="viewer");
    }finally{creatingRef.current=false;}
  }

  async function createBlankScenario(){
    setShowScChoice(false);
    const sc=(await getMaps(proj.id)).filter(m=>m.isScenario);
    const map={id:uid(),name:t("scenario_default_n","Сценарий {n}").replace("{n}",String(sc.length+1)),nodes:[],edges:[],ctx:"",isScenario:true,createdAt:Date.now()};
    const saved=await saveMap(proj.id,map);
    onOpenMap(saved,proj,true,myRole==="viewer");
  }

  async function createScenarioFromTemplate(parsed){
    setShowScTmpls(false);setShowScChoice(false);
    const sc=(await getMaps(proj.id)).filter(m=>m.isScenario);
    const name=parsed.scenarioName?`${parsed.scenarioIcon} ${parsed.scenarioName}`:t("scenario_default_n","Сценарий {n}").replace("{n}",String(sc.length+1));
    const map={id:uid(),name,nodes:parsed.nodes||[],edges:parsed.edges||[],ctx:"",isScenario:true,createdAt:Date.now()};
    const saved=await saveMap(proj.id,map);
    await load();
    setToast({msg:t("scenario_created","Сценарий «{name}» создан!").replace("{name}",name),type:"success"});
    onOpenMap(saved,proj,false,myRole==="viewer");
  }

  async function tryCreateScenario(){
    if(tier.scenarios===0){setToast({msg:t("scenarios_pro","Сценарии доступны с Pro"),type:"warn"});return;}
    const sc=(await getMaps(proj.id)).filter(m=>m.isScenario);
    if(sc.length>=tier.scenarios){setToast({msg:t("scenario_limit","Лимит сценариев для тарифа")+" "+tier.label+": "+fmt(tier.scenarios),type:"warn"});return;}
    setShowScChoice(true);
  }

  async function delMap(id){setDelMapId(id);}
  async function doDelMap(){
    if(!delMapId)return;
    await deleteMap(proj.id,delMapId);
    await load();
    setDelMapId(null);
  }

  async function addMember(){
    if(!newMember.trim())return;
    if((proj.members||[]).length>=tier.users){setToast({msg:t("members_limit","Лимит участников: {n}").replace("{n}",String(tier.users)),type:"warn"});return;}
    if(proj.members?.find(m=>m.email===newMember.trim())){setToast({msg:t("member_added_already","Участник уже добавлен"),type:"info"});return;}
    if(API_BASE){
      const updated=await addProjectMember(proj.id,newMember.trim(),nmRole);
      if(updated){setProj(updated);setNewMember("");setToast({msg:t("member_added","Участник добавлен"),type:"success"});}
      else setToast({msg:t("member_add_err","Ошибка добавления"),type:"error"});
    }else{
      const updated={...proj,members:[...(proj.members||[]),{email:newMember.trim(),role:nmRole}]};
      await saveProject(updated);setProj(updated);setNewMember("");
    }
  }

  async function removeMember(email){
    if(email===proj.owner)return;
    if(API_BASE){
      const updated=await removeProjectMember(proj.id,email);
      if(updated)setProj(updated);
    }else{
      const updated={...proj,members:(proj.members||[]).filter(m=>m.email!==email)};
      await saveProject(updated);setProj(updated);
    }
  }

  const regularMaps=maps.filter(m=>!m.isScenario);
  const scenarios=maps.filter(m=>m.isScenario);

  // Stats
  const allNodes=maps.flatMap(m=>m.nodes||[]);
  const allEdges=maps.flatMap(m=>m.edges||[]);
  const totalNodes=allNodes.length;
  const doneNodes=allNodes.filter(n=>n.status==="completed").length;
  const avgProgress=totalNodes?Math.round(allNodes.reduce((s,n)=>s+(n.progress||0),0)/totalNodes):0;
  const overdueCount=allNodes.filter(n=>n.deadline&&new Date(n.deadline)<new Date()&&n.status!=="completed").length;

  function MapCard({m,isSc,staggerIndex=0}){
    const ns=m.nodes||[];
    const done=ns.filter(n=>n.status==="completed").length;
    const prog=ns.length?Math.round(ns.reduce((s,n)=>s+(n.progress||0),0)/ns.length):0;
    const overdue=ns.filter(n=>n.deadline&&new Date(n.deadline)<new Date()&&n.status!=="completed").length;
    return(
      <div className={"card-stagger sa-map-card sa-map-card-pro sa-lift"+(isSc?" sa-map-card--sc":"")} style={{padding:"20px 22px",cursor:"pointer",animationDelay:`${staggerIndex*0.05}s`,borderColor:isSc?"rgba(104,54,245,.35)":undefined}}
        onClick={()=>onOpenMap(m,proj,false,myRole==="viewer")}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:"var(--accent-soft)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,border:"1px solid var(--glass-border-accent,var(--border))"}}>
            {isSc?"⎇":"🗺️"}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13.5,fontWeight:800,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name||t("untitled","Без названия")}</div>
            <div style={{fontSize:13.5,color:"var(--text5)"}}>{ns.length} {t("steps_label","шагов")} • {t("updated_label","обновлено")} {(()=>{const ts=toMs((m as any).updatedAt||(m as any).updated_at);return ts?new Date(ts).toLocaleDateString(lang==="en"?"en-US":lang==="uz"?"uz-UZ":"ru",{day:"2-digit",month:"short"}):"—";})()}</div>
          </div>
          {canEdit&&<button type="button" className="sa-map-card__del" onClick={e=>{e.stopPropagation();delMap(m.id);}} aria-label={t("confirm_delete_map","Удалить карту?")} style={{width:22,height:22,borderRadius:5,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"var(--red)",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",opacity:0,transition:"opacity .22s ease"}}><IconTrash size={12}/></button>}
        </div>
        {ns.length>0&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:13,color:"var(--text5)"}}>{t("progress","Прогресс")}</span>
              <span style={{fontSize:13,fontWeight:700,color:"var(--text4)"}}>{prog}%</span>
            </div>
            <div style={{height:4,borderRadius:2,background:"var(--surface2)",overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,background:"var(--gradient-accent)",width:`${prog}%`,transition:"width .3s"}}/>
            </div>
          </div>
        )}
        {overdue>0&&<div style={{marginTop:7,fontSize:13.5,color:"var(--danger,#f04458)",fontWeight:600}}>⚠ {overdue} просрочено</div>}
      </div>
    );
  }

  return(
    <div className={"sa-strategy-ui "+(theme==="dark"?"dk":"lt")} data-theme={theme} style={{minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",position:"relative",overflowX:"hidden"}}>
      <StrategyShellBg/>
      <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
{toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}

      <div className="sa-app-topbar">
        <div className="atb-cluster" style={{minWidth:0,flex:isMobile?"1 1 100%":"1 1 auto",maxWidth:isMobile?"100%":"46%"}}>
          <button type="button" className="sa-back-ic" onClick={onBack} aria-label={t("back_btn","Назад")}>←</button>
          <div style={{minWidth:0}}>
            <div className="tb-title" style={{fontSize:isMobile?14:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.name||t("project_short","Проект")}</div>
            <div className="tb-sub">{t("pd_sub_maps","{n} карт").replace("{n}",String(regularMaps.length))} • {t("pd_sub_sc","{n} сцен.").replace("{n}",String(scenarios.length))} • {t("pd_sub_m","{n} уч.").replace("{n}",String((proj.members||[]).length))}</div>
          </div>
        </div>
        {!isMobile&&onOpenContentPlanHub&&(
          <div style={{flex:"1 1 180px",display:"flex",justifyContent:"center",minWidth:0}}>
            <MainWorkspaceNav mode="strategy" onStrategy={()=>{}} onContentPlan={onOpenContentPlanHub} t={t} isMobile={false}/>
          </div>
        )}
        <div className="atb-cluster" style={{marginLeft:isMobile?"auto":undefined}}>
          <div className="tpill" onClick={onToggleTheme} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")onToggleTheme();}} aria-label={t("toggle_theme","Тема")}>
            <div className={`tpi${theme==="dark"?" on":""}`}>☽</div>
            <div className={`tpi${theme==="light"?" on":""}`}>☀</div>
          </div>
          {API_BASE&&<NotifBell unread={notifUnread} onClick={()=>setShowNotifs(true)} className="btn-ic"/>}
          <button type="button" className="btn-ic" onClick={onProfile} title={t("profile_title","Профиль")} aria-label={t("profile_title","Профиль")} style={{fontSize:14,fontWeight:900}}>{(user.name||user.email||"U")[0].toUpperCase()}</button>
        </div>
      </div>
      {isMobile&&onOpenContentPlanHub&&(
        <div style={{padding:"10px 16px",borderBottom:".5px solid var(--b1)",background:"var(--top)",display:"flex",justifyContent:"center"}}>
          <MainWorkspaceNav mode="strategy" onStrategy={()=>{}} onContentPlan={onOpenContentPlanHub} t={t} isMobile={true}/>
        </div>
      )}

      <div className="sa-page-reveal sa-pr-d1" style={{maxWidth:1000,width:"100%",margin:"0 auto",padding:isMobile?"18px 20px 0":"24px 32px 0"}}>
        <div className="sa-bento sa-bento--4" style={{gap:isMobile?12:16}}>
          {[
            {icon:"📈",label:t("overall_progress","Общий прогресс"),val:`${avgProgress}%`,sub:overdueCount>0?t("overdue_n","{n} просрочено").replace("{n}",String(overdueCount)):t("on_track","в графике"),color:avgProgress>=60?"#34d399":avgProgress>=30?"#fbbf24":"#a78bfa"},
            {icon:"◈",label:t("total_steps","Всего шагов"),val:totalNodes,sub:t("completed_n","{n} завершено").replace("{n}",String(doneNodes)),color:"#22d3ee"},
            {icon:"🗺️",label:t("strategy_maps","Стратегические карты"),val:regularMaps.length,sub:t("pd_sub_sc","{n} сцен.").replace("{n}",String(scenarios.length)),color:"#a78bfa"},
            {icon:"👥",label:t("members","участников"),val:(proj.members||[]).length||1,sub:isOwner?t("role_owner","Владелец"):(ROLES[myRole]?.label||""),color:"#fbbf24"},
          ].map(s=>(
            <div key={s.label} className="sa-dash-stat sa-card-pro sa-lift" style={{borderRadius:20,padding:isMobile?14:20,display:"flex",flexDirection:"column",gap:8,minWidth:0}}>
              <div style={{fontSize:17}} aria-hidden>{s.icon}</div>
              <div style={{fontSize:isMobile?22:28,fontWeight:900,color:s.color,letterSpacing:-1,lineHeight:1}}>{s.val}</div>
              <div>
                <div style={{fontSize:10.5,fontWeight:800,letterSpacing:.6,textTransform:"uppercase",color:"var(--text4)"}}>{s.label}</div>
                {s.sub&&<div style={{fontSize:11.5,color:"var(--text3)",marginTop:2}}>{s.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sa-proj-tabs sa-page-reveal sa-pr-d2" role="tablist">
        {([
          ["maps",isMobile?`🗺 (${regularMaps.length})`:`🗺 ${t("pd_tab_maps","Карты")} (${regularMaps.length})`],
          ["scenarios",isMobile?`⎇ (${scenarios.length})`:`⎇ ${t("pd_tab_scenarios","Сценарии")} (${scenarios.length})`],
          ["content",isMobile?"✍️":"✍️ "+t("content_plan_tab","Контент-план")],
          ["ai",isMobile?"✦":"✦ "+t("project_ai_tab","AI")],
          ["team",isMobile?`👥 (${(proj.members||[]).length})`:`👥 ${t("pd_tab_team","Команда")} (${(proj.members||[]).length})`],
          ["settings","⚙ "+t("settings_title","Настройки")],
        ] as const).map(([k,lbl])=>(
          <button key={k} type="button" role="tab" aria-selected={tab===k} className={tab===k?"on":""} onClick={()=>setTab(k as any)}>{lbl}</button>
        ))}
      </div>

      <div className="sa-page-reveal sa-pr-d3" style={{maxWidth:1000,margin:"0 auto",padding:isMobile?"24px 20px":"36px 32px",flex:1}}>
        {/* Maps Tab */}
        {tab==="maps"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{flex:1,fontSize:13,fontWeight:700,color:"var(--text)"}}>{t("strategy_maps","Стратегические карты")}</div>
              {canEdit&&tier.templates&&<button onClick={()=>setShowTmpls(true)} style={{padding:"7px 14px",borderRadius:9,border:"1px solid rgba(245,158,11,.25)",background:"rgba(245,158,11,.07)",color:"#fbbf24",cursor:"pointer",fontSize:13,fontWeight:700}}>📋 Из шаблона</button>}
              {canEdit&&<button className="btn-interactive" onClick={()=>createMap()} style={{padding:"7px 16px",borderRadius:9,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 2px 12px var(--accent-glow)"}}>+ {t("new_map","Новая карта")}</button>}
            </div>
            {loading?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                {[1,2,3].map(i=><div key={i} style={{height:140,borderRadius:14,background:"var(--surface)",animation:"pulse 1.5s ease infinite",border:"1px solid var(--border)"}}/>)}
              </div>
            ):regularMaps.length===0?(
              <div className="sa-empty-state">
                <div style={{fontSize:36,marginBottom:10}}>🗺️</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text3)",marginBottom:6}}>{t("no_maps","Нет карт")}</div>
                <div style={{fontSize:13,color:"var(--text5)",marginBottom:16,maxWidth:320,margin:"0 auto 16px"}}>{t("create_first_map","Создайте первую стратегическую карту")}. {t("create_first_map_hint","Добавьте шаги, свяжите их — AI подскажет следующий ход.")}</div>
                {canEdit&&<button className="btn-interactive" onClick={()=>createMap()} style={{padding:"9px 20px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 4px 18px var(--accent-glow)"}}>+ {t("create_map","Создать карту")}</button>}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:isMobile?16:20}}>
                {regularMaps.map((m,i)=><MapCard key={m.id} m={m} isSc={false} staggerIndex={i}/>)}
              </div>
            )}
            {(()=>{
              const acts=[...maps].filter(m=>(m as any).updatedAt||(m as any).updated_at).map(m=>({name:m.name||t("untitled","Без названия"),at:(m as any).updatedAt||(m as any).updated_at,n:(m.nodes||[]).length})).sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,5);
              if(acts.length===0)return null;
              return(
                <div style={{marginTop:28}}>
                  <div style={{fontSize:11,fontWeight:800,letterSpacing:.8,textTransform:"uppercase",color:"var(--text4)",marginBottom:12}}>{t("dash_recent_activity","Недавняя активность")}</div>
                  <div className="sa-panel" style={{padding:"6px 16px"}}>
                    {acts.map((a,i)=>{
                      const diff=Date.now()-(a.at||0);const h=Math.floor(diff/3.6e6);const d=Math.floor(h/24);
                      const rel=h<1?t("just_now","только что"):h<24?t("hours_ago","{n} ч. назад").replace("{n}",String(h)):d===1?t("yesterday","вчера"):t("days_ago_n","{n} дн. назад").replace("{n}",String(d));
                      return(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<acts.length-1?"1px solid var(--border)":"none"}}>
                          <div style={{width:30,height:30,borderRadius:9,background:"var(--surface2)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}} aria-hidden>🗺️</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13.5,fontWeight:700,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                            <div style={{fontSize:12,color:"var(--text4)"}}>{t("dash_nodes_count","{n} узлов").replace("{n}",String(a.n))}</div>
                          </div>
                          <div style={{fontSize:11.5,color:"var(--text5)",flexShrink:0}}>{rel}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Scenarios Tab */}
        {tab==="scenarios"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Сценарии</div>
                <div style={{fontSize:13,color:"var(--text5)"}}>{t("alt_strategies","Альтернативные стратегии и планы «что если»")}</div>
              </div>
              {canEdit&&(
                tier.scenarios===0?(
                  <button onClick={()=>onUpgrade&&onUpgrade()} style={{padding:"7px 14px",borderRadius:9,border:"1px solid rgba(245,158,11,.25)",background:"rgba(245,158,11,.07)",color:"#fbbf24",cursor:"pointer",fontSize:13,fontWeight:700}}>🔒 Pro+</button>
                ):(
                  <button className="btn-interactive" onClick={tryCreateScenario} style={{padding:"7px 16px",borderRadius:9,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 2px 12px var(--accent-glow)"}}>+ {t("new_scenario","Новый сценарий")}</button>
                )
              )}
            </div>
            {tier.scenarios===0?(
              <div className="sa-empty-state" style={{borderColor:"color-mix(in srgb,var(--accent-1) 35%,var(--border))",background:"color-mix(in srgb,var(--accent-soft) 40%,var(--surface))"}}>
                <div style={{fontSize:36,marginBottom:10}}>⎇</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text3)",marginBottom:6}}>{t("scenarios_pro","Сценарии доступны с Pro")}</div>
                <div style={{fontSize:13,color:"var(--text5)",marginBottom:16,maxWidth:300,margin:"0 auto 16px"}}>Создавайте альтернативные планы: «Что если потеряем ключевого клиента?» или «Что если вырастем ×3 за год?»</div>
                {onUpgrade&&<button className="btn-interactive" onClick={onUpgrade} style={{padding:"9px 20px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 4px 18px var(--accent-glow)"}}>{t("upgrade_to_pro","Перейти на Pro")}</button>}
              </div>
            ):scenarios.length===0?(
              <div className="sa-empty-state">
                <div style={{fontSize:36,marginBottom:10}}>⎇</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text3)",marginBottom:6}}>{t("no_scenarios","Нет сценариев")}</div>
                <div style={{fontSize:13,color:"var(--text5)",marginBottom:16}}>{t("create_first_scenario","Создайте первый сценарий вручную или с помощью AI шаблонов")}</div>
                {canEdit&&<button className="btn-interactive" onClick={tryCreateScenario} style={{padding:"9px 20px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 4px 18px var(--accent-glow)"}}>+ {t("create_scenario","Создать сценарий")}</button>}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(260px,1fr))",gap:isMobile?16:12}}>
                {scenarios.map((m,i)=><MapCard key={m.id} m={m} isSc={true} staggerIndex={i}/>)}
              </div>
            )}
          </div>
        )}

        {/* Content Plan Tab (Pro+) */}
        {tab==="content"&&(
          <div>
            {!tier.contentPlan?(
              <div className="sa-empty-state" style={{background:"color-mix(in srgb,var(--accent-soft) 50%,var(--surface))"}}>
                <div style={{fontSize:36,marginBottom:10}}>✍️</div>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text3)",marginBottom:6}}>{t("content_plan_locked_title","Контент-план доступен на Pro")}</div>
                <div style={{fontSize:13,color:"var(--text5)",marginBottom:16,maxWidth:360,margin:"0 auto 16px"}}>{t("content_plan_pro_only","Приложение использует знания о вашем бизнесе и стратегии для планирования постов.")}</div>
                {onUpgrade&&<button className="btn-interactive" onClick={onUpgrade} style={{padding:"9px 20px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 4px 18px var(--accent-glow)"}}>{t("upgrade_to_pro","Перейти на Pro")}</button>}
              </div>
            ):(
              <>
                {onOpenContentPlanProject&&(
                  <div className="sa-card-pro sa-lift" style={{display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"stretch":"center",gap:14,padding:"14px 18px",borderRadius:18,marginBottom:20}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13.5,fontWeight:800,color:"var(--text)",marginBottom:4}}>{t("cp_workspace_banner_title","Отдельный раздел «Контент-план»")}</div>
                      <div style={{fontSize:12.5,color:"var(--text5)",lineHeight:1.45}}>{t("cp_workspace_banner_hint","Тот же план в полноэкранном режиме — как карта: удобно вести ленту и календарь без переключения вкладок.")}</div>
                    </div>
                    <button type="button" className="btn-interactive" onClick={()=>onOpenContentPlanProject(proj,maps)} style={{padding:"10px 18px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:800,whiteSpace:"nowrap",boxShadow:"0 2px 14px var(--accent-glow)",flexShrink:0}}>{t("cp_open_workspace","Открыть раздел →")}</button>
                  </div>
                )}
                <ContentPlanTab projectId={proj.id} projectName={proj.name||"Проект"} maps={maps} user={user} theme={theme} lang={lang} t={t} onChangeTier={onChangeTier}/>
              </>
            )}
          </div>
        )}

        {/* AI Tab */}
        {tab==="ai"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="sa-panel" style={{padding:"14px 18px"}}>
              <div style={{fontSize:14,fontWeight:900,color:"var(--text)",display:"flex",alignItems:"center",gap:10}}>
                <span style={{width:28,height:28,borderRadius:8,background:"var(--gradient-accent)",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"var(--accent-on-bg)",boxShadow:"0 2px 12px var(--accent-glow)",fontWeight:900}}>✦</span>
                {t("project_ai_title","AI по проекту")}
              </div>
              <div style={{fontSize:13.5,color:"var(--text5)",marginTop:6}}>
                {t("project_ai_hint","Один и тот же чат, доступен и в карте. Здесь AI видит контекст всех карт проекта.")}
              </div>
            </div>
            <div className="sa-ai-chat-shell">
              <AiPanel
                embedded={true}
                isMobile={isMobile}
                nodes={allNodes}
                edges={allEdges}
                ctx={projCtx||""}
                tier={user?.tier||"free"}
                projectName={proj?.name||""}
                mapName={t("project_scope","Проект")}
                userName={user?.name||user?.email||""}
                msgs={aiChatMsgs||[]}
                onMsgsChange={aiChatSetMsgs||(()=>{})}
                onAddNode={()=>{}}
                onClose={()=>{}}
                externalMsgs={[]}
                onClearExternal={()=>{}}
                onError={(msg)=>setToast({msg,type:"error"})}
                statusMap={getSTATUS(t)}
              />
            </div>
          </div>
        )}

        {/* Team Tab */}
        {tab==="team"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {(proj.members||[]).map(m=>(
              <div key={m.email} className="sa-card-pro sa-lift" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:14}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--accent-on-bg)",fontWeight:900,flexShrink:0,boxShadow:"0 2px 10px var(--accent-glow)"}}>{(m.email||"?")[0].toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13.5,fontWeight:700,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.email}</div>
                  <div style={{fontSize:13.5,color:"var(--text5)"}}>{m.role==="owner"?t("role_owner","Владелец"):m.role==="editor"?t("role_editor","Редактор"):t("observer","Наблюдатель")}</div>
                </div>
                {isOwner&&m.email!==proj.owner&&(
                  <div style={{display:"flex",gap:6}}>
                    <select value={m.role} onChange={async e=>{const updated={...proj,members:(proj.members||[]).map(x=>x.email===m.email?{...x,role:e.target.value}:x)};try{await saveProject(updated);setProj(updated);}catch(err:any){setToast({msg:err?.message||t("save_error","Ошибка сохранения"),type:"error"});}}} style={{padding:"4px 8px",borderRadius:6,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:13,cursor:"pointer"}}>
                      <option value="editor">{t("role_editor","Редактор")}</option>
                      <option value="viewer">{t("observer","Наблюдатель")}</option>
                    </select>
                    <button onClick={()=>removeMember(m.email)} style={{width:26,height:26,borderRadius:6,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"#f04458",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                  </div>
                )}
              </div>
            ))}
            {isOwner&&(
              <div className="sa-panel" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"12px 16px",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontSize:13.5,fontWeight:700,color:"var(--text)"}}>🔗 {t("invite_link","Ссылка-приглашение")}</div>
                  <div style={{fontSize:12,color:"var(--text5)"}}>{t("invite_link_desc","Скопируйте и отправьте — пригласите команду одной ссылкой.")}</div>
                </div>
                <button type="button" onClick={async()=>{
                  const url=`${window.location.origin}/?join=${proj.id}`;
                  try{await navigator.clipboard.writeText(url);setToast({msg:t("link_copied","Ссылка скопирована"),type:"success"});}
                  catch{setToast({msg:url,type:"info"});}
                }} className="btn-interactive" style={{padding:"8px 14px",borderRadius:10,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:"var(--accent-1)",cursor:"pointer",fontSize:12.5,fontWeight:800}}>{t("copy_link","Скопировать")}</button>
              </div>
            )}
            {isOwner&&(proj.members||[]).length<tier.users&&(
              <div className="sa-panel" style={{display:"flex",gap:9,padding:"12px 16px",border:"1px dashed color-mix(in srgb,var(--accent-1) 30%,var(--border))"}}>
                <input value={newMember} onChange={e=>setNewMember(e.target.value)} placeholder="Email участника" onKeyDown={e=>{if(e.key==="Enter")addMember();}} style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--input-bg)",color:"var(--text)",fontSize:13,outline:"none"}}/>
                <select value={nmRole} onChange={e=>setNmRole(e.target.value)} style={{padding:"8px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:13}}>
                  <option value="editor">{t("role_editor","Редактор")}</option>
                  <option value="viewer">{t("observer","Наблюдатель")}</option>
                </select>
                <button className="btn-interactive" onClick={addMember} style={{padding:"8px 14px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:900,boxShadow:"0 2px 12px var(--accent-glow)"}}>{t("add","Добавить")}</button>
              </div>
            )}
            {(proj.members||[]).length>=tier.users&&<div style={{fontSize:13.5,color:"var(--text5)",textAlign:"center",padding:"8px",borderRadius:8,border:"1px dashed var(--border2)"}}>{t("member_limit","Лимит участников для {plan}: {n}.").replace("{plan}",tier.label).replace("{n}",String(tier.users))} <span onClick={()=>onUpgrade&&onUpgrade()} style={{color:"var(--accent-2)",cursor:"pointer",fontWeight:700}}>{t("upgrade_tier_arrow","Улучшить тариф →")}</span></div>}
          </div>
        )}

        {/* Settings Tab */}
        {tab==="settings"&&(
          <div className="sa-panel" style={{display:"flex",flexDirection:"column",gap:14,maxWidth:520}}>
            <div>
              <div style={{fontSize:11,fontWeight:800,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>{t("project_name_label","Название проекта")}</div>
              <input value={proj.name||""} onChange={e=>setProj(p=>({...p,name:e.target.value}))} onBlur={async()=>{try{await saveProject(proj);setToast({msg:t("saved_ok","Сохранено"),type:"success"});}catch(e:any){setToast({msg:e?.message||t("save_error","Ошибка сохранения"),type:"error"});}}} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid color-mix(in srgb,var(--border) 75%,var(--accent-1) 25%)",background:"var(--input-bg)",color:"var(--text)",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:800,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Тариф</div>
              <div className="sa-card-pro" style={{padding:"12px 16px",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{TIERS[user.tier]?.label||"Free"}</div>
                  <div style={{fontSize:13,color:"var(--text5)"}}>до {fmt(tier.maps)} карт • {fmt(tier.scenarios)} сценариев • {fmt(tier.users)} участников</div>
                </div>
                {onUpgrade&&<button className="btn-interactive" onClick={onUpgrade} style={{padding:"6px 14px",borderRadius:10,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:13,fontWeight:900,boxShadow:"0 2px 12px var(--accent-glow)"}}>{t("upgrade_plan","Улучшить")}</button>}
              </div>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:800,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>{t("share_section","Поделиться (read-only)")}</div>
              <div className="sa-card-pro" style={{padding:"12px 16px",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{t("share_link_title","Ссылка только для чтения")}</div>
                  <div style={{fontSize:12.5,color:"var(--text5)"}}>{t("share_link_desc","Любой с этой ссылкой увидит карты и контент-план без возможности редактировать.")}</div>
                </div>
                <button onClick={async()=>{
                  const url=`${window.location.origin}/?share=${proj.id}`;
                  try{await navigator.clipboard.writeText(url);setToast({msg:t("link_copied","Ссылка скопирована"),type:"success"});setTimeout(()=>setToast(null),2500);}
                  catch{setToast({msg:url,type:"info"});setTimeout(()=>setToast(null),5000);}
                }} className="btn-interactive" style={{padding:"8px 14px",borderRadius:10,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:"var(--accent-1)",cursor:"pointer",fontSize:12.5,fontWeight:800}}>🔗 {t("copy_link","Скопировать")}</button>
              </div>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:800,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>{t("versions_section","Версии карт")}</div>
              <div className="sa-card-pro" style={{padding:"12px 16px",borderRadius:14,fontSize:12.5,color:"var(--text4)"}}>
                {regularMaps.length===0
                  ? t("versions_no_maps","Сначала создайте карту — версии хранятся для каждой карты.")
                  : t("versions_open_in_map","История версий доступна в редакторе карты — кнопка 📜 на верхней панели.")
                }
              </div>
            </div>
            {isOwner&&(
              <button type="button" onClick={()=>setDelProjConfirm(true)} style={{padding:"10px",borderRadius:10,border:"1px solid rgba(239,68,68,.25)",background:"rgba(239,68,68,.05)",color:"var(--red)",cursor:"pointer",fontSize:13,fontWeight:700,marginTop:10,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8}}><IconTrash/> {t("delete_project","Удалить проект")}</button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showTmpls&&<TemplateModal tier={user.tier} onSelect={(t)=>{setShowTmpls(false);if(t)createMap(t);}} onClose={()=>setShowTmpls(false)} theme={theme}/>}
      {showScTmpls&&<ScenarioTemplatesModal onSelect={createScenarioFromTemplate} onClose={()=>{setShowScTmpls(false);setShowScChoice(false);}} mapCtx={projCtx} theme={theme}/>}
      {delMapId&&<ConfirmDialog title={t("confirm_delete_map","Удалить карту?")} message={t("confirm_delete_map_desc","Карта будет удалена без возможности восстановления.")} confirmLabel={t("delete","Удалить")} onConfirm={doDelMap} onCancel={()=>setDelMapId(null)} danger={true}/>}
      {delProjConfirm&&<ConfirmDialog title={t("delete_project","Удалить проект?")} message={t("confirm_delete_proj","Все карты и данные проекта будут удалены безвозвратно.")} confirmLabel={t("delete","Удалить")} onConfirm={async()=>{await deleteProject(proj.id);setDelProjConfirm(false);onBack();}} onCancel={()=>setDelProjConfirm(false)} danger={true}/>}

      {showNotifs&&(
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
          deleteGlyph="×"
          onFollowLink={async(n:any)=>{
            if(!n.link)return;
            try{
              const u=new URL(n.link,window.location.origin);
              const open=(u.searchParams.get("open")||"").toLowerCase();
              const projectId=u.searchParams.get("projectId")||"";
              const mapId=u.searchParams.get("mapId")||"";
              const nodeId=u.searchParams.get("nodeId")||"";
              if(open==="map"&&projectId&&mapId&&projectId===proj.id){
                setShowNotifs(false);
                onOpenMap({id:mapId},proj,false,false,nodeId||null);
                return;
              }
            }catch{}
            window.location.href=n.link;
          }}
        />
      )}

      {/* Scenario choice modal */}
      {showScChoice&&(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"var(--modal-overlay-strong,rgba(0,0,0,.8))",display:"flex",alignItems:"center",justifyContent:"center",zIndex:160,backdropFilter:"blur(14px)",animation:"fadeIn .2s ease"}} onClick={e=>{if(e.target===e.currentTarget)setShowScChoice(false);}}>
          <div className="glass-panel glass-panel-xl" style={{width:"min(95vw,460px)",borderRadius:22,overflow:"hidden",animation:"scaleIn .2s ease"}}>
            <div style={{padding:"18px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:30,height:30,borderRadius:8,background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"var(--accent-on-bg)",fontWeight:900,boxShadow:"0 2px 12px var(--accent-glow)"}}>⎇</div>
              <div style={{fontSize:14,fontWeight:800,color:"var(--text)",flex:1}}>{t("new_scenario","Новый сценарий")}</div>
              <button onClick={()=>setShowScChoice(false)} style={{width:26,height:26,borderRadius:6,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text4)",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
            <div style={{padding:"18px 20px",display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={createBlankScenario} className="btn-interactive" style={{padding:"16px 18px",borderRadius:14,border:"1px solid var(--glass-border-accent,var(--border))",background:"var(--surface)",textAlign:"left",cursor:"pointer",display:"flex",gap:14,alignItems:"center",transition:"all .2s"}}
                onMouseOver={e=>{e.currentTarget.style.background="var(--accent-soft)";e.currentTarget.style.borderColor="var(--accent-1)";}}
                onMouseOut={e=>{e.currentTarget.style.background="var(--surface)";e.currentTarget.style.borderColor="var(--glass-border-accent,var(--border))";}}>
                <div style={{width:40,height:40,borderRadius:10,background:"var(--accent-soft)",border:"1px solid var(--glass-border-accent,var(--border))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>✏️</div>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:"var(--text)",marginBottom:3}}>{t("empty_scenario","Пустой сценарий")}</div>
                  <div style={{fontSize:13.5,color:"var(--text4)"}}>{t("start_ai_interview","Начать с чистой карты и AI-интервью")}</div>
                </div>
              </button>
              <button onClick={()=>{setShowScChoice(false);setShowScTmpls(true);}} style={{padding:"16px 18px",borderRadius:14,border:"1px solid rgba(104,54,245,.25)",background:"rgba(104,54,245,.06)",textAlign:"left",cursor:"pointer",display:"flex",gap:14,alignItems:"center",transition:"all .2s"}}
                onMouseOver={e=>{e.currentTarget.style.background="rgba(104,54,245,.12)";e.currentTarget.style.borderColor="rgba(104,54,245,.5)";}}
                onMouseOut={e=>{e.currentTarget.style.background="rgba(104,54,245,.06)";e.currentTarget.style.borderColor="rgba(104,54,245,.25)";}}>
                <div style={{width:40,height:40,borderRadius:10,background:"rgba(104,54,245,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>✦</div>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:"var(--text)",marginBottom:3}}>AI шаблон сценария</div>
                  <div style={{fontSize:13.5,color:"var(--text4)"}}>8 типов: кризис, рост, инвестиции, пивот и другие</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
// ── ImportJSON (helper) ──
