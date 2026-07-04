const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Создание всех таблиц ──────────────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Пользователи
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email           TEXT UNIQUE NOT NULL,
        password_hash   TEXT NOT NULL,
        name            TEXT NOT NULL DEFAULT '',
        bio             TEXT NOT NULL DEFAULT '',
        tier            TEXT NOT NULL DEFAULT 'free',
        trial_ends_at   TIMESTAMPTZ,
        ai_lang         TEXT NOT NULL DEFAULT 'ru',
        notif_email     BOOLEAN NOT NULL DEFAULT true,
        notif_push      BOOLEAN NOT NULL DEFAULT true,
        auto_save       BOOLEAN NOT NULL DEFAULT true,
        compact_mode    BOOLEAN NOT NULL DEFAULT false,
        default_view    TEXT NOT NULL DEFAULT 'canvas',
        theme          TEXT NOT NULL DEFAULT 'dark',
        palette        TEXT NOT NULL DEFAULT 'indigo',
        stripe_customer_id      TEXT,
        stripe_subscription_id  TEXT,
        tier_valid_until         TIMESTAMPTZ,
        reset_token              TEXT,
        reset_token_expires      TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Сессии — зарезервировано для refresh rotation / revoke (см. auth.js); пока не используется.
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Проекты
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        name        TEXT NOT NULL DEFAULT 'Мой проект',
        members     JSONB NOT NULL DEFAULT '[]',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Карты / Стратегии
    await client.query(`
      CREATE TABLE IF NOT EXISTS maps (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name        TEXT NOT NULL DEFAULT 'Стратегия',
        nodes       JSONB NOT NULL DEFAULT '[]',
        edges       JSONB NOT NULL DEFAULT '[]',
        ctx         TEXT NOT NULL DEFAULT '',
        is_scenario BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Контент-план проекта (Pro+): список элементов хранится как JSONB
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_content_plans (
        project_id  UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        items       JSONB NOT NULL DEFAULT '[]',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Публичные ссылки (read-only шаринг)
    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        share_id     TEXT UNIQUE NOT NULL,
        map_id       UUID REFERENCES maps(id) ON DELETE CASCADE,
        project_name TEXT NOT NULL DEFAULT '',
        snapshot     JSONB NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Счётчик AI-сообщений по месяцам
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email  TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        month_key   TEXT NOT NULL,
        count       INTEGER NOT NULL DEFAULT 0,
        UNIQUE(user_email, month_key)
      )
    `);

    // История версий карты
    await client.query(`
      CREATE TABLE IF NOT EXISTS map_versions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        map_id      UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        user_email  TEXT NOT NULL,
        label       TEXT NOT NULL DEFAULT '',
        nodes       JSONB NOT NULL DEFAULT '[]',
        edges       JSONB NOT NULL DEFAULT '[]',
        ctx         TEXT NOT NULL DEFAULT '',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // In-app уведомления
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email  TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        type        TEXT NOT NULL DEFAULT 'info',
        title       TEXT NOT NULL DEFAULT '',
        body        TEXT NOT NULL DEFAULT '',
        link        TEXT NOT NULL DEFAULT '',
        is_read     BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Индексы
    await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_owner   ON projects(owner_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maps_project     ON maps(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_usage_user    ON ai_usage(user_email, month_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shares_sid       ON shares(share_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_map_versions_map ON map_versions(map_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notif_user       ON notifications(user_email, is_read)`);
    // Полнотекстовый поиск — используем 'simple' (поддерживается везде, включая Railway)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maps_search ON maps USING gin(to_tsvector('simple', name || ' ' || ctx))`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maps_nodes_search ON maps USING gin(nodes)`);

    // Недостающие индексы
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL`);

    // Миграция: добавляем новые колонки если их нет (для уже существующих БД)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token TEXT`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(email_verify_token) WHERE email_verify_token IS NOT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS palette TEXT DEFAULT 'indigo'`);

    // Идемпотентность Stripe webhooks (event.id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        id   TEXT PRIMARY KEY,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stripe_events_received ON stripe_webhook_events(received_at)`);

    await client.query('COMMIT');
    console.log('✅ Database initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ DB init error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ── Seed: создаём dev-аккаунт и начальные данные ────────────────────────────
async function seedDB() {
  if (process.env.NODE_ENV === 'production' && (process.env.DEV_EMAIL || process.env.DEV_PASSWORD)) {
    console.warn('⚠️  Seed skipped in production: unset DEV_EMAIL and DEV_PASSWORD');
    return;
  }
  const bcrypt = require('bcryptjs');

  const DEV_EMAIL    = process.env.DEV_EMAIL;
  const DEV_PASSWORD = process.env.DEV_PASSWORD;
  const DEV_NAME     = process.env.DEV_NAME     || 'Admin';
  const DEV_TIER     = process.env.DEV_TIER     || 'team';

  // Пропускаем seed если переменные не заданы
  if (!DEV_EMAIL || !DEV_PASSWORD) {
    console.log('ℹ️  Seed skipped: DEV_EMAIL / DEV_PASSWORD not set in environment');
    return;
  }

  try {
    // Проверяем — существует ли уже dev-аккаунт
    const { rows } = await pool.query('SELECT id, tier FROM users WHERE email = $1', [DEV_EMAIL]);

    if (rows[0]) {
      // Аккаунт есть — убеждаемся что тариф актуален
      if (rows[0].tier !== DEV_TIER) {
        await pool.query(
          `UPDATE users SET tier = $1, trial_ends_at = NULL, updated_at = now() WHERE email = $2`,
          [DEV_TIER, DEV_EMAIL]
        );
        console.log(`✅ Dev account tier updated → ${DEV_TIER}`);
      } else {
        console.log(`✅ Dev account exists (${DEV_EMAIL})`);
      }
      return;
    }

    // Создаём dev-аккаунт
    const hash = await bcrypt.hash(DEV_PASSWORD, 12);
    const { rows: newUser } = await pool.query(
      `INSERT INTO users (email, password_hash, name, tier, trial_ends_at)
       VALUES ($1, $2, $3, $4, NULL)
       RETURNING id, email`,
      [DEV_EMAIL, hash, DEV_NAME, DEV_TIER]
    );

    // Создаём дефолтный проект для dev-аккаунта
    const { rows: proj } = await pool.query(
      `INSERT INTO projects (owner_email, name, members)
       VALUES ($1, 'Тестовый проект', $2)
       RETURNING id`,
      [DEV_EMAIL, JSON.stringify([{ email: DEV_EMAIL, role: 'owner' }])]
    );

    // Создаём приветственную карту
    const sampleNodes = [
      { id: 'n1', x: 200, y: 150, title: 'Анализ рынка', status: 'completed', priority: 'high', progress: 100, reason: 'Понять целевую аудиторию и конкурентов', metric: 'Отчёт готов', tags: ['research'], comments: [], history: [] },
      { id: 'n2', x: 500, y: 150, title: 'MVP продукта', status: 'active', priority: 'critical', progress: 60, reason: 'Запустить минимальный рабочий продукт', metric: '100 первых пользователей', deadline: '2026-04-01', tags: ['product'], comments: [], history: [] },
      { id: 'n3', x: 800, y: 150, title: 'Запуск маркетинга', status: 'planning', priority: 'high', progress: 0, reason: 'Привлечь первых платящих пользователей', metric: '$1000 MRR', tags: ['marketing'], comments: [], history: [] },
    ];
    const sampleEdges = [
      { id: 'e1', source: 'n1', target: 'n2', from: 'n1', to: 'n2', type: 'requires', label: 'Требует' },
      { id: 'e2', source: 'n2', target: 'n3', from: 'n2', to: 'n3', type: 'leads', label: 'Ведёт к' },
    ];

    await pool.query(
      `INSERT INTO maps (project_id, name, nodes, edges, ctx)
       VALUES ($1, 'Стратегия запуска', $2, $3, $4)`,
      [proj[0].id, JSON.stringify(sampleNodes), JSON.stringify(sampleEdges), 'Стартап, SaaS, выход на рынок']
    );

    console.log(`✅ Dev account created: ${DEV_EMAIL} (tier: ${DEV_TIER})`);
  } catch (err) {
    // Seed — некритичная операция, не останавливаем сервер
    console.warn('⚠️  Seed warning (non-fatal):', err.message);
  }
}

/** Удаляет старые записи идемпотентности webhooks (Stripe event.id). По умолчанию старше 90 дней. */
async function cleanupStripeWebhookEvents() {
  const raw = process.env.STRIPE_WEBHOOK_EVENTS_RETENTION_DAYS;
  let days = parseInt(raw || '90', 10);
  if (Number.isNaN(days)) days = 90;
  days = Math.min(365, Math.max(30, days));
  const { rowCount } = await pool.query(
    `DELETE FROM stripe_webhook_events WHERE received_at < (now() - ($1::int * interval '1 day'))`,
    [days]
  );
  if (rowCount > 0) {
    console.log(`✅ stripe_webhook_events: удалено ${rowCount} записей старше ${days} дн.`);
  }
}

module.exports = { pool, initDB, seedDB, cleanupStripeWebhookEvents };
