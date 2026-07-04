const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const DEFAULT_DEV_SECRET = 'strategy-ai-secret-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET + '_refresh');

// Безопасность: в production запрещаем запуск с дефолтным секретом —
// иначе любой, кто знает значение по умолчанию, сможет подписывать токены.
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_DEV_SECRET) {
  throw new Error('JWT_SECRET must be set to a strong unique value in production (default secret is not allowed).');
}
if (process.env.NODE_ENV === 'production' && !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET must be set in production (do not rely on JWT_SECRET+_refresh).');
}
if (JWT_SECRET === DEFAULT_DEV_SECRET) {
  console.warn('[auth] WARNING: using default JWT secret — set JWT_SECRET env var before deploying.');
}
const JWT_EXPIRES = '15m';         // Access token — короткоживущий
const JWT_REFRESH_EXPIRES = '30d'; // Refresh token — долгоживущий

// Генерация access token (15 мин)
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// Генерация refresh token (30 дней)
function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });
}

// Middleware: проверка токена из заголовка Authorization: Bearer <token>
async function requireAuth(req, res, next) {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Необходима авторизация' });
    }
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    // Проверяем, что пользователь ещё существует
    const { rows } = await pool.query(
      'SELECT id, email, name, bio, tier, ai_lang, notif_email, notif_push, auto_save, compact_mode, default_view, theme, palette, trial_ends_at, stripe_customer_id, stripe_subscription_id, tier_valid_until, created_at, email_verified FROM users WHERE email = $1',
      [decoded.email]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const user = rows[0];

    // Если триал истёк и нет активной подписки — даунгрейд до free.
    if (
      user.tier !== 'free' &&
      user.trial_ends_at &&
      new Date(user.trial_ends_at) < new Date() &&
      !user.stripe_subscription_id
    ) {
      pool.query(
        `UPDATE users SET tier = 'free', trial_ends_at = NULL, updated_at = now() WHERE email = $1`,
        [user.email]
      ).catch(e => console.error('Trial downgrade error:', e.message));
      user.tier = 'free';
      user.trial_ends_at = null;
    }

    // Платный период истёк (tier_valid_until), подписка не активна — даунгрейд до free.
    if (
      user.tier !== 'free' &&
      user.tier_valid_until &&
      new Date(user.tier_valid_until) < new Date() &&
      !user.stripe_subscription_id
    ) {
      pool.query(
        `UPDATE users SET tier = 'free', tier_valid_until = NULL, updated_at = now() WHERE email = $1`,
        [user.email]
      ).catch(e => console.error('Tier valid_until downgrade error:', e.message));
      user.tier = 'free';
      user.tier_valid_until = null;
    }

    user.is_dev = (process.env.DEV_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean).includes(user.email);
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
    }
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

// Middleware: проверка, является ли пользователь owner или editor проекта
async function requireProjectAccess(req, res, next) {
  try {
    const { projectId } = req.params;
    const email = req.user.email;

    const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!rows[0]) return res.status(404).json({ error: 'Проект не найден' });

    const project = rows[0];
    const members = project.members || [];
    const isOwner = project.owner_email === email;
    const member = members.find(m => m.email === email);
    const role = isOwner ? 'owner' : member?.role;

    if (!role) return res.status(403).json({ error: 'Нет доступа к проекту' });

    req.project = project;
    req.projectRole = role;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { signToken, signRefreshToken, requireAuth, requireProjectAccess, JWT_SECRET, JWT_REFRESH_SECRET };
