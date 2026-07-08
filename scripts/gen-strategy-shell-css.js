/** Извлекает <style> из public/strategy-reference.html и превращает селекторы в префикс .sa-strategy-ui + классы .sa-* (без конфликта с #root). */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "strategy-reference.html"), "utf8");
const m = html.match(/<style>([\s\S]*?)<\/style>/);
if (!m) throw new Error("no <style> in strategy-reference.html");
let css = m[1];
const pairs = [
  ["#toast", ".sa-toast-host"],
  ["#modal", ".sa-modal-host"],
  ["#m-box", ".sa-mbox"],
  ["#mbox", ".sa-mbox"],
  ["#s-settings", ".sa-screen-settings"],
  ["#s-insights", ".sa-screen-insights"],
  ["#s-ai", ".sa-screen-ai"],
  ["#s-timeline", ".sa-screen-timeline"],
  ["#s-scenarios", ".sa-screen-scenarios"],
  ["#s-map", ".sa-screen-map"],
  ["#canvas-wrap", ".sa-canvas-wrap"],
  ["#map-canvas-wrap", ".sa-canvas-wrap"],
  ["#canvas", ".sa-canvas-host"],
  ["#topbar", ".sa-topbar"],
  ["#main", ".sa-main"],
  ["#sb", ".sa-sb"],
  ["#app-shell", ".sa-app"],
  ["#app", ".sa-app"],
  ["#v-app", ".sa-v-app"],
  ["#v-landing", ".sa-v-landing"],
  ["#v-tier", ".sa-v-tier"],
  ["#bgl", ".sa-bgl"],
  ["#bgd", ".sa-bgd"],
];
for (const [a, b] of pairs) css = css.split(a).join(b);
css = css.split(".map-canvas-wrap").join(".sa-canvas-wrap");
css = css.replace(/\.map-tb\b/g, ".map-toolbar");
css = css.replace(/^\.dk\{/gm, ".sa-strategy-ui.dk{");
css = css.replace(/^\.lt\{/gm, ".sa-strategy-ui.lt{");
css = css.replace(/\.lt /g, ".sa-strategy-ui.lt ");
css = css.replace(/\.lt\./g, ".sa-strategy-ui.lt.");
css = css.replace(/body\{background:var\(--bg\)/g, ".sa-strategy-ui{background:var(--bg)");
css = `/* Автогенерация: node scripts/gen-strategy-shell-css.js ← public/strategy-reference.html */\n` +
  `/* Корень: <div class="sa-strategy-ui dk|lt">…</div> */\n` +
  css.replace(/html,body\{[^}]+\}/,
    "html,body{height:100%}.sa-strategy-ui{font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;height:100%;min-height:100vh;max-height:100vh;overflow:hidden;display:flex;flex-direction:column}");
const appOverrides = `

/* ── overrides: React-карта (SVG-узлы), flex-цепочка (см. scripts/gen-strategy-shell-css.js) ── */
.sa-strategy-ui>.sa-app{flex:1;min-height:0;min-width:0;overflow:hidden}
.sa-canvas-wrap.sa-canvas-no-dots::before{display:none!important}
.sa-canvas-wrap>svg{pointer-events:auto!important;touch-action:none}
.sa-map-toolbar-rows{border-bottom:.5px solid var(--b1);background:var(--top);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);min-width:0;overflow-x:hidden;overflow-y:visible}
.sa-map-toolbar-rows>div{min-width:0;max-width:100%;box-sizing:border-box}

/* Сайдбар: читаемее ширина */
.sa-sb{width:236px;min-width:236px}

/* Insight cards: tone via CSS variable (React sets --ins-tone) */
.sa-strategy-ui .insight-card{border-left:3px solid var(--ins-tone,transparent)}

/* Project tabs: reset native button chrome (reference uses .proj-tab underline) */
.proj-tabs-bar .proj-tab{
  border:none;background:transparent;font-family:inherit;margin:0;padding:11px 14px;
  appearance:none;-webkit-appearance:none;cursor:pointer;color:var(--t2);
  border-bottom:2px solid transparent;border-radius:0;box-shadow:none;outline:none;
}
.proj-tabs-bar .proj-tab.on{color:var(--acc);border-bottom-color:var(--acc);font-weight:600}
.sa-strategy-ui.lt .proj-tabs-bar .proj-tab.on{color:#5526d6;border-bottom-color:#5526d6}

/* CRM — в палитре акцента, без цианового «неона» */
.sa-strategy-ui .crm-sync{margin:0 12px 12px;background:rgba(104,54,245,.08);border:.5px solid rgba(104,54,245,.22);box-shadow:none}
.sa-strategy-ui .crm-sync:hover{background:rgba(104,54,245,.12)}
.sa-strategy-ui.lt .crm-sync{box-shadow:0 2px 14px rgba(104,54,245,.1)}
.sa-strategy-ui .cs-dot{background:var(--acc);animation:none;box-shadow:none}
.sa-strategy-ui .cs-title{color:var(--t2);font-weight:600}
.sa-strategy-ui .cs-sub{color:var(--t3);opacity:.9}

/* Контент main: на всю ширину колонки */
.sa-main .scr{max-width:none!important;width:100%;box-sizing:border-box}

/* Верхняя полоса: выравнивание по центру + перенос */
.sa-topbar{align-items:center;flex-wrap:wrap;row-gap:10px}
.sa-topbar .tb-r{flex-wrap:wrap;justify-content:flex-end;gap:10px;row-gap:8px;align-items:center}

/* Первая строка тулбара карты в одной теме с макетом */
.sa-map-toolbar-rows>div:first-child{border-bottom-color:var(--b1)!important}

/* Полоса «Стратегия / Контент-план» на карте */
.sa-map-cp-strip{background:var(--top)!important;border-bottom:.5px solid var(--b1)!important;padding:8px 18px!important}
.sa-map-cp-strip .cp-strip-label{display:none}

/* Вкладки разделов (MainWorkspaceNav) — те же токены, что .tabs/.tab в макете */
.sa-strategy-ui .workspace-nav-tabs.tabs{display:flex;background:var(--inp);border:.5px solid var(--b0);border-radius:10px;padding:3px;gap:2px;align-items:center}
.sa-strategy-ui .workspace-nav-tabs.tabs .tab{font-size:11.5px;color:var(--t3);cursor:pointer;padding:5px 12px;border-radius:7px;transition:all .18s;font-weight:500;user-select:none;border:none;background:transparent;font-family:inherit;line-height:1.2}
.sa-strategy-ui .workspace-nav-tabs.tabs .tab.on{background:var(--card);color:var(--t1);font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.sa-strategy-ui.lt .workspace-nav-tabs.tabs .tab.on{background:rgba(255,255,255,.92);color:var(--acc);box-shadow:0 2px 8px rgba(104,54,245,.14)}
.sa-strategy-ui .workspace-nav-tabs.tabs .tab:disabled{opacity:1;cursor:default}
.sa-strategy-ui .workspace-nav-tabs.tabs.workspace-nav-tabs--sm .tab{font-size:11px;padding:4px 10px}

/* Нижняя плавающая панель: не дублировать тень glass-card */
.sa-canvas-wrap .map-toolbar.glass-card{border:none!important;box-shadow:none!important;background:transparent!important;padding:6px 8px!important}

/* Canvas-first map chrome (full-bleed map like reference canvas) */
.map-canvas-topbar{
  flex-shrink:0;height:48px;display:flex;align-items:center;justify-content:space-between;
  padding:0 14px 0 12px;border-bottom:.5px solid var(--b1);background:var(--top);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:2;
}
.mct-l{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
.mct-menu,.mct-back{width:34px;height:34px;border-radius:9px;border:none;background:transparent;color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mct-menu:hover,.mct-back:hover{background:var(--rowh);color:var(--t1)}
.mct-title{font-size:14px;font-weight:700;color:var(--t1);letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mct-save{font-size:10.5px;color:var(--green);font-weight:600;margin-left:8px;white-space:nowrap}
.mct-r{display:flex;align-items:center;gap:8px;flex-shrink:0}
.mct-action{height:32px!important;font-size:11.5px!important;padding:0 12px!important;gap:6px;display:inline-flex;align-items:center}
.mct-av{width:32px;height:32px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0}

.map-tool-rail{
  position:absolute;right:14px;top:50%;transform:translateY(-50%);
  display:flex;flex-direction:column;gap:4px;z-index:12;
  background:var(--sb);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
  border:.5px solid var(--b2);border-radius:14px;padding:6px;
  box-shadow:0 8px 32px rgba(0,0,0,.28);
}
.sa-strategy-ui.lt .map-tool-rail{box-shadow:0 8px 32px rgba(78,55,180,.16)}
.mtr-btn{width:36px;height:36px;border-radius:10px;border:none;background:transparent;color:var(--t2);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .18s}
.mtr-btn:hover{background:var(--card2);color:var(--t1)}
.mtr-btn.on{background:rgba(104,54,245,.18);color:var(--acc)}
.mtr-sep{height:.5px;background:var(--b1);margin:2px 4px}

.map-corner-ctrl{
  position:absolute;right:14px;bottom:88px;display:flex;align-items:center;gap:3px;z-index:12;
  background:var(--sb);backdrop-filter:blur(28px);border:.5px solid var(--b2);border-radius:12px;padding:4px 6px;
  box-shadow:0 6px 24px rgba(0,0,0,.22);
}
.mcc-btn{width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--t2);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center}
.mcc-btn:hover:not(:disabled){background:var(--card2);color:var(--t1)}
.mcc-btn:disabled{opacity:.35;cursor:not-allowed}
.mcc-zoom{min-width:42px;height:30px;border:none;background:transparent;color:var(--t2);font-size:11px;font-weight:700;cursor:pointer;border-radius:8px;padding:0 4px}
.mcc-zoom:hover{background:var(--card2);color:var(--t1)}
.mcc-sep{width:.5px;height:18px;background:var(--b1);margin:0 2px}

.map-canvas-prompt-wrap{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:12;width:min(560px,calc(100% - 120px));pointer-events:none}
.map-canvas-hint{text-align:center;font-size:10.5px;color:var(--t3);margin-bottom:8px;pointer-events:none}
.map-canvas-prompt{
  pointer-events:all;display:flex;align-items:center;gap:8px;
  background:var(--sb);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);
  border:.5px solid var(--b2);border-radius:16px;padding:8px 10px 8px 12px;
  box-shadow:0 12px 40px rgba(0,0,0,.32);
}
.sa-strategy-ui.lt .map-canvas-prompt{box-shadow:0 12px 40px rgba(78,55,180,.14)}
.mcp-icon{width:28px;height:28px;border-radius:8px;border:none;background:var(--inp);color:var(--t3);font-size:16px;flex-shrink:0;cursor:default}
.mcp-inp{flex:1;min-width:0;border:none;background:transparent;outline:none;font-size:13px;color:var(--t1);font-family:inherit}
.mcp-inp::placeholder{color:var(--t3)}
.mcp-send{width:34px;height:34px;border-radius:10px;border:none;background:var(--acc);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mcp-send:disabled{opacity:.4;cursor:not-allowed}

.sa-route-map .sa-main .sa-screen-map{flex:1;min-height:0}
.sa-route-map .node-panel.open{right:58px}

/* Выход — без конфликта с .lang-btn (flex:1) */
.sa-shell-logout{margin:0 12px 12px;align-self:stretch;padding:8px 10px;border-radius:8px;border:.5px solid var(--b1);background:transparent;color:var(--t3);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .18s,color .18s}
.sa-shell-logout:hover{background:var(--rowh);color:var(--t2)}

/* Модалки React: хост без flex-column корня .sa-strategy-ui */
.sa-strategy-ui.sa-modal-host{
  position:fixed!important;
  inset:0!important;
  z-index:220!important;
  display:block!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
  background:transparent!important;
  pointer-events:none!important;
}
.sa-strategy-ui.sa-modal-host > .overlay.open{pointer-events:all!important}
.sa-strategy-ui .overlay.sa-overlay-fade-out{background:rgba(0,0,0,0)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:background .22s ease,backdrop-filter .22s ease}
.sa-strategy-ui .modal-box.sa-modal-shrink-out{opacity:0!important;transform:scale(.93) translateY(16px)!important;transition:all .22s cubic-bezier(.4,0,.2,1)!important}

/* Статичная стеклянная панель (welcome, карточки) */
.sa-strategy-ui .sa-ref-panel{
  background:var(--sb);
  backdrop-filter:blur(44px) saturate(1.1);
  -webkit-backdrop-filter:blur(44px) saturate(1.1);
  border:.5px solid var(--b2);
  border-radius:20px;
  padding:28px;
  box-shadow:0 28px 70px rgba(0,0,0,.42);
}
.sa-strategy-ui.lt .sa-ref-panel{box-shadow:0 28px 70px rgba(78,55,180,.22)}

/* Сетка фич на welcome — как мини feat-card */
.sa-ws-feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px}
.sa-ws-feat{
  display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;
  background:var(--card);border:.5px solid var(--b1);transition:border-color .2s,transform .2s,box-shadow .2s;
  box-shadow:var(--shc);
}
.sa-ws-feat:hover{border-color:var(--bh);transform:translateY(-2px);box-shadow:var(--shh)}
.sa-ws-feat .sf-ic{font-size:16px;line-height:1;flex-shrink:0}
.sa-ws-feat .sf-txt{font-size:12.5px;font-weight:600;color:var(--t2);line-height:1.35}

/* Welcome: одна строка фичи с ротацией вместо сетки */
.sa-ws-feat-rotator{min-height:46px;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px 4px 2px;margin-top:2px}
.sa-ws-feat-rotator-inner{display:inline-flex;align-items:center;gap:10px;max-width:100%;animation:sa-ws-feat-in .48s cubic-bezier(.22,1,.36,1) both}
.sa-ws-feat-rotator-ic{font-size:20px;line-height:1;flex-shrink:0;filter:drop-shadow(0 0 10px rgba(160,80,255,.2))}
.sa-ws-feat-rotator-txt{font-size:14px;font-weight:600;color:var(--t2);letter-spacing:.01em;line-height:1.35;text-align:left}
@keyframes sa-ws-feat-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
.sa-ws-auth-back{display:block;width:100%;margin-bottom:12px;padding:9px 12px;border-radius:12px;border:.5px solid var(--b1);background:var(--inp);color:var(--t3);font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .18s,color .18s,border-color .18s}
.sa-ws-auth-back:hover{background:var(--card2);color:var(--t2);border-color:var(--bh)}
.sa-ws-auth-form .modal-inp{margin-bottom:10px}
.sa-ws-auth-form .modal-btn{margin-top:2px}
.sa-ws-auth-form-wrap{border-top:.5px solid var(--b1);padding-top:16px;margin-top:14px}
.sa-ws-phase-enter{animation:sa-ws-phase-in .38s cubic-bezier(.22,1,.36,1) both}
.sa-ws-cta-block{animation:sa-ws-phase-in .26s cubic-bezier(.22,1,.36,1) both}
@keyframes sa-ws-phase-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.sa-ws-card-region{width:100%}
.sa-ws-auth-form #welcome-auth-title:focus-visible{outline:2px solid var(--acc);outline-offset:3px;border-radius:6px}
@media (prefers-reduced-motion:reduce){
  .sa-ws-phase-enter,.sa-ws-cta-block{animation:none!important}
  .sa-ws-feat-rotator-inner{animation:none!important}
  .sa-ws-feat-rotator--static .sa-ws-feat-rotator-inner{animation:none!important}
}

/* Топбар полноэкранных экранов без shell — как sa-topbar */
.sa-app-topbar{
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;row-gap:10px;
  padding:11px 18px;background:var(--top);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);
  border-bottom:.5px solid var(--b1);flex-shrink:0;position:relative;z-index:10;
}
.sa-app-topbar .atb-cluster{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sa-strategy-ui.lt .sa-app-topbar{box-shadow:0 1px 0 rgba(104,80,220,.14),0 4px 20px rgba(78,55,180,.06)}

/* Появление контента страницы */
@keyframes sa-fade-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.sa-page-reveal{animation:sa-fade-up .5s cubic-bezier(.22,1,.36,1) both}
.sa-page-reveal.sa-pr-d1{animation-delay:.07s}
.sa-page-reveal.sa-pr-d2{animation-delay:.14s}
.sa-page-reveal.sa-pr-d3{animation-delay:.21s}

/* Панель референса — лёгкий lift при hover */
.sa-ref-panel{transition:transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s ease,border-color .25s ease}
.sa-ref-panel.sa-ref-panel--lift:hover{transform:translateY(-3px);box-shadow:0 32px 78px rgba(0,0,0,.5);border-color:var(--bh)}
.sa-strategy-ui.lt .sa-ref-panel.sa-ref-panel--lift:hover{box-shadow:0 32px 78px rgba(78,55,180,.28)}

/* Карточка карты проекта — как proj-card */
.sa-map-card{
  position:relative;overflow:hidden;border-radius:16px!important;border:.5px solid var(--b1)!important;
  background:var(--card)!important;box-shadow:var(--shc)!important;
  transition:transform .24s cubic-bezier(.22,1,.36,1),box-shadow .28s ease,border-color .22s!important;
}
.sa-map-card::after{content:'';position:absolute;inset:0;border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.07),transparent 55%);pointer-events:none}
.sa-map-card:hover{border-color:var(--bh)!important;transform:translateY(-4px)!important;box-shadow:var(--shh)!important}
.sa-map-card.sa-map-card--sc{border-color:rgba(139,92,246,.28)!important}
.sa-map-card.sa-map-card--sc:hover{border-color:rgba(165,92,246,.55)!important;box-shadow:0 16px 48px rgba(139,92,246,.22)!important}
.sa-strategy-ui.lt .sa-map-card::after{background:linear-gradient(145deg,rgba(255,255,255,.8),rgba(255,255,255,.05) 42%,transparent 68%)}

/* Хаб контент-плана: карточки проектов + иконка в hero */
.sa-cp-hub-card:not(:disabled){
  transition:transform .26s cubic-bezier(.22,1,.36,1),box-shadow .3s ease,border-color .22s;
}
.sa-cp-hub-card:not(:disabled):hover{
  transform:translateY(-4px);
  box-shadow:var(--shh);
  border-color:var(--bh)!important;
}
.sa-cp-hub-card:not(:disabled):active{transform:translateY(-2px) scale(.992)}
.sa-cp-hub-hero-ic{transition:transform .4s cubic-bezier(.22,1,.36,1),box-shadow .35s ease}
.sa-ref-panel:hover .sa-cp-hub-hero-ic{transform:scale(1.06);box-shadow:0 8px 28px var(--accent-glow)}

/* Статистика под шапкой проекта */
.sa-proj-stats{display:flex;flex-wrap:wrap;gap:clamp(14px,3vw,32px);padding:12px 18px;background:var(--top);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border-bottom:.5px solid var(--b1)}
.sa-proj-stats .sps-block{transition:transform .2s ease}
.sa-proj-stats .sps-block:hover{transform:translateY(-2px)}
.sa-proj-stats .sps-lbl{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:4px}
.sa-proj-stats .sps-val{font-size:15px;font-weight:800;letter-spacing:-.02em;line-height:1.15}

/* Вкладки карточки проекта */
.sa-proj-tabs{display:flex;gap:2px;border-bottom:.5px solid var(--b1);padding:0 16px;background:var(--top);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);overflow-x:auto;-webkit-overflow-scrolling:touch}
.sa-proj-tabs button{
  flex-shrink:0;padding:12px 14px;font-size:12.5px;font-weight:500;color:var(--t3);cursor:pointer;border:none;background:transparent;
  font-family:inherit;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .2s,border-color .2s,background .2s;border-radius:8px 8px 0 0;
}
.sa-proj-tabs button:hover{color:var(--t1);background:var(--rowh)}
.sa-proj-tabs button.on{color:var(--acc);font-weight:700;border-bottom-color:var(--acc)}
.sa-strategy-ui.lt .sa-proj-tabs button.on{color:#5526d6;border-bottom-color:#5526d6}
.sa-proj-tabs button:focus-visible{outline:2px solid var(--acc);outline-offset:2px}

/* Кнопка-иконка назад в топбаре */
.sa-app-topbar .sa-back-ic{
  width:36px;height:36px;border-radius:10px;border:.5px solid var(--b1);background:var(--inp);color:var(--t2);
  display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;transition:background .2s,color .2s,transform .15s,border-color .2s;
}
.sa-app-topbar .sa-back-ic:hover{background:var(--card2);color:var(--t1);border-color:var(--bh)}
.sa-app-topbar .sa-back-ic:active{transform:scale(.96)}

/* Лендинг: герой на всю ширину (не сжимать flex-элементы), шапка на весь экран */
.sa-v-landing{align-items:stretch!important}
#land-nav-fixed{
  left:0!important;right:0!important;transform:none!important;
  width:100%!important;max-width:none!important;
  padding:18px clamp(16px,4vw,40px)!important;
  padding-left:max(18px,env(safe-area-inset-left))!important;
  padding-right:max(18px,env(safe-area-inset-right))!important;
}
#land-nav-fixed .land-nav-links{display:flex;gap:clamp(14px,2.5vw,26px);align-items:center;flex-wrap:wrap;justify-content:center;flex:1;min-width:0}
#land-nav-fixed .footer-link{font-size:14px;font-weight:600;color:var(--t2)}
#land-nav-fixed.scrolled{
  padding:12px clamp(16px,4vw,40px)!important;
  padding-left:max(12px,env(safe-area-inset-left))!important;
  padding-right:max(12px,env(safe-area-inset-right))!important;
}
.sa-strategy-ui.lt #land-nav-fixed.scrolled{
  padding:12px clamp(16px,4vw,40px)!important;
  padding-left:max(12px,env(safe-area-inset-left))!important;
  padding-right:max(12px,env(safe-area-inset-right))!important;
}
`;
const out = path.join(root, "client", "strategy-shell.css");
fs.writeFileSync(out, css + appOverrides, "utf8");
console.log("wrote", out, "(" + Math.round((css + appOverrides).length / 1024) + " KB)");
