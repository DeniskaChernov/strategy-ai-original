import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import {
  API_BASE,
  apiFetch,
  store,
  refreshUserAfterPayment,
  getJWT,
  clearJWT,
  clearRefreshToken,
  getSession,
  clearSession,
  seedDefault,
  normalizeUser,
  patchUser,
  getProjects,
  joinProject,
  normalizeProject,
} from "./client/api";
import { makeTfn } from "./client/i18n/makeTfn";
import { StrategyShellBg, type StrategyShellNav } from "./strategy-shell-sidebar";
import type { AppScreen } from "./client/app-screen";
import { AuthenticatedAppShell } from "./client/components/authenticated-app-shell";
import { MapRouteLoadingShell } from "./client/components/map-route-loading-shell";
import { SplashLoaderScreen } from "./client/splash-loader";
import { parseMarketingPath } from "./client/spa-path";
import { applySeoForAppScreen } from "./client/seo-head";
import { LegalDocumentPage, NotFoundPage } from "./client/legal-pages";
import { trackSaEvent } from "./client/analytics";
import { getMaps } from "./client/lib/maps-api";
import { LangCtx } from "./client/lang-context";
import { OfflineBanner } from "./client/components/offline-banner";
import { TierSelectionScreen } from "./client/components/tier-selection-screen";
import { AuthModal } from "./client/strategy-modals/auth-modal";
import { CookieConsent } from "./client/components/cookie-consent";
import { ResetPasswordModal } from "./client/strategy-modals/reset-password-modal";
import { SplashScreen, initialMarketingScreen, initialLegalKind } from "./client/components/app-route-boot";

const ReferenceLandingView = React.lazy(() =>
  import("./reference-landing").then((m) => ({ default: m.ReferenceLandingView }))
);
const MapEditor = React.lazy(() =>
  import("./client/map-editor/map-editor").then((m) => ({ default: m.MapEditor }))
);
function prefetchMapEditorChunk() {
  void import("./client/map-editor/map-editor");
}
const DashboardPage = React.lazy(() =>
  import("./client/dashboard/dashboard-page").then((m) => ({ default: m.DashboardPage }))
);
const InsightsPage = React.lazy(() =>
  import("./client/insights/insights-page").then((m) => ({ default: m.InsightsPage }))
);
const AiAdvisorPage = React.lazy(() =>
  import("./client/ai-advisor/ai-advisor-page").then((m) => ({ default: m.AiAdvisorPage }))
);
const ProjectsPageLazy = React.lazy(() =>
  import("./client/projects/projects").then((m) => ({ default: m.ProjectsPage }))
);
const ProjectDetailLazy = React.lazy(() =>
  import("./client/projects/projects").then((m) => ({ default: m.ProjectDetail }))
);
const ContentPlanHubPageLazy = React.lazy(() =>
  import("./client/content-plan/content-plan-pages").then((m) => ({ default: m.ContentPlanHubPage }))
);
const ContentPlanProjectPageLazy = React.lazy(() =>
  import("./client/content-plan/content-plan-pages").then((m) => ({ default: m.ContentPlanProjectPage }))
);
const SettingsPageLazy = React.lazy(() =>
  import("./client/settings/settings-page").then((m) => ({ default: m.SettingsPage }))
);

function LazyScreenFallback({ theme, text }: { theme: string; text: string }) {
  return <SplashLoaderScreen theme={theme === "light" ? "light" : "dark"} text={text} />;
}

// Оркестратор SPA — экраны вынесены в client/*

// ── App ──
export default function App(){
  const[screen,setScreen]=useState<AppScreen>(() => initialMarketingScreen() as AppScreen);
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

  const navigateTo = useCallback((next: AppScreen, opts?: { clearProject?: boolean; clearMap?: boolean; clearCp?: boolean }) => {
    const clearProject = opts?.clearProject !== false && ["dashboard", "insights", "ai", "projects", "contentPlanHub", "settings", "landing"].includes(next);
    const clearMap = opts?.clearMap !== false && next !== "map" && next !== "sharedMap";
    const clearCp = opts?.clearCp !== false && next !== "contentPlanProject" && next !== "contentPlanHub";
    if (clearMap) {
      setMapData(null);
      setMapFocusNodeId(null);
      setMapReadOnly(false);
    }
    if (clearProject && next !== "project" && next !== "map" && next !== "contentPlanProject") setProject(null);
    if (clearCp) {
      setCpProject(null);
      setCpMaps([]);
    }
    setScreen(next);
  }, []);

  const initRunningRef=useRef(false);
  const pendingDeepLinkRef=useRef<any>(null);
  const pendingJoinRef=useRef<string|null>(null);

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
      const joinParam=(searchParams.get("join")||"").trim();
      if(joinParam)pendingJoinRef.current=joinParam;
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
              if(await processPendingJoin()){setAuthChecked(true);return;}
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
              setScreen("dashboard");setAuthChecked(true);return;
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
              setScreen("dashboard");setAuthChecked(true);return;
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
      setLoadError(e?.message||t("load_data_failed","Не удалось загрузить данные"));
      setAuthChecked(true);
    }finally{
      initRunningRef.current=false;
    }
  }

  useEffect(()=>{
    (window as any).__sa_onSessionExpired=()=>{
      setUser(null);setProject(null);setMapData(null);setCpProject(null);setCpMaps([]);
      try{window.history.replaceState({},"","/");}catch{}
      setScreen("landing");setShowAuth(true);setAuthTab("login");
    };
    return()=>{delete (window as any).__sa_onSessionExpired;};
  },[]);

  useEffect(()=>{
    applySeoForAppScreen(screen,{legalKind});
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

  useEffect(()=>{
    if(screen==="splash"||screen==="landing"||screen==="sharedMap"||screen==="legal"||screen==="notFound")return;
    const h=()=>{
      const st=history.state?.screen as AppScreen|undefined;
      if(st==="dashboard"||st==="insights"||st==="ai"||st==="projects"||st==="settings"){
        navigateTo(st,{clearProject:true,clearMap:true,clearCp:true});
        return;
      }
      if(screen==="map"&&project){setMapData(null);setScreen("project");}
      else if(screen==="project"&&project){setProject(null);setScreen("projects");}
      else if(screen==="contentPlanProject"&&cpProject){setCpProject(null);setCpMaps([]);setScreen("contentPlanHub");}
      else if(screen==="contentPlanHub"){navigateTo("dashboard");}
      else if(screen==="projects"){navigateTo("dashboard");}
      else if(screen==="insights"||screen==="ai"||screen==="settings"){navigateTo("dashboard");}
    };
    window.addEventListener("popstate",h);
    return()=>window.removeEventListener("popstate",h);
  },[screen,project,cpProject,navigateTo]);

  useEffect(()=>{
    if(screen==="dashboard"&&history.state?.screen!=="dashboard")history.pushState({screen:"dashboard"},"","/app");
    else if(screen==="insights"&&history.state?.screen!=="insights")history.pushState({screen:"insights"},"","/app");
    else if(screen==="ai"&&history.state?.screen!=="ai")history.pushState({screen:"ai"},"","/app");
    else if(screen==="settings"&&history.state?.screen!=="settings")history.pushState({screen:"settings"},"","/app");
    else if(screen==="projects"&&history.state?.screen!=="projects")history.pushState({screen:"projects"},"","/app");
    else if(screen==="project"&&project&&history.state?.screen!=="project")history.pushState({screen:"project",projectId:project.id},"","");
    else if(screen==="map"&&mapData&&history.state?.screen!=="map")history.pushState({screen:"map",mapId:mapData.id},"","");
    else if(screen==="contentPlanHub"&&history.state?.screen!=="contentPlanHub")history.pushState({screen:"contentPlanHub"},"","");
    else if(screen==="contentPlanProject"&&cpProject&&history.state?.screen!=="contentPlanProject")history.pushState({screen:"contentPlanProject",projectId:cpProject.id},"","");
  },[screen,project?.id,mapData?.id,cpProject?.id]);

  // Глобальный обработчик истёкшей сессии — регистрация выше (после всех hooks)
  useEffect(()=>{initApp();},[]);

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

  async function processPendingJoin(): Promise<boolean>{
    const jid=pendingJoinRef.current;
    if(!jid)return false;
    pendingJoinRef.current=null;
    try{
      const p=await joinProject(jid);
      if(p){
        onSelectProject(p);
        try{window.history.replaceState({},"","/app");}catch{}
        return true;
      }
    }catch{/* — */}
    return false;
  }

  async function handleAuth(u:any,isNew:boolean){
    trackSaEvent(isNew?"sign_up":"login",{method:"email"});
    setUser(u);setShowAuth(false);
    try{window.history.replaceState({},"","/app");}catch{}
    if(await processPendingJoin())return;
    if(isNew){setShowTiers(true);}
    else{setScreen("dashboard");}
  }

  function handleGlobalNav(nav:StrategyShellNav){
    if(nav==="dashboard"){navigateTo("dashboard");return;}
    if(nav==="projects"){navigateTo("projects");return;}
    if(nav==="contentPlan"){navigateTo("contentPlanHub");return;}
    if(nav==="ai"){navigateTo("ai");return;}
    if(nav==="insights"){navigateTo("insights");return;}
    if(nav==="settings"||nav==="team"){setShowProfile(false);navigateTo("settings");return;}
    if(nav==="map"){
      try{
        const sp=localStorage.getItem("sa_last_project");
        const sm=localStorage.getItem("sa_last_map");
        if(sp&&sm){
          const proj=JSON.parse(sp);
          const map=JSON.parse(sm);
          onOpenMap({id:map.id,name:map.name},proj,false,false);
          return;
        }
        if(sp){
          onSelectProject(JSON.parse(sp));
          return;
        }
      }catch{/* — */}
      navigateTo("projects");
      return;
    }
    navigateTo("projects");
  }

  async function followAppNotifLink(link:string){
    if(!user?.email)return false;
    try{
      const u=new URL(link,window.location.origin);
      const openRaw=(u.searchParams.get("open")||"").toLowerCase();
      if(!openRaw)return false;
      const dl:any={
        open:openRaw==="contentplan"?"contentPlan":openRaw,
        projectId:u.searchParams.get("projectId")||"",
        mapId:u.searchParams.get("mapId")||"",
        nodeId:u.searchParams.get("nodeId")||"",
      };
      if(openRaw==="contentplan"&&!dl.projectId)delete dl.projectId;
      return openDeepLink(dl,user);
    }catch{return false;}
  }

  function openSettings(){setShowProfile(false);navigateTo("settings");}

  async function onChangeTier(t){
    if(!user)return;
    const updated=await patchUser(user.email,{tier:t});
    if(updated)setUser(updated);
    setShowTiers(false);
    if(screen!=="projects"&&screen!=="project"&&screen!=="map"&&screen!=="contentPlanHub"&&screen!=="contentPlanProject"&&screen!=="settings")setScreen("projects");
  }

  async function onLogout(){
    await clearSession();
    setUser(null);setProject(null);setMapData(null);setCpProject(null);setCpMaps([]);
    setAiChatMsgs([]);
    try{window.history.replaceState({},"","/");}catch{}
    setScreen("landing");
  }

  function onSelectProject(p){
    prefetchMapEditorChunk();
    setProject(p);setScreen("project");
    try{localStorage.setItem("sa_last_project",JSON.stringify({id:p.id,name:p.name}));localStorage.removeItem("sa_last_map");}catch{}
  }

  async function onOpenMap(map,proj,isNew,readOnlyMap=false,focusNodeId:string|null=null){
    prefetchMapEditorChunk();
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

  const shellCommon = user ? {
    user,
    theme,
    palette,
    showProfile,
    onShowProfile: setShowProfile,
    onUpgrade: () => setShowProfile(true),
    onUpdateUser: (u: any) => setUser(u),
    onChangeTier,
    onLogout,
    onToggleTheme: toggleTheme,
    onPaletteChange: changePalette,
  } : null;

  return(
    <LangCtx.Provider value={{lang,setLang:changeLang,t}}>
      <div data-theme={theme} data-palette={appPalette} className="screen-wrap" style={{minHeight:"100vh",background:screen==="landing"||screen==="legal"||screen==="notFound"?"transparent":"var(--bg)",transition:"background .35s ease, color .35s ease"}}>
<OfflineBanner/>
      <>
        {showTiers&&(
          <div className={"sa-strategy-ui "+(theme==="dark"?"dk":"lt")} data-theme={theme} data-palette={palette} style={{minHeight:"100vh",background:"var(--bg)",position:"relative",fontFamily:"'Inter',system-ui,sans-serif"}}>
            <StrategyShellBg/>
            <TierSelectionScreen isNew={true} currentUser={user} theme={theme} palette={palette}
              onSelect={onChangeTier}
              onBack={()=>{setShowTiers(false);navigateTo("projects");}}
            />
          </div>
        )}
        {!showTiers&&<>
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
          <React.Suspense fallback={<LazyScreenFallback theme={theme} text={t("loading","Загрузка…")}/>}>
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
          </React.Suspense>
        )}
        {screen==="dashboard"&&user&&shellCommon&&(
          <AuthenticatedAppShell {...shellCommon}>
            <React.Suspense fallback={<LazyScreenFallback theme={theme} text={t("loading","Загрузка…")}/>}>
              <DashboardPage
                user={user} theme={theme}
                onToggleTheme={toggleTheme}
                onProfile={openSettings}
                onLogout={onLogout}
                onChangeTier={()=>setShowTiers(true)}
                onShellNav={handleGlobalNav}
                onOpenProject={onSelectProject}
                onOpenMap={onOpenMap}
                onOpenContentPlanHub={()=>navigateTo("contentPlanHub")}
                aiChatMsgs={aiChatMsgs}
                aiChatSetMsgs={setAiChatMsgs}
              />
            </React.Suspense>
          </AuthenticatedAppShell>
        )}
        {screen==="insights"&&user&&shellCommon&&(
          <AuthenticatedAppShell {...shellCommon}>
            <React.Suspense fallback={<LazyScreenFallback theme={theme} text={t("loading","Загрузка…")}/>}>
              <InsightsPage
                user={user} theme={theme}
                onToggleTheme={toggleTheme}
                onProfile={openSettings}
                onLogout={onLogout}
                onChangeTier={()=>setShowTiers(true)}
                onShellNav={handleGlobalNav}
                onOpenContentPlanHub={()=>navigateTo("contentPlanHub")}
                onOpenProject={onSelectProject}
                onOpenMap={onOpenMap}
                onOpenContentPlanProject={(p:any,m:any[])=>{setCpProject(p);setCpMaps(Array.isArray(m)?m:[]);navigateTo("contentPlanProject",{clearProject:false,clearMap:true,clearCp:false});}}
              />
            </React.Suspense>
          </AuthenticatedAppShell>
        )}
        {screen==="ai"&&user&&shellCommon&&(
          <AuthenticatedAppShell {...shellCommon}>
            <React.Suspense fallback={<LazyScreenFallback theme={theme} text={t("loading","Загрузка…")}/>}>
              <AiAdvisorPage
                user={user} theme={theme}
                onToggleTheme={toggleTheme}
                onProfile={openSettings}
                onLogout={onLogout}
                onChangeTier={()=>setShowTiers(true)}
                onShellNav={handleGlobalNav}
                onOpenContentPlanHub={()=>navigateTo("contentPlanHub")}
                onOpenProject={onSelectProject}
                onOpenMap={onOpenMap}
                onOpenContentPlanProject={(p:any,m:any[])=>{setCpProject(p);setCpMaps(Array.isArray(m)?m:[]);navigateTo("contentPlanProject",{clearProject:false,clearMap:true,clearCp:false});}}
                aiChatMsgs={aiChatMsgs}
                aiChatSetMsgs={setAiChatMsgs}
              />
            </React.Suspense>
          </AuthenticatedAppShell>
        )}
        {screen==="settings"&&user&&shellCommon&&(
          <AuthenticatedAppShell {...shellCommon}>
            <React.Suspense fallback={<LazyScreenFallback theme={theme} text={t("loading","Загрузка…")}/>}>
              <SettingsPageLazy
                user={user}
                theme={theme}
                palette={palette}
                onToggleTheme={toggleTheme}
                onPaletteChange={changePalette}
                onUpdateUser={(u:any)=>setUser(u)}
                onChangeTier={onChangeTier}
                onLogout={onLogout}
                onShellNav={handleGlobalNav}
                onOpenContentPlanHub={()=>navigateTo("contentPlanHub")}
              />
            </React.Suspense>
          </AuthenticatedAppShell>
        )}
        {screen==="projects"&&user&&shellCommon&&(
          <AuthenticatedAppShell {...shellCommon}>
            <React.Suspense fallback={<LazyScreenFallback theme={theme} text={t("loading","Загрузка…")}/>}>
              <ProjectsPageLazy
                user={user} theme={theme}
                onSelectProject={onSelectProject}
                onOpenMap={onOpenMap}
                onLogout={onLogout}
                onChangeTier={(tier:string)=>onChangeTier(tier)}
                onProfile={openSettings}
                onToggleTheme={toggleTheme}
                aiChatMsgs={aiChatMsgs}
                aiChatSetMsgs={setAiChatMsgs}
                onOpenContentPlanHub={()=>navigateTo("contentPlanHub")}
                onOpenContentPlanProject={(p:any,m:any[])=>{setCpProject(p);setCpMaps(Array.isArray(m)?m:[]);navigateTo("contentPlanProject",{clearProject:false,clearMap:true,clearCp:false});}}
                onGoToDashboard={()=>navigateTo("dashboard")}
                onGoToAi={()=>navigateTo("ai")}
                onGoToInsights={()=>navigateTo("insights")}
              />
            </React.Suspense>
          </AuthenticatedAppShell>
        )}
        {screen==="contentPlanHub"&&user&&shellCommon&&(
          <AuthenticatedAppShell {...shellCommon}>
            <React.Suspense fallback={<LazyScreenFallback theme={theme} text={t("loading","Загрузка…")}/>}>
              <ContentPlanHubPageLazy
                user={user}
                theme={theme}
                onBackToStrategy={()=>navigateTo("projects")}
                onOpenProject={(p:any,maps:any[])=>{setCpProject(p);setCpMaps(Array.isArray(maps)?maps:[]);navigateTo("contentPlanProject",{clearProject:false,clearMap:true,clearCp:false});}}
                onLogout={onLogout}
                onProfile={openSettings}
                onToggleTheme={toggleTheme}
                onUpgrade={()=>setShowProfile(true)}
                aiChatMsgs={aiChatMsgs}
                aiChatSetMsgs={setAiChatMsgs}
                onSelectProject={onSelectProject}
                onOpenMap={onOpenMap}
                onShellNav={handleGlobalNav}
              />
            </React.Suspense>
          </AuthenticatedAppShell>
        )}
        {screen==="contentPlanProject"&&user&&cpProject&&shellCommon&&(
          <AuthenticatedAppShell {...shellCommon}>
            <React.Suspense fallback={<LazyScreenFallback theme={theme} text={t("loading","Загрузка…")}/>}>
              <ContentPlanProjectPageLazy
                user={user}
                project={cpProject}
                maps={cpMaps}
                theme={theme}
                onBackToHub={()=>{setCpProject(null);setCpMaps([]);navigateTo("contentPlanHub");}}
                onOpenStrategyProject={()=>{setProject(cpProject);setCpProject(null);setCpMaps([]);navigateTo("project",{clearProject:false,clearMap:true,clearCp:true});}}
                onLogout={onLogout}
                onProfile={openSettings}
                onToggleTheme={toggleTheme}
                onChangeTier={onChangeTier}
                onUpgrade={()=>setShowProfile(true)}
                aiChatMsgs={aiChatMsgs}
                aiChatSetMsgs={setAiChatMsgs}
                onSelectProject={onSelectProject}
                onOpenMap={onOpenMap}
                onSwitchContentPlanProject={(p:any,m:any[])=>{setCpProject(p);setCpMaps(Array.isArray(m)?m:[]);}}
                onShellNav={handleGlobalNav}
              />
            </React.Suspense>
          </AuthenticatedAppShell>
        )}
        {screen==="project"&&user&&project&&shellCommon&&(
          <AuthenticatedAppShell {...shellCommon}>
            <React.Suspense fallback={<LazyScreenFallback theme={theme} text={t("loading","Загрузка…")}/>}>
              <ProjectDetailLazy
                user={user} project={project} theme={theme}
                onBack={()=>navigateTo("projects")}
                onOpenMap={onOpenMap}
                onProfile={openSettings}
                onToggleTheme={toggleTheme}
                onChangeTier={onChangeTier}
                onUpgrade={()=>setShowProfile(true)}
                onShellNav={handleGlobalNav}
                onLogout={onLogout}
                onOpenContentPlanHub={()=>navigateTo("contentPlanHub")}
                onOpenContentPlanProject={(p:any,m:any[])=>{setCpProject(p);setCpMaps(Array.isArray(m)?m:[]);navigateTo("contentPlanProject",{clearProject:false,clearMap:true,clearCp:false});}}
                aiChatMsgs={aiChatMsgs}
                aiChatSetMsgs={setAiChatMsgs}
              />
            </React.Suspense>
          </AuthenticatedAppShell>
        )}
        {screen==="map"&&user&&mapData&&project&&shellCommon&&(
          <AuthenticatedAppShell {...shellCommon}>
            <React.Suspense fallback={
              <MapRouteLoadingShell
                user={user}
                theme={theme}
                text={t("loading","Загрузка…")}
                lang={lang}
                onLang={changeLang}
                onShellNav={handleGlobalNav}
                onProfile={openSettings}
                onLogout={onLogout}
                onToggleTheme={toggleTheme}
                t={t}
              />
            }>
              <MapEditor
                user={user} mapData={mapData} project={project}
                isNew={mapIsNew} theme={theme} readOnly={mapReadOnly} palette={palette}
                onBack={()=>setScreen("project")}
                onProfile={openSettings}
                onToggleTheme={toggleTheme}
                onOpenContentPlanHub={()=>navigateTo("contentPlanHub")}
                onOpenContentPlanProject={async()=>{
                  if(!project?.id)return;
                  try{
                    const ms=await getMaps(project.id);
                    setCpProject(project);
                    setCpMaps(Array.isArray(ms)?ms:[]);
                    navigateTo("contentPlanProject",{clearProject:false,clearMap:true,clearCp:false});
                  }catch{}
                }}
                onShellGlobalNav={handleGlobalNav}
                onFollowNotifLink={followAppNotifLink}
                aiChatMsgs={aiChatMsgs}
                aiChatSetMsgs={setAiChatMsgs}
                focusNodeId={mapFocusNodeId}
              />
            </React.Suspense>
          </AuthenticatedAppShell>
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
        </>}
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
