# Design sync + QA plan (reference: `public/strategy-reference.html`)

План дополняет архитектурный аудит и фиксирует **визуальный паритет**, **логику** и **удобства** внутреннего приложения.

**Прогоны:** по 10 шагов → проверка (CI, ручной чеклист, grep/аудит) → отметка статуса.

**Легенда:** `[ ]` todo · `[~]` in progress · `[x]` done · `[—]` blocked/deferred

---

## Фаза A — Фундамент и pipeline (шаги 1–5)

| # | Шаг | Проверка | Статус |
|---|-----|----------|--------|
| 1 | Эталон `strategy-reference.html` = пользовательский HTML | Размер файлов совпадает | [x] |
| 2 | `node scripts/gen-strategy-shell-css.js` → `client/` + `public/strategy-shell.css` | build cache-bust hash меняется | [x] |
| 3 | CI зелёный: `npm run ci` (build, tsc, vitest, artifacts) | exit 0 | [x] |
| 4 | План зафиксирован в `docs/DESIGN_SYNC_AND_QA_PLAN.md` | файл в репо | [x] |
| 5 | Новые i18n-ключи (Projects shell, NewProjectModal) в fallback-аудите | `node scripts/audit-i18n-keys.mjs` | [x] |

---

## Фаза B — Shell parity: topbar + layout (шаги 6–15)

| # | Шаг | Файлы | Проверка | Статус |
|---|-----|-------|----------|--------|
| 6 | **Projects (desktop):** `WorkspaceTopBar` + `.scr` + `.proj-grid` | `projects.tsx`, `reference-project-card.tsx` | визуально = reference `renderProjects` | [x] |
| 7 | **Desktop global search (⌘K):** overlay `#search-overlay` + `.search-box` | `global-search-overlay.tsx`, projects, dashboard | ⌘K открывает поиск на desktop | [x] |
| 8 | **Dashboard KPI:** `.r4` + `.kpi-card` вместо `dash-grid` | `dashboard-page.tsx` | классы есть в `strategy-shell.css` | [x] |
| 9 | **Dashboard activity:** разметка как в reference (inline rows в `.card`) | `dashboard-page.tsx` | без orphan-классов | [x] |
| 10 | **Project detail:** sidebar shell + `WorkspaceTopBar` + `proj-tabs-bar` | `projects.tsx` `ProjectDetail` | shell desktop | [x] |
| 11 | **Insights:** `WorkspaceTopBar`, `.r4` KPI, insight-cards | `insights-page.tsx` | parity с `#s-insights` | [x] |
| 12 | **AI Advisor:** `sa-screen-ai`, `chat-area`, sidebar | `ai-advisor-page.tsx` | layout = reference | [x] |
| 13 | **Map editor:** `map-filter-bar` + `map-toolbar` (не 2-row inline toolbar) | `map-editor.tsx` | canvas = `map-canvas-wrap` | [x] |
| 14 | **Content plan hub/project:** `StrategyShellSidebar` + `WorkspaceTopBar` | `content-plan-pages.tsx` | hub + project shell | [x] |
| 15 | **Settings screen:** `settings-layout` / `settings-nav` | `settings-page.tsx` + route | desktop page | [x] |

---

## Фаза C — Логика и UX (шаги 16–25)

| # | Шаг | Проверка | Статус |
|---|-----|----------|--------|
| 16 | `handleGlobalNav("map")` → last map или понятный fallback | клик «Цели» на dashboard открывает карту | [x] |
| 17 | `/?join={projectId}` — invite flow | join добавляет member | [x] |
| 18 | Share project URL (shareId vs projectId) | POST shares → корректная ссылка | [x] |
| 19 | Projects: filter/sort в reference-UI | desktop selects под `.slbl` | [x] |
| 20 | `NewProjectModal` сохраняет icon/color/description | карточка показывает emoji/color | [x] |
| 21 | Viewer: read-only на карте + shares API + Socket.IO | e2e/manual | [—] |
| 22 | Offline / без `API_BASE`: search affordance скрыт или stub | topbar без ложного ⌘K | [x] |
| 23 | AI `onAddNode` wired там, где UI обещает действие | map editor ✅; portfolio no-op | [~] |
| 24 | Notifications deep links (`open=map/project/contentplan`) | dashboard, insights, ai, cp, projects | [x] |
| 25 | Weekly briefing auto-trigger + sidebar CTA | не дублировать на projects shell | [x] |

---

## Фаза D — QA, тесты, прод (шаги 26–35)

| # | Шаг | Проверка | Статус |
|---|-----|----------|--------|
| 26 | Vitest: shell nav, tier limits, map utils | `npm test` | [x] |
| 27 | Playwright smoke: landing + `/app` + health | `npm run test:e2e` | [~] |
| 28 | a11y: keyboard на `.proj-card`, `.ni`, modals | tab/enter/escape | [—] |
| 29 | Theme `dk`/`lt` на всех shell-экранах | без смешения `global.css` токенов | [~] |
| 30 | Lazy routes + chunk load после deploy | SW network-first | [—] |
| 31 | Railway env preflight (`preflightEnv.js`) | fail-fast без secrets | [x] |
| 32 | Stripe webhook вне rate limit | оплата не 429 | [x] |
| 33 | Cron deadline reminders single-leader | advisory lock | [x] |
| 34 | `docs/ARCHITECTURE_AND_ROADMAP.md` + deploy doc | актуальны | [x] |
| 35 | Security pass: shares, JWT, CORS, viewer WS | review checklist | [—] |

---

## QA прогоны 1–10

См. `docs/QA_PASSES.md`.

---

*Обновлять статусы после каждого прогона. Не редактировать `strategy-reference.html` вручную — только sync из эталона + `gen-strategy-shell-css.js`.*
