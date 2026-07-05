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
| 20 | CI | `npm run ci` | pending run |

## Backlog

- Playwright login → projects flow (full E2E)
- Viewer read-only manual pass
- Security review checklist (step 35)

*Обновлено: прогон 3.*
