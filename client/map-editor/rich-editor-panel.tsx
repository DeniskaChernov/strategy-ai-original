import React, { useState, useRef, useEffect, useMemo } from "react";
import { useLang } from "../lang-context";
import { getSTATUS, getPRIORITY, getETYPE } from "../lib/strategy-labels";
import { callAI } from "../lib/call-ai";
import { uid } from "../lib/util";
import { IconButton } from "../components/icon-button";
import { IconTrash } from "../components/icons";
import { CustomSelect } from "../components/custom-select";

// Map editor: step side panel
// ── RichEditorPanel ── (aiPanelOpen: сдвигает влево, чтобы не перекрывать AI; isMobile: полноэкранная панель)
export function RichEditorPanel({node,ctx,readOnly,userName,onUpdate,onDelete,onClose,allNodes=[],allEdges=[],onScrollTo,onConnect,onError,onNotify,aiPanelOpen,isMobile,referenceShell=false,statusMap,etypeMap}){
  const{t,lang}=useLang();
  const STATUS=statusMap||getSTATUS(t);
  const PRIORITY=getPRIORITY(t);
  const ETYPE=etypeMap||getETYPE(t);
  const[tab,setTab]=useState("info");
  const[showMore,setShowMore]=useState(false);
  const[newComment,setNewComment]=useState("");
  const[aiRephrLoading,setAiRephrLoading]=useState(false);
  const[aiCommentLoading,setAiCommentLoading]=useState(false);
  const[autoConnLoading,setAutoConnLoading]=useState(false);
  const[exiting,setExiting]=useState(false);
  const handleClose=()=>{if(exiting)return;setExiting(true);setTimeout(()=>onClose(),320);};
  const comments=node.comments||[];
  const history=node.history||[];
  const accentPick=(STATUS.planning&&STATUS.planning.c)||"#6836f5";
  const COLORS=["",accentPick,(ETYPE.affects&&ETYPE.affects.c)||"#a050ff","#06b6d4","#12c482","#f09428","#f04458","#ec4899","#0891b2","#84cc16","#ea580c"];

  async function aiRephrase(){
    if(aiRephrLoading)return;
    setAiRephrLoading(true);
    const nodeEdges=allEdges.filter(e=>(e.source||e.from)===node.id||(e.target||e.to)===node.id);
    const connStr=nodeEdges.length?nodeEdges.map(e=>{const s=allNodes.find(n=>n.id===(e.source||e.from)),t=allNodes.find(n=>n.id===(e.target||e.to));return `${s?.title||""} ${e.type||"→"} ${t?.title||""}`;}).join("; "):"нет";
    try{
      const raw=await callAI([{role:"user",content:`Перефразируй шаг стратегической карты. Сделай название КОНКРЕТНЫМ ДЕЙСТВИЕМ (глагол+объект).
Текущее: ${node.title||""}
Причина: ${node.reason||"нет"}
Действие: ${node.action||"нет"}
Метрика: ${node.metric||"нет"}
Контекст: ${ctx||"стартап"}
Связи: ${connStr}

Правила: title — название (глагол+объект), reason — зачем, action — что именно сделать (конкретное действие), metric — измеримый результат. Учитывай связи и отрасль. Формулировка — actionable.
Верни ТОЛЬКО JSON: {"title":"...","reason":"...","action":"...","metric":"..."}`}],"Ты редактор стратегических карт. Делай формулировки конкретными: название + зачем + что сделать + результат. Без воды.",400);
      let p;
      try{p=JSON.parse(raw.replace(/```json|```/g,"").trim());}
      catch{const m=raw.match(/\{[\s\S]*\}/);p=m?JSON.parse(m[0]):null;}
      if(p?.title){
        const hEntry={id:uid(),type:"ai_rephrase",at:Date.now(),by:"AI ✦",before:{title:node.title},after:{title:p.title}};
        onUpdate({...p,action:p.action!=null?p.action:node.action,history:[...history,hEntry]});
      }else{onError?.(t("ai_rephrase_no_result","AI не смог перефразировать. Попробуйте ещё раз."));}
    }catch(e:any){onError?.(e?.message||t("ai_rephrase_error","Ошибка AI. Проверьте сеть и ключ API."));}
    setAiRephrLoading(false);
  }

  async function addComment(){
    const text=newComment.trim();
    if(!text)return;
    if(text.startsWith("@AI")||text.startsWith("@ai")){
      const q=text.replace(/^@[Aa][Ii]\s*/,"");
      const userMsg={id:uid(),author:userName,text,at:Date.now()};
      const aiPlaceholder={id:uid(),author:"AI ✦",text:"…",at:Date.now()+1,isAI:true};
      const base=[...comments,userMsg];
      onUpdate({comments:[...base,aiPlaceholder]});
      setNewComment("");
      setAiCommentLoading(true);
      try{
        const nodeEdges=allEdges.filter(e=>(e.source||e.from)===node.id||(e.target||e.to)===node.id);
        const connStr=nodeEdges.length?nodeEdges.map(e=>{const s=allNodes.find(n=>n.id===(e.source||e.from)),t=allNodes.find(n=>n.id===(e.target||e.to));return `${s?.title||""} ${e.type||"→"} ${t?.title||""}`;}).join("; "):"нет";
        const answer=await callAI([{role:"user",content:`Вопрос по шагу "${node.title||""}" (зачем: ${node.reason||"-"}, что сделать: ${node.action||"-"}, метрика: ${node.metric||"-"}): ${q}\nКонтекст: ${ctx||"стартап"}. Связи: ${connStr}\nОтветь кратко. Дай ТОЛЬКО конкретное действие — что сделать, зачем, как измерить. Без общих фраз.`}],"Ты AI-советник. Отвечай ТОЛЬКО конкретными действиями и измеримым результатом. Формат: что сделать → зачем → метрика. Без воды.",300);
        onUpdate({comments:[...base,{...aiPlaceholder,text:answer}]});
      }catch(e:any){onUpdate({comments:[...base,{...aiPlaceholder,text:t("ai_comment_error","Ошибка AI. Попробуйте ещё раз.")}]});onError?.(e?.message||t("ai_comment_error","Ошибка AI. Попробуйте ещё раз."));}
      setAiCommentLoading(false);
    }else{
      const c={id:uid(),author:userName,text,at:Date.now()};
      onUpdate({comments:[...comments,c]});
      setNewComment("");
    }
  }

  async function doAutoConnect(){
    if(autoConnLoading||allNodes.length<2)return;
    setAutoConnLoading(true);
    const others=allNodes.filter(n=>n.id!==node.id).map(n=>`${n.id}:${n.title}${n.reason?" ("+n.reason+")":""}`);
    const existingForNode=allEdges.filter(e=>(e.source||e.from)===node.id||(e.target||e.to)===node.id);
    const prompt=`Узел: "${node.title}" (${node.reason||"-"}, метрика: ${node.metric||"-"}).
Контекст: ${ctx||"стартап"}

Другие узлы (id:title): ${others.join("; ")}

Уже есть связей у этого узла: ${existingForNode.length}. ${existingForNode.length?existingForNode.map(e=>`${e.source||e.from}→${e.target||e.to}:${e.type}`).join(", "):""}

Связи: [{"from":"${node.id}","to":"id_другого_узла","type":"requires|affects|blocks|follows"}]. Максимум 3, только логичные. requires: A нужен для B. affects: A влияет. blocks: A блокирует. follows: B после A. Используй ID из списка "Другие узлы".`;
    try{
      const raw=await callAI([{role:"user",content:prompt}],"Ты стратег. Учитывай отрасль и бизнес-контекст. Определи логические зависимости. Верни ТОЛЬКО JSON массив [{from,to,type}]. Используй ID узлов из запроса.",400);
      const clean=raw.replace(/```json|```/g,"").trim();
      let arr;
      try{const p=JSON.parse(clean);arr=Array.isArray(p)?p:(p.connections||p.edges||[]);}catch{arr=[];}
      const valid=arr.filter(e=>e.from&&e.to&&e.from!==e.to&&allNodes.find(n=>n.id===e.to||n.id===e.from));
      const toAdd=valid.filter(ne=>!allEdges.find(ex=>(ex.source===ne.from&&ex.target===ne.to)||(ex.from===ne.from&&ex.to===ne.to)));
      if(toAdd.length>0){
        toAdd.forEach(e=>{onConnect&&onConnect({source:e.from,target:e.to,type:e.type||"requires"});});
        onNotify?.(t("links_added","🔗 Добавлено: {n} связей").replace("{n}",String(toAdd.length)),"success");
      }else{onNotify?.(t("links_optimal","Связи уже оптимальны"),"info");}
    }catch(e:any){onError?.(e?.message||t("ai_autoconnect_error","Ошибка AI. Попробуйте ещё раз."));}
    setAutoConnLoading(false);
  }

  const iS=useMemo<React.CSSProperties>(()=>({width:"100%",padding:"10px 12px",fontSize:13,background:"rgba(255,255,255,.04)",border:"1px solid var(--glass-border-accent,var(--input-border))",borderRadius:10,color:"var(--text)",outline:"none",fontFamily:"'Inter',system-ui,sans-serif",transition:"border-color .2s",backdropFilter:"blur(8px)"}),[]);
  const iSTextarea=useMemo<React.CSSProperties>(()=>({...iS,resize:"vertical",minHeight:40,maxHeight:160,overflowY:"auto",wordBreak:"break-word"}),[iS]);
  const connCount=allEdges.filter(e=>(e.source||e.from)===node.id||(e.target||e.to)===node.id).length;
  const tabs=useMemo(()=>[
    ["info","◆ "+t("tab_info","Инфо")] as const,
    ["comments",`💬${comments.length?" "+comments.length:""}`] as const,
    ["connections",`⇄${connCount?" "+connCount:""}`] as const,
    ["history",`⏱${history.length?" "+history.length:""}`] as const,
  ],[t,comments.length,connCount,history.length]);

  // focus trap внутри шторки
  const panelRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    function onKey(e:KeyboardEvent){
      if(e.key==="Escape"){e.preventDefault();handleClose();return;}
      if(e.key!=="Tab"||!panelRef.current)return;
      const focusable=panelRef.current.querySelectorAll<HTMLElement>('button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if(focusable.length===0)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const refShell=referenceShell&&!isMobile;
  const panelRight=isMobile?0:refShell?0:(aiPanelOpen?360:0);
  const panelWidth=isMobile?"100%":refShell?300:(aiPanelOpen?320:340);
  const panelStyle: React.CSSProperties=isMobile?{position:"fixed",left:0,right:0,top:0,bottom:0,width:"100%",maxWidth:480,marginLeft:"auto",borderLeft:"1px solid var(--border)",display:"flex",flexDirection:"column",zIndex:50,boxShadow:"-16px 0 48px rgba(0,0,0,.3)",borderRadius:0}:refShell?{position:"absolute",top:16,right:16,bottom:16,width:300,display:"flex",flexDirection:"column",zIndex:10}:{position:"absolute",right:panelRight,top:0,bottom:0,width:panelWidth,borderLeft:"1px solid var(--border)",display:"flex",flexDirection:"column",zIndex:40,boxShadow:"-16px 0 48px rgba(0,0,0,.2)",borderRadius:"16px 0 0 0"};
  const panelClass=refShell?`node-panel open${exiting?" panel-slide-out":""}`:`glass-panel panel-slide ${exiting?"panel-slide-out":""}`.trim();
  return(
    <div ref={panelRef} role="dialog" aria-modal="false" aria-label={t("editor_panel","Редактор шага")}
         className={panelClass} style={panelStyle}>
      <div className={refShell?"np-head":undefined} style={refShell?undefined:{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:"1px solid var(--glass-border-accent,var(--border))",flexShrink:0,background:"rgba(255,255,255,.02)",backdropFilter:"blur(12px)"}}>
        {refShell?(
          <>
            <div className="np-type">{(STATUS[node.status]?.label||node.status||"Step").slice(0,12)}</div>
            <input className="np-title-input" value={node.title||""} onChange={e=>!readOnly&&onUpdate({title:e.target.value})} placeholder={t("title","Node title…")} readOnly={readOnly}/>
            <div className="np-close" onClick={handleClose} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")handleClose();}} aria-label={t("close","Close")}>×</div>
          </>
        ):(
          <>
        <div style={{width:10,height:10,borderRadius:3,background:STATUS[node.status]?.c||"var(--accent-1)",flexShrink:0}}/>
        <div style={{flex:1,fontSize:14,fontWeight:800,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{node.title||t("untitled","Без названия")}</div>
        {onScrollTo&&<IconButton size={36} onClick={()=>onScrollTo(node)} title={t("find_on_map","Найти на карте")} aria-label={t("find_on_map","Найти на карте")} style={{borderRadius:10}}>↗</IconButton>}
        <IconButton size={36} danger onClick={handleClose} title={t("close","Закрыть")} aria-label={t("close","Закрыть")} style={{borderRadius:10,fontSize:16}}>×</IconButton>
          </>
        )}
      </div>
      {!refShell&&(
      <div className="tabs" role="tablist" style={{margin:"10px 14px 6px",overflowX:"auto",flexShrink:0}}>
        {tabs.map(item=>{
          const k=item[0],lbl=item[1];
          const isActive=tab===k;
          return <button key={k} role="tab" aria-selected={isActive} className={"tab"+(isActive?" on":"")} onClick={()=>setTab(k)} style={{flex:1,whiteSpace:"nowrap",fontSize:12}}>{lbl}</button>;
        })}
      </div>
      )}
      <div className={refShell?"np-body":undefined} style={refShell?undefined:{flex:1,overflowY:"auto",padding:"14px 16px"}}>
        {(refShell||tab==="info")&&(
          <div style={{display:"flex",flexDirection:"column",gap:refShell?12:14}}>
            {!refShell&&(
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text4)",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                {t("title","Название")}
                {!readOnly&&<button onClick={aiRephrase} disabled={aiRephrLoading} style={{fontSize:11,padding:"2px 8px",borderRadius:6,border:"1px solid var(--border)",background:"var(--surface)",color:aiRephrLoading?"var(--text4)":"var(--accent-2)",cursor:aiRephrLoading?"wait":"pointer",transition:"all .2s"}}>{aiRephrLoading?"…":"✨ AI"}</button>}
              </div>
              <textarea value={node.title||""} onChange={e=>!readOnly&&onUpdate({title:e.target.value})} rows={1} style={{...iSTextarea,minHeight:44,maxHeight:80}} readOnly={readOnly} placeholder={t("title","Название шага")}/>
            </div>
            )}
            <div className={refShell?"np-section":undefined}>
              <div className={refShell?"np-lbl":undefined} style={refShell?undefined:{fontSize:12,fontWeight:600,color:"var(--text4)",marginBottom:6}}>{refShell?t("why_label","Description"):t("why_label","Зачем?")} {!refShell&&<span style={{fontSize:11,color:"var(--text5)",fontWeight:400}}>(описание)</span>}</div>
              <textarea className={refShell?"np-textarea":undefined} value={node.reason||""} onChange={e=>!readOnly&&onUpdate({reason:e.target.value})} placeholder={t("why_placeholder","What does this node represent?")} rows={refShell?3:2} style={refShell?undefined:{...iSTextarea,minHeight:56}} readOnly={readOnly}/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"var(--accent-2)",marginBottom:6}}>{t("action_label","Что сделать")} <span style={{fontSize:11,color:"var(--text5)",fontWeight:400}}>(конкретное действие)</span></div>
              <textarea value={node.action||""} onChange={e=>!readOnly&&onUpdate({action:e.target.value})} placeholder={t("action_placeholder","Напр.: Провести 15 интервью с ЦА до пятницы")} rows={2} style={{...iSTextarea,minHeight:56,borderColor:"var(--accent-1)"}} readOnly={readOnly}/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text4)",marginBottom:6}}>{t("metric_label","Метрика")}</div>
              <input value={node.metric||""} onChange={e=>!readOnly&&onUpdate({metric:e.target.value})} style={{...iS,resize:undefined}} readOnly={readOnly}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><div style={{fontSize:11,fontWeight:600,color:"var(--text5)",marginBottom:4}}>{t("status","Статус")}</div>
                <CustomSelect value={node.status||"planning"} onChange={v=>!readOnly&&onUpdate({status:v})} disabled={readOnly} style={{width:"100%"}} options={Object.entries(STATUS).map(([k,s]:[string,{label:string;c:string}])=>({value:k,label:s.label,dot:s.c}))}/>
              </div>
              <div><div style={{fontSize:11,fontWeight:600,color:"var(--text5)",marginBottom:4}}>{t("priority","Приоритет")}</div>
                <CustomSelect value={node.priority||"medium"} onChange={v=>!readOnly&&onUpdate({priority:v})} disabled={readOnly} style={{width:"100%"}} options={Object.entries(PRIORITY).map(([k,p]:[string,{label:string;c:string}])=>({value:k,label:p.label,dot:p.c}))}/>
              </div>
            </div>
            <div><div style={{fontSize:11,fontWeight:600,color:"var(--text5)",marginBottom:4}}>{t("progress","Прогресс")} <span style={{color:"var(--accent-1)",fontWeight:700}}>{node.progress||0}%</span></div>
              <input type="range" min={0} max={100} value={node.progress||0} onChange={e=>!readOnly&&onUpdate({progress:+e.target.value})} style={{width:"100%",accentColor:"var(--accent-1)"}} disabled={readOnly}/>
            </div>
            {showMore&&(
              <div style={{display:"flex",flexDirection:"column",gap:12,paddingTop:8,borderTop:"1px solid var(--border)",animation:"slideDown .25s ease"}}>
                <div><div style={{fontSize:11,fontWeight:600,color:"var(--text5)",marginBottom:4}}>{t("node_deadline","Дедлайн")}</div>
                  <input type="date" value={node.deadline||""} onChange={e=>!readOnly&&onUpdate({deadline:e.target.value})} style={{...iS,resize:undefined}} readOnly={readOnly}/>
                </div>
                <div><div style={{fontSize:11,fontWeight:600,color:"var(--text5)",marginBottom:4}}>{t("tags_label","Теги")}</div>
                  <input value={(node.tags||[]).join(", ")} onChange={e=>!readOnly&&onUpdate({tags:e.target.value.split(",").map(tc=>tc.trim()).filter(Boolean)})} placeholder="тег1, тег2" style={{...iS,resize:undefined}} readOnly={readOnly}/>
                </div>
                <div><div style={{fontSize:11,fontWeight:600,color:"var(--text5)",marginBottom:6}}>{t("node_color_label","Цвет")}</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {COLORS.map((c,i)=>(
                      <div key={i} onClick={()=>!readOnly&&onUpdate({color:c})} style={{width:20,height:20,borderRadius:6,background:c||"var(--surface2)",border:(node.color||"")===(c)?"2px solid var(--text)":"1px solid var(--border)",cursor:readOnly?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"var(--text5)",transition:"all .15s"}}>{!c&&"∅"}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <button onClick={()=>setShowMore(s=>!s)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",color:"var(--text4)",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s"}}>
              {showMore?"▲ "+t("collapse","Свернуть"):"▼ "+t("details","Детали")}
            </button>
            {!readOnly&&(
              <div style={{display:"flex",gap:6,paddingTop:4,flexWrap:"wrap"}}>
                {onConnect&&<button onClick={()=>onConnect({startNode:node})} style={{flex:"1 1 80px",padding:"8px 12px",borderRadius:8,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:"var(--accent-2)",cursor:"pointer",fontSize:12,fontWeight:600,transition:"all .2s"}}>⇒ {t("link_btn","Связать")}</button>}
                <button onClick={doAutoConnect} disabled={autoConnLoading} style={{flex:"1 1 80px",padding:"8px 12px",borderRadius:8,border:"1px solid var(--accent-1)",background:"var(--accent-soft)",color:autoConnLoading?"var(--text4)":"var(--accent-2)",cursor:autoConnLoading?"wait":"pointer",fontSize:12,fontWeight:600,transition:"all .2s"}}>{autoConnLoading?"…":"✦ AI"}</button>
                <button onClick={()=>{
                  try{
                    localStorage.setItem("sa_cp_prefill",JSON.stringify({title:node.title||"",brief:node.reason||node.action||"",strategyStepId:node.id,strategyStepTitle:node.title||"",ts:Date.now()}));
                    onNotify?.(t("cp_prefill_ready","Черновик публикации подготовлен. Откройте Контент-план."),"success");
                  }catch{}
                }} title={t("cp_create_from_step","Создать пост из шага")} style={{flex:"1 1 80px",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text2)",cursor:"pointer",fontSize:12,fontWeight:600,transition:"all .2s"}}>📝 {t("cp_create_from_step_short","В контент-план")}</button>
                <button type="button" aria-label={t("delete","Удалить")} onClick={()=>onDelete(node.id)} style={{padding:"8px 12px",borderRadius:"var(--radius-sm,8px)",border:"1px solid rgba(239,68,68,.25)",background:"rgba(239,68,68,.08)",color:"var(--red)",cursor:"pointer",fontSize:12,transition:"all .2s",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><IconTrash/></button>
              </div>
            )}
          </div>
        )}
        {!refShell&&tab==="comments"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {comments.length===0&&<div style={{padding:"20px",textAlign:"center",color:"var(--text5)",fontSize:13,border:"1px dashed var(--border2)",borderRadius:8}}>{t("no_comments2","Нет комментариев.")}<br/><span style={{fontSize:13}}>{t("use_ai_comment","Используйте @AI чтобы задать вопрос AI.")}</span></div>}
            {comments.map(c=>(
              <div key={c.id} style={{padding:"9px 11px",borderRadius:9,background:c.isAI?"var(--accent-soft)":"var(--surface)",border:`1px solid ${c.isAI?"var(--accent-1)":"var(--border)"}`,position:"relative"}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                  <div style={{width:18,height:18,borderRadius:"50%",background:c.isAI?"var(--gradient-accent)":"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:c.isAI?"var(--accent-on-bg)":"var(--text4)",fontWeight:700,flexShrink:0}}>{c.isAI?"✦":(c.author||"?")[0].toUpperCase()}</div>
                  <div style={{fontSize:13.5,fontWeight:700,color:c.isAI?"var(--accent-2)":"var(--text3)"}}>{c.author}</div>
                  <div style={{fontSize:12,color:"var(--text5)",marginLeft:"auto"}}>{new Date(c.at).toLocaleString(lang==="en"?"en-US":lang==="uz"?"uz-UZ":"ru",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>
                  {!readOnly&&!c.isAI&&<button onClick={()=>onUpdate({comments:comments.filter(x=>x.id!==c.id)})} style={{width:16,height:16,borderRadius:4,border:"none",background:"transparent",color:"var(--text5)",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>}
                </div>
                <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.55,whiteSpace:"pre-wrap"}}>{c.text}</div>
                {c.text==="…"&&aiCommentLoading&&<div style={{display:"flex",gap:3,marginTop:4}}>{[0,1,2].map(i=><div key={i} style={{width:4,height:4,borderRadius:"50%",background:"var(--accent-1)",animation:`thinkDot 1.4s ease ${i*.2}s infinite`}}/>)}</div>}
              </div>
            ))}
            {!readOnly&&(
              <div style={{marginTop:4,borderTop:"1px solid var(--border)",paddingTop:8,display:"flex",flexDirection:"column",gap:6}}>
                <textarea value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder={t("comment_placeholder","Комментарий… или @AI вопрос (Ctrl+Enter)")} rows={2} onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();addComment();}}} style={{...iSTextarea,lineHeight:1.5}}/>
                <button onClick={addComment} disabled={!newComment.trim()||aiCommentLoading} style={{padding:"7px",borderRadius:8,border:"none",background:newComment.trim()&&!aiCommentLoading?"var(--gradient-accent)":"var(--surface2)",color:newComment.trim()&&!aiCommentLoading?"var(--accent-on-bg)":"var(--text4)",fontSize:13,cursor:newComment.trim()&&!aiCommentLoading?"pointer":"not-allowed",fontWeight:600}}>{aiCommentLoading?t("ai_replying","AI отвечает…"):t("send","Отправить")}</button>
              </div>
            )}
          </div>
        )}
        {!refShell&&tab==="connections"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(()=>{
              const allE=allEdges.filter(e=>(e.source||e.from)===node.id||(e.target||e.to)===node.id);
              if(allE.length===0)return <div style={{padding:"20px",textAlign:"center",color:"var(--text5)",fontSize:13,border:"1px dashed var(--border2)",borderRadius:8}}>{t("no_edges","Нет связей.")}<br/>{t("use_connect","Используйте ⇒ Связать или ✦ AI-связи.")}</div>;
              const outgoing=allE.filter(e=>(e.source||e.from)===node.id);
              const incoming=allE.filter(e=>(e.target||e.to)===node.id);
              function ConnSection({title,edges}){
                if(!edges.length)return null;
                return(
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"var(--text5)",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>{title}</div>
                    {edges.map(e=>{
                      const otherId=(e.source||e.from)===node.id?(e.target||e.to):(e.source||e.from);
                      const other=allNodes.find(n=>n.id===otherId);
                      const et=ETYPE[e.type]||ETYPE.requires;
                      return(
                        <div key={e.id} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 9px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",marginBottom:5,cursor:"pointer"}}
                          onClick={()=>onScrollTo&&onScrollTo(other)}>
                          <div style={{width:7,height:7,borderRadius:2,background:et.c,flexShrink:0}}/>
                          <div style={{flex:1,fontSize:13,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{other?.title||t("deleted","Удалён")}</div>
                          <div style={{fontSize:12,color:et.c,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{et.label}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return(
                <React.Fragment>
                  <ConnSection title={`→ ${t("outgoing","Исходящие")} (${outgoing.length})`} edges={outgoing}/>
                  <ConnSection title={`← ${t("incoming","Входящие")} (${incoming.length})`} edges={incoming}/>
                </React.Fragment>
              );
            })()}
          </div>
        )}
        {!refShell&&tab==="history"&&(
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {history.length===0&&<div style={{padding:"20px",textAlign:"center",color:"var(--text5)",fontSize:13,border:"1px dashed var(--border2)",borderRadius:8}}>{t("history_empty2","История изменений пуста.")}</div>}
            {[...history].reverse().map(h=>(
              <div key={h.id} style={{padding:"9px 11px",borderRadius:9,background:"var(--surface)",border:"1px solid var(--border)"}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:13.5,fontWeight:700,color:h.type==="ai_rephrase"?"var(--accent-2)":"var(--text3)"}}>{h.type==="ai_rephrase"?"✦ "+t("ai_rephrased","AI переформулировал"):"✏️ "+t("changed","Изменено")}</span>
                  <span style={{fontSize:12,color:"var(--text5)",marginLeft:"auto"}}>{new Date(h.at).toLocaleString(lang==="en"?"en-US":lang==="uz"?"uz-UZ":"ru",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <div style={{fontSize:13,color:"var(--text4)",marginBottom:3}}>{t("author","Автор")}: {h.by}</div>
                {h.before?.title&&<div style={{fontSize:13,color:"var(--text5)",padding:"3px 7px",background:"rgba(239,68,68,.04)",borderRadius:5,borderLeft:"2px solid rgba(239,68,68,.3)",marginBottom:2}}>{t("before","До")}: {h.before.title}</div>}
                {h.after?.title&&<div style={{fontSize:13,color:"var(--text3)",padding:"3px 7px",background:"rgba(16,185,129,.04)",borderRadius:5,borderLeft:"2px solid rgba(16,185,129,.3)"}}>{t("after","После")}: {h.after.title}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

