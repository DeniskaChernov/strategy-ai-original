import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useLang } from "../lang-context";
import { consumePendingAiPrompt } from "../lib/ai-pending-prompt";
import { AI_TIER } from "../lib/ai-prompts";
import { getSTATUS, getPRIORITY } from "../lib/strategy-labels";
import { callAI } from "../lib/call-ai";

export function AiPanel({nodes,edges,ctx,tier,onAddNode,onClose,externalMsgs=[],onClearExternal,projectName="",mapName="",userName="",msgs:msgsProp,onMsgsChange,onError,isMobile,embedded=false,referenceShell=false,promptToSend=null,onPromptSent,statusMap}:{nodes:any;edges:any;ctx:any;tier:any;onAddNode:any;onClose:any;externalMsgs?:any[];onClearExternal:any;projectName?:string;mapName?:string;userName?:string;msgs:any;onMsgsChange:any;onError?:any;isMobile?:boolean;embedded?:boolean;referenceShell?:boolean;promptToSend?:string|null;onPromptSent?:()=>void;statusMap?:any}){
  const{t}=useLang();
  const STATUS=statusMap||getSTATUS(t);
  const PRIORITY=getPRIORITY(t);
  const tierCfg=AI_TIER[tier]||AI_TIER.free;
  const meta={projectName,mapName,userName};
  const[localMsgs,setLocalMsgs]=useState([]);
  const isControlled=onMsgsChange&&msgsProp;
  const msgs=isControlled?msgsProp:localMsgs;
  const setMsgs=isControlled?onMsgsChange:setLocalMsgs;
  const[inp,setInp]=useState("");
  const[load,setLoad]=useState(false);
  const[exiting,setExiting]=useState(false);
  const handleClose=()=>{if(exiting)return;setExiting(true);setTimeout(()=>onClose(),320);};
  const endRef=useRef(null);
  const inpRef=useRef<HTMLInputElement>(null);
  const taRef=useRef<HTMLTextAreaElement>(null);
  const initRef=useRef(false);
  useLayoutEffect(()=>{
    const pending=consumePendingAiPrompt();
    if(pending)setInp(pending);
  },[]);
  const panelHealth=useMemo(()=>{
    const done=nodes.filter((n:any)=>n.status==="completed").length;
    const h=nodes.length?Math.round((done/nodes.length)*100):0;
    return{h,done};
  },[nodes]);

  // Только при первом открытии — приветствие, если чат пуст. Чат НЕ очищается при смене tier или закрытии панели.
  useEffect(()=>{
    if(msgs.length>0)return;
    const greetings={
      free:t("ai_greet_free","Привет! Я AI-стратег: помогу выбрать следующий шаг и метрику. Чипы ниже — быстрый старт."),
      starter:t("ai_greet_starter","Привет! Я ваш стратегический помощник: риски, маркетинг, продажи — в привязке к карте. Спросите или нажмите чип."),
      pro:t("ai_greet_pro","Привет! Режим Pro: SWOT, Porter, OKR, CAC/LTV, MEDDIC. Дам диагноз → действия → риск → быструю победу."),
      team:t("ai_greet_team","Добрый день. Партнёрский режим: GTM, unit economics, Blue Ocean. Executive insight и топ-приоритеты по вашей карте."),
      enterprise:t("ai_greet_enterprise","Добрый день. Коллегиум C-level: стратегия, маркетинг, продажи, финансы. Ищем non-obvious ходы и слепые зоны."),
    };
    if(!initRef.current){initRef.current=true;setMsgs([{role:"ai",text:greetings[tier]||greetings.free}]);}
  },[tier,t]);

  // Inject external messages (e.g. from autoConnect)
  useEffect(()=>{
    if(externalMsgs&&externalMsgs.length>0){
      setMsgs((m:any[])=>[...m,...externalMsgs.map((em:any)=>({role:"ai",text:em.content}))]);
      onClearExternal&&onClearExternal();
    }
  },[externalMsgs]);

  const scrollRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=scrollRef.current;
    if(!el){endRef.current?.scrollIntoView({block:"nearest"});return;}
    const reduced=typeof window!=="undefined"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<160;
    if(nearBottom||msgs.length<=1){
      el.scrollTo({top:el.scrollHeight,behavior:reduced?"auto":"smooth"});
    }
  },[msgs]);
  useEffect(()=>{if(!load)inpRef.current?.focus();},[load]);

  const quickByTier=useMemo(()=>({
    free:[t("qf_add","Что добавить?"),t("qf_risks","Главные риски?"),t("qf_premortem","Pre-mortem: что убьёт план?"),t("qf_exp","Один эксперимент на неделю"),t("qf_next","Следующий шаг?"),t("qf_stuck","Застрял — что делать?"),t("qf_wrong","Что не так?")],
    starter:[t("qs_analyze","Проанализируй карту"),t("qs_second","Second-order эффекты"),t("qs_find_risks","Найди риски"),t("qs_propose","Предложи шаги"),t("qs_msales","Маркетинг / продажи"),t("qs_start","С чего начать?"),t("qs_miss","Что упускаю?"),t("qs_wrong","Что не так?")],
    pro:[t("qp_full","Полный анализ"),t("qp_second","Second-order effects"),t("qp_bottleneck","Узкие места"),t("qp_risks","Риски и контрмеры"),t("qp_prio","Приоритизируй"),t("qp_unit","CAC/LTV и runway"),t("qp_sales","Sales pipeline"),t("qp_miss","Что я упускаю?"),t("qp_pre","Pre-mortem")],
    team:[t("qt_audit","Стратегический аудит"),t("qt_unit","Unit economics"),t("qt_gtm","GTM рекомендации"),t("qt_comp","Конкурентный анализ"),t("qt_scale","Точки масштабирования"),t("qt_blue","Blue Ocean"),t("qt_non","Non-obvious риск"),t("qt_blind","Strategic blind spots"),t("qt_cap","Капитальная эффективность")],
    enterprise:[t("qe_exec","Executive audit"),t("qe_bcg","BCG / сценарии"),t("qe_okr","OKR для карты"),t("qe_dd","Due diligence угол"),t("qe_cmo","CMO/CRO угол"),t("qe_reg","Reg / data риск"),t("qe_blind","Strategic blind spots"),t("qe_non","Non-obvious move"),t("qe_pre","Pre-mortem сценарий")],
  }),[t]);
  const allQuick=quickByTier[tier]||quickByTier.free;
  const QUICK_SHOW=4;
  const[showMoreQuick,setShowMoreQuick]=useState(false);
  const quick=showMoreQuick?allQuick:allQuick.slice(0,QUICK_SHOW);

  const aiFreeTier=tier==="free";
  async function send(text?: string){
    const q=text||inp.trim();
    if(!q||load)return;
    if(aiFreeTier){
      setMsgs(m=>[...m,{role:"user",text:q},{role:"sys",text:t("ai_free_upgrade","AI-чат доступен с тарифа Starter. Улучшите тариф в профиле →")}]);
      return;
    }
    setInp("");
    const nM=[...msgs,{role:"user",text:q}];
    setMsgs(nM);
    setLoad(true);
    const mapSummary=nodes.map(n=>`${n.title}|${n.reason||"-"}|${n.action||"-"}|${n.metric||"-"}|${STATUS[n.status]?.label||n.status}|${n.progress||0}%|${PRIORITY[n.priority]?.label||n.priority}${n.deadline?"|📅"+n.deadline:""}${n.tags?.length?"|"+n.tags.join(","):""}`).join("\n");
    const edgesSummary=edges.length?edges.map(e=>{const s=nodes.find(n=>n.id===e.source),t=nodes.find(n=>n.id===e.target);return`${s?.title||e.source} → ${t?.title||e.target}: ${e.type||"requires"}`;}).join("\n"):"нет";
    const done=nodes.filter(n=>n.status==="completed").length;
    const blocked=nodes.filter(n=>n.status==="blocked").length;
    const critical=nodes.filter(n=>n.priority==="critical"&&n.status!=="completed").length;
    const overdue=nodes.filter(n=>n.deadline&&new Date(n.deadline)<new Date()&&n.status!=="completed").length;
    const health=nodes.length?Math.round((done/nodes.length)*100):0;
    const stats=`Health: ${health}% | Выполнено: ${done} | Заблокировано: ${blocked} | Критичных: ${critical} | Просрочено: ${overdue}`;
    const fullCtx={mapSummary,edgesSummary,stats,nodes,edges};
    const sys=tierCfg.system(ctx||"",mapSummary,meta,fullCtx);
    try{
      const maxHist=tier==="enterprise"?24:tier==="team"?20:16;
      const history=nM.slice(-maxHist).map(m=>({role:m.role==="ai"?"assistant":"user",content:m.text}));
      const reply=await callAI(history,sys,tier==="enterprise"||tier==="team"?1500:1200);
      // Parse <ADD> tags for new nodes
      const addMatch=reply.match(/<ADD>([\s\S]*?)<\/ADD>/);
      let displayReply=reply.replace(/<ADD>[\s\S]*?<\/ADD>/g,"").trim();
      setMsgs(m=>[...m,{role:"ai",text:displayReply}]);
      if(addMatch&&onAddNode){
        try{
          const raw=addMatch[1].replace(/[\r\n]/g," ").trim();
          const fallback=raw.match(/\{[\s\S]*\}/);
          const nodeData=JSON.parse(fallback?fallback[0]:raw);
          const n={title:nodeData.title||t("new_step","Новый шаг"),reason:nodeData.reason||"",action:nodeData.action||"",metric:nodeData.metric||"",status:nodeData.status||"planning",priority:nodeData.priority||"medium",progress:nodeData.progress??0,tags:Array.isArray(nodeData.tags)?nodeData.tags:[],color:nodeData.color||""};
          onAddNode(n);
          setMsgs(m=>[...m,{role:"sys",text:"✅ "+t("step_added_to_map","Шаг добавлен на карту")+": "+n.title}]);
        }catch{setMsgs(m=>[...m,{role:"sys",text:"⚠️ "+t("ai_step_format_err","AI предложил шаг, но формат не распознан. Добавьте вручную.")}]);}
      }
    }catch(e:any){
      const msg=e?.message||t("connection_error","Ошибка подключения. Проверьте сеть.");
      setMsgs(m=>[...m,{role:"ai",text:msg}]);
      onError?.(msg);
    }
    setLoad(false);
    taRef.current?.focus();
    inpRef.current?.focus();
  }

  useEffect(()=>{
    if(!promptToSend?.trim())return;
    send(promptToSend.trim());
    onPromptSent?.();
  },[promptToSend]);

  if(referenceShell){
    return(
      <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,height:"100%",overflow:"hidden"}}>
        <div ref={scrollRef} className="chat-area">
          {msgs.filter(m=>m.role!=="sys").map((m,i)=>(
            <div key={i} className={`msg ${m.role}`}>
              {m.role==="ai"&&<div className="msg-av" style={{background:"rgba(18,196,130,.15)",color:"#12c482"}}>AI</div>}
              {m.role==="user"&&<div className="msg-av" style={{background:"rgba(104,54,245,.15)",color:"var(--acc)"}}>{(userName||"?")[0].toUpperCase()}</div>}
              <div className="msg-body">{m.text}</div>
            </div>
          ))}
          {load&&(
            <div className="msg ai">
              <div className="msg-av" style={{background:"rgba(18,196,130,.15)",color:"#12c482"}}>AI</div>
              <div className="msg-body"><div className="typing"><span/><span/><span/></div></div>
            </div>
          )}
          <div ref={endRef}/>
        </div>
        <div className="chat-inp-row">
          <textarea
            ref={taRef}
            className="chat-inp"
            value={inp}
            onChange={e=>setInp(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder={aiFreeTier?t("ai_free_placeholder","Available on Starter+"):t("ask_placeholder","Ask about your strategy, goals, risks…")}
            rows={1}
            disabled={aiFreeTier}
          />
          <button type="button" className="chat-send" onClick={()=>send()} disabled={aiFreeTier||!inp.trim()||load} aria-label={t("send","Send")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M1 7l12-6-6 12-1.5-5L1 7z" fill="white"/></svg>
          </button>
        </div>
      </div>
    );
  }

  const aiPanelStyle: React.CSSProperties=embedded
    ? {position:"relative",width:"100%",height:referenceShell?"100%":(isMobile?560:680),display:"flex",flexDirection:"column",zIndex:1,borderRadius:referenceShell?0:18,overflow:"hidden"}
    : (isMobile
        ? {position:"fixed",left:0,right:0,top:0,bottom:0,width:"100%",maxWidth:480,marginLeft:"auto",borderLeft:"1px solid var(--border)",display:"flex",flexDirection:"column",zIndex:50,boxShadow:"-16px 0 48px rgba(0,0,0,.3)",borderRadius:0}
        : {position:"absolute",right:0,top:0,bottom:0,width:360,borderLeft:"1px solid var(--border)",display:"flex",flexDirection:"column",zIndex:45,boxShadow:"-16px 0 48px rgba(0,0,0,.2)",borderRadius:"16px 0 0 0"});
  const showCtxStrip=Boolean((mapName||"").trim()||(projectName||"").trim()||nodes.length>0);
  return(
    <div className={`glass-panel sa-ai-panel ${embedded?"":"panel-slide"} ${exiting&&!embedded?"panel-slide-out":""}`.trim()} style={{...aiPanelStyle,background:"var(--glass-panel-bg)",backdropFilter:"blur(24px)"}}>
      <div className="sa-ai-panel-header" style={{display:"flex",alignItems:"center",gap:12,padding:"16px 18px",borderBottom:"1px solid var(--glass-border-accent,var(--border))",flexShrink:0,background:"rgba(255,255,255,.02)",backdropFilter:"blur(12px)",position:"relative"}}>
        <div style={{width:36,height:36,borderRadius:10,background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 2px 12px var(--accent-glow)",flexShrink:0,border:"1px solid rgba(255,255,255,.2)"}}>✦</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:900,color:"var(--text)",letterSpacing:"-0.02em"}}>{t("ai_consultant","AI Советник")}</div>
          <div style={{fontSize:11,color:"var(--accent-2)",fontWeight:600,marginTop:1}}>{tierCfg.badge} {tierCfg.label}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>{const g={free:t("ai_greet_free","Привет! Я AI-стратег: помогу выбрать следующий шаг и метрику. Чипы ниже — быстрый старт."),starter:t("ai_greet_starter","Привет! Я ваш стратегический помощник: риски, маркетинг, продажи — в привязке к карте. Спросите или нажмите чип."),pro:t("ai_greet_pro","Привет! Режим Pro: SWOT, Porter, OKR, CAC/LTV, MEDDIC. Дам диагноз → действия → риск → быструю победу."),team:t("ai_greet_team","Добрый день. Партнёрский режим: GTM, unit economics, Blue Ocean. Executive insight и топ-приоритеты по вашей карте."),enterprise:t("ai_greet_enterprise","Добрый день. Коллегиум C-level: стратегия, маркетинг, продажи, финансы. Ищем non-obvious ходы и слепые зоны.")};setMsgs([{role:"ai",text:g[tier]||g.free}]);}} title={t("clear_chat","Очистить чат")} style={{padding:"6px 10px",borderRadius:8,border:"1px solid var(--glass-border-accent,var(--border))",background:"rgba(255,255,255,.04)",color:"var(--text4)",cursor:"pointer",fontSize:11,fontWeight:600}}>↻</button>
          {!embedded&&<button onClick={handleClose} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--glass-border-accent,var(--border))",background:"rgba(255,255,255,.04)",color:"var(--text4)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>}
        </div>
      </div>
      {showCtxStrip&&(
        <div style={{padding:"12px 18px 10px",borderBottom:"1px solid var(--glass-border-accent,var(--border))",flexShrink:0}}>
          <div className="sa-ai-panel-ctx">{t("ai_panel_context_lbl","Контекст")}</div>
          <div className="sa-ai-panel-strip">
            {(mapName||"").trim()?(
              <span><span aria-hidden>📍</span>{(mapName||"").trim()}</span>
            ):(projectName||"").trim()?(
              <span><span aria-hidden>📁</span>{(projectName||"").trim()}</span>
            ):null}
            {nodes.length>0&&(
              <>
                <span aria-hidden>·</span>
                <span><span className="sa-ai-hp">{panelHealth.h}%</span> {t("ai_health_short","Health")}</span>
                <span aria-hidden>·</span>
                <span>{nodes.length} {t("steps_label","шагов")}</span>
              </>
            )}
          </div>
        </div>
      )}
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--glass-border-accent,var(--border))",flexShrink:0,background:"transparent"}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--text5)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{t("ai_quick_questions","Быстрые вопросы")}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {quick.map(q=>(
            <button key={q} className="btn-interactive sa-ai-chip" onClick={()=>send(q)} style={{padding:"8px 12px",borderRadius:999,border:"1px solid var(--glass-border-accent,var(--border))",background:"rgba(255,255,255,.04)",backdropFilter:"blur(8px)",color:"var(--text2)",cursor:"pointer",fontSize:11,fontWeight:600}}>{q}</button>
          ))}
          {allQuick.length>QUICK_SHOW&&(
            <button onClick={()=>setShowMoreQuick(s=>!s)} className="btn-interactive sa-ai-chip" style={{padding:"8px 12px",borderRadius:999,border:"1px dashed var(--border)",background:"transparent",color:"var(--text4)",fontSize:11,fontWeight:600,cursor:"pointer"}}>
              {showMoreQuick?"▲ "+t("collapse","Свернуть"):"+ "+t("more_dots","Ещё…")}
            </button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="sa-ai-msg-scroll" style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:14,scrollBehavior:"smooth"}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":m.role==="sys"?"center":"flex-start",gap:10,alignItems:"flex-start",animation:"fadeInUp .4s cubic-bezier(0.22,1,0.36,1) forwards"}}>
            {m.role==="ai"&&<div style={{width:28,height:28,borderRadius:8,background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,marginTop:2,boxShadow:"0 2px 8px var(--accent-glow)"}}>◆</div>}
            <div style={{maxWidth:"88%",padding:m.role==="user"?"12px 16px":"12px 16px 12px 20px",borderRadius:m.role==="user"?"14px 14px 4px 14px":m.role==="sys"?"10px":"4px 14px 14px 14px",background:m.role==="user"?"var(--gradient-accent)":m.role==="sys"?"rgba(16,185,129,.12)":"rgba(255,255,255,.04)",backdropFilter:m.role==="user"?"none":"blur(10px)",border:m.role==="user"?"none":m.role==="sys"?"1px solid rgba(16,185,129,.25)":"1px solid var(--glass-border-accent,var(--border))",borderLeft:m.role==="ai"?"3px solid var(--accent-1)":"none",fontSize:13,lineHeight:1.6,color:m.role==="user"?"var(--accent-on-bg,#fff)":m.role==="sys"?"var(--green)":"var(--text)",whiteSpace:"pre-wrap",boxShadow:m.role==="user"?"0 2px 12px var(--accent-glow)":m.role==="sys"?"none":"0 2px 12px rgba(0,0,0,.06)"}}>{m.text}</div>
          </div>
        ))}
        {load&&<div style={{display:"flex",gap:10,alignItems:"center",minHeight:42}}><div style={{width:28,height:28,borderRadius:8,background:"var(--gradient-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,boxShadow:"0 2px 8px var(--accent-glow)"}}>◆</div><div style={{display:"flex",gap:4,padding:"10px 14px",background:"rgba(255,255,255,.04)",backdropFilter:"blur(8px)",borderRadius:"4px 14px 14px 14px",border:"1px solid var(--glass-border-accent,var(--border))"}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--accent-1)",animation:`thinkDot 1.4s ease ${i*.2}s infinite`,opacity:.7}}/>)}</div></div>}
        <div ref={endRef}/>
      </div>
      <div style={{padding:"16px 18px",borderTop:"1px solid var(--glass-border-accent,var(--border))",flexShrink:0,background:"rgba(255,255,255,.02)",backdropFilter:"blur(8px)",flexDirection:"column",display:"flex",gap:10}}>
        {aiFreeTier&&<div role="status" className="glass-card" style={{padding:"12px 14px",borderRadius:12,border:"1px solid rgba(104,54,245,.32)",background:"linear-gradient(135deg,rgba(104,54,245,.10),rgba(160,80,255,.06))",color:"var(--text2)",fontSize:12.5,display:"flex",alignItems:"center",gap:10}}>
          <span style={{width:28,height:28,borderRadius:8,background:"var(--gradient-accent)",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"var(--accent-on-bg,#fff)",fontSize:14,flexShrink:0,boxShadow:"0 4px 14px var(--accent-glow)"}}>✦</span>
          <span style={{lineHeight:1.45}}>{t("ai_free_upgrade","AI-чат доступен с тарифа Starter. Улучшите тариф в профиле.")}</span>
        </div>}
        <div className="sa-ai-input-wrap" style={{opacity:aiFreeTier?.65:1,width:"100%"}}>
          <input ref={inpRef} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={aiFreeTier?t("ai_free_placeholder","Доступно с тарифа Starter"):t("ask_placeholder","Спросите о стратегии…")} disabled={aiFreeTier} style={{flex:1,minWidth:0,padding:"10px 4px 10px 0",fontSize:13,color:"var(--text)",outline:"none",fontFamily:"'Inter',system-ui,sans-serif",transition:"opacity .2s",opacity:aiFreeTier?.7:1}}/>
          <button className="btn-interactive" onClick={()=>send()} disabled={aiFreeTier||!inp.trim()||load} style={{width:44,height:44,borderRadius:12,border:"none",flexShrink:0,background:!aiFreeTier&&inp.trim()&&!load?"var(--gradient-accent)":"rgba(255,255,255,.06)",color:!aiFreeTier&&inp.trim()&&!load?"var(--accent-on-bg,#fff)":"var(--text4)",cursor:!aiFreeTier&&inp.trim()&&!load?"pointer":"not-allowed",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:!aiFreeTier&&inp.trim()&&!load?"0 2px 12px var(--accent-glow)":"none"}}>↑</button>
        </div>
      </div>
    </div>
  );
}
