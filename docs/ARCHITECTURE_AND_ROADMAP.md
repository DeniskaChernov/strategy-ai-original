# Strategy AI — архитектура, логика и планы

Документ фиксирует **как устроено приложение сейчас** и **что осталось по логике/инфраструктуре**.  
Обновлять при существенных изменениях в `strategy-ai-full.tsx`, API или схеме БД.

> Визуал, CSS и редизайн здесь намеренно не описываются.

---

## 1. Назначение продукта (логика)

SaaS для стратегического планирования:

- **Проекты** — контейнеры для команд и карт.
- **Карты стратегии** — граф узлов (цели, шаги, риски и т.д.) + рёбра, прогресс, статусы, дедлайны.
- **Сценарии** — карты с флагом `isScenario`, отдельные лимиты по тарифу.
- **Контент-план** — JSON-структура на проект (`project_content_plans`).
- **AI-советник** — чат с контекстом портфеля/карты, лимиты по тарифу, серверный прокси к OpenAI.
- **Инсайты** — агрегированная аналитика по узлам портфеля.
- **Шаринг** — публичная ссылка на карту (read-only).
- **Тарифы и оплата** — Stripe, trial, лимиты ресурсов.
- **Уведомления** — in-app (+ cron email по дедлайнам на сервере).

---

## 2. Стек и структура репозитория

| Слой | Технологии | Путь |
|------|------------|------|
| Backend | Node.js, Express, PostgreSQL (`pg`), Socket.IO | `server/` |
| Frontend | React 18, TypeScript/TSX, esbuild (ESM + code splitting) | `client/`, `strategy-ai-full.tsx` |
| Общие данные | JSON-конфиг тарифов | `shared/tiers.json` |
| Статика после сборки | `public/` (`app.js`, chunks, CSS, `index.html`) |
| Скрипты | CI, i18n-аудит, dedupe, sync CSS | `scripts/` |
| Деплой | Railway (Nixpacks), Procfile | `railway.json`, `Procfile` |

**Точки входа:**

- Сервер: `server/index.js` — HTTP + WebSocket + раздача `public/`.
- Клиент (сборка): `strategy-ai-full.tsx` → `public/app.js`.
- HTML: `public/index.html` — splash, SEO-fallback в `#root`, `env-config.js`, module `app.js`.

**Корневые модули вне `client/`:**

- `strategy-ai-full.tsx` — оркестратор SPA (~2100+ строк, основной техдолг).
- `strategy-shell-sidebar.tsx` — боковая навигация workspace.
- `reference-landing.tsx` — маркетинговый лендинг (lazy import).

---

## 3. Сборка и деплой

### `build.js`

1. Копирует CSS из `client/` в `public/`.
2. Генерирует `public/env-config.js` (GA4, Clarity, `siteUrl`, …).
3. `sitemap.xml`, `robots.txt` (Disallow `/app`, `/api/`).
4. esbuild: entry `strategy-ai-full.tsx` → `public/app.js` + `chunk-*.js`.
5. `public/build-meta.json` — hash и список чанков.
6. Cache-bust: подставляет `?v=<hash>` в `index.html` для `app.js` и основных CSS.

### Railway (`railway.json`)

- Build: `CI=true npm install && npm run build`
- Start: `node server/index.js`

### CI (`npm run ci`)

`build` → `tsc --noEmit` → `scripts/verify-build-artifacts.js`

### Service Worker (`public/sw.js`) — только кэш-логика

- Версия кэша: `strategy-ai-v9`.
- **Network-first:** `app.js`, `chunk-*`, CSS, `/`, `index.html` — чтобы после деплоя не отдавать устаревший бандл.
- **Cache-first:** прочие GET (кроме `/api/` и socket).
- Install: иконки, manifest (не прекэширует JS/CSS на install).

---

## 4. Серверная архитектура

### `server/index.js`

- Express + `compression`, CORS (`ALLOWED_ORIGINS` в production).
- Rate limiting, Morgan, trust proxy.
- Опционально Sentry (`SENTRY_DSN`).
- Socket.IO на том же HTTP-сервере.
- Cron: напоминания о дедлайнах (08:00 UTC, один раз в день).
- SEO: `server/seo.js` — для краулеров отдаёт HTML с meta по маршруту; SPA fallback `GET *` → `index.html`.

### Роуты API

| Префикс | Файл | Назначение |
|---------|------|------------|
| `/api/auth` | `routes/auth.js` | register, login, refresh, me, profile, verify, reset password |
| `/api/projects` | `routes/projects.js` | CRUD проектов, участники |
| `/api/projects/:id/maps` | `routes/maps.js` | CRUD карт, лимиты сценариев |
| `/api/projects/.../versions` | `routes/versions.js` | снимки версий карты |
| `/api/tiers` | `routes/tiers.js` | конфиг + `GET /usage` |
| `/api/payments` | `routes/payments.js` | Stripe Checkout |
| `/api/webhooks` | `routes/webhooks.js` | Stripe webhooks (raw body) |
| `/api/shares` | `routes/shares.js` | публичные ссылки на карты |
| `/api/ai` | `routes/ai.js` | прокси к OpenAI, лимиты, логирование |
| `/api/search` | `routes/search.js` | поиск по проектам/картам/узлам |
| `/api/notifications` | `routes/notifications.js` | in-app уведомления |

### БД (`server/db.js`)

Таблицы: `users`, `sessions`, `projects`, `maps`, `project_content_plans`, `shares`, `ai_usage`, `map_versions`, `notifications`, `stripe_webhook_events`.

Карты: `nodes`, `edges`, `ctx` (JSONB).  
Контент-план: `items` в `project_content_plans`.

### Auth middleware (`server/middleware/auth.js`)

- JWT access (15m) + refresh (30d).
- `requireAuth`, проверка trial → downgrade на `free`.
- В `req.user` — email, tier, theme, palette, stripe_customer_id, `is_dev`, флаги уведомлений.

### Socket.IO

- Комнаты: `map:{mapId}`.
- JWT в `handshake.auth.token`, проверка доступа к проекту карты.
- События: `join-map`, `leave-map`, `node-move`, `node-update`, `node-add`, `node-delete`, `edge-update`, `cursor-move`, presence (`user-joined`, `user-left`).

Клиентская реализация: **`client/map-editor/map-editor.tsx`** (reconnect с обновлением JWT).

---

## 5. Клиентская архитектура

### Два уровня «маршрутизации»

1. **URL (маркетинг):** `client/spa-path.ts`  
   `/`, `/app`, `/privacy`, `/terms`, `/404`.

2. **Внутренний state machine:** `screen` в `App()` (`strategy-ai-full.tsx`).

### Значения `screen`

| screen | Модуль | Ответственность |
|--------|--------|-----------------|
| `splash` | inline | лоадер до `authChecked` |
| `landing` | `reference-landing.tsx` (lazy) | маркетинг, CTA → auth |
| `legal` | `client/legal-pages.tsx` | privacy / terms |
| `notFound` | `client/legal-pages.tsx` | 404 |
| `sharedMap` | `MapEditor` readOnly | просмотр по share link |
| `dashboard` | `client/dashboard/dashboard-page.tsx` | обзор портфеля |
| `insights` | `client/insights/insights-page.tsx` | аналитика |
| `ai` | `client/ai-advisor/ai-advisor-page.tsx` | глобальный AI-чат |
| `projects` | `client/projects/projects.tsx` | список проектов |
| `project` | `client/projects/projects.tsx` | деталь проекта, вкладки |
| `map` | `client/map-editor/map-editor.tsx` | редактор карты |
| `contentPlanHub` | **inline** в monolith | выбор проекта для CP |
| `contentPlanProject` | **inline** + `ContentPlanTab` | контент-план проекта |

Дополнительно: `showTiers`, `showAuth`, `showProfile` — оверлеи, не отдельные `screen`.

### Инициализация (`initApp`)

Обрабатывает:

- Query: `?open=`, `?share=`, `?reset=`, `?verified=1`, `?payment=success&tier=`
- Сессию: JWT → `GET /api/auth/me` или localStorage demo
- Deep links через `openDeepLink()`
- После успешной сессии на `/` или `/app` → **`screen = "dashboard"`** (согласовано с `handleAuth` после логина)

### History API

- `pushState` для project / map / contentPlan.
- `popstate`: назад с map → project, с project → projects, с projects → dashboard.

### Глобальное состояние в `App`

- `user`, `theme`, `palette`, `lang`
- `project`, `mapData`, `cpProject`, `cpMaps`
- `aiChatMsgs` + persist `localStorage` ключ `sa_ai_chat_{email}`
- Обработчик `__sa_onSessionExpired` при 401

---

## 6. Dual-mode: production API vs offline demo

Определяется `API_BASE` в `client/api.ts` (из `window.__STRATEGY_AI_API_URL__` / origin).

| Режим | Хранение | Auth |
|-------|----------|------|
| **С API** | PostgreSQL через REST | JWT + refresh, bcrypt на сервере |
| **Без API** | `localStorage` (`sa_acc`, `sa_proj`, `sa_maps_*`, `sa_sess`) | `hashPw` (btoa) — **только демо**, не production-safe |

`apiFetch` — автоматический refresh JWT, проброс `session_expired`.

---

## 7. Клиентские модули данных

| Модуль | Путь | Роль |
|--------|------|------|
| `api.ts` | `client/api.ts` | auth, projects, profile, notifications, store |
| `maps-api.ts` | `client/lib/maps-api.ts` | maps CRUD, content-plan GET/PUT |
| `call-ai.ts` | `client/lib/call-ai.ts` | `POST /api/ai/chat` |
| `map-utils.ts` | `client/lib/map-utils.ts` | normalizeMap, UUID, топосорт, дефолтные узлы |
| `tiers.ts` | `client/lib/tiers.ts` | лимиты для UI (дублирует `shared/tiers.json` — риск расхождения) |
| `strategy-labels.ts` | `client/lib/strategy-labels.ts` | статусы, роли, i18n-лейблы |

### Карты: важная логика

- Новые карты на клиенте могли иметь короткий `uid()`; `saveMap` при не-UUID делает **POST** и подменяет id серверным UUID.
- Версии: автосохранение на PUT (~10 мин) + ручной снимок «Версия» в редакторе.
- Read-only для роли `viewer` и для `sharedMap`.

---

## 8. i18n

- Словари: `client/i18n/langs.ts` — **ru**, **en**, **uz**.
- `makeTfn(lang)` → `t(key, fallback)`.
- `LangCtx` / `useLang()` — `localStorage.sa_lang`, default `ru`.
- Скрипты аудита: `scripts/audit-i18n-keys.mjs`, `scripts/collect-i18n-fallbacks.mjs`.

---

## 9. Тарифы и платежи

- Канон на бэкенде: `shared/tiers.json` + env Stripe price ids.
- Ключи: `free`, `starter`, `pro`, `team`, `enterprise`.
- Лимиты: projects, maps, members, scenarios, `ai_messages`.
- Trial: `trial_ends_at` при регистрации (`TRIAL_DAYS`, default 7).
- Stripe: checkout, webhooks, `refreshUserAfterPayment()` на клиенте.
- `GET /api/tiers/usage` — AI messages, scenarios (используется в профиле).

---

## 10. Уведомления

- **In-app:** таблица `notifications`, CRUD API, хук `useNotifications`, модалка `NotificationsCenterModal`.
- Подключено в **projects** и inline Content Plan в monolith; не на всех экранах одинаково.
- **Email:** cron дедлайнов на сервере; флаг `notif_email` в профиле.
- **Push:** флаг `notif_push` в UI, пакет `web-push` в dependencies — **серверной реализации нет**.

---

## 11. AI

- Сервер: `OPENAI_KEY`, модели по тарифу, учёт `ai_usage`.
- Free: чат заблокирован на клиенте (`AiPanel`), запрос не уходит.
- Контекст: проект, карта, узлы, рёбра; intent parsing, формат `<ADD>{...}</ADD>` для предложения шагов.
- Глобальный чат + встроенный в map-editor (`AiPanel`).
- Без ключа: 503 / сообщение о недоступности.

Направления развития (из `AUDIT_REPORT.md`, логика): память диалога, аудит карты, проактивные подсказки, структурированный вывод для Pro+.

---

## 12. Поиск

- `GET /api/search` — проекты, карты, узлы.
- UI поиска в `ProjectsPage` (глобальный поиск, sessionStorage `sa_focus_search` при переходе с дашборда).

---

## 13. Шаринг

- API: создание share, публичный GET.
- Клиент: `#share=` deep link, экран `sharedMap`, `MapEditor` с `readOnly`.
- Offline: только localStorage, без кросс-устройства.

---

## 14. Экспорт

- **PDF:** print-based (браузер → «Сохранить как PDF»).
- **PPTX:** для Enterprise — `pptxgenjs`; иначе print по HTML-слайдам.

---

## 15. Что уже реализовано (функционально)

- Полный цикл auth (register, login, refresh, verify email, reset password, delete account).
- Projects / maps CRUD, шаблоны, сценарии, лимиты по тарифу.
- Редактор карты: узлы, рёбра, Gantt, симуляция, версии, collaborative cursors (WS).
- Роли: owner / editor / viewer (viewer → read-only на карте).
- Контент-план (hub + проект) — **работает из monolith**.
- Dashboard, Insights, AI Advisor как отдельные экраны.
- Stripe payments + webhooks.
- In-app notifications (частичное покрытие экранов).
- Deep links, share links, payment return URL.
- SEO server-side для маркетинговых URL.
- PWA: manifest + service worker.
- Мультиязычность ru/en/uz.
- Dev-флаг `is_dev` через env `DEV_EMAILS` (не хардкод email).

---

## 16. Технический долг (код)

### Monolith `strategy-ai-full.tsx`

Вынесено в `client/`, но **дубликаты или inline-копии остаются в monolith**:

| Сущность | В monolith | Вынесено | Статус |
|----------|------------|----------|--------|
| `ProjectsPage`, `ProjectDetail` | — | `client/projects/projects.tsx` | ✅ импорт |
| `MapEditor` | — | `client/map-editor/` | ✅ импорт |
| `ContentPlanHubPage`, `ContentPlanProjectPage` | inline ~258+ | `client/content-plan/content-plan-pages.tsx` | ❌ orphan, не импортируется |
| `ContentPlanTab` | inline ~562+ | `client/content-plan/content-plan-tab.tsx` | ⚠️ projects импортирует extracted; monolith — inline |
| `TrialBanner`, `EmailVerifyBanner` | inline | `client/components/trial-email-banners.tsx` | ❌ дубликат |
| `EdgeLine` | inline | `client/map-editor/edge-line.tsx` | ❌ дубликат |
| `DeadlineReminders` | inline | `client/map-editor/deadline-reminders.tsx` | ❌ дубликат в monolith |
| `InMapOnboarding` | inline ~1147 | в `map-editor.tsx` | ❌ dead code в monolith |
| `SplashScreen`, route boot | inline | `client/components/app-route-boot.tsx` | ❌ orphan |
| `Onboarding` | import unused | `client/onboarding/onboarding.tsx` | ❌ мёртвый import |

Утилита: `scripts/dedupe-pages.mjs` (частично применена).

### Прочее

- Мёртвый `import { io } from "socket.io-client"` в `strategy-ai-full.tsx` (логика WS только в map-editor).
- `client/lib/tiers.ts` vs `shared/tiers.json` — два источника; бэкенд читает JSON, фронт — статику.
- Таблица `sessions` в БД зарезервирована, revocation list не используется.
- Смена пароля в demo-mode (`hashPw` / btoa) несовместима с bcrypt бэкенда.

---

## 17. Планы и оставшаяся работа (логика / инфраструктура)

### P0 — стабильность продакшена

| Задача | Детали |
|--------|--------|
| Синхронизация `package-lock.json` с `package.json` | Иначе `npm ci` на Railway падает |
| `OPENAI_KEY` в env деплоя | Без ключа AI на сервере недоступен |
| Stripe env + webhooks | См. `PAYMENT_INTEGRATION.md` |
| `ALLOWED_ORIGINS` в production | Иначе CORS блокирует API |

### P1 — архитектура и сопровождение

| Задача | Детали |
|--------|--------|
| **Дедуп Content Plan** | Импортировать `content-plan-pages.tsx` в monolith, удалить inline ~300+ строк |
| **Дедуп баннеров, EdgeLine, InMapOnboarding** | Импорт из `client/`, удалить inline |
| **Подключить `app-route-boot.tsx`** | Или удалить orphan |
| **Единый источник тарифов на фронте** | `GET /api/tiers` или импорт из `shared/tiers.json` на этапе сборки |
| **Monolith split** | Цель: `strategy-ai-full.tsx` только оркестрация + lazy routes |
| **Покрытие уведомлений** | Единый центр на dashboard / insights / ai (сейчас разрозненно) |
| **Офлайн-ошибки при старте** | Экран retry вместо белого экрана (`loadError` частично есть) |
| **Лимиты при даунгрейде** | Явная политика: read-only лишних карт vs принудительное удаление |
| **Viewer на API** | Дублировать запреты редактирования на бэкенде везде (частично есть) |

### P2 — фичи (логика не завершена)

| Задача | Статус |
|--------|--------|
| Google OAuth | заглушка `google_login_coming` |
| Web Push | UI toggle + dep, нет backend |
| Email-уведомления по событиям | кроме cron дедлайнов |
| Еженедельный брифинг | модалка есть (`weekly-briefing-modal`), нужна связка с AI-саммари / расписанием |
| CRM-интеграция | placeholder в shell |
| Тесты | vitest в devDeps; smoke E2E нет |
| AI: память, аудит карты, структурированные ответы | см. `AUDIT_REPORT.md` § «Как улучшить AI» |

### Порядок рефакторинга monolith (рекомендуемый)

1. Content Plan → импорт из `client/content-plan/content-plan-pages.tsx`.
2. Trial/Email banners → `client/components/trial-email-banners.tsx`.
3. Splash / `initialMarketingScreen` → `app-route-boot.tsx`.
4. Удалить dead code: `InMapOnboarding`, unused `Onboarding` import, `socket.io-client` import.
5. Разбить оставшийся monolith по экранам через lazy `React.lazy`.

---

## 18. Связанные документы

| Файл | Содержание |
|------|------------|
| `AUDIT_REPORT.md` | Аудит багов и AI-роадмап |
| `RECOMMENDATIONS.md` | Приоритеты до/после запуска |
| `PAYMENT_INTEGRATION.md` | Stripe |
| `RAILWAY_DEPLOY.md` | Деплой |
| `RELEASE_CHECKLIST.md` | Чеклист релиза |
| `README.md` | Быстрый старт |

---

## 19. Диаграмма потока (упрощённо)

```
Browser
  index.html → app.js (strategy-ai-full.tsx)
    ├── parseMarketingPath (URL)
    ├── screen state machine
    ├── LangCtx + JWT / localStorage
    └── экраны (client/*)
          ├── dashboard / insights / ai-advisor
          ├── projects → project → map-editor (+ Socket.IO)
          └── content-plan (inline monolith)

server/index.js
  ├── REST /api/*
  ├── Socket.IO (map rooms)
  ├── PostgreSQL
  ├── Stripe webhooks
  └── static public/ + SEO fallback
```

---

*Последнее обновление документа: 2026-07-01.*
