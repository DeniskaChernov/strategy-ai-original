import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { io as ioClient } from "socket.io-client";
import pptxgen from "pptxgenjs";
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
import { getMaps, saveMap, deleteMap, getContentPlan, saveContentPlan } from "../lib/maps-api";
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
import { MapTour } from "../components/map-tour";
import { AppTopBar } from "../components/app-top-bar";
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
import { NodeCard } from "./node-card";
import { EdgeLine } from "./edge-line";
import { DeadlineReminders } from "./deadline-reminders";
import { SparklesCanvas } from "../components/sparkles-canvas";
import { RichEditorPanel } from "./rich-editor-panel";
import { AiPanel } from "./ai-panel";


// ── InMapOnboarding (используется внутри MapEditor) ──
// ── InMapOnboarding ──
export function InMapOnboarding({project,tier,theme="dark",onDone,onSkip}){
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


// ── MapEditor ──
export function MapEditor({user,mapData,project,onBack,isNew,onProfile,onToggleTheme,theme,readOnly=false,aiChatMsgs,aiChatSetMsgs,focusNodeId=null,palette="indigo",onOpenContentPlanHub=null,onOpenContentPlanProject=null,onShellGlobalNav}){
  const{t,lang,setLang}=useLang();
  const isMobile=useIsMobile();
  const[accHex,setAccHex]=useState({a1:"#6836f5",a2:"#a050ff"});
  const[sidebarCollapsed,setSidebarCollapsed]=useState<boolean>(()=>{
    try{return localStorage.getItem("sa_map_sb_collapsed")==="1";}catch{return false;}
  });
  useEffect(()=>{try{localStorage.setItem("sa_map_sb_collapsed",sidebarCollapsed?"1":"0");}catch{}},[sidebarCollapsed]);
  const ZEN_LS_KEY="sa_map_zen";
  const[zenMode,setZenMode]=useState<boolean>(()=>{try{return localStorage.getItem(ZEN_LS_KEY)==="1";}catch{return false;}});
  useEffect(()=>{try{localStorage.setItem(ZEN_LS_KEY,zenMode?"1":"0");}catch{}},[zenMode]);
  useEffect(()=>{
    if(zenMode)document.body.classList.add("sa-map-zen");
    else document.body.classList.remove("sa-map-zen");
    return()=>document.body.classList.remove("sa-map-zen");
  },[zenMode]);
  useEffect(()=>{
    document.body.classList.add("sa-route-map");
    return()=>{document.body.classList.remove("sa-route-map");};
  },[]);
  useLayoutEffect(()=>{
    try{
      const s=getComputedStyle(document.body);
      setAccHex({
        a1:(s.getPropertyValue("--accent-1")||"").trim()||"#6836f5",
        a2:(s.getPropertyValue("--accent-2")||"").trim()||"#a050ff",
      });
    }catch{}
  },[palette,theme]);
  const STATUS=useMemo(()=>{const b=getSTATUS(t);return{...b,planning:{...b.planning,c:accHex.a1}};},[t,accHex.a1]);
  const ETYPE=useMemo(()=>{const b=getETYPE(t);return{...b,requires:{...b.requires,c:accHex.a1},affects:{...b.affects,c:accHex.a2}};},[t,accHex.a1,accHex.a2]);
  const[nodes,setNodes]=useState(mapData?.nodes||defaultNodes());
  const[edges,setEdges]=useState(mapData?.edges||[]);
  const[selNode,setSelNode]=useState(null);
  const[selEdge,setSelEdge]=useState(null);
  const[ctxMenu,setCtxMenu]=useState<{x:number,y:number,node?:any}|null>(null);
  const[selNodes,setSelNodes]=useState<Set<string>>(new Set());
  const[showAI,setShowAI]=useState(false);
  const[showStats,setShowStats]=useState(false);
  const[connecting,setConnecting]=useState(false);
  const[connectSrc,setConnectSrc]=useState(null);
  const[showMini,setShowMini]=useState(true);
  const[search,setSearch]=useState("");
  const[pendingAiMsgs,setPendingAiMsgs]=useState([]);
  const aiChatMsgsLocal = aiChatMsgs || [];
  const setAiChatMsgsLocal = aiChatSetMsgs || (()=>{});
  const[statusFilter,setStatusFilter]=useState("all");
  const[toasts,setToasts]=useState([]);
  const[saveState,setSaveState]=useState("saved");
  const[undoStack,setUndoStack]=useState([]);
  const[redoStack,setRedoStack]=useState([]);
  const[showShortcuts,setShowShortcuts]=useState(false);
  const[clipboard,setClipboard]=useState(null);
  const[showSim,setShowSim]=useState(false);
  const[showTemplates,setShowTemplates]=useState(false);
  const[showGantt,setShowGantt]=useState(false);
  const[showTour,setShowTour]=useState(false);
  const[exporting,setExporting]=useState(false);
  const[searchQ,setSearchQ]=useState("");
  const[showSearch,setShowSearch]=useState(false);
  const[showOnboarding,setShowOnboarding]=useState(false);
  const[allMaps,setAllMaps]=useState([]);
  const[showVersions,setShowVersions]=useState(false);
  const[showDeadlines,setShowDeadlines]=useState(true);
  const[showBriefing,setShowBriefing]=useState(false);
  const[showNotifs,setShowNotifs]=useState(false);
  const{notifs,setNotifs,notifUnread,setNotifUnread,notifLoading,loadNotifications}=useNotifications(showNotifs,user?.email);
  // WebSocket presence
  const[onlineUsers,setOnlineUsers]=useState<any[]>([]);
  const[remoteCursors,setRemoteCursors]=useState<Record<string,{x:number,y:number,name:string,email:string}>>({});
  const socketRef=useRef<any>(null);
  const importRef=useRef<any>(null);
  const svgRef=useRef<any>(null);
  const dragging=useRef<any>(null);
  const panning=useRef<any>(null);
  const viewRef=useRef({x:0,y:0,zoom:0.85});
  const[view,setView]=useState({x:0,y:0,zoom:0.85});
  const focusPulseRef=useRef<any>(null);
  const[focusPulseId,setFocusPulseId]=useState<string|null>(null);
  const W=typeof window!=="undefined"?window.innerWidth:1400;
  const H=typeof window!=="undefined"?window.innerHeight:900;

  function addToast(msg:string,type="info"){
    const id=uid();
    setToasts((t:any[])=>[...t,{id,msg,type}]);
    // автоудаление через 4.3s — тост сам вызовет onClose после анимации (4s + 0.26s выход)
    setTimeout(()=>setToasts((t:any[])=>t.filter((x:any)=>x.id!==id)),4300);
  }
  function pushUndo(n:any,e:any){setUndoStack((s:any[])=>[...s.slice(-29),{nodes:n,edges:e}]);setRedoStack([]);}

  useEffect(()=>{
    if(!focusNodeId)return;
    const n=nodes.find((x:any)=>x.id===focusNodeId);
    if(!n)return;
    const z=1.05;
    const nx=-n.x+W/2, ny=-n.y+H/2;
    setView({x:nx,y:ny,zoom:z});
    viewRef.current={x:nx,y:ny,zoom:z};
    setSelNode(n);
    setFocusPulseId(n.id);
    if(focusPulseRef.current)clearTimeout(focusPulseRef.current);
    focusPulseRef.current=setTimeout(()=>setFocusPulseId(null),1600);
    return()=>{ if(focusPulseRef.current)clearTimeout(focusPulseRef.current); };
  },[focusNodeId,nodes.length]);

  // Флаг: текущее изменение nodes/edges пришло от удалённого коллеги (не сохраняем локально)
  const remoteUpdateRef=useRef(false);

  // ── WebSocket: подключаемся если есть API и карта имеет ID ──
  useEffect(()=>{
    if(!API_BASE||!mapData?.id||!user||readOnly)return;
    let socket:any;
    try{
      const token=getJWT();
      socket=ioClient(API_BASE,{transports:["websocket","polling"],auth:{token}});
      socketRef.current=socket;
      socket.io.on("reconnect_attempt",()=>{
        const tok=getJWT();
        if(tok)socket.auth={...socket.auth,token:tok};
        addToast(t("ws_reconnecting","Соединение потеряно — пробую переподключиться…"),"warn");
      });
      socket.io.on("reconnect",()=>{
        addToast(t("ws_reconnected","Соединение восстановлено"),"success");
      });
      socket.on("disconnect",(reason:string)=>{
        if(reason==="io server disconnect"||reason==="transport close")
          addToast(t("ws_disconnected","Соединение прервано"),"warn");
      });
      socket.emit("join-map",{mapId:mapData.id,userName:user.name||user.email});
      socket.on("join-error",(payload:any)=>{
        addToast(payload?.message||t("ws_join_denied","Нет доступа к совместному редактированию"),"error");
        try{socket.disconnect();}catch{}
        socketRef.current=null;
      });
      socket.on("user-joined",(data:any)=>setOnlineUsers((u:any[])=>[...u.filter(x=>x.email!==data.email),data]));
      socket.on("user-left",(data:any)=>setOnlineUsers((u:any[])=>u.filter(x=>x.email!==data.email)));
      socket.on("node-move",({nodeId,x,y}:any)=>{
        remoteUpdateRef.current=true;
        setNodes((ns:any[])=>ns.map((n:any)=>n.id===nodeId?{...n,x,y}:n));
      });
      socket.on("node-update",({node}:any)=>{
        remoteUpdateRef.current=true;
        setNodes((ns:any[])=>ns.map((n:any)=>n.id===node.id?{...n,...node}:n));
      });
      socket.on("node-add",({node}:any)=>{
        remoteUpdateRef.current=true;
        setNodes((ns:any[])=>[...ns.filter((n:any)=>n.id!==node.id),node]);
      });
      socket.on("node-delete",({nodeId}:any)=>{
        remoteUpdateRef.current=true;
        setNodes((ns:any[])=>ns.filter((n:any)=>n.id!==nodeId));
      });
      socket.on("edge-update",({edges:es}:any)=>{
        remoteUpdateRef.current=true;
        setEdges(es);
      });
      socket.on("cursor-move",({email,name,x,y}:any)=>setRemoteCursors(c=>({...c,[email]:{x,y,name,email}})));
    }catch(e){/* WebSocket недоступен — работаем без него */}
    return()=>{socket?.emit("leave-map",{mapId:mapData.id});socket?.disconnect();socketRef.current=null;setOnlineUsers([]);};
  },[mapData?.id,user?.email]);

  useEffect(()=>{document.title=`${mapData?.name||project?.name||"Карта"} — Strategy AI`;return()=>{document.title="Strategy AI";};},[mapData?.name,project?.name]);

  // Состояние единого AI-чата живёт в App и прокидывается сюда

  // Трансляция перемещения узла через WebSocket
  function emitNodeMove(nodeId:string,x:number,y:number){
    socketRef.current?.emit("node-move",{mapId:mapData?.id,nodeId,x,y});
  }
  function emitNodeUpdate(node:any){
    socketRef.current?.emit("node-update",{mapId:mapData?.id,node});
  }
  function emitEdgeUpdate(edges:any[]){
    if(!readOnly)socketRef.current?.emit("edge-update",{mapId:mapData?.id,edges});
  }
  function setEdgesUser(updater:(prev:any[])=>any[]){
    setEdges(prev=>{const next=updater(prev);emitEdgeUpdate(next);return next;});
  }
  function undo(){if(!undoStack.length)return;const prev=undoStack[undoStack.length-1];setRedoStack(r=>[...r,{nodes,edges}]);setNodes(prev.nodes);setEdges(prev.edges);setUndoStack(s=>s.slice(0,-1));}
  function redo(){if(!redoStack.length)return;const next=redoStack[redoStack.length-1];setUndoStack(s=>[...s,{nodes,edges}]);setNodes(next.nodes);setEdges(next.edges);setRedoStack(r=>r.slice(0,-1));}

  function updateNode(n){pushUndo(nodes,edges);setNodes(ns=>ns.map(x=>x.id===n.id?n:x));}
  function deleteNode(id){
    pushUndo(nodes,edges);
    setNodes(ns=>ns.filter(x=>x.id!==id));
    setEdges(es=>{const next=es.filter(e=>e.source!==id&&e.target!==id);if(!readOnly)socketRef.current?.emit("edge-update",{mapId:mapData?.id,edges:next});return next;});
    setSelNode(null);
    if(!readOnly)socketRef.current?.emit("node-delete",{mapId:mapData?.id,nodeId:id});
  }
  function duplicateNode(n){const copy={...n,id:uid(),x:n.x+60,y:n.y+60,title:n.title+" (копия)",comments:[],history:[]};pushUndo(nodes,edges);setNodes(ns=>[...ns,copy]);if(!readOnly)socketRef.current?.emit("node-add",{mapId:mapData?.id,node:copy});}
  function importJSON(){importRef.current?.click();}
  function handleImportFile(e){
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const raw=ev.target?.result;
        if(typeof raw!=="string")return;
        const d=JSON.parse(raw);
        if(d.nodes||d.edges){
          pushUndo(nodes,edges);
          const newEdges=d.edges||[];
          setNodes((d.nodes||[]).map(n=>({...n,comments:n.comments||[],history:n.history||[]})));
          setEdges(newEdges);
          emitEdgeUpdate(newEdges);
          setTimeout(fitView,100);
          addToast(t("imported_steps","✅ Импортировано: {n} шагов").replace("{n}",String((d.nodes||[]).length)),"success");
        }else addToast(t("json_invalid","Некорректный формат JSON"),"error");
      }catch{addToast(t("file_read_err","Ошибка чтения файла"),"error");}
      e.target.value="";
    };
    r.readAsText(f);
  }

  function addNode(){
    const v=viewRef.current;
    const mapX=snap((W/2-v.x)/v.zoom-120);
    const mapY=snap((H/2-v.y)/v.zoom-64);
    const n={id:uid(),x:mapX,y:mapY,title:t("new_step_title","Новый шаг"),reason:"",action:"",metric:"",status:"planning",priority:"medium",progress:0,tags:[],color:"",comments:[],history:[]};
    pushUndo(nodes,edges);setNodes(ns=>[...ns,n]);setSelNode(n);
    if(!readOnly)socketRef.current?.emit("node-add",{mapId:mapData?.id,node:n});
  }
  function addNodeAt(clientX:number,clientY:number){
    const rect=svgRef.current?.getBoundingClientRect();
    if(!rect)return addNode();
    const v=viewRef.current;
    const cx=clientX-rect.left,cy=clientY-rect.top;
    const mapX=snap((cx-v.x)/v.zoom-120);
    const mapY=snap((cy-v.y)/v.zoom-64);
    const n={id:uid(),x:mapX,y:mapY,title:t("new_step_title","Новый шаг"),reason:"",action:"",metric:"",status:"planning",priority:"medium",progress:0,tags:[],color:"",comments:[],history:[]};
    pushUndo(nodes,edges);setNodes(ns=>[...ns,n]);setSelNode(n);
    if(!readOnly)socketRef.current?.emit("node-add",{mapId:mapData?.id,node:n});
  }

  async function exportPNG(){
    if(!svgRef.current||exporting)return;
    setExporting(true);
    try{
      const svg=svgRef.current;
      const svgClone=svg.cloneNode(true);
      const isDark=theme!=="light";
      const bg=isDark?"#050410":"#ece9ff";
      const bgRect=document.createElementNS("http://www.w3.org/2000/svg","rect");
      bgRect.setAttribute("width","100%");bgRect.setAttribute("height","100%");bgRect.setAttribute("fill",bg);
      svgClone.insertBefore(bgRect,svgClone.firstChild);
      const svgStr=new XMLSerializer().serializeToString(svgClone);
      const blob=new Blob([svgStr],{type:"image/svg+xml;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement("canvas");
        canvas.width=svg.clientWidth*2;canvas.height=svg.clientHeight*2;
        const ctx=canvas.getContext("2d");
        ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.scale(2,2);ctx.drawImage(img,0,0);
        URL.revokeObjectURL(url);
        canvas.toBlob(b=>{
          const a=document.createElement("a");
          a.href=URL.createObjectURL(b);
          a.download=`${mapData?.name||project?.name||"strategy"}.png`;
          a.click();
          setExporting(false);
          addToast(t("png_exported","PNG экспортирован ✓"),"success");
        },"image/png");
      };
      img.onerror=()=>setExporting(false);
      img.src=url;
    }catch{setExporting(false);}
  }

  function exportJSON(){
    const data={name:mapData?.name||project?.name||"map",ctx:mapData?.ctx,nodes,edges,exportedAt:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`${((mapData?.name||project?.name||"strategy").replace(/\s+/g,"-"))}.json`;a.click();
    URL.revokeObjectURL(url);
    addToast(t("json_exported","JSON экспортирован ✓"),"success");
  }

  async function shareMap(){
    const mapPayload={name:mapData?.name||project?.name||"",nodes,edges,ctx:mapData?.ctx||""};
    const projectName=project?.name||"";
    let url="";
    if(API_BASE){
      try{
        const d=await apiFetch("/api/shares",{
          method:"POST",
          body:JSON.stringify({mapId:mapData?.id,projectId:project?.id,projectName,mapData:mapPayload}),
        });
        url=d.url;
      }catch(e:any){addToast(e.message||t("share_create_err","Ошибка создания ссылки"),"error");return;}
    } else {
      const shareId=uid();
      await store.set("sa_share_"+shareId,{map:mapPayload,projectName,createdAt:Date.now()});
      url=(typeof window!=="undefined"?window.location.origin+window.location.pathname:"")+"?share="+shareId;
    }
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(url);
      else{const ta=document.createElement("textarea");ta.value=url;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}
      addToast(t("share_copied","Ссылка скопирована. Откройте её для просмотра карты."),"success");
    }catch{addToast(url,"info");}
  }

  function exportPDF(){
    const title=mapData?.name||project?.name||"Strategy Map";
    const rows=nodes.map((n:any)=>`<tr><td>${sanitize(n.title)}</td><td>${sanitize(n.status)||"-"}</td><td>${n.progress!=null?n.progress+"%":"-"}</td><td>${sanitize(n.deadline)||"-"}</td><td>${sanitize(n.metric)||"-"}</td></tr>`).join("");
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sanitize(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>@page{margin:20mm 15mm}body{font-family:'Inter',system-ui,sans-serif;padding:0;color:#08061a;font-size:13px;background:#fff}
h1{font-size:22px;font-weight:700;color:#08061a;margin:0 0 6px;letter-spacing:-.02em}
.meta{color:rgba(70,58,130,.55);font-size:12px;margin-bottom:20px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid rgba(104,80,220,.14);padding:8px 11px;text-align:left}
th{background:rgba(104,54,245,.08);font-weight:600;font-size:12px;color:#232060}
tr:nth-child(even){background:rgba(236,233,255,.35)}
</style></head><body>
<h1>${sanitize(title)}</h1>
<p class="meta">${new Date().toLocaleDateString()} · ${nodes.length} ${t("steps_label","шагов")} · Strategy AI</p>
<table><thead><tr><th>${t("step","Шаг")}</th><th>${t("status","Статус")}</th><th>${t("progress","Прогресс")}</th><th>${t("deadline","Дедлайн")}</th><th>${t("metric","Метрика")}</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
    const w=window.open("","_blank");
    if(!w){addToast(t("popup_blocked","Разрешите всплывающие окна для экспорта"),"warn");return;}
    w.document.write(html);w.document.close();
    w.onload=()=>{w.print();(w as any).onafterprint=()=>w.close();};
  }

  async function exportPPTX(){
    const title=sanitize(mapData?.name||project?.name||"Strategy Map");
    const date=new Date().toLocaleDateString("ru-RU");
    const hasRealPptx=TIERS[user?.tier||"free"]?.pptx;
    if(hasRealPptx){
      try{
        const pres=new pptxgen();
        pres.title=title;
        pres.author="Strategy AI";
        const titleSlide=pres.addSlide();
        titleSlide.addText(title,{x:0.5,y:1.5,w:9,h:1,fontSize:44,bold:true,color:"08061a"});
        titleSlide.addText(`${t("strategy_map","Стратегическая карта")} · ${date} · ${nodes.length} ${t("steps_label","шагов")}`,{x:0.5,y:2.5,w:9,h:0.5,fontSize:18,color:"9088b0"});
        for(let i=0;i<nodes.length;i++){
          const n=nodes[i];
          const slide=pres.addSlide();
          slide.addText(sanitize(n.title||""),{x:0.5,y:0.3,w:9,h:0.8,fontSize:28,bold:true,color:"08061a"});
          slide.addText(`${n.status||"planning"} · ${n.priority||"medium"}`,{x:0.5,y:1.1,w:9,h:0.3,fontSize:12,color:"9088b0"});
          if(n.reason)slide.addText(sanitize(n.reason).slice(0,500),{x:0.5,y:1.5,w:9,h:1.5,fontSize:14,color:"6c6480",valign:"top"});
          if(n.metric)slide.addText(`🎯 ${sanitize(n.metric)}`,{x:0.5,y:3.2,w:9,h:0.4,fontSize:14,color:"6836f5",bold:true});
          slide.addText(`${n.progress||0}%${n.deadline?` · ${t("deadline","Дедлайн")}: ${n.deadline}`:""}`,{x:0.5,y:3.7,w:9,h:0.3,fontSize:12,color:"9088b0"});
        }
        const fname=`${title.replace(/[^a-zA-Zа-яА-Я0-9\s-]/g,"").slice(0,40)}.pptx`;
        await pres.writeFile({fileName:fname});
        addToast(t("export_pptx","⬇ PPTX")+" ✓","success");
      }catch(e:any){addToast(e?.message||t("save_error","Ошибка экспорта"),"error");}
      return;
    }
    const statusColors:Record<string,string>={completed:"#12c482",active:"#6836f5",planning:"#9088b0",paused:"#f09428",blocked:"#f04458"};
    const prioColors:Record<string,string>={critical:"#f04458",high:"#f09428",medium:"#6836f5",low:"#a8a4c8"};
    const slides=nodes.map((n:any,i:number)=>`
      <div class="slide">
        <div class="slide-num">${i+1} / ${nodes.length}</div>
        <div class="slide-tag" style="background:${statusColors[n.status]||"#9088b0"}20;color:${statusColors[n.status]||"#9088b0"};border:1px solid ${statusColors[n.status]||"#9088b0"}40">${n.status||"planning"}</div>
        <div class="prio-tag" style="background:${prioColors[n.priority]||"#9088b0"}20;color:${prioColors[n.priority]||"#9088b0"}">${n.priority||"medium"}</div>
        <h2>${sanitize(n.title)}</h2>
        ${n.reason?`<p class="reason">${sanitize(n.reason)}</p>`:""}
        ${n.metric?`<div class="metric">🎯 ${sanitize(n.metric)}</div>`:""}
        <div class="progress-wrap"><div class="progress-bar" style="width:${n.progress||0}%"></div></div>
        <div class="prog-label">${n.progress||0}%${n.deadline?` · ${t("deadline","Deadline")}: ${n.deadline}`:""}</div>
      </div>`).join("");
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
@page{size:297mm 210mm landscape;margin:0}
*{box-sizing:border-box}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
body{font-family:'Inter',system-ui,sans-serif;background:#ece9ff;margin:0;padding:0}
.title-slide{width:297mm;height:210mm;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(104,54,245,.35),transparent 55%),linear-gradient(145deg,#12081f 0%,#050410 48%,#0c0622 100%);page-break-after:always}
.title-slide h1{font-size:42px;font-weight:800;color:#eaeaf8;margin:0 0 12px;text-align:center;letter-spacing:-.03em}
.title-slide p{font-size:18px;color:rgba(188,186,224,.62);margin:0}
.slide{width:297mm;height:210mm;padding:28mm 20mm 20mm;position:relative;display:flex;flex-direction:column;justify-content:center;page-break-after:always;border-top:4px solid #6836f5;background:#fff}
.slide-num{position:absolute;top:12mm;right:14mm;font-size:11px;color:rgba(70,58,130,.45)}
.slide-tag{display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:8px;margin-right:6px}
.prio-tag{display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:8px}
h2{font-size:32px;font-weight:800;color:#08061a;margin:0 0 12px;line-height:1.2;letter-spacing:-.02em}
.reason{font-size:16px;color:rgba(35,28,80,.78);margin:0 0 16px;line-height:1.6}
.metric{font-size:15px;color:#6836f5;font-weight:600;margin-bottom:16px;padding:10px 16px;background:rgba(104,54,245,.1);border:1px solid rgba(104,80,220,.18);border-radius:12px;display:inline-block}
.progress-wrap{height:10px;background:rgba(104,80,220,.12);border-radius:5px;margin-bottom:6px;max-width:400px}
.progress-bar{height:10px;background:linear-gradient(90deg,#6836f5,#a050ff);border-radius:5px;transition:width .3s}
.prog-label{font-size:13px;color:rgba(70,58,130,.45)}
@media print{.slide,.title-slide{display:flex!important}}
</style></head><body>
<div class="title-slide"><h1>${title}</h1><p>Стратегическая карта · ${date} · ${nodes.length} шагов</p></div>
${slides}
</body></html>`;
    const w=window.open("","_blank");
    if(!w){addToast(t("popup_blocked","Разрешите всплывающие окна для экспорта"),"warn");return;}
    w.document.write(html);w.document.close();
    setTimeout(()=>{w.print();},500);
    addToast(t("export_pptx","⬇ PPTX")+" — "+t("export_pptx_print_hint","откроется окно печати"),"success");
  }

  function fitView(){
    if(!nodes.length)return;
    const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs)+240,minY=Math.min(...ys),maxY=Math.max(...ys)+128;
    const pad=72;
    const scaleX=(W-pad*2)/(maxX-minX||1),scaleY=(H-152)/(maxY-minY||1);
    const zoom=Math.max(.2,Math.min(1.5,Math.min(scaleX,scaleY)));
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const nx=W/2-cx*zoom,ny=(H-72)/2-cy*zoom;
    viewRef.current={x:nx,y:ny,zoom};setView({x:nx,y:ny,zoom});
  }

  function autoLayout(){
    const sorted=topSort(nodes,edges);
    const GRID_START=72,COL=350,ROW=210;
    const newNodes=nodes.map(n=>{
      const idx=sorted.findIndex(s=>s.id===n.id);
      const safeIdx=idx<0?nodes.indexOf(n):idx;
      const col=safeIdx%4,row=Math.floor(safeIdx/4);
      return{...n,x:snap(GRID_START+col*COL),y:snap(GRID_START+row*ROW)};
    });
    pushUndo(nodes,edges);setNodes(newNodes);addToast(t("layout_applied","⌥ Авто-раскладка применена"),"info");
    setTimeout(fitView,50);
  }

  async function autoConnect(){
    if(nodes.length<2){addToast(t("min_2_steps","Нужно минимум 2 шага"),"info");return;}
    addToast(t("ai_analyzing_links","🔗 AI анализирует логику карты…"),"info");
    const ctx=nodes.map(n=>`ID: ${n.id}\nНазвание: ${n.title}${n.reason?`\nОписание: ${n.reason}`:""}${n.metric?`\nМетрика: ${n.metric}`:""}${n.status?`\nСтатус: ${n.status}`:""}${n.deadline?`\nДедлайн: ${n.deadline}`:""}${n.tags?.length?`\nТеги: ${n.tags.join(", ")}`:""}`)
      .join("\n\n");
    const existingEdges=edges.map(e=>`${e.source} → ${e.target} (${e.type||"requires"})`).join(", ")||"нет";
    try{
      const r=await callAI([{role:"user",content:
`Ты — стратегический аналитик. Определи ТОЛЬКО логически обоснованные причинно-следственные связи между шагами.

ШАГИ:
${ctx}

УЖЕ СУЩЕСТВУЮЩИЕ СВЯЗИ: ${existingEdges}

БАЗА ЗНАНИЙ (учитывай при анализе): ${AI_KNOWLEDGE}

ПРАВИЛА:
- requires: A нужен для B (без A нельзя B). affects: A влияет на B. blocks: A блокирует B. follows: B после A.
- Учитывай отрасль: маркетинг (воронка TOFU/MOFU/BOFU), продажи (pipeline, BANT), стратегию (последовательность шагов)
- НЕ добавляй связи "по теме" — только логические зависимости. Максимум 6 новых связей.
- Если блокировка/зависимость — обоснуй в reason. Используй ID из шагов (id, не title).

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "connections": [{"source":"id1","target":"id2","type":"requires","reason":"кратко почему эта связь логична"}],
  "summary": "2-3 предложения: что обнаружил в логике карты и почему добавил именно эти связи"
}`
      }],"Верни ТОЛЬКО JSON без markdown. Думай как стратег. Учитывай отрасль и бизнес-контекст.",900);
      const clean=r.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      const newConns=parsed.connections||[];
      const filtered=newConns.filter(e=>
        e.source&&e.target&&e.source!==e.target&&
        nodes.find(n=>n.id===e.source)&&
        nodes.find(n=>n.id===e.target)&&
        !edges.find(ex=>ex.source===e.source&&ex.target===e.target)
      );
      if(filtered.length){
        pushUndo(nodes,edges);
        setEdgesUser(es=>[...es,...filtered.map(e=>({...e,id:uid(),label:e.reason||""}))]);
        addToast(t("links_added","🔗 Добавлено: {n} связей").replace("{n}",String(filtered.length)),"success");
        // Open AI panel and show reasoning
        setShowAI(true);
        setSelNode(null);
        const reasonLines=filtered.map(e=>{
          const src=nodes.find(n=>n.id===e.source)?.title||e.source;
          const tgt=nodes.find(n=>n.id===e.target)?.title||e.target;
          const typeLabel={requires:"→ требует",affects:"→ влияет на",blocks:"→ блокирует",follows:"→ следует после"}[e.type]||"→";
          return `• **${src}** ${typeLabel} **${tgt}**\n  ${e.reason||""}`;
        }).join("\n");
        const msg=`🔗 **AI-связи добавлены (${filtered.length})**\n\n${reasonLines}\n\n---\n${parsed.summary||""}`;
        // inject as AI message into chat
        setPendingAiMsgs(prev=>[...prev,{role:"assistant",content:msg,ts:Date.now()}]);
      } else {
        addToast(t("links_optimal","Связи уже оптимальны — добавить нечего"),"info");
        setShowAI(true);
        setPendingAiMsgs(prev=>[...prev,{role:"assistant",content:`🔍 **Анализ связей завершён**\n\n${parsed.summary||"Все логические связи уже присутствуют на карте. AI не нашёл новых обоснованных зависимостей."}`,ts:Date.now()}]);
      }
    }catch(err:any){
      const msg=err?.message||"";
      const hint=msg.includes("429")||msg.includes("лимит")?t("ai_rate_limit_hint","Превышен лимит запросов. Подождите минуту."):msg.includes("network")||msg.includes("fetch")?t("ai_network_err","Проверьте интернет и ключ API."):t("ai_error","Ошибка AI-анализа");
      addToast(hint,"error");
    }
  }

  // load allMaps + trigger onboarding
  useEffect(()=>{
    (async()=>{
      const ms=await getMaps(project.id);
      setAllMaps(ms);
      if(isNew&&(!mapData?.nodes||mapData.nodes.length===0)){
        setShowOnboarding(true);
      } else if(isNew&&mapData?.nodes?.length>0){
        const toured=sessionStorage.getItem("sa_toured");
        if(!toured){sessionStorage.setItem("sa_toured","1");setShowTour(true);}
      }
    })();
    setTimeout(fitView,120);
  },[]);

  // save
  useEffect(()=>{
    if(readOnly)return;
    if(user?.autoSave===false)return; // Учёт настройки автосохранения
    // Если изменение пришло от коллеги — не запускаем autosave, сбрасываем флаг
    if(remoteUpdateRef.current){remoteUpdateRef.current=false;return;}
    setSaveState("saving");
    const tid=setTimeout(async()=>{
      try{
        const map={...mapData,nodes,edges,updatedAt:Date.now()};
        await saveMap(project.id,map);
        setSaveState("saved");
      }catch(e:any){
        setSaveState("error");
        if(!e?.message?.includes("MAP_LIMIT")){
          console.warn("Autosave failed:",e?.message);
        }
      }
    },900);
    return()=>clearTimeout(tid);
  },[nodes,edges,user?.autoSave]);

  // beforeunload — предупреждение при уходе с несохранёнными изменениями
  useEffect(()=>{
    if(readOnly)return;
    const h=(e:BeforeUnloadEvent)=>{if(saveState==="saving"||saveState==="error"){e.preventDefault();}};
    window.addEventListener("beforeunload",h);return()=>window.removeEventListener("beforeunload",h);
  },[saveState,readOnly]);

  // keyboard
  useEffect(()=>{
    function onKey(e){
      const tag=document.activeElement?.tagName;
      if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault();undo();}
      else if((e.ctrlKey||e.metaKey)&&(e.key==="y"||(e.key==="z"&&e.shiftKey))){e.preventDefault();redo();}
      else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==="A"){e.preventDefault();setShowAI(a=>!a);if(selNode)setSelNode(null);}
      else if((e.ctrlKey||e.metaKey)&&e.key==="c"&&selNode){setClipboard(selNode);addToast(t("copied","📋 Скопировано"),"info");}
      else if((e.ctrlKey||e.metaKey)&&e.key==="v"&&clipboard){const copy={...clipboard,id:uid(),x:clipboard.x+60,y:clipboard.y+60};pushUndo(nodes,edges);setNodes(ns=>[...ns,copy]);addToast(t("pasted","📋 Вставлено"),"info");}
      else if(e.key==="Escape"){if(zenMode){setZenMode(false);return;}if(ctxMenu)setCtxMenu(null);else{setConnecting(false);setConnectSrc(null);setSelNode(null);setSelNodes(new Set());}}
      else if((e.key==="Delete"||e.key==="Backspace")&&(selNode||selNodes.size)&&!connecting){
        const toDel=selNodes.size?Array.from(selNodes):[selNode.id];
        pushUndo(nodes,edges);
        setNodes(ns=>ns.filter(n=>!toDel.includes(n.id)));
        setEdgesUser(es=>es.filter(e=>!toDel.includes(e.source)&&!toDel.includes(e.target)));
        setSelNodes(new Set());setSelNode(null);
      }
      else if((e.key==="Delete"||e.key==="Backspace")&&selEdge){pushUndo(nodes,edges);setEdgesUser(es=>es.filter(x=>x.id!==selEdge.id));setSelEdge(null);}
      else if(e.key==="?"||e.key==="/"){ setShowShortcuts(s=>!s);}
      else if((e.ctrlKey||e.metaKey)&&e.key==="a"){e.preventDefault();if(nodes.length){setSelNodes(new Set(nodes.map(n=>n.id)));setSelNode(nodes[0]);}}
      else if((selNode||selNodes.size)&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){
        e.preventDefault();
        const d=e.shiftKey?40:10;
        const dx=e.key==="ArrowLeft"?-d:e.key==="ArrowRight"?d:0;
        const dy=e.key==="ArrowUp"?-d:e.key==="ArrowDown"?d:0;
        const ids=selNodes.size?selNodes:new Set([selNode.id]);
        setNodes(ns=>ns.map(n=>ids.has(n.id)?{...n,x:snap(n.x+dx),y:snap(n.y+dy)}:n));
      }
    }
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[selNode,selEdge,selNodes,clipboard,connecting,undoStack,redoStack,nodes,edges,ctxMenu,zenMode]);

  function onSvgMouseDown(e){
    const isTouch=e.pointerType==="touch";
    const isEmptyBg=e.target===svgRef.current||e.target?.tagName==="svg"||e.target?.getAttribute?.("data-canvas-bg")==="1";
    const wantPan=isTouch||e.button===1||(e.button===0&&(e.altKey||isEmptyBg));
    if(wantPan&&isEmptyBg){
      panning.current={startX:e.clientX-viewRef.current.x,startY:e.clientY-viewRef.current.y};
      e.preventDefault();return;
    }
    if(isEmptyBg){
      setSelNode(null);setSelEdge(null);
      if(connecting){setConnecting(false);setConnectSrc(null);}
    }
  }
  function onSvgMouseMove(e){
    if(panning.current){
      const x=e.clientX-panning.current.startX,y=e.clientY-panning.current.startY;
      viewRef.current={...viewRef.current,x,y};setView(v=>({...v,x,y}));e.preventDefault();return;
    }
    if(dragging.current){
      const{node,startMX,startMY,startNX,startNY,offsets}=dragging.current;
      const dx=(e.clientX-startMX)/viewRef.current.zoom,dy=(e.clientY-startMY)/viewRef.current.zoom;
      if(offsets){setNodes(ns=>ns.map(n=>offsets[n.id]!==undefined?{...n,x:snap(offsets[n.id].x+dx),y:snap(offsets[n.id].y+dy)}:n));}
      else{setNodes(ns=>ns.map(n=>n.id===node.id?{...n,x:snap(startNX+dx),y:snap(startNY+dy)}:n));}
    }
  }
  function onSvgMouseUp(){panning.current=null;if(dragging.current){dragging.current=null;}}
  function onWheel(e){
    e.preventDefault();
    const factor=e.deltaY<0?1.1:0.91;
    const nx=viewRef.current.zoom*factor;
    if(nx<0.2||nx>3)return;
    const rect=svgRef.current?.getBoundingClientRect();
    const cx=rect?e.clientX-rect.left:W/2,cy=rect?e.clientY-rect.top:H/2;
    const newX=cx-(cx-viewRef.current.x)*factor,newY=cy-(cy-viewRef.current.y)*factor;
    viewRef.current={x:newX,y:newY,zoom:nx};setView({x:newX,y:newY,zoom:nx});
  }
  function onNodeMouseDown(e,node){
    if(readOnly)return;
    if(e.pointerType!=="touch"&&e.button!==0)return;
    if(connecting){
      if(connectSrc&&connectSrc.id!==node.id){
        if(!edges.find(ex=>ex.source===connectSrc.id&&ex.target===node.id)){
          const ne={id:uid(),source:connectSrc.id,target:node.id,type:"requires",label:""};
          pushUndo(nodes,edges);setEdgesUser(es=>[...es,ne]);
        }
      }else{setConnectSrc(node);}
      return;
    }
    e.stopPropagation();
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    const ids=selNodes.size?selNodes:new Set([node.id]);
    const offsets=ids.size>1?Object.fromEntries(nodes.filter(n=>ids.has(n.id)).map(n=>[n.id,{x:n.x,y:n.y}])):undefined;
    dragging.current={node,startMX:e.clientX,startMY:e.clientY,startNX:node.x,startNY:node.y,offsets};
  }
  function onNodeClick(node,ev?:{shiftKey?:boolean}){
    if(connecting){return;}
    if(ev?.shiftKey){
      const next=new Set(selNodes);
      if(next.has(node.id))next.delete(node.id);else next.add(node.id);
      setSelNodes(next);
      setSelNode(next.size?(next.has(node.id)?node:nodes.find(n=>next.has(n.id))||null):null);
    }else{
      setSelNode(node);setSelEdge(null);setSelNodes(new Set([node.id]));
    }
  }
  function startConnect(node){setConnecting(true);setConnectSrc(node);setSelNode(null);}
  function scrollToNode(node){
    const nx=W/2-node.x*viewRef.current.zoom-120*viewRef.current.zoom;
    const ny=H/2-node.y*viewRef.current.zoom-64*viewRef.current.zoom;
    viewRef.current={...viewRef.current,x:nx,y:ny};setView(v=>({...v,x:nx,y:ny}));
  }

  const filteredNodes=nodes.filter(n=>{
    if(statusFilter!=="all"&&n.status!==statusFilter)return false;
    if(!search)return true;
    const q=search.toLowerCase();
    return n.title?.toLowerCase().includes(q)||n.reason?.toLowerCase().includes(q)||(n.tags||[]).some(t=>t.toLowerCase().includes(q));
  });
  const hiddenIds=new Set(nodes.filter(n=>!filteredNodes.find(f=>f.id===n.id)).map(n=>n.id));

  const tier=TIERS[user?.tier||"free"]||TIERS.free;
  const rightPanelOpen=selNode||showAI;
  const[bgMode,setBgMode]=useState("grid"); // grid = точки + --map-canvas (strategy-reference.html) | stars | none
  const toolbarStyle={display:"flex",alignItems:"center",gap:5};
  const btnStyle=(active)=>({padding:"6px 12px",borderRadius:10,border:`1px solid ${active?"var(--accent-1)":"var(--border)"}`,background:active?"var(--accent-soft)":"transparent",color:active?"var(--accent-2)":"var(--text3)",cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap",transition:"all .2s"});
  const sep=<div style={{width:1,height:24,background:"var(--border)",margin:"0 6px",flexShrink:0,borderRadius:1}}/>;
  const ib=(active,title,onClick,children,extraStyle={})=>(
    <button onClick={onClick} title={title} aria-label={title} style={{width:38,height:38,borderRadius:12,border:"none",background:active?"var(--accent-soft)":"transparent",color:active?"var(--accent-2)":"var(--text4)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s",...extraStyle}}
      onMouseOver={e=>{if(!active)e.currentTarget.style.background="var(--surface)";}} onMouseOut={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
      {children}
    </button>
  );
  const tb=(active,onClick,children,titleOrStyle?:string|object,extraStyle={})=>{
    const opts: {title?: string} & Record<string, unknown>=typeof titleOrStyle==="string"?{title:titleOrStyle,...extraStyle}:{...(titleOrStyle && typeof titleOrStyle==="object"?titleOrStyle:{}),...extraStyle};
    const {title,...style}=opts;
    return (
    <button onClick={onClick} title={title} style={{height:38,padding:"0 16px",borderRadius:12,border:"none",background:active?"var(--accent-soft)":"transparent",color:active?"var(--accent-2)":"var(--text3)",cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,transition:"all .2s",display:"flex",alignItems:"center",gap:8,...style}}
      onMouseOver={e=>{if(!active)e.currentTarget.style.background="var(--surface)";}} onMouseOut={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
      {children}
    </button>
  );};
  const retrySave=async()=>{setSaveState("saving");try{await saveMap(project.id,{...mapData,nodes,edges,updatedAt:Date.now()});setSaveState("saved");}catch{setSaveState("error");}};
  const saveVersion=async()=>{if(!API_BASE||!project?.id||!mapData?.id)return;try{const lbl=t("version_save_label","Промежуточная версия")+" "+new Date().toLocaleString("ru",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});await apiFetch(`/api/projects/${project.id}/maps/${mapData.id}/versions`,{method:"POST",body:JSON.stringify({label:lbl,nodes,edges,ctx:mapData?.ctx||""})});addToast(t("version_saved","Версия сохранена ✓"),"success");}catch(e:any){addToast(e?.message||t("save_error","Ошибка"),"error");}};

  function handleShellNav(nav:StrategyShellNav){
    if(nav==="ai"){setShowAI(true);return;}
    if(nav==="scenarios"){setShowSim(true);return;}
    if(nav==="timeline"){setShowGantt(true);return;}
    if(nav==="insights"){setShowStats(true);return;}
    if(nav==="settings"){onProfile();return;}
    if(nav==="map")return;
    if(nav==="team"){addToast(t("shell_team_hint","Участники проекта — в карточке проекта и в профиле."),"info");return;}
    onShellGlobalNav?.(nav);
  }
  const shellUi=!!user&&!isMobile;

  const _mapMain=(
    <>
{readOnly&&(
        <div style={{flexShrink:0,background:"rgba(148,163,184,.12)",borderBottom:"1px solid var(--border)",padding:"6px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:12.5,color:"var(--text3)",fontWeight:600}}>
          <span>👁</span> {t("read_only_banner","Режим просмотра — вы можете просматривать карту, но не редактировать")}
        </div>
      )}
      {shellUi&&(
        <AppTopBar
          title={mapData?.name||t("shell_strategy_map","Карта стратегии")}
          subtitle={project?.name||""}
          flowHint={t("workspace_flow_hint_map","Шаги и связи — контекст для сценариев, Gantt и AI.")}
          leftAddon={
            <button
              type="button"
              className={"sa-shell-burger"+(sidebarCollapsed?" on":"")}
              onClick={()=>setSidebarCollapsed(c=>!c)}
              title={sidebarCollapsed?t("shell_show_sidebar","Показать панель"):t("shell_hide_sidebar","Скрыть панель")}
              aria-label={sidebarCollapsed?t("shell_show_sidebar","Показать панель"):t("shell_hide_sidebar","Скрыть панель")}
              aria-pressed={sidebarCollapsed}
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          }
          rightContent={
            <>
              {API_BASE&&<NotifBell unread={notifUnread} onClick={()=>setShowNotifs(true)}/>}
              {!readOnly&&(
                <div role="status" aria-live="polite" aria-relevant="text" style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:saveState==="saving"?"#f09428":saveState==="error"?"#f04458":"#12c482"}}>
                  {saveState==="saving"?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> {t("saving","Сохраняю")}</>:saveState==="error"?<>✗ {t("save_error","Ошибка")}</>:<>✓ {t("saved_short","Сохранено")}</>}
                </div>
              )}
              {!readOnly&&user&&(
                <button type="button" className="btn-ic" onClick={onProfile} title={t("profile_title","Профиль")} aria-label={t("profile_title","Профиль")}>{(user?.name||user?.email||"U")[0].toUpperCase()}</button>
              )}
            </>
          }
        />
      )}
      {!shellUi&&(<>
      {/* ── TOOLBAR — 2 rows (mobile / legacy) ── */}
      <div style={{flexShrink:0,zIndex:30,borderBottom:"1px solid var(--glass-border-accent,var(--border))",background:"var(--bg2)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",boxShadow:"0 1px 0 var(--glass-border-accent,var(--border))"}}>

        {/* ROW 1 — primary actions + search */}
        <div style={{minHeight:60,display:"flex",alignItems:"center",gap:isMobile?10:12,padding:isMobile?"10px 16px":shellUi?"0 20px":"0 24px",borderBottom:"1px solid var(--border)",flexWrap:isMobile?"wrap":shellUi?"wrap":undefined}}>

          {/* LEFT: nav + breadcrumb + edit */}
          <div style={{display:"flex",alignItems:"center",gap:isMobile?8:12,flexShrink:0,minWidth:0}}>
            {tb(false,onBack,<>{t("back_btn","← Назад")}</>,t("back_to_project","Вернуться в проект"))}
            {project?.name&&mapData?.name&&!isMobile&&(
              <span style={{fontSize:13,color:"var(--text4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}} title={`${project.name} → ${mapData.name}`}>
                {project.name} <span style={{opacity:.6}}>→</span> {mapData.name}
              </span>
            )}
            {!readOnly&&<>{sep}
            <button className="btn-interactive sa-tbar-btn--add" onClick={addNode} title={t("add_step_hint","Добавить шаг (клик на пустое место)")} style={{height:40,padding:isMobile?"0 14px":"0 18px",borderRadius:12,border:"none",background:"var(--gradient-accent)",color:"var(--accent-on-bg)",cursor:"pointer",fontSize:14,fontWeight:700,flexShrink:0,display:"flex",alignItems:"center",gap:8,boxShadow:"0 2px 12px var(--accent-glow)"}}>
              <span style={{fontSize:17,lineHeight:1}}>+</span> {t("step_short","Шаг")}
            </button>
            <button onClick={()=>{setConnecting(c=>!c);setConnectSrc(null);}} title={connecting?t("cancel","Отмена"):t("link_mode_hint","Режим связи: клик на источник, затем на цель")}
              style={{height:40,padding:isMobile?"0 12px":"0 16px",borderRadius:12,border:"none",background:connecting?"var(--accent-soft)":"var(--surface)",color:connecting?"var(--accent-2)":"var(--text2)",cursor:"pointer",fontSize:13,fontWeight:600,flexShrink:0,display:"flex",alignItems:"center",gap:6,transition:"all .2s"}}>
              {connecting?<><span style={{color:"#f04458"}}>✕</span> {isMobile?t("cancel_short","Отм."):t("cancel","Отмена")}</>:<>{isMobile?"⇒":t("link_btn","⇒ Связать")}</>}
            </button>
            {sep}
            {ib(!undoStack.length,"Отменить (Ctrl+Z)",undo,<>↩</>,{opacity:undoStack.length?.9:.35})}
            {ib(!redoStack.length,"Повторить (Ctrl+Y)",redo,<>↪</>,{opacity:redoStack.length?.9:.35})}
            </>}
            {sep}
            {user&&ib(zenMode,t("map_zen_hint","Только карта: скрыть вторую панель, FAB и миникарту (Esc — выход)"),()=>setZenMode(z=>!z),<>🌿</>,zenMode?{borderColor:"rgba(16,185,129,.45)",background:"rgba(16,185,129,.12)",color:"#34d399"}:{})}
          </div>

          {sep}

          {/* CENTER: search + filter */}
          <div style={{flex:isMobile?undefined:1,display:"flex",alignItems:"center",gap:isMobile?4:6,justifyContent:"center",minWidth:0,flexShrink:isMobile?0:undefined}}>
            {!isMobile&&<div style={{position:"relative",flexShrink:0}}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:15,color:"var(--text4)",pointerEvents:"none"}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по шагам…"
                style={{padding:"10px 14px 10px 38px",fontSize:14,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:12,color:"var(--text)",outline:"none",width:220,fontFamily:"inherit",transition:"border-color .2s,box-shadow .2s"}}/>
            </div>}
            {isMobile&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍" style={{padding:"6px 10px",fontSize:13,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:8,color:"var(--text)",outline:"none",width:60,fontFamily:"inherit"}}/>}
            <CustomSelect value={statusFilter} onChange={v=>setStatusFilter(v)}
              options={[{value:"all",label:isMobile?t("all_statuses_short","Статусы"):t("all_statuses","Все статусы")},...Object.entries(STATUS).map(([k,s])=>{const x=s as {label:string;c:string};return{value:k,label:x.label,dot:x.c};})]}
              style={{minWidth:isMobile?72:100}}/>
            <div style={{fontSize:13,color:"var(--text4)",fontWeight:600,padding:"6px 12px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",whiteSpace:"nowrap",flexShrink:0}}>
              {filteredNodes.length}{search||statusFilter!=="all"?`/${nodes.length}`:""}{isMobile?"":" шагов"}
            </div>
          </div>

          {sep}

          {/* RIGHT: user + save */}
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {!shellUi&&ib(false,"Переключить тему",onToggleTheme,theme==="dark"?<>☀️</>:<>🌙</>)}
            {!shellUi&&API_BASE&&<NotifBell unread={notifUnread} onClick={()=>setShowNotifs(true)}/>}
            {readOnly?(
              <div style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",fontSize:13,fontWeight:600,color:"var(--text4)"}}>{t("read_only","Только просмотр")}</div>
            ):(
              <>
            {!shellUi&&(
            <button onClick={onProfile} title={t("profile_title","Профиль")} aria-label={t("profile_title","Профиль")}
              style={{width:32,height:32,borderRadius:"50%",border:`2px solid ${tier.color}55`,background:`linear-gradient(135deg,${tier.color}cc,${tier.color}44)`,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {(user?.name||user?.email||"U")[0].toUpperCase()}
            </button>
            )}
            {!shellUi&&(
            <div role="status" aria-live="polite" aria-relevant="text" style={{display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,color:saveState==="saving"?"#f09428":saveState==="error"?"#f04458":"#12c482",transition:"color .25s ease, opacity .25s ease"}}>
              {saveState==="saving"?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> {t("saving","Сохраняю")}</>:saveState==="error"?<><span>✗</span> {t("save_error","Ошибка сохранения")} <button className="btn-interactive" onClick={retrySave} style={{marginLeft:4,padding:"2px 8px",borderRadius:6,border:"1px solid rgba(239,68,68,.4)",background:"rgba(239,68,68,.1)",color:"#f04458",cursor:"pointer",fontSize:12,fontWeight:700}}>{t("retry","Повторить")}</button></>:<><span style={{animation:"successPop .35s ease"}}>✓</span> {t("saved_short","Сохранено")}</>}
            </div>
            )}
              </>
            )}
          </div>
        </div>

        {user&&onOpenContentPlanHub&&!(shellUi&&sidebarCollapsed)&&!zenMode&&(
          <div className={shellUi?"sa-map-cp-strip":undefined} style={{padding:shellUi?undefined:"10px 16px",borderBottom:shellUi?undefined:"1px solid var(--border)",background:shellUi?undefined:"var(--surface2)"}}>
            <div className={shellUi?"cp-strip-label":undefined} style={{fontSize:10.5,fontWeight:800,color:"var(--text5)",textTransform:"uppercase",letterSpacing:.08,textAlign:"center",marginBottom:shellUi?0:8}}>{t("cp_map_strip_label","Контент-план и разделы")}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:shellUi?14:12,flexWrap:"wrap"}}>
              <MainWorkspaceNav mode="strategy" onStrategy={()=>{}} onContentPlan={onOpenContentPlanHub} t={t} isMobile={isMobile}/>
              {onOpenContentPlanProject&&project?.id&&(
                <button type="button" className={shellUi?"btn-g":"btn-interactive"} onClick={()=>onOpenContentPlanProject()} title={t("cp_from_map_hint","Открыть контент-план этого проекта в полноэкранном режиме")}
                  style={shellUi?{height:32,fontSize:11.5,padding:"0 14px",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6,color:"var(--acc)"}:{padding:"8px 16px",borderRadius:10,border:"1px solid var(--glass-border-accent,var(--border))",background:"var(--accent-soft)",color:"var(--accent-1)",cursor:"pointer",fontSize:13,fontWeight:800,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:8}}>
                  <span aria-hidden>✍️</span>{t("cp_from_map_btn","Контент-план проекта")}
                </button>
              )}
            </div>
          </div>
        )}

        {!zenMode&&(<>
        {/* ROW 2 — view tools + panels + export (в shell вторая строка — экспорт, без вылезания за экран) */}
        <div style={{minHeight:shellUi?56:52,display:"flex",alignItems:"center",gap:isMobile?6:shellUi?12:10,padding:isMobile?"10px 16px":shellUi?"10px 20px":"0 24px",flexWrap:isMobile?"wrap":shellUi?"wrap":"nowrap",width:"100%",minWidth:0,boxSizing:"border-box"}}>

          {/* View tools */}
          <div style={{display:"flex",alignItems:"center",gap:isMobile?4:shellUi?8:6,flexShrink:0}}>
            {!isMobile&&<span style={{fontSize:shellUi?13:12,color:"var(--text4)",letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginRight:2}}>Вид</span>}
            {tb(false,fitView,<>{isMobile?"⊡":<>⊡ {t("fit_view","Вписать")}</>}</>,t("fit_view_hint","Вписать карту в экран"))}
            {selNode&&tb(false,()=>scrollToNode(selNode),<>{isMobile?"◎":<>◎ {t("center_on","К узлу")}</>}</>,t("center_on_hint","Центрировать на выбранном шаге"))}
            {!readOnly&&tb(false,autoLayout,<>{isMobile?"⌥":t("auto_layout","⌥ Расклад")}</>,t("auto_layout_hint","Автоматическая раскладка по связям"))}
            {!readOnly&&tb(false,autoConnect,<>{isMobile?"🔗":t("ai_links","🔗 AI-связи")}</>,t("ai_links_hint","AI предложит связи между шагами"))}
          </div>

          {sep}

          {/* Canvas bg */}
          <div style={{display:"flex",alignItems:"center",gap:shellUi?6:2,flexShrink:0}}>
            {!isMobile&&<span style={{fontSize:shellUi?13:12,color:"var(--text4)",letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginRight:2}}>{t("bg_label","Фон")}</span>}
            {[["grid","⊞","Точки"],["stars","✦","Звёзды"],["none","○","Чисто"]].map(([m,icon,label])=>(
              <button key={m} onClick={()=>setBgMode(m)} title={`Фон: ${label}`}
                style={{height:30,padding:"0 10px",borderRadius:8,border:"none",background:bgMode===m?"rgba(104,54,245,.15)":"transparent",color:bgMode===m?"#a5b4fc":"var(--text4)",cursor:"pointer",fontSize:14,fontWeight:600,flexShrink:0,transition:"all .2s"}}>
                {icon}
              </button>
            ))}
          </div>

          {sep}

          {/* Panels */}
          <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
            {ib(showAI,t("ai_consultant_hint","AI-консультант (Ctrl+Shift+A)"),()=>setShowAI((a:boolean)=>!a),<>✦ AI</>,{width:"auto",padding:"0 10px",fontSize:13,fontWeight:600,color:showAI?"#b4a3ff":"#c4b5ff",borderColor:showAI?"rgba(104,54,245,.5)":"rgba(104,54,245,.28)",background:showAI?"rgba(104,54,245,.14)":"rgba(104,54,245,.07)"})}
            {ib(showMini,t("minimap_hint","Миникарта"),()=>setShowMini((m:boolean)=>!m),<>🗺</>)}
            {ib(false,t("stats_title","Статистика"),()=>setShowStats(true),<>📊</>)}
            {ib(false,t("weekly_briefing","Еженедельный брифинг"),()=>setShowBriefing(true),<>📋</>)}
            {ib(showTour,t("map_tour","Тур по карте"),()=>setShowTour(true),<>🎯</>)}
            {ib(false,t("shortcuts_title","Горячие клавиши")+" (?)",()=>setShowShortcuts(true),<>⌨️</>)}
            {!readOnly&&ib(showDeadlines,t("deadline_reminder","Напоминания о дедлайнах"),()=>setShowDeadlines((d:boolean)=>!d),<>⏰</>,{borderColor:showDeadlines?"rgba(245,158,11,.5)":"",background:showDeadlines?"rgba(245,158,11,.08)":"",color:showDeadlines?"#f09428":""})}
          </div>

          {sep}

          {/* Panels: Simulation, Templates, Gantt */}
          <div style={{display:"flex",alignItems:"center",gap:shellUi?6:3,flexShrink:0}}>
            {!readOnly&&<button onClick={()=>setShowSim(true)} title={t("simulation_hint","Симуляция выполнения стратегии")}
              style={{height:shellUi?30:26,padding:shellUi?"0 12px":"0 10px",borderRadius:8,border:shellUi?"1px solid rgba(104,54,245,.35)":"1px solid rgba(14,165,233,.3)",background:shellUi?"rgba(104,54,245,.1)":"rgba(14,165,233,.07)",color:shellUi?"#c4b5fd":"#38bdf8",cursor:"pointer",fontSize:shellUi?14:13,fontWeight:600,flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
              ⎇ Симуляция
            </button>}
            {!readOnly&&(TIERS[user?.tier||"free"]?.templates)&&(
              <button onClick={()=>setShowTemplates(true)} title={t("templates_hint","Шаблоны карт")}
                style={{height:shellUi?30:26,padding:shellUi?"0 12px":"0 10px",borderRadius:8,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.07)",color:"#fbbf24",cursor:"pointer",fontSize:shellUi?14:13,fontWeight:600,flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
                📋 Шаблоны
              </button>
            )}
            <button onClick={()=>setShowGantt(g=>!g)} title={t("gantt_title","Диаграмма Ганта")}
              style={{height:shellUi?30:26,padding:shellUi?"0 12px":"0 10px",borderRadius:8,border:`1px solid ${showGantt?"rgba(16,185,129,.5)":"rgba(16,185,129,.2)"}`,background:showGantt?"rgba(16,185,129,.14)":"rgba(16,185,129,.06)",color:"#34d399",cursor:"pointer",fontSize:shellUi?14:13,fontWeight:600,flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
              📅 Gantt
            </button>
          </div>

          {sep}

          {/* Export/Import */}
          <div style={{display:"flex",alignItems:"center",gap:shellUi?8:8,flexShrink:shellUi?undefined:0,flexWrap:"wrap",minWidth:0,maxWidth:"100%",...(shellUi?{flexBasis:"100%",width:"100%",paddingTop:8,marginTop:4,borderTop:"1px solid var(--b1)"}:{})}}>
            <span style={{fontSize:shellUi?13:12,color:"var(--text4)",letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginRight:4,flexShrink:0}}>{t("export_label","Экспорт")}</span>
            <button className="sa-tbar-btn" onClick={exportPNG} disabled={exporting} title={t("export_png_title","Скачать PNG")}
              style={{height:shellUi?36:32,padding:shellUi?"0 14px":"0 12px",borderRadius:10,border:"1px solid var(--border)",background:"transparent",color:"var(--text3)",cursor:"pointer",fontSize:shellUi?14:13,fontWeight:600,flexShrink:0}}>
              {exporting?"…":"⬇ PNG"}
            </button>
            <button className="sa-tbar-btn" onClick={exportJSON} title={t("export_json_title","Скачать JSON")}
              style={{height:shellUi?36:32,padding:shellUi?"0 14px":"0 12px",borderRadius:10,border:"1px solid var(--border)",background:"transparent",color:"var(--text3)",cursor:"pointer",fontSize:shellUi?14:13,fontWeight:600,flexShrink:0}}>
              ⬇ JSON
            </button>
            <button className="sa-tbar-btn" onClick={exportPDF} title={t("export_pdf_hint","PDF через печать браузера (Ctrl+P → Сохранить как PDF)")}
              style={{height:shellUi?36:32,padding:shellUi?"0 14px":"0 12px",borderRadius:10,border:"1px solid var(--border)",background:"transparent",color:"var(--text3)",cursor:"pointer",fontSize:shellUi?14:13,fontWeight:600,flexShrink:0}}>
              ⬇ PDF
            </button>
            <button className="sa-tbar-btn--danger" onClick={exportPPTX} title={t("export_pptx","Скачать PPTX")}
              style={{height:shellUi?36:32,padding:shellUi?"0 14px":"0 12px",borderRadius:10,border:"1px solid rgba(239,68,68,.25)",background:"rgba(239,68,68,.06)",color:"#f87171",cursor:"pointer",fontSize:shellUi?14:13,fontWeight:600,flexShrink:0}}>
              ⬇ PPTX
            </button>
            {/* Версии */}
            {API_BASE&&mapData?.id&&(
              <>
                {!readOnly&&<button className="sa-tbar-btn--accent" onClick={saveVersion} title={t("save_version_btn","Сохранить версию")}
                  style={{height:32,padding:"0 12px",borderRadius:10,border:"1px solid rgba(104,54,245,.3)",background:"rgba(104,54,245,.08)",color:"#b4a3ff",cursor:"pointer",fontSize:13,fontWeight:600,flexShrink:0}}>📸 {t("save_version_short","Версия")}</button>}
                <button className="sa-tbar-btn--accent" onClick={()=>setShowVersions(true)} title={t("version_history","История версий")}
                  style={{height:32,padding:"0 12px",borderRadius:10,border:"1px solid rgba(104,54,245,.3)",background:"rgba(104,54,245,.08)",color:"#b4a3ff",cursor:"pointer",fontSize:13,fontWeight:600,flexShrink:0}}>
                  📜 {!isMobile&&t("version_history_short","История")}
                </button>
              </>
            )}
            {/* Онлайн-пользователи */}
            {onlineUsers.length>0&&(
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"0 8px",height:26,borderRadius:6,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.25)"}}>
                {onlineUsers.slice(0,3).map(u=>(
                  <div key={u.email} title={u.name||u.email} style={{width:20,height:20,borderRadius:"50%",background:"linear-gradient(135deg,#12c482,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",border:"2px solid var(--surface)"}}>
                    {(u.name||u.email||"?")[0].toUpperCase()}
                  </div>
                ))}
                <span style={{fontSize:11,color:"#34d399",fontWeight:600}}>{onlineUsers.length}</span>
              </div>
            )}
            {!readOnly&&<><button onClick={importJSON} title="Загрузить JSON"
              style={{height:32,padding:"0 12px",borderRadius:10,border:"1px solid var(--border)",background:"transparent",color:"var(--text3)",cursor:"pointer",fontSize:13,fontWeight:600,flexShrink:0,transition:"all .15s"}}
              onMouseOver={e=>{e.currentTarget.style.background="var(--surface)";}} onMouseOut={e=>{e.currentTarget.style.background="transparent";}}>
              ⬆ JSON
            </button>
            <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={handleImportFile}/>
            <button onClick={shareMap} title={t("share_map","Поделиться картой")}
              style={{height:32,padding:"0 14px",borderRadius:10,border:"1px solid rgba(16,185,129,.35)",background:"rgba(16,185,129,.08)",color:"#34d399",cursor:"pointer",fontSize:13,fontWeight:600,flexShrink:0,display:"flex",alignItems:"center",gap:6,transition:"all .15s"}}
              onMouseOver={e=>{e.currentTarget.style.background="rgba(16,185,129,.14)";}} onMouseOut={e=>{e.currentTarget.style.background="rgba(16,185,129,.08)";}}>
              🔗 {t("share_btn","Поделиться")}
            </button>
            </>}
          </div>

        </div>
        </>)}
      </div>
      </>)}
      {/* canvas — в оболочке макета: .sa-screen-map + .sa-canvas-wrap (точки через :: при grid) */}
      <div className="sa-screen-map screen on" style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
      <div
        className={"sa-canvas-wrap"+(bgMode!=="grid"?" sa-canvas-no-dots":"")}
        style={{
          flex:1,
          position:"relative",
          overflow:"hidden",
          ...(bgMode==="grid"?{}:{}),
          ...(bgMode==="stars"&&theme==="dark"?{background:"var(--map-canvas, #08061a)"}:{}),
          ...(bgMode==="none"?{background:"var(--bg)"}:{}),
        }}>
        {/* stars — только тёмная тема; SVG rect прозрачный иначе звёзды не видны */}
        {bgMode==="stars"&&theme==="dark"&&(
          <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none"}}>
            <SparklesCanvas density={175} speed={0.35} minSz={0.3} maxSz={1.0} color="#ffffff" style={{opacity:.4}}/>
          </div>
        )}
        {shellUi&&!zenMode&&(
          <div className="map-filter-bar">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{opacity:.4,flexShrink:0}} aria-hidden><circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3"/><line x1="7.8" y1="7.8" x2="11" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            <input className="mfb-inp" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("map_search_nodes","Search nodes…")}/>
            <div className="mfb-sep"/>
            {([["all",t("all_statuses","All")],["active",(STATUS as any).active?.label||"In progress"],["completed",(STATUS as any).completed?.label||"Done"],["planning",(STATUS as any).planning?.label||"Not started"]] as const).map(([k,lbl])=>(
              <div key={k} className={"mfb-filter"+(statusFilter===k?" on":"")} onClick={()=>setStatusFilter(k)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setStatusFilter(k);}}>{lbl}</div>
            ))}
            {!readOnly&&(
              <>
                <div className="mfb-sep"/>
                {(TIERS[user?.tier||"free"]?.templates)&&<div className="mfb-filter" onClick={()=>setShowTemplates(true)} title={t("templates_hint","Шаблоны карт")} role="button" tabIndex={0}>📋</div>}
                <div className="mfb-filter" onClick={()=>setShowSim(true)} title={t("simulation_hint","Симуляция")} role="button" tabIndex={0}>▶</div>
              </>
            )}
          </div>
        )}
        {showSearch&&(
          <div style={{position:"absolute",top:56,left:"50%",transform:"translateX(-50%)",zIndex:50,background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:12,padding:"8px 10px",boxShadow:"0 8px 30px rgba(0,0,0,.4)",display:"flex",gap:8,alignItems:"center",minWidth:280,animation:"slideDown .15s ease"}}>
            <span style={{color:"var(--text4)",fontSize:13}}>🔍</span>
            <input autoFocus value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Поиск по названию шага…"
              onKeyDown={e=>{if(e.key==="Escape"){setShowSearch(false);setSearchQ("");}}}
              style={{flex:1,background:"transparent",border:"none",outline:"none",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}/>
            {searchQ&&<span style={{fontSize:13,color:"var(--text4)",fontWeight:600}}>{nodes.filter(n=>n.title.toLowerCase().includes(searchQ.toLowerCase())).length} найдено</span>}
            <button onClick={()=>{setShowSearch(false);setSearchQ("");}} style={{width:20,height:20,borderRadius:5,border:"none",background:"var(--surface)",color:"var(--text4)",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
        )}
        <svg ref={svgRef} width="100%" height="100%"
          onPointerDown={onSvgMouseDown} onPointerMove={onSvgMouseMove} onPointerUp={onSvgMouseUp} onPointerLeave={onSvgMouseUp}
          onWheel={onWheel} style={{cursor:panning.current?"grabbing":"grab",display:"block",touchAction:"none"}}
          onClick={e=>{const t=e.target as Element;if(t===svgRef.current||t?.tagName==="svg"||t?.getAttribute?.("data-canvas-bg")==="1"){setSelNode(null);setSelEdge(null);setCtxMenu(null);}}}
          onDoubleClick={e=>{const t=e.target as Element;if(!readOnly&&(t===svgRef.current||t?.tagName==="svg"||t?.getAttribute?.("data-canvas-bg")==="1")){e.preventDefault();addNodeAt(e.clientX,e.clientY);}}}
          onContextMenu={e=>{const t=e.target as Element;if(t===svgRef.current||t?.tagName==="svg"||t?.getAttribute?.("data-canvas-bg")==="1"){e.preventDefault();if(!readOnly)setCtxMenu({x:e.clientX,y:e.clientY});}}}>
          <defs>
            <clipPath id="nodeTitleClip"><rect x={14} y={2} width={178} height={16} rx={2}/></clipPath>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="sa-edge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent-1)"/>
              <stop offset="100%" stopColor="var(--accent-2)"/>
            </linearGradient>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`translate(${view.x%40},${view.y%40})`}>
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--grid)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={bgMode==="grid"||(bgMode==="stars"&&theme==="dark")?"transparent":"var(--bg)"} data-canvas-bg="1"/>
          <g transform={`translate(${view.x},${view.y}) scale(${view.zoom})`}>
            {edges.filter(e=>!hiddenIds.has(e.source)&&!hiddenIds.has(e.target)).map(e=>(
              <EdgeLine key={e.id} edge={e} nodes={nodes} selected={selEdge?.id===e.id} etypeMap={ETYPE} onClick={ed=>{setSelEdge(ed);setSelNode(null);}}/>
            ))}
            {filteredNodes.map(n=>(
              <NodeCard key={n.id} node={n} selected={selNode?.id===n.id||selNodes.has(n.id)} focused={focusPulseId===n.id} connecting={connecting} connectSource={connectSrc} onClick={onNodeClick} onMouseDown={onNodeMouseDown} onContextMenu={(x,y,nd)=>{if(!readOnly)setCtxMenu({x,y,node:nd});}} theme={theme} statusMap={STATUS}/>
            ))}
          </g>
          {connecting&&(
            <text x={W/2} y={36} textAnchor="middle" fontSize={13} fill="var(--accent-2)" fontWeight={700} style={{pointerEvents:"none",fontFamily:"'Inter',system-ui,sans-serif"}}>
              {connectSrc?`Выберите цель для "${connectSrc.title?.slice(0,20)}"…`:"Нажмите на исходный узел…"}
            </text>
          )}
        </svg>
        {/* Empty state: no nodes at all */}
        {nodes.length===0&&!showOnboarding&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:5}}>
            <div style={{textAlign:"center",padding:32}}>
              <div style={{fontSize:56,marginBottom:16,opacity:.6}}>🗺️</div>
              <div style={{fontSize:16,fontWeight:700,color:"var(--text2)",marginBottom:8}}>{t("map_empty_title","Карта пуста")}</div>
              <div style={{fontSize:14,color:"var(--text4)"}}>{t("map_empty_hint","Нажмите + Шаг, дважды кликните на фон или перетащите фон для перемещения.")}</div>
            </div>
          </div>
        )}
        {/* Empty state: filter/search returned no results */}
        {nodes.length>0&&filteredNodes.length===0&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:5}}>
            <div style={{textAlign:"center",padding:32,background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",boxShadow:"0 8px 32px rgba(0,0,0,.3)"}}>
              <div style={{fontSize:40,marginBottom:12}}>🔍</div>
              <div style={{fontSize:15,fontWeight:700,color:"var(--text2)",marginBottom:6}}>{t("search_no_results","Ничего не найдено")}</div>
              <div style={{fontSize:13,color:"var(--text4)"}}>{t("search_no_results_hint","Сбросьте поиск или фильтр статусов.")}</div>
            </div>
          </div>
        )}
        {/* edge label editor */}
        {selEdge&&!selNode&&!readOnly&&(
          <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"var(--surface)",border:"1px solid var(--glass-border-accent,var(--border))",borderRadius:12,boxShadow:"var(--shadow,0 16px 40px rgba(0,0,0,.7))",zIndex:40,animation:"slideUp .2s ease"}}>
            <span style={{fontSize:13,color:"var(--text4)",fontWeight:600}}>{t("edge_type","Тип связи:")}</span>
            <CustomSelect
              value={selEdge.type||"requires"}
              onChange={v=>{const ne={...selEdge,type:v};pushUndo(nodes,edges);setEdgesUser(es=>es.map(x=>x.id===selEdge.id?ne:x));setSelEdge(ne);}}
              options={Object.entries(ETYPE).map(([k,e])=>{const x=e as {label:string;c:string};return{value:k,label:x.label,dot:x.c};})}
            />
            <input value={selEdge.label||""} onChange={e=>{const ne={...selEdge,label:e.target.value};setEdgesUser(es=>es.map(x=>x.id===selEdge.id?ne:x));setSelEdge(ne);}} placeholder="Подпись…" style={{fontSize:13,padding:"5px 10px",background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:8,color:"var(--text)",outline:"none",fontFamily:"inherit",width:120}}/>
            <input type="number" min={1} max={5} value={selEdge.weight||3} onChange={e=>{const w=Math.max(1,Math.min(5,Number(e.target.value)||3));const ne={...selEdge,weight:w};setEdgesUser(es=>es.map(x=>x.id===selEdge.id?ne:x));setSelEdge(ne);}} title={t("edge_weight","Вес 1–5")} style={{fontSize:13,padding:"5px 6px",width:54,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:8,color:"var(--text)",outline:"none",fontFamily:"inherit"}}/>
            <input value={selEdge.note||""} onChange={e=>{const ne={...selEdge,note:e.target.value};setEdgesUser(es=>es.map(x=>x.id===selEdge.id?ne:x));setSelEdge(ne);}} placeholder={t("edge_note_ph","Заметка…")} title={t("edge_note","Внутренняя заметка о связи")} style={{fontSize:13,padding:"5px 10px",background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:8,color:"var(--text)",outline:"none",fontFamily:"inherit",width:140}}/>
            <button type="button" onClick={()=>{pushUndo(nodes,edges);setEdgesUser(es=>es.filter(x=>x.id!==selEdge.id));setSelEdge(null);}} style={{padding:"5px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.08)",color:"var(--red)",cursor:"pointer",fontSize:13,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6}}><IconTrash/> {t("delete","Удалить")}</button>
          </div>
        )}
        {ctxMenu&&(
          <div className="modal-scale" style={{position:"fixed",left:ctxMenu.x,top:ctxMenu.y,zIndex:400,background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:18,boxShadow:"0 20px 56px rgba(0,0,0,.35)",padding:"12px 0",minWidth:240,backdropFilter:"blur(16px)"}}>
            {ctxMenu.node?(
              <>
                <div style={{padding:"12px 20px",fontSize:12,color:"var(--text4)",borderBottom:"1px solid var(--border)"}}>{ctxMenu.node.title?.slice(0,24)}{(ctxMenu.node.title||"").length>24?"…":""}</div>
                <button onClick={()=>{scrollToNode(ctxMenu.node);setCtxMenu(null);}} style={{width:"100%",padding:"12px 20px",border:"none",background:"none",color:"var(--text2)",fontSize:13,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>↗ {t("center_on_node","Центрировать")}</button>
                {!readOnly&&<>
                  <button onClick={()=>{duplicateNode(ctxMenu.node);setCtxMenu(null);}} style={{width:"100%",padding:"12px 20px",border:"none",background:"none",color:"var(--text2)",fontSize:13,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>📋 {t("duplicate","Дублировать")}</button>
                  <button onClick={()=>{setClipboard(ctxMenu.node);addToast(t("copied","📋 Скопировано"),"info");setCtxMenu(null);}} style={{width:"100%",padding:"12px 20px",border:"none",background:"none",color:"var(--text2)",fontSize:13,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>📄 {t("copy_short","Копировать")}</button>
                  <button onClick={()=>{startConnect(ctxMenu.node);setCtxMenu(null);}} style={{width:"100%",padding:"12px 20px",border:"none",background:"none",color:"var(--text2)",fontSize:13,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>⇒ {t("link_btn","Связать")}</button>
                  <button type="button" onClick={()=>{const ids=selNodes.size>1?Array.from(selNodes):[ctxMenu.node.id];pushUndo(nodes,edges);setNodes(ns=>ns.filter(n=>!ids.includes(n.id)));setEdgesUser(es=>es.filter(e=>!ids.includes(e.source)&&!ids.includes(e.target)));setSelNodes(new Set());setSelNode(null);setCtxMenu(null);}} style={{width:"100%",padding:"12px 20px",border:"none",background:"none",color:"var(--red)",fontSize:13,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}><IconTrash/> {selNodes.size>1?t("delete_selected","Удалить выбранные")+` (${selNodes.size})`:t("delete","Удалить")}</button>
                </>}
              </>
            ):(
              !readOnly&&<button onClick={()=>{addNodeAt(ctxMenu.x,ctxMenu.y);setCtxMenu(null);}} style={{width:"100%",padding:"12px 20px",border:"none",background:"none",color:"var(--text2)",fontSize:13,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>+ {t("add_step_here","Добавить шаг здесь")}</button>
            )}
          </div>
        )}
        {ctxMenu&&<div style={{position:"fixed",inset:0,zIndex:399}} onClick={()=>setCtxMenu(null)}/>}
        {showMini&&!zenMode&&<MiniMap nodes={nodes} edges={edges} viewX={view.x} viewY={view.y} zoom={view.zoom} canvasW={W} canvasH={H} onJump={(x,y)=>{viewRef.current={...viewRef.current,x,y};setView(v=>({...v,x,y}));}} theme={theme} statusMap={STATUS}/>}
        {toasts.map(toast=><Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={()=>setToasts(ts=>ts.filter(x=>x.id!==toast.id))}/>)}
        {selNode&&(
          <RichEditorPanel
            node={selNode}
            aiPanelOpen={showAI}
            isMobile={isMobile}
            ctx={mapData?.ctx||""}
            readOnly={readOnly}
            userName={user?.name||user?.email||"Пользователь"}
            allNodes={nodes}
            allEdges={edges}
            onUpdate={(patch)=>{
              const n={...selNode,...patch};
              const hEntry=(patch.title&&patch.title!==selNode.title)?{id:uid(),type:"edit",at:Date.now(),by:user?.name||user?.email||"user",before:{title:selNode.title},after:{title:patch.title}}:null;
              const fullNode={...n,history:hEntry?[...(selNode.history||[]),hEntry]:(selNode.history||[])};
              pushUndo(nodes,edges);
              updateNode(fullNode);
              setSelNode(fullNode);
              if(!readOnly)emitNodeUpdate(fullNode);
            }}
            onDelete={(id)=>{deleteNode(id);}}
            onClose={()=>setSelNode(null)}
            onScrollTo={scrollToNode}
            onConnect={(cfg)=>{
              if(cfg.startNode){startConnect(cfg.startNode);}
              else if(cfg.source&&cfg.target){
                const ne={id:uid(),source:cfg.source,target:cfg.target,type:cfg.type||"requires",label:""};
                pushUndo(nodes,edges);setEdgesUser(es=>[...es,ne]);
              }
            }}
            onError={(msg)=>addToast(msg,"error")}
            onNotify={(msg,type)=>addToast(msg,type||"info")}
            statusMap={STATUS}
            etypeMap={ETYPE}
          />
        )}
        {showAI&&<AiPanel isMobile={isMobile} nodes={nodes} edges={edges} ctx={mapData?.ctx||""} tier={user?.tier||"free"} projectName={project?.name||""} mapName={mapData?.name||""} userName={user?.name||user?.email||""} msgs={aiChatMsgsLocal} onMsgsChange={setAiChatMsgsLocal} onAddNode={(n)=>{const nn={...n,id:uid(),x:snap((-view.x/view.zoom)+W/view.zoom/2-120+Math.random()*80),y:snap((-view.y/view.zoom)+H/view.zoom/2-64+Math.random()*80),comments:[],history:[]};pushUndo(nodes,edges);setNodes(ns=>[...ns,nn]);if(!readOnly)socketRef.current?.emit("node-add",{mapId:mapData?.id,node:nn});}} onClose={()=>setShowAI(false)} externalMsgs={pendingAiMsgs} onClearExternal={()=>setPendingAiMsgs([])} onError={(msg)=>addToast(msg,"error")} statusMap={STATUS}/>}
        {showStats&&<StatsPopup nodes={nodes} edges={edges} onClose={()=>setShowStats(false)} statusMap={STATUS}/>}
        {showTemplates&&<TemplateModal tier={user?.tier} onSelect={(tmpl:any)=>{setShowTemplates(false);if(tmpl){pushUndo(nodes,edges);setNodes(tmpl.nodes.map((n:any)=>({...n,comments:[],history:[]})));setEdges(tmpl.edges);emitEdgeUpdate(tmpl.edges);setTimeout(fitView,100);setPendingAiMsgs([{role:"ai",text:t("ai_customize_template_offer","Я применил шаблон. Хотите подстроить его под ваш бизнес? Напишите, чем вы занимаетесь и какая цель — я адаптирую шаги под вас.")}]);setShowAI(true);}}} onClose={()=>setShowTemplates(false)} theme={theme}/>}
        {showGantt&&<GanttView nodes={nodes} onClose={()=>setShowGantt(false)} statusMap={STATUS} onRowClick={(n:any)=>{setSelNode(n);setShowGantt(false);}}/>}
        {showTour&&<MapTour onDone={()=>setShowTour(false)}/>}
        {showSim&&<SimulationModal mapData={{...mapData,nodes,edges}} allProjectMaps={allMaps} onClose={()=>setShowSim(false)} theme={theme} statusMap={STATUS}/>}
        {showOnboarding&&<InMapOnboarding project={project} tier={user?.tier} theme={theme} onDone={(mapObj:any)=>{setShowOnboarding(false);const es=mapObj.edges||[];setNodes(mapObj.nodes||[]);setEdges(es);emitEdgeUpdate(es);setTimeout(fitView,200);}} onSkip={()=>{setShowOnboarding(false);setNodes(defaultNodes());}}/>}
        {showBriefing&&(
          <WeeklyBriefingModal nodes={nodes} mapName={mapData?.name||"Карта"} user={user} onClose={()=>setShowBriefing(false)} theme={theme} onError={(msg)=>addToast(msg,"error")}/>
        )}
        {showVersions&&mapData?.id&&(
          <VersionHistoryModal
            mapId={mapData.id} projectId={project?.id||""} theme={theme} isMobile={isMobile}
            onRestore={(v:any)=>{pushUndo(nodes,edges);const es=v.edges||[];setNodes(v.nodes||[]);setEdges(es);emitEdgeUpdate(es);addToast(t("version_restored","Версия восстановлена"),"success");}}
            onError={(msg)=>addToast(msg,"error")}
            onClose={()=>setShowVersions(false)}
          />
        )}
        {/* Напоминания о дедлайнах */}
        {showDeadlines&&!readOnly&&(
          <DeadlineReminders nodes={nodes} onDismiss={()=>setShowDeadlines(false)} onGoToNode={(id:string)=>{
            const n=nodes.find((x:any)=>x.id===id);
            if(n){setView({x:-n.x+W/2,y:-n.y+H/2,zoom:1});viewRef.current={x:-n.x+W/2,y:-n.y+H/2,zoom:1};setSelNode(n);}
          }}/>
        )}
        {/* Удалённые курсоры (WebSocket presence) */}
        {Object.values(remoteCursors).map((c:any)=>(
          <div key={c.email} style={{position:"fixed",left:c.x,top:c.y,pointerEvents:"none",zIndex:500,transform:"translate(-50%,-50%)"}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:"var(--accent-1)",border:"2px solid #fff",boxShadow:"0 2px 8px rgba(0,0,0,.3)"}}/>
            <div style={{position:"absolute",top:12,left:12,background:"var(--accent-1)",color:"var(--accent-on-bg,#fff)",padding:"2px 6px",borderRadius:5,fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{c.name||c.email}</div>
          </div>
        ))}
        {showShortcuts&&(
          <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"var(--modal-overlay-bg,rgba(0,0,0,.6))",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(16px)",padding:isMobile?0:16}} onClick={()=>setShowShortcuts(false)}>
            <div className="glass-panel glass-panel-lg" style={{borderRadius:isMobile?"18px 18px 0 0":24,maxWidth:440,width:isMobile?"100%":"90%",maxHeight:isMobile?"78vh":"none",display:"flex",flexDirection:"column",overflow:"hidden",animation:"scaleIn .2s ease"}} onClick={e=>e.stopPropagation()}>
              <SheetSwipeHandle enabled={isMobile} onClose={()=>setShowShortcuts(false)} />
              <div style={{padding:"32px 36px",flex:1,minHeight:0,overflowY:isMobile?"auto":"visible"}}>
              <div style={{fontSize:15,fontWeight:800,color:"var(--text)",marginBottom:16}}>⌨️ Горячие клавиши</div>
              <p style={{fontSize:12,color:"var(--text4)",marginBottom:12}}>💡 {t("shortcuts_copy_hint","Выделите узел, Ctrl+C — копировать, Ctrl+V — вставить. Комбинации можно копировать из этой подсказки.")}</p>
              {[["Ctrl+Z / Ctrl+Y","Отменить / Повторить"],["Ctrl+Shift+A","Открыть AI-советник"],["Ctrl+F","Поиск шагов"],["Ctrl+A","Выбрать все узлы"],["Ctrl+C","Копировать шаг"],["Ctrl+V","Вставить шаг"],["Delete / Backspace","Удалить выбранное"],["Shift+клик","Мультивыбор узлов"],["Двойной клик на фон","Добавить шаг в точке"],["ПКМ на узле/фоне","Контекстное меню"],["Escape","Снять выбор / закрыть меню"],["← → ↑ ↓","Двигать шаг (Shift=×4)"],["Перетащить фон","Панорамировать"],["Scroll","Масштаб"],["?","Эта подсказка"]].map(row=>(
                <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                  <code style={{fontSize:13,background:"var(--surface)",padding:"2px 7px",borderRadius:5,color:"var(--accent-1)",fontFamily:"'JetBrains Mono',monospace"}}>{row[0]}</code>
                  <span style={{fontSize:13,color:"var(--text3)"}}>{row[1]}</span>
                </div>
              ))}
              <button onClick={()=>setShowShortcuts(false)} style={{marginTop:16,width:"100%",padding:"10px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text3)",cursor:"pointer",fontSize:13,fontWeight:600}}>{t("close","Закрыть")}</button>
              </div>
            </div>
          </div>
        )}

        {showNotifs&&(
          <NotificationsCenterModal
            open={showNotifs}
            onClose={()=>setShowNotifs(false)}
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
            onFollowLink={async(n:any)=>{if(n.link)window.location.href=n.link;}}
          />
        )}
        {!zenMode&&(
        <div className={shellUi?"map-toolbar":"zoom-ctrl glass-card"} style={shellUi?undefined:{position:"absolute",bottom:28,left:28,display:"flex",gap:8,alignItems:"center",zIndex:30,padding:"10px 16px",borderRadius:16,boxShadow:"var(--glass-shadow-accent,none),0 8px 32px rgba(0,0,0,.2)"}}>
          {!readOnly&&shellUi&&(
            <>
              <button type="button" className={"mt-btn"+(!connecting?" on":"")} onClick={()=>{setConnecting(false);setConnectSrc(null);}} title={t("tool_select","Select (V)")} aria-label={t("tool_select","Select")}>▣</button>
              <button type="button" className={"mt-btn"+(connecting?" on":"")} onClick={()=>{setConnecting(c=>!c);setConnectSrc(null);}} title={t("link_mode_hint","Connect")} aria-label={t("link_btn","Связать")}>⇒</button>
              <button type="button" className="mt-btn" onClick={addNode} title={t("add_step_hint","Add node")} aria-label={t("step_short","Шаг")}>+</button>
              <div className="mt-sep" aria-hidden/>
            </>
          )}
          <button className={shellUi?"mt-btn":"zoom-ctrl-btn"} onClick={()=>{const nz=Math.max(.2,view.zoom*.83);viewRef.current={...viewRef.current,zoom:nz};setView(v=>({...v,zoom:nz}));}} title={t("zoom_out","Уменьшить")} style={shellUi?undefined:{width:36,height:36,borderRadius:10,border:"none",background:"var(--surface)",color:"var(--text2)",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
          <div className={shellUi?"mt-zoom":undefined} style={shellUi?undefined:{fontSize:14,color:"var(--text3)",fontWeight:700,minWidth:48,textAlign:"center"}} onClick={shellUi?fitView:undefined} role={shellUi?"button":undefined} tabIndex={shellUi?0:undefined} onKeyDown={shellUi?(e=>{if(e.key==="Enter"||e.key===" ")fitView();}):undefined}>{Math.round(view.zoom*100)}%</div>
          <button className={shellUi?"mt-btn":"zoom-ctrl-btn"} onClick={()=>{const nz=Math.min(3,view.zoom*1.2);viewRef.current={...viewRef.current,zoom:nz};setView(v=>({...v,zoom:nz}));}} title={t("zoom_in","Увеличить")} style={shellUi?undefined:{width:36,height:36,borderRadius:10,border:"none",background:"var(--surface)",color:"var(--text2)",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          {shellUi&&(
            <>
              <button type="button" className="mt-btn" onClick={fitView} title={t("fit_view_hint","Fit (Ctrl+0)")} aria-label={t("fit_view","Вписать")}>⊡</button>
              {!readOnly&&<button type="button" className="mt-btn" onClick={autoLayout} title={t("auto_layout_hint","Auto layout")} aria-label={t("auto_layout","Расклад")}>⌥</button>}
              <button type="button" className="mt-btn" onClick={exportJSON} title={t("export_json_title","Export JSON")} aria-label={t("export_label","Экспорт")}>⬇</button>
              {!readOnly&&<button type="button" className="mt-btn" onClick={shareMap} title={t("share_map","Share")} aria-label={t("share_btn","Поделиться")}>🔗</button>}
              <button type="button" className="mt-btn" onClick={()=>setShowShortcuts(true)} title={t("shortcuts_title","Shortcuts (?)")} aria-label={t("shortcuts_title","Горячие клавиши")}>⌨</button>
              <div className="mt-sep" aria-hidden/>
              <button type="button" className={"mt-btn"+(showAI?" on":"")} onClick={()=>setShowAI(a=>!a)} title={t("ai_consultant_hint","AI")} aria-label={t("ai_consultant","AI Советник")}><span aria-hidden>✦</span></button>
            </>
          )}
        </div>
        )}
      </div>
      </div>
    </>
  );
  return shellUi?(
    <div className={"sa-strategy-ui sa-v-app "+(theme==="dark"?"dk":"lt")} data-theme={theme} data-palette={palette} style={{width:"100%",height:"100%",minHeight:"100vh",maxHeight:"100vh",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <StrategyShellBg/>
      <div className="sa-app" style={{flex:1,minHeight:0,minWidth:0,display:"flex",overflow:"hidden",position:"relative",zIndex:1}}>
        <StrategyShellSidebar
          theme={theme}
          onToggleTheme={onToggleTheme}
          activeNav="map"
          onNavigate={handleShellNav}
          tierLabel={tier.label}
          tierColor={tier.color}
          onTierClick={onProfile}
          lang={lang}
          onLang={code=>setLang(code)}
          userName={user?.name||""}
          userEmail={user?.email||""}
          scenarioCount={0}
          onUserCard={onProfile}
          showContentPlan={!!onOpenContentPlanHub}
          onContentPlan={onOpenContentPlanHub||undefined}
          showTrialBanner={(user?.tier||"free")==="free"}
          onLogoClick={() => onShellGlobalNav?.("dashboard")}
          collapsed={sidebarCollapsed}
          t={t}
        />
        <div className="sa-main" style={{flex:1,minWidth:0,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>{_mapMain}</div>
        {!zenMode&&<FloatingAiAssistant t={t} variant="app" onOpenFullChat={() => setShowAI(true)} />}
      </div>
    </div>
  ):(
    <div className={"sa-strategy-ui "+(theme==="dark"?"dk":"lt")} data-theme={theme} data-palette={palette} style={{width:"100%",maxWidth:"100%",height:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",position:"relative",overflow:"hidden",boxSizing:"border-box"}}>
      <StrategyShellBg/>
      <div style={{flex:1,minHeight:0,position:"relative",zIndex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>{_mapMain}</div>
      {!zenMode&&<FloatingAiAssistant t={t} variant="app" onOpenFullChat={() => setShowAI(true)} />}
    </div>
  );
}

// ── Хаб контент-плана: те же проекты, что и в стратегии ──
