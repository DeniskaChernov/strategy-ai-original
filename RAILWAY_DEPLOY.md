# 🚀 Деплой Strategy AI на Railway

## Шаг 1 — Установи зависимости сервера

```bash
cd server
npm install
```

---

## Шаг 2 — Зарегистрируйся на Railway

1. Зайди на [railway.app](https://railway.app)
2. Нажми **Start a New Project**
3. Выбери **Deploy from GitHub repo** (или **Empty project**)

---

## Шаг 3 — Подключи базу данных PostgreSQL

1. В проекте нажми **+ New** → **Database** → **Add PostgreSQL**
2. Railway автоматически создаст БД
3. В переменных появится `DATABASE_URL` — **скопируй её**

---

## Шаг 4 — Задеплой сервер

### Вариант A: через GitHub
1. Подключи репозиторий к Railway
2. Убедись что `railway.json` есть в корне (уже создан)
3. Railway автоматически запустит `node server/index.js`

### Вариант B: Railway CLI
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## Шаг 5 — Переменные окружения на Railway

В Railway → твой сервис → **Variables** → добавь:

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | Автоматически из PostgreSQL |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Случайная строка 64+ символов (`node -e "require('crypto').randomBytes(64).toString('hex')""`) |
| `JWT_REFRESH_SECRET` | Отдельная случайная строка (не `JWT_SECRET + '_refresh'`) |
| `ALLOWED_ORIGINS` | URL фронтенда через запятую |
| `APP_URL` | URL приложения (Stripe redirect, письма) |
| `PUBLIC_SITE_URL` | Canonical URL для SEO (опционально, рекомендуется) |
| `OPENAI_KEY` | Ключ с [platform.openai.com](https://platform.openai.com/api-keys) |
| `STRIPE_SECRET_KEY` | `sk_live_...` из Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` из Stripe Webhooks |
| `STRIPE_PRICE_STARTER` | `price_...` из Stripe Products |
| `STRIPE_PRICE_PRO` | `price_...` из Stripe Products |
| `STRIPE_PRICE_TEAM` | `price_...` из Stripe Products |
| `STRIPE_PRICE_ENTERPRISE` | `price_...` из Stripe Products |
| `RESEND_API_KEY` | (опционально) для email |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | (опционально) Web Push |

Полный список: `server/.env.example`, `RAILWAY_DEPLOY.md`.

---

## Шаг 6 — Настрой Stripe

1. Зайди на [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Products** → создай 4 продукта:
   - Starter — $9/мес (Recurring)
   - Pro — $29/мес (Recurring)
   - Team — $59/мес (Recurring)
   - Enterprise — $149/мес (Recurring)
3. Скопируй **Price ID** каждого (`price_xxx`) в Railway Variables
4. **Developers** → **Webhooks** → Add endpoint:
   - URL: `https://your-backend.railway.app/api/webhooks/stripe`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `checkout.session.completed`
5. Скопируй **Signing secret** (`whsec_...`) в `STRIPE_WEBHOOK_SECRET`

---

## Шаг 7 — Подключи фронтенд к бэкенду

В HTML-файле (или в Cursor Artifact) добавь перед загрузкой скрипта:

```html
<script>
  window.__STRATEGY_AI_API_URL__ = "https://your-backend.railway.app";
</script>
```

Или если используешь отдельный фронтенд-сервис на Railway:
1. Создай статический сайт (или Vite/CRA)
2. Добавь переменную `VITE_API_URL=https://your-backend.railway.app`
3. В коде: `window.__STRATEGY_AI_API_URL__ = import.meta.env.VITE_API_URL`

---

## Шаг 8 — Проверь работу

```bash
# Проверка health endpoint
curl https://your-backend.railway.app/api/health

# Тестовая регистрация
curl -X POST https://your-backend.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test"}'
```

---

## Архитектура

```
[Браузер / Фронтенд]
        ↓ HTTPS
[Railway: Node.js Express]
   ├── /api/auth/*        — JWT авторизация
   ├── /api/projects/*    — CRUD проектов
   ├── /api/projects/:id/maps/* — CRUD карт
   ├── /api/tiers/*       — тарифы
   ├── /api/payments/*    — Stripe Checkout
   ├── /api/webhooks/*    — Stripe Events
   ├── /api/shares/*      — публичные ссылки
   └── /api/ai/*          — прокси OpenAI + лимиты
        ↓
[Railway: PostgreSQL]
   ├── users              — пользователи + тарифы
   ├── projects           — проекты
   ├── maps               — стратегические карты
   ├── shares             — публичные ссылки
   └── ai_usage           — счётчик AI сообщений
```

---

## Структура файлов

```
c:\Strategy AI\
├── strategy-ai-full.tsx     # Фронтенд (весь UI)
├── railway.json              # Railway конфиг
├── Procfile                  # Команда запуска
├── .gitignore
└── server/
    ├── index.js              # Express точка входа
    ├── db.js                 # PostgreSQL + init
    ├── package.json
    ├── .env.example          # Шаблон переменных
    ├── middleware/
    │   └── auth.js           # JWT middleware
    └── routes/
        ├── auth.js           # register/login/me/profile
        ├── projects.js       # CRUD + участники
        ├── maps.js           # CRUD стратегий
        ├── tiers.js          # тарифы + usage
        ├── payments.js       # Stripe Checkout/Portal
        ├── webhooks.js       # Stripe Events
        ├── shares.js         # публичные ссылки
        └── ai.js             # прокси Anthropic
```
