require('dotenv').config();
const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { pool, initDB, seedDB, cleanupStripeWebhookEvents } = require('./db');

// ── Sentry (опционально, если SENTRY_DSN задан) ──────────────────────────────
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1,
    });
    console.log('✅ Sentry initialized');
  } catch (e) {
    console.warn('⚠️ Sentry not installed (run: npm i @sentry/node)');
  }
}

const app = express();
// Trust proxy (Railway, Nginx, etc.) — иначе express-rate-limit падает с X-Forwarded-For
app.set('trust proxy', 1);
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// ── CORS ───────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // Разрешить запросы без origin (мобильные, curl, etc.)
    if (!origin) return cb(null, true);
    // Если ALLOWED_ORIGINS не задан — разрешить только в development
    if (allowedOrigins.length === 0) {
      if (process.env.NODE_ENV === 'production') {
        return cb(new Error(`CORS: ALLOWED_ORIGINS not configured in production`));
      }
      return cb(null, true);
    }
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
};
app.use(cors(corsOptions));

// ── WebSocket (Socket.IO) ──────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');
const { getProjectAccess } = require('./lib/projectAccess');
const io = new SocketIO(server, {
  cors: corsOptions,
  pingTimeout: 60000,
});

// Middleware: проверяем JWT при подключении к Socket.IO
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Unauthorized: no token'));
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.data.userEmail = decoded.email;
    socket.data.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Unauthorized: invalid token'));
  }
});

// Комнаты: map:{mapId} — все редакторы одной карты (доступ только при членстве в проекте)
function rejectViewerMutation(socket, eventName) {
  if (socket.data?.projectRole === 'viewer') {
    socket.emit('mutation-denied', { event: eventName, message: 'Наблюдатель не может изменять карту' });
    return true;
  }
  return false;
}

io.on('connection', (socket) => {
  socket.on('join-map', async ({ mapId, userName }) => {
    const userEmail = socket.data.userEmail;
    if (!mapId) {
      socket.emit('join-error', { message: 'Некорректный идентификатор карты' });
      return;
    }
    try {
      const { rows } = await pool.query(
        'SELECT project_id FROM maps WHERE id = $1',
        [mapId]
      );
      if (!rows[0]) {
        socket.emit('join-error', { message: 'Карта не найдена' });
        return;
      }
      const projectId = rows[0].project_id;
      const { role } = await getProjectAccess(projectId, userEmail);
      if (!role) {
        socket.emit('join-error', { message: 'Нет доступа к этой карте' });
        return;
      }
      if (socket.data.mapId && socket.data.mapId !== mapId) {
        socket.leave(`map:${socket.data.mapId}`);
      }
      socket.join(`map:${mapId}`);
      socket.data = { ...socket.data, mapId, userName, projectRole: role, projectId };
      socket.to(`map:${mapId}`).emit('user-joined', { email: userEmail, name: userName, role });
    } catch (e) {
      console.error('join-map:', e.message);
      socket.emit('join-error', { message: 'Ошибка проверки доступа' });
    }
  });

  // Синхронизация перемещения узла
  socket.on('node-move', ({ mapId, nodeId, x, y }) => {
    if (mapId !== socket.data?.mapId) return;
    if (rejectViewerMutation(socket, 'node-move')) return;
    socket.to(`map:${mapId}`).emit('node-move', { nodeId, x, y, from: socket.data.userEmail });
  });

  // Синхронизация изменения поля узла
  socket.on('node-update', ({ mapId, node }) => {
    if (mapId !== socket.data?.mapId) return;
    if (rejectViewerMutation(socket, 'node-update')) return;
    socket.to(`map:${mapId}`).emit('node-update', { node, from: socket.data.userEmail });
  });

  // Синхронизация добавления узла
  socket.on('node-add', ({ mapId, node }) => {
    if (mapId !== socket.data?.mapId) return;
    if (rejectViewerMutation(socket, 'node-add')) return;
    socket.to(`map:${mapId}`).emit('node-add', { node, from: socket.data.userEmail });
  });

  // Синхронизация удаления узла
  socket.on('node-delete', ({ mapId, nodeId }) => {
    if (mapId !== socket.data?.mapId) return;
    if (rejectViewerMutation(socket, 'node-delete')) return;
    socket.to(`map:${mapId}`).emit('node-delete', { nodeId, from: socket.data.userEmail });
  });

  // Синхронизация рёбер
  socket.on('edge-update', ({ mapId, edges }) => {
    if (mapId !== socket.data?.mapId) return;
    if (rejectViewerMutation(socket, 'edge-update')) return;
    socket.to(`map:${mapId}`).emit('edge-update', { edges, from: socket.data.userEmail });
  });

  // Курсор (live presence)
  socket.on('cursor-move', ({ mapId, x, y }) => {
    if (mapId !== socket.data?.mapId) return;
    socket.to(`map:${mapId}`).emit('cursor-move', {
      email: socket.data.userEmail,
      name: socket.data?.userName,
      x, y,
    });
  });

  socket.on('leave-map', ({ mapId }) => {
    socket.leave(`map:${mapId}`);
    socket.to(`map:${mapId}`).emit('user-left', { email: socket.data.userEmail });
    socket.data.mapId = null;
  });

  socket.on('disconnect', () => {
    if (socket.data?.mapId) {
      socket.to(`map:${socket.data.mapId}`).emit('user-left', { email: socket.data.userEmail });
    }
  });
});

// Экспортируем io для использования в роутах
app.set('io', io);

// ── Security headers (CSP) ───────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // CSP: разрешаем inline для React/Vite, fonts, connect к API
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.clarity.ms",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss: https://www.google-analytics.com https://analytics.google.com https://*.clarity.ms",
    "frame-src 'self' https://www.loom.com https://*.loom.com https://www.youtube.com https://www.youtube-nocookie.com",
    "frame-ancestors 'none'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
});

// ── Gzip (compression) — меньше трафика для JSON и статики ───────────────────
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.path === '/api/webhooks/stripe') return false;
      return compression.filter(req, res);
    },
  })
);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Sentry request handler (должен быть первым middleware) ───────────────────
if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
}

// ── Stripe Webhook (нужен raw body ПЕРЕД json-парсером) ───────────────────────
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// ── JSON / urlencoded ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
});
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Слишком много попыток. Подождите 15 минут.' },
});
const aiLimit = rateLimit({
  windowMs: 60 * 1000, max: 15,
  message: { error: 'Слишком много AI запросов. Подождите минуту.' },
});

app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/webhooks/stripe')) return next();
  return generalLimit(req, res, next);
});
app.use('/api/auth/login', authLimit);
app.use('/api/auth/register', authLimit);
app.use('/api/auth/forgot-password', authLimit);
app.use('/api/ai/', aiLimit);

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const projectRoutes      = require('./routes/projects');
const mapRoutes          = require('./routes/maps');
const { router: tierRoutes } = require('./routes/tiers');
const paymentRoutes      = require('./routes/payments');
const webhookRoutes      = require('./routes/webhooks');
const shareRoutes        = require('./routes/shares');
const aiRoutes           = require('./routes/ai');
const searchRoutes       = require('./routes/search');
const { router: notifRoutes } = require('./routes/notifications');
const versionsRoutes     = require('./routes/versions');

app.use('/api/auth',         authRoutes);
app.use('/api/projects',     projectRoutes);
app.use('/api/projects',     mapRoutes);
app.use('/api/projects',     versionsRoutes);
app.use('/api/tiers',        tierRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/webhooks',     webhookRoutes);
app.use('/api/shares',       shareRoutes);
app.use('/api/ai',           aiRoutes);
app.use('/api/search',       searchRoutes);
app.use('/api/notifications', notifRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let database = 'unknown';
  try {
    await pool.query('SELECT 1');
    database = 'ok';
  } catch (e) {
    database = 'error';
  }
  const dbOk = database === 'ok';
  const strict =
    req.query.strict === '1' ||
    req.query.strict === 'true' ||
    req.query.readiness === '1';
  const httpOk = dbOk || !strict;
  res.status(httpOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    version: '1.1.0',
    time: new Date().toISOString(),
    aiReady: !!process.env.OPENAI_KEY,
    database,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
if (Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}
app.use((err, req, res, _next) => {
  console.error('❌ Error:', err.message);
  const status = err.status || err.statusCode || 500;
  if (status === 500 && Sentry) {
    Sentry.captureException(err);
  }
  res.status(status).json({
    error: status === 500 ? 'Внутренняя ошибка сервера' : err.message,
  });
});

// ── Фронтенд (статика из /public) — ПОСЛЕ error handler и API роутов ─────────
const path = require('path');
const publicDir = path.join(__dirname, '..', 'public');
const { renderIndex, routeFor } = require('./seo');
app.use(express.static(publicDir, { index: false }));
// SPA fallback — все не-API роуты отдают index.html с per-route SEO
app.get('*', (req, res) => {
  const html = renderIndex(req.path, req);
  if (html == null) {
    return res.status(503).send('App not built yet. Run: npm run build');
  }
  const route = routeFor(req.path);
  const status = route === 'notFound' ? 404 : 200;
  res
    .status(status)
    .set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, must-revalidate',
    })
    .send(html);
});

// ── Deadline reminder cron (запускается раз в день в 08:00 UTC) ──────────────
const { sendEmail, deadlineReminderEmail } = require('./routes/email');

async function runDeadlineReminders() {
  const LOCK_KEY = 8400123456789012;
  let client;
  try {
    client = await pool.connect();
    const { rows: lockRows } = await client.query(
      'SELECT pg_try_advisory_lock($1::bigint) AS locked',
      [LOCK_KEY]
    );
    if (!lockRows[0]?.locked) {
      console.log('Deadline reminders: another instance holds lock, skipping');
      return;
    }

    // Находим всех пользователей с notif_email = true
    const { rows: users } = await client.query(
      `SELECT email, name FROM users WHERE notif_email = true AND email_verified = true`
    );

    const today = new Date();
    const in3days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().slice(0, 10);
    const in3daysStr = in3days.toISOString().slice(0, 10);

    for (const user of users) {
      try {
        // Находим все карты пользователя (как owner или member)
        const { rows: projects } = await client.query(
          `SELECT id FROM projects WHERE owner_email = $1 OR members @> $2::jsonb`,
          [user.email, JSON.stringify([{ email: user.email }])]
        );
        if (!projects.length) continue;

        const projectIds = projects.map(p => p.id);
        const { rows: maps } = await client.query(
          `SELECT nodes FROM maps WHERE project_id = ANY($1) AND is_scenario = false`,
          [projectIds]
        );

        // Собираем шаги с дедлайнами в ближайшие 3 дня
        const urgentSteps = [];
        for (const map of maps) {
          const nodes = map.nodes || [];
          for (const node of nodes) {
            if (node.deadline && node.status !== 'completed' && node.deadline >= todayStr && node.deadline <= in3daysStr) {
              urgentSteps.push({ title: node.title, deadline: node.deadline });
            }
          }
        }

        if (urgentSteps.length > 0) {
          const { subject, html } = deadlineReminderEmail(user.name, urgentSteps);
          await sendEmail({ to: user.email, subject, html });
        }
      } catch (e) {
        console.warn(`Deadline reminder failed for ${user.email}:`, e.message);
      }
    }
    console.log(`✅ Deadline reminders sent (checked ${users.length} users)`);
  } catch (e) {
    console.error('Deadline cron error:', e.message);
  } finally {
    if (client) {
      try {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [8400123456789012]);
      } catch (_) { /* ignore */ }
      client.release();
    }
  }
}

let lastDeadlineRunDate = null;
function startCron() {
  setInterval(() => {
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const today = now.toISOString().slice(0, 10);
    if (hour === 8 && minute < 5 && lastDeadlineRunDate !== today) {
      lastDeadlineRunDate = today;
      runDeadlineReminders();
    }
  }, 60 * 60 * 1000);
}

// Проверка обязательных и важных env-переменных. В production падаем при
// отсутствии критичных секретов; для остальных — печатаем понятный warning.
const { validateProductionEnv } = require('./lib/preflightEnv');

function preflightEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const { hard, soft } = validateProductionEnv(process.env);

  if (hard.length) {
    console.error('❌ Критические env-переменные отсутствуют или используют дефолт:');
    hard.forEach((k) => console.error('   ·', k));
    if (isProd) {
      console.error('Сервер не может запуститься в production. Подробнее: RAILWAY_DEPLOY.md');
      process.exit(1);
    }
  }
  if (soft.length) {
    console.warn('⚠️  Опциональные env-переменные не заданы:');
    soft.forEach((k) => console.warn('   ·', k));
  }
  if (!isProd && !process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET не задан — использую дефолт (только для разработки)');
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  preflightEnv();

  console.log('🔄 Connecting to database...');
  await initDB();
  await seedDB();

  server.listen(PORT, () => {
    console.log(`🚀 Strategy AI Server v1.1 running on port ${PORT}`);
    console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   DB:  connected`);
    console.log(`   WS:  enabled`);
    startCron();
    console.log(`   CRON: deadline reminders scheduled`);
    cleanupStripeWebhookEvents().catch((e) =>
      console.warn('stripe_webhook_events cleanup:', e.message)
    );
    setInterval(
      () => cleanupStripeWebhookEvents().catch((e) => console.warn('stripe_webhook_events cleanup:', e.message)),
      24 * 60 * 60 * 1000
    );
  });
}

start().catch(err => {
  console.error('❌ Fatal startup error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
