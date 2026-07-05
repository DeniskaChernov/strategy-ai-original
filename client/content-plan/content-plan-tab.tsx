import React, { useState, useEffect } from "react";
import { uid } from "../lib/util";
import { getContentPlan, saveContentPlan } from "../lib/maps-api";
import { callAI } from "../lib/call-ai";
import { useIsMobile } from "../hooks/use-is-mobile";
import { GlassCalendar, dateToYMD } from "../glass-calendar";
import { PillGroup } from "../components/pill-group";
import { ConfirmDialog } from "../strategy-modals/confirm-dialog";
import { IconTrash } from "../components/icons";

// ── ContentPlanTab (Pro+): ведение контент-плана по проекту, связь с шагами стратегии ──
const CONTENT_TYPES=[{id:"post",labelKey:"content_type_post",fb:"Пост"},{id:"story",labelKey:"content_type_story",fb:"История"},{id:"email",labelKey:"content_type_email",fb:"Рассылка"},{id:"video",labelKey:"content_type_video",fb:"Видео"}];
const CONTENT_CHANNELS=[{id:"blog",labelKey:"content_channel_blog",fb:"Блог"},{id:"instagram",labelKey:"content_channel_instagram",fb:"Instagram"},{id:"telegram",labelKey:"content_channel_telegram",fb:"Telegram"},{id:"vk",labelKey:"content_channel_vk",fb:"ВКонтакте"},{id:"youtube",labelKey:"content_channel_youtube",fb:"YouTube"},{id:"email",labelKey:"content_channel_email",fb:"Email"}];
const CONTENT_STATUSES=[{id:"draft",labelKey:"content_status_draft",fb:"Черновик"},{id:"scheduled",labelKey:"content_status_scheduled",fb:"Запланировано"},{id:"published",labelKey:"content_status_published",fb:"Опубликовано"}];

export function ContentPlanTab({projectId,projectName,maps,user,theme,lang,t,onChangeTier}:{projectId:string;projectName:string;maps:any[];user:any;theme:string;lang:string;t:(k:string,fb?:string)=>string;onChangeTier:(tier:string)=>void}){
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
            <div className="cp-kanban">
              {CONTENT_STATUSES.map(st=>{
                const colItems=filtered.filter((it:any)=>it.status===st.id);
                return(
                  <div key={st.id} className="cp-col">
                    <div className="cp-col-head">
                      <span className="cp-col-name">{t(st.labelKey||"",st.fb||st.id)}</span>
                      <span className="cp-col-count">{colItems.length}</span>
                    </div>
                    {colItems.map((it:any)=>(
                      <div key={it.id} className="cp-card" role="button" tabIndex={0} onClick={()=>setEditId(it.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setEditId(it.id);}}>
                        <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",marginBottom:4}}>{it.title||t("untitled","Untitled")}</div>
                        <div style={{fontSize:11.5,color:"var(--t3)"}}>{t(CONTENT_TYPES.find((x:any)=>x.id===it.type)?.labelKey||"content_type_post",CONTENT_TYPES.find((x:any)=>x.id===it.type)?.fb||"Post")}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
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

