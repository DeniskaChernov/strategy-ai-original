import React, { useState, useEffect, useMemo } from "react";
import { API_BASE, apiFetch, store, patchUser, hashPw, deleteProject, saveProject, clearJWT, clearSession } from "../api";
import { useLang } from "../lang-context";
import { useIsMobile } from "../hooks/use-is-mobile";
import { SheetSwipeHandle } from "../components/sheet-swipe-handle";
import { Toggle } from "../components/toggle";
import { FeatureValue } from "../components/feature-value";
import { IconUser, IconLock, IconSettings, IconChart, IconCard } from "../components/icons";
import { TIERS } from "../lib/tiers";
import { TIER_ORDER, TIER_MKT, TIER_FEAT_KEY, ALL_FEATURES } from "../lib/tier-marketing-data";
import { getTierPrice } from "../lib/strategy-labels";
import { fmt } from "../lib/util";

export function ProfileModal({user,onClose,onUpdate,onLogout,onChangeTier,theme="dark",onToggleTheme,palette="indigo",onPaletteChange,settingsShell=false,pageMode=false}){
  const{t,lang,setLang}=useLang();
  const tier=TIERS[user.tier]||TIERS.free;
  const isMobile=useIsMobile();
  const[tab,setTab]=useState("profile");
  const[showDeleteConfirm,setShowDeleteConfirm]=useState(false);const[delPw,setDelPw]=useState("");const[delErr,setDelErr]=useState("");
  const[selected,setSelected]=useState(user.tier||"free");
  const[buyPhase,setBuyPhase]=useState(null);
  const[name,setName]=useState(user.name||"");
  const[bio,setBio]=useState(user.bio||"");
  const[cp,setCp]=useState("");const[np,setNp]=useState("");const[cf,setCf]=useState("");const[showPw,setShowPw]=useState(false);
  const[msg,setMsg]=useState(null);const[loading,setLoading]=useState(false);
  const[cardNum,setCardNum]=useState("");const[cardName,setCardName]=useState("");const[cardExp,setCardExp]=useState("");const[cardCvv,setCardCvv]=useState("");const[cardError,setCardError]=useState(null);
  // settings state
  const[notifEmail,setNotifEmail]=useState(user.notifEmail!==false);
  const[notifPush,setNotifPush]=useState(user.notifPush!==false);
  const[autoSave,setAutoSave]=useState(user.autoSave!==false);
  const[compactMode,setCompactMode]=useState(user.compactMode||false);
  const[defaultView,setDefaultView]=useState(user.defaultView||"canvas");
  const[aiLang,setAiLang]=useState(user.aiLang||"ru");
  const[uiLang,setUiLang]=useState(lang);
  const[settingsSaved,setSettingsSaved]=useState(false);
  const[usage,setUsage]=useState<{maps?:{used:number};projects?:{used:number};scenarios?:{used:number}}|null>(null);

  useEffect(()=>{
    if(tab!=="tier"||!API_BASE)return;
    apiFetch("/api/tiers/usage").then(d=>setUsage(d.usage||null)).catch(()=>setUsage(null));
  },[tab]);

  const selTier=TIERS[selected]||TIERS.free;
  const curIdx=TIER_ORDER.indexOf(user.tier||"free");
  const isCurrentTier=selected===user.tier;
  const isUpgrade=TIER_ORDER.indexOf(selected)>curIdx;
  const fi=useMemo(()=>({width:"100%",padding:"10px 13px",fontSize:13,background:"var(--input-bg)",border:"1px solid var(--input-border)",borderRadius:9,color:"var(--text)",outline:"none",marginBottom:10,fontFamily:"'Inter',system-ui,sans-serif",transition:"border-color .18s ease,box-shadow .18s ease"} as React.CSSProperties),[]);
  function formatCardNum(v){return v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();}
  function formatExp(v){const d=v.replace(/\D/g,"").slice(0,4);return d.length>2?d.slice(0,2)+"/"+d.slice(2):d;}
  async function saveName(){
    if(!name.trim())return;
    setLoading(true);
    try{
      const u=await patchUser(user.email,{name:name.trim(),bio:bio.trim()});
      if(u)onUpdate(u);
      setMsg({t:t("profile_saved","Профиль обновлён ✓"),ok:true});
    }catch(e:any){setMsg({t:e?.message||t("save_error","Ошибка сохранения"),ok:false});}
    setLoading(false);
  }
  async function changePw(){
    if(!cp||!np){setMsg({t:t("fill_all_fields","Заполните все поля"),ok:false});return;}
    if(np.length<6){setMsg({t:t("min_6_chars","Минимум 6 символов"),ok:false});return;}
    if(np!==cf){setMsg({t:t("pw_mismatch","Пароли не совпадают"),ok:false});return;}
    setLoading(true);
    if(API_BASE){
      try{
        await apiFetch("/api/auth/change-password",{method:"POST",body:JSON.stringify({currentPassword:cp,newPassword:np})});
        setCp("");setNp("");setCf("");setMsg({t:t("pw_changed","Пароль изменён ✓"),ok:true});
      }catch(e:any){setMsg({t:e.message||t("pw_change_err","Ошибка смены пароля"),ok:false});}
      setLoading(false);return;
    }
    const a=await store.get("sa_acc")||[],acc=a.find((x:any)=>x.email===user.email);
    if(!acc||acc.pwHash!==hashPw(user.email,cp)){setMsg({t:t("wrong_pw","Неверный текущий пароль"),ok:false});setLoading(false);return;}
    await patchUser(user.email,{pwHash:hashPw(user.email,np)});
    setCp("");setNp("");setCf("");setMsg({t:t("pw_changed","Пароль изменён ✓"),ok:true});setLoading(false);
  }
  async function saveSettings(){
    setLoading(true);setMsg(null);
    try{
      const u=await patchUser(user.email,{notifEmail,notifPush,autoSave,compactMode,defaultView,aiLang,theme,palette});
      if(u)onUpdate(u);
      if(uiLang!==lang)setLang(uiLang);
      setSettingsSaved(true);
      setTimeout(()=>setSettingsSaved(false),2200);
    }catch(e:any){setMsg({t:e?.message||t("save_error","Ошибка сохранения"),ok:false});}
    setLoading(false);
  }
  async function executeBuy(){
    // Dev-аккаунт — мгновенное переключение без оплаты
    if(user.is_dev){
      setCardError(null);setBuyPhase("processing");
      await new Promise(r=>setTimeout(r,600));
      const u=await patchUser(user.email,{tier:selected});if(u)onUpdate(u);setBuyPhase("success");
      await new Promise(r=>setTimeout(r,1800));onClose();return;
    }
    // Через бэкенд — Stripe Checkout
    if(API_BASE&&selected!=="free"){
      setCardError(null);setBuyPhase("processing");
      try{
        const d=await apiFetch("/api/payments/checkout",{method:"POST",body:JSON.stringify({tierKey:selected})});
        if(d.checkoutUrl){window.location.href=d.checkoutUrl;return;}
        setCardError(t("checkout_no_url","Не удалось получить ссылку на оплату. Проверьте настройки Stripe."));
        setBuyPhase(null);
        return;
      }catch(e:any){setCardError(e.message||t("save_error","Ошибка оплаты"));setBuyPhase(null);return;}
    }
    // Fallback-имитация (если бэкенд не подключён — для тестирования)
    if(isUpgrade){
      const rawNum=cardNum.replace(/\s/g,"");
      if(rawNum.length<16){setCardError(t("card_number_ph","Введите полный номер карты (16 цифр)"));return;}
      if(!cardName.trim()){setCardError(t("card_holder_ph","Введите имя держателя"));return;}
      if(cardExp.length<5){setCardError(t("card_expiry_ph","Введите срок действия ММ/ГГ"));return;}
      if(cardCvv.length<3){setCardError(t("card_cvv_ph","Введите CVV"));return;}
    }
    setCardError(null);
    setBuyPhase("processing");await new Promise(r=>setTimeout(r,1800));
    const u=await patchUser(user.email,{tier:selected});if(u)onUpdate(u);setBuyPhase("success");
    await new Promise(r=>setTimeout(r,2400));onClose();
  }
  async function handleDeleteAccount(){
    setDelErr("");
    if(API_BASE&&!delPw){setDelErr(t("delete_need_pw","Введите пароль для подтверждения"));return;}
    setLoading(true);
    try{
      if(API_BASE){
        await apiFetch("/api/auth/account",{method:"DELETE",body:JSON.stringify({password:delPw})});
        clearJWT();
        setShowDeleteConfirm(false);setDelPw("");
        onClose();onLogout();return;
      }
      setShowDeleteConfirm(false);
      const a=((await store.get("sa_acc"))||[]).filter((x:any)=>x.email!==user.email);
      await store.set("sa_acc",a);
      const allProj=(await store.get("sa_proj"))||[];
      for(const p of allProj){
        if(p.owner===user.email)await deleteProject(p.id);
        else if(p.members?.some(m=>m.email===user.email))await saveProject({...p,members:(p.members||[]).filter(m=>m.email!==user.email)});
      }
      await clearSession();
      onClose();
      onLogout();
    }catch(e:any){
      const m=e?.message||t("delete_err","Ошибка при удалении");
      if(showDeleteConfirm)setDelErr(m); else setMsg({t:m,ok:false});
    }
    setLoading(false);
  }
  const[closing,setClosing]=useState(false);
  const handleClose=()=>{if(closing)return;setClosing(true);setTimeout(()=>onClose(),260);};
  useEffect(()=>{const h=e=>{if(e.key==="Escape"&&!buyPhase)handleClose();};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[buyPhase,closing]);

  const TABS:Array<[string,React.ReactNode,string]>=[
    ["profile",<IconUser/>,t("profile_title","Профиль")],
    ["security",<IconLock/>,t("security_title","Безопасность")],
    ["settings",<IconSettings/>,t("settings_title","Настройки")],
    ["stats",<IconChart/>,t("stats_tab","Статистика")],
    ["tier",<IconCard/>,t("billing_title","Тариф")],
  ];

  const useSettingsLayout=settingsShell||pageMode;
  const tabNav=useSettingsLayout?(
    <div className="settings-nav" role="tablist" aria-label={t("settings_title","Настройки")}>
      <div className="slbl" style={{padding:"0 7px 8px"}}>{t("settings_title","Настройки")}</div>
      {TABS.map(([k,_icon,label])=>(
        <div key={k as string} role="tab" aria-selected={tab===k} className={"sni"+(tab===k?" on":"")} onClick={()=>{setTab(k as string);setMsg(null);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){setTab(k as string);setMsg(null);}}} tabIndex={0}>{label}</div>
      ))}
      <div className="sni" style={{marginTop:"auto"}} onClick={onLogout} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")onLogout();}} role="button" tabIndex={0}>{t("logout","Выйти")}</div>
    </div>
  ):(
    <div className="sa-profile-tabs" role="tablist" aria-label={t("profile_title","Профиль")} style={{display:"flex",gap:4,padding:"8px 20px 0",flexShrink:0,borderBottom:"1px solid var(--border)",background:"var(--bg2)"}}>
      {TABS.map(([k,icon,label])=>(
        <button key={k as string} type="button" role="tab" aria-selected={tab===k} className={"sa-profile-tab"+(tab===k?" on":"")} onClick={()=>{setTab(k as string);setMsg(null);}} style={{padding:"10px 14px",border:"none",background:tab===k?"var(--accent-soft)":"transparent",color:tab===k?"var(--text)":"var(--text4)",fontSize:13.5,fontWeight:tab===k?700:500,cursor:"pointer",borderBottom:tab===k?`2px solid ${tier.color}`:"2px solid transparent",borderRadius:"10px 10px 0 0",transition:"all .15s",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
          <span style={{display:"inline-flex",alignItems:"center"}} aria-hidden="true">{icon}</span>{label}
        </button>
      ))}
      <div style={{flex:1}}/>
      <button type="button" className="sa-pf-logout" onClick={onLogout}>
        <span aria-hidden="true">⎋</span> {t("logout","Выйти")}
      </button>
    </div>
  );

  const tabPanels=(
        <div className={useSettingsLayout?"settings-body":undefined} style={{flex:1,minHeight:380,overflow:"hidden",display:"flex"}}>
          {tab==="profile"&&(
            <div className="tab-content" style={{flex:1,overflowY:"auto",padding:isMobile?"20px 16px":"28px 32px",minHeight:380}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?24:28,maxWidth:680}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:10}}>{t("display_name","Отображаемое имя")}</div>
                  <input style={fi} placeholder={t("display_name","Ваше имя")} value={name} onChange={e=>setName(e.target.value)} onFocus={e=>e.target.style.borderColor="var(--accent-1)"} onBlur={e=>e.target.style.borderColor="var(--input-border)"}/>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:10}}>{t("bio_label","О себе")}</div>
                  <textarea style={{...fi,height:72,resize:"vertical",lineHeight:1.5}} placeholder={t("bio_label","Краткое описание (должность, компания…)")} value={bio} onChange={e=>setBio(e.target.value)} onFocus={e=>e.target.style.borderColor="var(--accent-1)"} onBlur={e=>e.target.style.borderColor="var(--input-border)"}/>
                  <button onClick={saveName} disabled={loading||!name.trim()} style={{padding:"11px 22px",borderRadius:10,border:"none",background:"linear-gradient(135deg,var(--accent-1),var(--accent-2))",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
                    {loading?t("saving","Сохраняю…"):t("save","Сохранить профиль")}
                  </button>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:10}}>Email</div>
                  <div style={{padding:"11px 14px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",marginBottom:16}}>
                    <div style={{fontSize:13,color:"var(--text)",fontWeight:600}}>{user.email}</div>
                    <div style={{fontSize:13.5,color:"var(--text5)",marginTop:3}}>{t("email_no_change","Email нельзя изменить")}</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:10}}>{t("account_created","Аккаунт создан")}</div>
                  <div style={{padding:"11px 14px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",marginBottom:16}}>
                    <div style={{fontSize:13,color:"var(--text)",fontWeight:600}}>{user.createdAt?new Date(user.createdAt).toLocaleDateString(lang==="en"?"en-US":lang==="uz"?"uz-UZ":"ru-RU",{day:"numeric",month:"long",year:"numeric"}):"—"}</div>
                  </div>
                  <div style={{padding:"14px 16px",borderRadius:12,background:`${tier.color}10`,border:`1px solid ${tier.color}33`}}>
                    <div style={{fontSize:13,color:"var(--text4)",marginBottom:4}}>{t("current_plan","Текущий тариф")}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:18}}>{tier.badge}</span>
                      <div>
                        <div style={{fontSize:14,fontWeight:800,color:tier.color}}>{tier.label}</div>
                        <div style={{fontSize:13,color:"var(--text4)"}}>{getTierPrice(user.tier||"free",t)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {msg&&<div style={{marginTop:16,maxWidth:680,padding:"10px 15px",borderRadius:10,background:msg.ok?"rgba(16,185,129,.08)":"rgba(239,68,68,.08)",border:`1px solid ${msg.ok?"rgba(16,185,129,.25)":"rgba(239,68,68,.25)"}`,color:msg.ok?"var(--green)":"var(--red)",fontSize:13.5}}>{msg.t}</div>}
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {tab==="security"&&(
            <div className="tab-content" style={{flex:1,overflowY:"auto",padding:"28px 32px",minHeight:380}}>
              <div style={{maxWidth:420}}>
                <div style={{fontSize:13,fontWeight:800,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:10}}>{t("login_methods","Вход в аккаунт")}</div>
                <div style={{padding:"13px 16px",borderRadius:11,background:"var(--surface)",border:"1px solid var(--border)",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>✉️ Email</div>
                    <div style={{fontSize:12,color:"var(--text4)",marginTop:2}}>{user.email}</div>
                  </div>
                  <div style={{padding:"4px 10px",borderRadius:8,background:user.emailVerified!==false?"rgba(16,185,129,.12)":"rgba(245,158,11,.12)",border:`1px solid ${user.emailVerified!==false?"rgba(16,185,129,.3)":"rgba(245,158,11,.3)"}`,color:user.emailVerified!==false?"var(--green)":"var(--amber)",fontSize:12,fontWeight:700}}>
                    {user.emailVerified!==false?t("email_verified","Подтверждён"):t("email_not_verified","Не подтверждён")}
                  </div>
                </div>
                {API_BASE&&(
                  <div style={{padding:"12px 16px",borderRadius:11,background:"var(--surface2)",border:"1px solid var(--border)",marginBottom:20,fontSize:12,color:"var(--text4)"}} role="note">
                    {t("oauth_roadmap","OAuth (Google) запланирован в roadmap — пока доступен вход по email.")}
                  </div>
                )}
                <div style={{fontSize:15,fontWeight:800,color:"var(--text)",marginBottom:4}}>{t("change_password","Изменить пароль")}</div>
                <div style={{fontSize:13.5,color:"var(--text4)",marginBottom:20}}>{t("pw_hint","Пароль должен быть не менее 6 символов")}</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.7}}>{t("current_password","Текущий пароль")}</div>
                  <button type="button" onClick={()=>setShowPw(v=>!v)} aria-pressed={showPw} style={{display:"inline-flex",alignItems:"center",gap:5,background:"transparent",border:"none",cursor:"pointer",color:"var(--text4)",fontSize:12,fontWeight:600,padding:0}}>
                    {showPw?(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M10.6 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-0.4 1-1.2 2.2-2.4 3.3M6.3 6.3C4 7.7 2.6 9.9 2 12c1 2.5 5 7 10 7 1.6 0 3-0.4 4.3-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M9.5 9.6a3.5 3.5 0 004.9 4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>):(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7s-9-4.5-10-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8"/></svg>)}
                    {showPw?t("pw_hide","Скрыть"):t("pw_show","Показать")}
                  </button>
                </div>
                <input style={fi} type={showPw?"text":"password"} placeholder={t("current_password","Текущий пароль")} value={cp} onChange={e=>setCp(e.target.value)} autoComplete="current-password" onFocus={e=>e.target.style.borderColor="var(--accent-1)"} onBlur={e=>e.target.style.borderColor="var(--input-border)"}/>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text4)",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>{t("new_password_label","Новый пароль")}</div>
                <input style={fi} type={showPw?"text":"password"} placeholder={t("pw_hint","Мин. 6 символов")} value={np} onChange={e=>setNp(e.target.value)} autoComplete="new-password" onFocus={e=>e.target.style.borderColor="var(--accent-1)"} onBlur={e=>e.target.style.borderColor="var(--input-border)"}/>
                <input style={fi} type={showPw?"text":"password"} placeholder={t("confirm_password","Повторите новый пароль")} value={cf} onChange={e=>setCf(e.target.value)} autoComplete="new-password" onFocus={e=>e.target.style.borderColor="var(--accent-1)"} onBlur={e=>e.target.style.borderColor="var(--input-border)"}/>
                {np&&(
                  <div style={{marginBottom:12,padding:"10px 14px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)"}}>
                    <div style={{fontSize:13,color:"var(--text4)",marginBottom:6}}>{t("pw_strength","Надёжность пароля")}</div>
                    <div style={{display:"flex",gap:3}}>
                      {[np.length>=6,/[A-Z]/.test(np),/[0-9]/.test(np),/[^a-zA-Z0-9]/.test(np)].map((ok,i)=>(
                        <div key={i} style={{flex:1,height:4,borderRadius:2,background:ok?"var(--green)":"var(--border2)",transition:"background .3s"}}/>
                      ))}
                    </div>
                    <div style={{fontSize:13,color:"var(--text5)",marginTop:4}}>{[np.length>=6&&t("chars_6plus","6+"),/[A-Z]/.test(np)&&t("uppercase_chars","A-Z"),/[0-9]/.test(np)&&"0-9",/[^a-zA-Z0-9]/.test(np)&&"!@#"].filter(Boolean).join(" · ")}</div>
                  </div>
                )}
                <button onClick={changePw} disabled={loading} style={{padding:"12px 24px",borderRadius:10,border:"none",background:"linear-gradient(135deg,var(--accent-1),var(--accent-2))",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:12}}>
                  {loading?t("saving","Сохраняю…"):t("change_pw_btn","Изменить пароль")}
                </button>
                {msg&&<div style={{padding:"10px 14px",borderRadius:9,background:msg.ok?"rgba(16,185,129,.08)":"rgba(239,68,68,.08)",border:`1px solid ${msg.ok?"rgba(16,185,129,.25)":"rgba(239,68,68,.25)"}`,color:msg.ok?"var(--green)":"var(--red)",fontSize:13.5}}>{msg.t}</div>}

                <div style={{marginTop:24,paddingTop:24,borderTop:"1px solid var(--border)"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--red)",marginBottom:8}}>{t("danger_zone","Опасная зона")}</div>
                  <div style={{padding:"14px 16px",borderRadius:11,background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.15)"}}>
                    <div style={{fontSize:13.5,color:"var(--text)",fontWeight:600}}>{t("delete_account","Удалить аккаунт")}</div>
                    <div style={{fontSize:13.5,color:"var(--text4)",marginTop:3,marginBottom:10}}>{t("all_data_deleted","Все данные будут удалены безвозвратно")}</div>
                    <button type="button" onClick={()=>setShowDeleteConfirm(true)} disabled={loading} style={{padding:"8px 16px",borderRadius:8,border:"1px solid rgba(239,68,68,.35)",background:"transparent",color:"var(--red)",fontSize:13,fontWeight:600,cursor:loading?"not-allowed":"pointer"}}>{loading?t("loading_short","Загрузка…"):t("delete_account","Удалить аккаунт")}</button>
                  </div>
                </div>
                {showDeleteConfirm&&(
                  <div style={{position:"fixed",inset:0,zIndex:210,background:"var(--modal-overlay-bg,rgba(0,0,0,.6))",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowDeleteConfirm(false)}>
                    <div role="alertdialog" aria-modal="true" aria-labelledby="sa-pf-delete-title" aria-describedby="sa-pf-delete-desc" style={{background:"var(--bg2)",borderRadius:"var(--radius-lg,16px)",border:"1px solid var(--border)",padding:"24px 28px",maxWidth:400,width:"100%",boxShadow:"0 24px 48px rgba(0,0,0,.5)"}} onClick={e=>e.stopPropagation()}>
                      <div id="sa-pf-delete-title" style={{fontSize:16,fontWeight:800,color:"var(--text)",marginBottom:8}}>{t("delete_account","Удалить аккаунт")}?</div>
                      <div id="sa-pf-delete-desc" style={{fontSize:13.5,color:"var(--text3)",marginBottom:16}}>{t("delete_warning","Все данные будут удалены безвозвратно")}</div>
                      {API_BASE&&(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:12,fontWeight:700,color:"var(--text4)",marginBottom:6}}>{t("confirm_with_password","Подтвердите паролем")}</div>
                          <input type="password" value={delPw} onChange={e=>{setDelPw(e.target.value);if(delErr)setDelErr("");}} onKeyDown={e=>e.key==="Enter"&&handleDeleteAccount()} placeholder={t("password","Пароль")} autoComplete="current-password" style={{...fi,marginBottom:0,borderColor:delErr?"var(--red)":"var(--input-border)"}} autoFocus/>
                          {delErr&&<div style={{fontSize:12.5,color:"var(--red)",marginTop:6}}>{delErr}</div>}
                        </div>
                      )}
                      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                        <button type="button" onClick={()=>{setShowDeleteConfirm(false);setDelPw("");setDelErr("");}} style={{padding:"10px 20px",borderRadius:10,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:13,fontWeight:600,cursor:"pointer"}}>{t("cancel","Отмена")}</button>
                        <button type="button" onClick={handleDeleteAccount} disabled={loading||(!!API_BASE&&!delPw)} style={{padding:"10px 20px",borderRadius:10,border:"none",background:"var(--red)",color:"var(--accent-on-bg,#fff)",fontSize:13,fontWeight:700,cursor:(loading||(!!API_BASE&&!delPw))?"not-allowed":"pointer",opacity:(loading||(!!API_BASE&&!delPw))?.6:1}}>{loading?t("deleting","Удаляю…"):t("delete_forever","Удалить навсегда")}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {tab==="settings"&&(
            <div className="tab-content" style={{flex:1,overflowY:"auto",padding:isMobile?"16px 14px":"20px 24px",minHeight:380}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?18:24,maxWidth:720}}>
                <div>
                  <div style={{fontSize:12,fontWeight:800,color:"var(--text4)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>{t("appearance","Внешний вид")}</div>
                  <div className="glass-card" style={{padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,.04)",backdropFilter:"blur(10px)",border:"1px solid var(--glass-border-accent,var(--border))",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{t("theme_label","Тема")}</div>
                      <div style={{fontSize:11,color:"var(--text4)",marginTop:1}}>{theme==="dark"?t("dark_theme_label","Тёмная"):t("light_theme_label","Светлая")}</div>
                    </div>
                    <button onClick={onToggleTheme} style={{padding:"5px 12px",borderRadius:8,border:"1px solid var(--glass-border-accent,var(--border))",background:"rgba(255,255,255,.04)",color:"var(--text)",cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                      {theme==="dark"?t("light_theme_label","Светлая"):t("dark_theme_label","Тёмная")}
                    </button>
                  </div>
                  {onPaletteChange&&(
                    <div className="glass-card" style={{padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,.04)",backdropFilter:"blur(10px)",border:"1px solid var(--glass-border-accent,var(--border))",marginTop:6,marginBottom:6}}>
                      <div style={{fontSize:12,fontWeight:700,color:"var(--text4)",marginBottom:2}}>{t("palette_label","Цветовая палитра")}</div>
                      <div style={{fontSize:11,color:"var(--text5)",marginBottom:6}}>{t("palette_hint","Цвет кнопок и акцентов")}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {[
                          {id:"indigo",label:"◆ Indigo",c1:"#6836f5",c2:"#a050ff"},
                          {id:"ocean",label:"◇ Ocean",c1:"#5b8fb9",c2:"#7ab8d4"},
                          {id:"forest",label:"◇ Forest",c1:"#5a8c7b",c2:"#6ba881"},
                          {id:"orange",label:"◇ Orange",c1:"#ea580c",c2:"#f09428"},
                          {id:"sunset",label:"◇ Sunset",c1:"#b88a6a",c2:"#c9a088"},
                          {id:"mono",label:"◇ Mono",c1:"#6b7a8a",c2:"#8a9baa"},
                        ].map(({id,label,c1,c2})=>(
                          <button key={id} type="button" aria-pressed={palette===id} aria-label={t("palette_choose","Выбрать палитру: {name}").replace("{name}",label)} onClick={()=>onPaletteChange(id)} className="sa-palette-btn" data-on={palette===id?"1":"0"} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${palette===id?"var(--accent-1)":"var(--glass-border-accent,var(--border))"}`,background:palette===id?"var(--accent-soft)":"rgba(255,255,255,.02)",color:"var(--text)",cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:5,transition:"all .28s cubic-bezier(.34,1.56,.64,1)"}}>
                            <span style={{width:12,height:12,borderRadius:4,background:`linear-gradient(135deg,${c1},${c2})`,transition:"transform .3s ease"}}/>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Toggle val={compactMode} onChange={setCompactMode} label={t("compact_mode","Компактный режим")} desc={t("compact_desc","Уменьшенные карточки узлов")}/>

                  <div className="glass-card" style={{padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,.04)",backdropFilter:"blur(10px)",border:"1px solid var(--glass-border-accent,var(--border))",marginTop:6,marginBottom:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--text5)",marginBottom:6}}>{t("select_language","Язык интерфейса")}</div>
                    <div style={{display:"flex",gap:5}}>
                      {[["ru","RU"],["en","EN"],["uz","UZ"]].map(([v,label])=>(
                        <button key={v} onClick={()=>setUiLang(v)} style={{flex:1,padding:"6px 4px",borderRadius:8,border:`1px solid ${uiLang===v?"var(--accent-1)":"var(--glass-border-accent,var(--border))"}`,background:uiLang===v?"var(--accent-soft)":"transparent",color:uiLang===v?"var(--accent-1)":"var(--text3)",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"center"}}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{fontSize:12,fontWeight:800,color:"var(--text4)",textTransform:"uppercase",letterSpacing:1,marginTop:14,marginBottom:10}}>{t("strategy_maps","Карты")}</div>
                  <div className="glass-card" style={{padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,.04)",backdropFilter:"blur(10px)",border:"1px solid var(--glass-border-accent,var(--border))",marginBottom:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--text5)",marginBottom:6}}>{t("default_view","Вид по умолчанию")}</div>
                    <div style={{display:"flex",gap:5}}>
                      {[["canvas",t("canvas_view","Канвас")],["gantt",t("gantt_view","Gantt")],["list",t("list_view","Список")]].map(([v,label])=>(
                        <button key={v} onClick={()=>setDefaultView(v)} style={{flex:1,padding:"6px 4px",borderRadius:8,border:`1px solid ${defaultView===v?"var(--accent-1)":"var(--glass-border-accent,var(--border))"}`,background:defaultView===v?"var(--accent-soft)":"transparent",color:defaultView===v?"var(--accent-1)":"var(--text3)",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"center"}}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Toggle val={autoSave} onChange={setAutoSave} label={t("auto_save","Автосохранение")} desc={t("autosave_desc","Сохранять карту при каждом изменении")}/>
                </div>

                <div>
                  <div style={{fontSize:12,fontWeight:800,color:"var(--text4)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>{t("ai_assistant_title","AI-ассистент")}</div>
                  <div className="glass-card" style={{padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,.04)",backdropFilter:"blur(10px)",border:"1px solid var(--glass-border-accent,var(--border))",marginBottom:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--text5)",marginBottom:6}}>{t("ai_language","Язык ответов AI")}</div>
                    <div style={{display:"flex",gap:5}}>
                      {[["ru","Русский"],["en","English"],["uz","O'zbekcha"]].map(([v,label])=>(
                        <button key={v} onClick={()=>setAiLang(v)} style={{flex:1,padding:"6px 4px",borderRadius:8,border:`1px solid ${aiLang===v?"var(--accent-1)":"var(--glass-border-accent,var(--border))"}`,background:aiLang===v?"var(--accent-soft)":"transparent",color:aiLang===v?"var(--accent-1)":"var(--text3)",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"center"}}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{fontSize:12,fontWeight:800,color:"var(--text4)",textTransform:"uppercase",letterSpacing:1,marginTop:14,marginBottom:10}}>{t("notifications_title","Уведомления")}</div>
                  <Toggle val={notifEmail} onChange={setNotifEmail} label={t("email_notifications","Email уведомления")} desc={t("notif_email_desc","Важные обновления на почту")}/>
                  <Toggle val={notifPush} onChange={setNotifPush} label={t("push_notifications","Push уведомления")} desc={t("notif_push_desc","Уведомления в браузере")}/>
                  <div style={{fontSize:11.5,lineHeight:1.5,color:"var(--text5)",marginTop:8,padding:"10px 12px",borderRadius:11,border:"1px dashed var(--glass-border-accent,var(--border))",background:"rgba(255,255,255,.03)"}}>{t("notif_backend_note","Отправка писем и push на сервере появится после подключения уведомлений.")}</div>
                  <div style={{fontSize:11.5,lineHeight:1.5,color:"var(--text4)",marginTop:12,padding:"10px 12px",borderRadius:11,border:"1px solid var(--glass-border-accent,var(--border))",background:"var(--accent-soft)"}}>
                    <span style={{fontWeight:700,color:"var(--accent-2)"}}>{t("weekly_briefing","Еженедельный брифинг")}</span>
                    {" — "}{t("weekly_briefing_settings_hint","откройте на странице «Мои проекты» или в меню карты.")}
                  </div>
                </div>
              </div>

              <div style={{marginTop:24,maxWidth:720,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <button onClick={saveSettings} disabled={loading} style={{padding:"12px 28px",borderRadius:10,border:"none",background:"linear-gradient(135deg,var(--accent-1),var(--accent-2))",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                  {loading?t("saving","Сохраняю…"):t("save_settings","Сохранить настройки")}
                </button>
                {settingsSaved&&<div role="status" aria-live="polite" style={{fontSize:13,color:"var(--green)",fontWeight:600,display:"flex",alignItems:"center",gap:5}}><span aria-hidden="true">✓</span> {t("settings_saved","Настройки сохранены")}</div>}
                {msg&&!settingsSaved&&<div style={{padding:"10px 14px",borderRadius:9,background:msg.ok?"rgba(16,185,129,.08)":"rgba(239,68,68,.08)",border:`1px solid ${msg.ok?"rgba(16,185,129,.25)":"rgba(239,68,68,.25)"}`,color:msg.ok?"var(--green)":"var(--red)",fontSize:13.5}}>{msg.t}</div>}
              </div>
            </div>
          )}

          {/* ── STATS TAB ── */}
          {tab==="stats"&&(
            <div className="tab-content" style={{flex:1,overflowY:"auto",padding:"28px 32px",minHeight:380}}>
              <div style={{fontSize:15,fontWeight:800,color:"var(--text)",marginBottom:20}}>{t("stats_tab","Статистика аккаунта")}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24,maxWidth:620}}>
                {[
                  {icon:"📁",label:t("billing_title","Тариф"),val:tier.label,color:tier.color},
                  {icon:"🗺",label:t("maps_available","Карт доступно"),val:fmt(tier.maps),color:"var(--accent-1)"},
                  {icon:"👥",label:t("members","Участников"),val:fmt(tier.users),color:"var(--accent-2)"},
                  {icon:"⎇",label:t("scenarios_available","Сценариев"),val:fmt(tier.scenarios),color:"#06b6d4"},
                  {icon:"📁",label:t("projects_available","Проектов"),val:fmt(tier.projects),color:"var(--green)"},
                  {icon:"🤖",label:t("ai_level","AI уровень"),val:tier.ai,color:"var(--amber)"},
                ].map(s=>(
                  <div key={s.label} className="icard icard-stat" style={{"--icard-color":s.color,"--icard-glow":s.color+"33","--icard-bg":s.color+"09",padding:"16px",borderRadius:14,background:"var(--surface)",border:"1px solid var(--border)"}}>
                    <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
                    <div className="icard-val" style={{fontSize:20,fontWeight:900,color:s.color,letterSpacing:-1}}>{s.val}</div>
                    <div className="icard-desc" style={{fontSize:13,marginTop:3}}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{maxWidth:620}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:12}}>{t("current_plan","Возможности тарифа")}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {[
                    {label:t("lpr2_f4","Клонирование карт"),ok:tier.clone},
                    {label:t("templates","Шаблоны стратегий"),ok:tier.templates},
                    {label:t("content_plan","Контент-план"),ok:tier.contentPlan},
                    {label:"White-label",ok:tier.wl},
                    {label:"API",ok:tier.api},
                    {label:t("export_pdf","Отчёты"),ok:tier.report},
                    {label:t("export_pptx","PowerPoint экспорт"),ok:tier.pptx},
                  ].map(f=>(
                    <div key={f.label} className="icard feat-row" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)"}}>
                      <span className="icard-title" style={{fontSize:13,fontWeight:600,color:"var(--text2)"}}>{f.label}</span>
                      <span style={{fontSize:13,fontWeight:700,color:f.ok?"var(--green)":"var(--text5)"}}>{f.ok?"✓ "+t("done","Включено"):"✗ —"}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setTab("tier")} style={{marginTop:16,padding:"11px 22px",borderRadius:10,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:"var(--accent-1)",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  ↑ {t("upgrade_tier_arrow","Улучшить тариф →")}
                </button>
              </div>
            </div>
          )}

          {/* ── TIER TAB ── */}
          {tab==="tier"&&(
            <div className="tab-content" style={{display:"flex",width:"100%",overflow:"hidden",minHeight:380}}>
              <div style={{width:190,flexShrink:0,borderRight:"1px solid var(--border)",padding:"12px 8px",overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>
                {TIER_ORDER.map(k=>{
                  const tierItem=TIERS[k];
                  const mkt=TIER_MKT[k];
                  const isSel=k===selected;
                  const isCur=k===user.tier;
                  return(
                    <button key={k} onClick={()=>setSelected(k)} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 11px",borderRadius:12,border:`1px solid ${isSel?tierItem.color+"66":"transparent"}`,background:isSel?tierItem.color+"12":"transparent",cursor:"pointer",textAlign:"left",transition:"all .15s"}}>
                      <span style={{fontSize:15}}>{mkt?.icon ?? ""}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13.5,fontWeight:700,color:isSel?tierItem.color:"var(--text)"}}>{tierItem.label}</div>
                        <div style={{fontSize:13.5,color:"var(--text4)",marginTop:1}}>{getTierPrice(k,t)}</div>
                      </div>
                      {isCur&&<div style={{width:6,height:6,borderRadius:"50%",background:tierItem.color,flexShrink:0}}/>}
                    </button>
                  );
                })}
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"20px 22px"}}>
                {buyPhase==="processing"&&(
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16}}>
                    <div style={{width:48,height:48,border:`3px solid ${selTier.color}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{t("processing_payment","Обрабатываем платёж…")}</div>
                  </div>
                )}
                {buyPhase==="success"&&(
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12}}>
                    <div style={{width:56,height:56,borderRadius:"50%",background:`${selTier.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>✓</div>
                    <div style={{fontSize:15,fontWeight:800,color:selTier.color}}>{t("tier_activated","Тариф {tier} активирован ✓").replace("{tier}",selTier.label)}</div>
                  </div>
                )}
                {!buyPhase&&(
                  <>
                    <div style={{padding:"14px 16px",borderRadius:14,background:TIER_MKT[selected]?.gradient||"var(--surface)",border:`1px solid ${selTier.color}33`,marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                        <span style={{fontSize:22}}>{TIER_MKT[selected]?.icon ?? ""}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:16,fontWeight:900,color:selTier.color}}>{selTier.label}</div>
                          <div style={{fontSize:13.5,color:"var(--text4)"}}>{TIER_MKT[selected]?.sub ?? ""}</div>
                        </div>
                        <div style={{fontSize:18,fontWeight:900,color:selTier.color}}>{getTierPrice(selected,t)}</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                      {[["📁",fmt(selTier.projects),t("projects","проектов")],["🗺",fmt(selTier.maps),t("maps","карт")],["👥",fmt(selTier.users),t("members","участников")]].map(([ic,val,lbl])=>(
                        <div key={lbl} style={{borderRadius:10,padding:"10px 12px",background:"var(--surface)",border:"1px solid var(--border)",textAlign:"center"}}>
                          <div style={{fontSize:16,marginBottom:4}}>{ic}</div>
                          <div style={{fontSize:16,fontWeight:800,color:selTier.color}}>{val}</div>
                          <div style={{fontSize:13,color:"var(--text4)"}}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{marginBottom:16,padding:"12px 14px",borderRadius:12,background:"var(--surface)",border:"1px solid var(--border)",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--text4)",marginBottom:10}}>{t("tier_comparison","Сравнение тарифов")}</div>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(6,minmax(72px,1fr))":"repeat(6,1fr)",gap:0,fontSize:isMobile?11:12,minWidth:isMobile?432:"min(100%,520px)"}}>
                        <div style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",fontWeight:600,color:"var(--text4)"}}>{t("feature","Функция")}</div>
                        {TIER_ORDER.map(k=>(
                          <div key={k} style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",textAlign:"center",fontWeight:k===user.tier?700:500,color:k===user.tier?TIERS[k].color:"var(--text4)"}}>{TIERS[k].label}</div>
                        ))}
                        {ALL_FEATURES.slice(0,10).map(f=>(
                          <React.Fragment key={f.key}>
                            <div style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",color:"var(--text3)"}}>{f.label}</div>
                            {TIER_ORDER.map(k=>{
                              const v=f[TIER_FEAT_KEY[k]] as string|boolean;
                              return(
                                <div key={k} style={{padding:"6px 8px",borderBottom:"1px solid var(--border)",textAlign:"center"}}>
                                  <FeatureValue val={v}/>
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    {isUpgrade&&!user.is_dev&&(
                      <div style={{marginBottom:16,padding:"14px",borderRadius:12,background:"var(--surface)",border:"1px solid var(--border)"}}>
                        <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:12}}>{t("card_data_title","💳 Данные карты")}</div>
                        <input style={fi} placeholder={t("card_number_ph","Номер карты…")} value={cardNum} onChange={e=>setCardNum(formatCardNum(e.target.value))} onFocus={e=>e.target.style.borderColor=selTier.color} onBlur={e=>e.target.style.borderColor="var(--input-border)"}/>
                        <input style={fi} placeholder={t("card_holder_ph","Имя держателя…")} value={cardName} onChange={e=>setCardName(e.target.value)} onFocus={e=>e.target.style.borderColor=selTier.color} onBlur={e=>e.target.style.borderColor="var(--input-border)"}/>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          <input style={{...fi,marginBottom:0}} placeholder={t("card_expiry_ph","ММ/ГГ")} value={cardExp} onChange={e=>setCardExp(formatExp(e.target.value))} onFocus={e=>e.target.style.borderColor=selTier.color} onBlur={e=>e.target.style.borderColor="var(--input-border)"}/>
                          <input style={{...fi,marginBottom:0}} placeholder={t("card_cvv_ph","CVV")} value={cardCvv} onChange={e=>setCardCvv(e.target.value.replace(/\D/g,"").slice(0,4))} onFocus={e=>e.target.style.borderColor=selTier.color} onBlur={e=>e.target.style.borderColor="var(--input-border)"}/>
                        </div>
                        {cardError&&<div role="alert" style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",color:"var(--red)",fontSize:13}}>⚠️ {cardError}</div>}
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,paddingTop:12,marginTop:12,borderTop:"1px solid var(--border)"}}>
                          {["🔒 SSL","💳 Visa/MC","✓ PCI DSS"].map(b=><div key={b} style={{fontSize:13,color:"var(--text4)",fontWeight:500}}>{b}</div>)}
                        </div>
                      </div>
                    )}
                    {!isCurrentTier&&!isUpgrade&&(
                      <div style={{marginBottom:12,padding:"12px 14px",borderRadius:10,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",fontSize:13,color:"var(--amber)"}}>
                        <div style={{fontWeight:700,marginBottom:6}}>⚠️ {t("downgrade_warning","После смены тарифа часть данных может быть ограничена.")}</div>
                        {usage&&(usage.maps?.used>0||usage.projects?.used>0)&&(
                          <div style={{fontSize:12,marginBottom:6,opacity:.95}}>
                            {t("downgrade_you_have","У вас")}: {usage.maps?.used||0} {t("downgrade_maps_unit","карт")}, {usage.projects?.used||0} {t("downgrade_projects_unit","проектов")}
                          </div>
                        )}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                          <div style={{background:"rgba(245,158,11,.08)",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                            <span style={{opacity:.7}}>{t("downgrade_limit_maps","Карт")}:</span> <strong>{selTier.maps===999?"∞":selTier.maps}</strong>
                          </div>
                          <div style={{background:"rgba(245,158,11,.08)",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                            <span style={{opacity:.7}}>{t("downgrade_limit_projects","Проектов")}:</span> <strong>{selTier.projects===999?"∞":selTier.projects}</strong>
                          </div>
                        </div>
                        <div style={{fontSize:12,opacity:.8}}>{t("downgrade_excess","Данные сверх лимита станут доступны только для чтения.")}</div>
                      </div>
                    )}
                    {isCurrentTier&&user?.tier&&user.tier!=="free"&&(
                      <button type="button" onClick={async()=>{
                        try{
                          const r=await apiFetch("/api/billing/portal",{method:"POST"});
                          if(r?.url){window.location.href=r.url;return;}
                        }catch{}
                        // Fallback: openая ссылка на портал, если сервер недоступен
                        try{const url=(typeof window!=="undefined"&&(window as any).STRIPE_PORTAL_URL)||"https://billing.stripe.com/p/login";window.open(url,"_blank","noopener,noreferrer");}catch{}
                      }} style={{width:"100%",padding:"11px",borderRadius:12,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text2)",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8}}>
                        💳 {t("manage_billing","Управлять подпиской (Stripe)")}
                      </button>
                    )}
                    {isCurrentTier?(
                      <div style={{padding:"13px",borderRadius:12,background:"var(--surface)",border:"1px solid var(--border)",textAlign:"center",fontSize:13,color:"var(--text3)",fontWeight:600}}>{t("current_tier_badge","✓ Текущий тариф")}</div>
                    ):(
                      <button type="button" className="sa-pf-buy" onClick={executeBuy} style={{background:`linear-gradient(135deg,${selTier.color},${selTier.color}cc)`,boxShadow:`0 8px 24px ${selTier.color}40`}}>
                        {isUpgrade?(user.is_dev?t("activate_btn","⚡ Активировать")+" "+selTier.label:"🔒 "+t("go_to_plan","Перейти на {plan} — {price}").replace("{plan}",selTier.label).replace("{price}",getTierPrice(selected,t))):t("downgrade_to","↓ Перейти на ")+selTier.label}
                      </button>
                    )}
                    {isUpgrade&&user.is_dev&&<div style={{textAlign:"center",marginTop:8,fontSize:13.5,color:"var(--text4)"}}>{t("demo_payment_skipped","Демо — оплата пропущена")}</div>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
  );

  const dialogInner=(
    <>
      {!pageMode&&(
        <>
        <SheetSwipeHandle enabled={isMobile&&!buyPhase&&!showDeleteConfirm} onClose={handleClose} />
        <div className="sa-profile-header" style={{display:"flex",alignItems:"center",gap:14,padding:"18px 24px",flexShrink:0,borderBottom:"1px solid var(--border)",background:"var(--surface)",position:"relative",overflow:"hidden"}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"var(--accent-on-bg)",boxShadow:"0 6px 18px var(--accent-glow)"}}>{(user.name||user.email||"?")[0].toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div id="sa-pf-title" style={{fontSize:16,fontWeight:800,color:"var(--text)"}}>{user.name||t("user_word","Пользователь")}</div>
            <div style={{fontSize:13,color:"var(--text4)",marginTop:1}}>{user.email}</div>
            {user.bio&&<div style={{fontSize:13,color:"var(--text5)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:320}}>{user.bio}</div>}
          </div>
          <div className="glass-card" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:12,border:"1px solid var(--glass-border-accent,var(--border))",background:"var(--surface)"}}>
            <span style={{fontSize:13}}>{tier.badge}</span>
            <span style={{fontSize:13,fontWeight:800,color:"var(--text)"}}>{tier.label}</span>
          </div>
          <button type="button" className="sa-pf-close" aria-label={t("close","Закрыть")} onClick={handleClose}>×</button>
        </div>
        </>
      )}
      {useSettingsLayout?(
        <div className="settings-layout" style={{flex:1,minHeight:0,overflow:"hidden"}}>
          {tabNav}
          {tabPanels}
        </div>
      ):(
        <>
          {tabNav}
          {tabPanels}
        </>
      )}
    </>
  );

  if(pageMode){
    return(
      <div data-theme={theme} className="sa-settings-page" style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden",background:"var(--bg)"}}>
        {dialogInner}
      </div>
    );
  }

  return(
    <div data-theme={theme} className={closing?"modal-backdrop modal-backdrop-out":"modal-backdrop"} style={{position:"fixed",inset:0,background:"var(--modal-overlay-bg,rgba(0,0,0,.75))",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(16px)"}} onClick={e=>{if(e.target===e.currentTarget&&!buyPhase&&!showDeleteConfirm)handleClose();}}>
      <div role="dialog" aria-modal="true" aria-labelledby="sa-pf-title" className={`glass-panel glass-panel-lg ${closing?"modal-content-out":isMobile?"":"modal-content-pop"}`} style={{position:"relative",width:isMobile?"100%":"min(96vw,980px)",height:isMobile?"90vh":680,minHeight:520,borderRadius:20,display:"flex",flexDirection:"column",animation:isMobile&&!closing?"slideUp .3s cubic-bezier(0.22,1,0.36,1)":"none",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {dialogInner}
      </div>
    </div>
  );
}
