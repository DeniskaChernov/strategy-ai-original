# QA passes (post design-sync)

10 прогонов после шагов 1–35. Каждый прогон: grep/CI + сценарий + фикс при находке.

| # | Фокус | Проверка | Результат |
|---|--------|----------|-----------|
| 1 | TypeScript | `npx tsc --noEmit` | ✅ exit 0 |
| 2 | Unit tests | `npm test` (vitest) | ✅ 12/12 |
| 3 | i18n | `node scripts/audit-i18n-keys.mjs` | ✅ 0 missing RU/EN/UZ |
| 4 | ProjectDetail shell | `ProjectDetail` + `proj-tabs-bar` + sidebar | ✅ shell return; Fragment fix mobile topbar |
| 5 | Map shell parity | `map-filter-bar` + `map-toolbar` on desktop | ✅ 2-row toolbar hidden in shellUi |
| 6 | Content plan hub | `StrategyShellSidebar` + `WorkspaceTopBar` | ✅ desktop shell |
| 7 | Notifications deep links | `followNotificationLink` dashboard + CP hub | ✅ open=map/project/contentplan |
| 8 | Share / join | `copyProjectShareLink` POST shares; `processPendingJoin` | ✅ wired (manual E2E backlog) |
| 9 | Offline search | `showSearch={!!API_BASE}` projects topbar | ✅ no false ⌘K offline |
| 10 | Dead handlers grep | `onAddNode={()=>{}}` portfolio AI only | ⚠️ AI advisor/hub — by design (no map context) |

## Открытые пункты (backlog)

- ContentPlanProjectPage: desktop sidebar shell (hub done).
- Settings full-screen route (`screen=settings`) — modal uses wider desktop layout via `settingsShell`.
- Playwright E2E smoke (step 27).
- Map `onAddNode` in embedded AiPanel on map editor already wired via `addNode`.

*Обновлено: прогон 2 + QA 1–10.*
