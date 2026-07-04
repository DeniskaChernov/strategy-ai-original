const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db');
const { signToken, signRefreshToken, requireAuth } = require('../middleware/auth');
const { sendEmail, welcomeEmail, resetPasswordEmail, verifyEmailTemplate } = require('./email');

function getDevEmails() {
  return (process.env.DEV_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
}

function safeUser(row, isDev = false) {
  const {
    password_hash,
    reset_token,
    reset_token_expires,
    email_verify_token,
    stripe_customer_id,
    stripe_subscription_id,
    ...rest
  } = row;
  return { ...rest, is_dev: isDev };
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

    const emailLower = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailLower)) {
      return res.status(400).json({ error: 'Некорректный формат email' });
    }

    const displayName = (name?.trim() || emailLower.split('@')[0]).substring(0, 100);
    const hash = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    await client.query('BEGIN');

    // Атомарный INSERT — если email уже есть, PostgreSQL бросит 23505
    let user;
    try {
      const trialDays = parseInt(process.env.TRIAL_DAYS || '7');
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, name, tier, trial_ends_at, email_verified, email_verify_token)
         VALUES ($1, $2, $3, 'starter', $4, false, $5)
         RETURNING id, email, name, bio, tier, ai_lang, notif_email, notif_push,
                   auto_save, compact_mode, default_view, theme, palette, trial_ends_at, created_at, email_verified`,
        [emailLower, hash, displayName, trialEndsAt.toISOString(), verifyToken]
      );
      user = rows[0];
    } catch (insertErr) {
      await client.query('ROLLBACK');
      if (insertErr.code === '23505') {
        return res.status(409).json({ error: 'Email уже зарегистрирован' });
      }
      throw insertErr;
    }

    // Создаём дефолтный проект в той же транзакции
    await client.query(
      `INSERT INTO projects (owner_email, name, members)
       VALUES ($1, 'Моя стратегия', $2)`,
      [emailLower, JSON.stringify([{ email: emailLower, role: 'owner' }])]
    );

    await client.query('COMMIT');

    const token = signToken({ email: user.email, id: user.id });
    const refreshToken = signRefreshToken({ email: user.email, id: user.id });

    // Приветственное письмо + верификация асинхронно
    const { subject: ws, html: wh } = welcomeEmail(displayName);
    sendEmail({ to: emailLower, subject: ws, html: wh }).catch(() => {});
    const { subject: vs, html: vh } = verifyEmailTemplate(displayName, verifyToken);
    sendEmail({ to: emailLower, subject: vs, html: vh }).catch(() => {});

    res.status(201).json({ token, refreshToken, user: safeUser(user, getDevEmails().includes(user.email)), isNew: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

    const emailLower = email.trim().toLowerCase();
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [emailLower]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = signToken({ email: user.email, id: user.id });
    const refreshToken = signRefreshToken({ email: user.email, id: user.id });
    res.json({ token, refreshToken, user: safeUser(user, getDevEmails().includes(user.email)), isNew: false });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — получить текущего пользователя по токену
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user, getDevEmails().includes(req.user.email)) });
});

// GET /api/auth/verify-email?token=xxx — подтверждение email
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Токен обязателен' });

    const { rows } = await pool.query(
      `UPDATE users SET email_verified = true, email_verify_token = NULL, updated_at = now()
       WHERE email_verify_token = $1
       RETURNING id, email, name`,
      [token]
    );

    if (!rows[0]) {
      return res.status(400).json({ error: 'Ссылка недействительна или уже использована' });
    }

    // Редирект на приложение с флагом verified
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    res.redirect(`${appUrl}?verified=1`);
  } catch (err) { next(err); }
});

// POST /api/auth/resend-verification — повторная отправка письма верификации
router.post('/resend-verification', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT email_verified, name FROM users WHERE email = $1`,
      [req.user.email]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
    if (rows[0].email_verified) return res.json({ ok: true, message: 'Email уже подтверждён' });

    const newToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE users SET email_verify_token = $1, updated_at = now() WHERE email = $2`,
      [newToken, req.user.email]
    );

    const { subject, html } = verifyEmailTemplate(rows[0].name, newToken);
    sendEmail({ to: req.user.email, subject, html }).catch(() => {});

    res.json({ ok: true, message: 'Письмо отправлено' });
  } catch (err) { next(err); }
});

// PATCH /api/auth/profile — обновить профиль
router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const { name, bio, ai_lang, notif_email, notif_push, auto_save, compact_mode, default_view, tier, theme, palette } = req.body;

    // Валидация входных данных
    const ALLOWED_VIEWS = ['canvas', 'list', 'gantt'];
    const ALLOWED_TIERS = ['free', 'starter', 'pro', 'team', 'enterprise'];
    const ALLOWED_THEMES = ['dark', 'light'];
    const ALLOWED_PALETTES = ['indigo', 'ocean', 'forest', 'sunset', 'mono', 'orange'];
    if (default_view && !ALLOWED_VIEWS.includes(default_view)) {
      return res.status(400).json({ error: 'Недопустимое значение default_view' });
    }
    if (theme && !ALLOWED_THEMES.includes(theme)) {
      return res.status(400).json({ error: 'Недопустимое значение theme' });
    }
    if (palette && !ALLOWED_PALETTES.includes(palette)) {
      return res.status(400).json({ error: 'Недопустимое значение palette' });
    }
    if (name && typeof name === 'string' && name.length > 100) {
      return res.status(400).json({ error: 'Имя не может быть длиннее 100 символов' });
    }
    if (bio && typeof bio === 'string' && bio.length > 500) {
      return res.status(400).json({ error: 'Bio не может быть длиннее 500 символов' });
    }

    const DEV_EMAILS = getDevEmails();
    const newTier = tier && ALLOWED_TIERS.includes(tier) && req.user.is_dev && DEV_EMAILS.includes(req.user.email) ? tier : null;

    const { rows } = await pool.query(
      `UPDATE users SET
        name         = COALESCE($1, name),
        bio          = COALESCE($2, bio),
        ai_lang      = COALESCE($3, ai_lang),
        notif_email  = COALESCE($4, notif_email),
        notif_push   = COALESCE($5, notif_push),
        auto_save    = COALESCE($6, auto_save),
        compact_mode = COALESCE($7, compact_mode),
        default_view = COALESCE($8, default_view),
        tier         = COALESCE($10, tier),
        theme        = COALESCE($11, theme),
        palette      = COALESCE($12, palette),
        updated_at   = now()
       WHERE email = $9
       RETURNING id, email, name, bio, tier, ai_lang, notif_email, notif_push, auto_save, compact_mode, default_view, theme, palette, trial_ends_at, created_at, email_verified`,
      [name, bio, ai_lang, notif_email, notif_push, auto_save, compact_mode, default_view, req.user.email, newTier, theme, palette]
    );
    const userRow = rows[0];
    res.json({ user: { ...userRow, is_dev: getDevEmails().includes(userRow.email) } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Заполните все поля' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Новый пароль минимум 6 символов' });

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [req.user.email]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Неверный текущий пароль' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE email = $2', [hash, req.user.email]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh — обновить access token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken обязателен' });
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';
    let decoded;
    try { decoded = jwt.verify(refreshToken, secret); }
    catch { return res.status(401).json({ error: 'Refresh token истёк или недействителен' }); }

    const { rows } = await pool.query('SELECT id, email FROM users WHERE email = $1', [decoded.email]);
    if (!rows[0]) return res.status(401).json({ error: 'Пользователь не найден' });

    const { signToken: st, signRefreshToken: srt } = require('../middleware/auth');
    const token = st({ email: rows[0].email, id: rows[0].id });
    const newRefresh = srt({ email: rows[0].email, id: rows[0].id });
    res.json({ token, refreshToken: newRefresh });
  } catch (err) { next(err); }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email обязателен' });
    const emailLower = email.trim().toLowerCase();
    const { rows } = await pool.query('SELECT name FROM users WHERE email = $1', [emailLower]);
    // Не раскрываем существование аккаунта — всегда отвечаем success
    if (rows[0]) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 час
      await pool.query(
        `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3`,
        [token, expires, emailLower]
      );
      const { subject, html } = resetPasswordEmail(rows[0].name, token);
      sendEmail({ to: emailLower, subject, html }).catch(() => {});
    }
    res.json({ ok: true, message: 'Если email зарегистрирован — письмо отправлено' });
  } catch (err) { next(err); }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'token и newPassword обязательны' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

    const { rows } = await pool.query(
      `SELECT email FROM users WHERE reset_token = $1 AND reset_token_expires > now()`,
      [token]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Ссылка недействительна или истекла' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = now()
       WHERE email = $2`,
      [hash, rows[0].email]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/auth/account — удалить аккаунт (требует подтверждения паролем)
router.delete('/account', requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Для удаления аккаунта введите пароль' });

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [req.user.email]);
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(403).json({ error: 'Неверный пароль' });

    await pool.query('DELETE FROM users WHERE email = $1', [req.user.email]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
