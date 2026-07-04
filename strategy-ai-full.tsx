import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
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
} from "./client/api";
import { makeTfn } from "./client/i18n/makeTfn";
import { StrategyShellBg, type StrategyShellNav } from "./strategy-shell-sidebar";
const ReferenceLandingView = React.lazy(() =>
  import("./reference-landing").then((m) => ({ default: m.ReferenceLandingView }))
);
import { SplashLoaderScreen } from "./client/splash-loader";
import { parseMarketingPath } from "./client/spa-path";
import { applySeoForAppScreen } from "./client/seo-head";
import { LegalDocumentPage, NotFoundPage } from "./client/legal-pages";
import { trackSaEvent } from "./client/analytics";
import { getMaps, getMapsByProject } from "./client/lib/maps-api";
import { LangCtx } from "./client/lang-context";
import { OfflineBanner } from "./client/components/offline-banner";
import { TierSelectionScreen } from "./client/components/tier-selection-screen";
import { AuthModal } from "./client/strategy-modals/auth-modal";
import { CookieConsent } from "./client/components/cookie-consent";
import { ProfileModal } from "./client/strategy-modals/profile-modal";
import { MapEditor } from "./client/map-editor/map-editor";
import { DashboardPage } from "./client/dashboard/dashboard-page";
import { InsightsPage } from "./client/insights/insights-page";
import { AiAdvisorPage } from "./client/ai-advisor/ai-advisor-page";
import { ResetPasswordModal } from "./client/strategy-modals/reset-password-modal";
import { ProjectsPage, ProjectDetail } from "./client/projects/projects";
import { ContentPlanHubPage, ContentPlanProjectPage } from "./client/content-plan/content-plan-pages";
import { TrialBanner, EmailVerifyBanner } from "./client/components/trial-email-banners";
import { SplashScreen, initialMarketingScreen, initialLegalKind } from "./client/components/app-route-boot";

// Оркестратор SPA — экраны вынесены в client/*

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
