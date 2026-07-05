# QA passes (post design-sync)

## Visual regression checklist (design parity P1–P5)

| # | Screen | Viewport | Pass criteria | P1 | P2 | P3 | P4 | P5 |
|---|--------|----------|---------------|----|----|----|----|-----|
| 1 | Projects | 1280 | `.proj-grid`, `.proj-card`, reference sidebar | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | Project Overview | 1280 | `.po-grid`, default tab Overview | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | Project Maps | 1280 | `.map-list-item` rows | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | Dashboard | 1280 | `.r4`, `.kpi-card` | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | Map | 1280 | `.map-filter-bar`, `.map-toolbar` | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | AI Advisor | 1280 | `.chat-area`, `.ai-sidebar` | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | Insights | 1280 | `.insight-card` grid | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | Content Plan | 1280 | `.cp-kanban`, `.cp-col` | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | Settings | 1280 | `.settings-layout`, `.sni` | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | Projects mobile | 375 | `.proj-card` compact | ☐ | ☐ | ☐ | ☐ | ☐ |

*Обновлено: design parity P5.*

## Прогон 1–10

См. коммит `33eed62`.

## Прогон 11–20

| # | Фокус | Проверка | Результат |
|---|--------|----------|-----------|
| 11 | ContentPlanProject shell | sidebar + `WorkspaceTopBar` + `primaryCta` maps | ✅ |
| 12 | Settings route | `screen=settings` + `settings-layout` nav | ✅ |
| 13 | Deep links insights/ai | `followNotificationLink` + project/map/cp | ✅ |
| 14 | Vitest notif helper | `tests/notif-deep-link.test.ts` | ✅ 4 tests |
| 15 | openSettings flow | sidebar settings → route, not modal | ✅ |
| 16 | TypeScript | `npx tsc --noEmit` | ✅ |
| 17 | Unit tests | `npm test` 16/16 | ✅ |
| 18 | E2E smoke | `/app` route + health API | ✅ spec updated |
| 19 | i18n | audit script | ✅ (unchanged keys) |
| 20 | CI | `npm run ci` | ✅ |
| 21 | Notif helper hub route | contentplan without projectId | ✅ |
| 22 | Map editor notif links | `onFollowNotifLink` + orchestrator | ✅ |
| 23 | Projects notif DRY | `createNotifFollowHandler` | ✅ |
| 24 | Settings browser history | pushState `/app` + popstate | ✅ |
| 25 | proj-card a11y | Enter/Space + aria-label | ✅ |
| 26 | Vitest | 5 notif tests | ✅ |
| 27 | E2E | strategy-shell.css on `/app` | ✅ spec |
| 28 | Security checklist | `docs/SECURITY_CHECKLIST.md` | ✅ draft |
| 29 | TypeScript | `tsc --noEmit` | ✅ |
| 30 | CI | `npm run ci` | ✅ 17 tests |

## Backlog

- Playwright login → projects flow (full E2E)
- Viewer read-only manual pass (see SECURITY_CHECKLIST)
- a11y: modals Escape focus trap audit

*Обновлено: прогон 4.*
