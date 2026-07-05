# QA passes (post design-sync)

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
| 29 | TypeScript | `tsc --noEmit` | pending |
| 30 | CI | `npm run ci` | pending |

## Backlog

- Playwright login → projects flow (full E2E)
- Viewer read-only manual pass (see SECURITY_CHECKLIST)
- a11y: modals Escape focus trap audit

*Обновлено: прогон 4.*
