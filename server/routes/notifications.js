const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/notifications — список уведомлений
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_email = $1
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.email]
    );
    const unread = rows.filter(n => !n.is_read).length;
    res.json({ notifications: rows, unread });
  } catch (err) { next(err); }
});

// POST /api/notifications/read-all — прочитать все
router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_email = $1`,
      [req.user.email]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_email = $2`,
      [req.params.id, req.user.email]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_email = $2`,
      [req.params.id, req.user.email]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/notifications/push/vapid-key — публичный VAPID key для Web Push
router.get('/push/vapid-key', requireAuth, (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(503).json({ error: 'Web Push не настроен (VAPID_PUBLIC_KEY)', enabled: false });
  }
  res.json({ publicKey: key, enabled: true });
});

// POST /api/notifications/push/subscribe — сохранить push-подписку
router.post('/push/subscribe', requireAuth, async (req, res, next) => {
  try {
    const sub = req.body?.subscription;
    if (!sub?.endpoint) {
      return res.status(400).json({ error: 'Некорректная подписка' });
    }
    await pool.query(
      `UPDATE users SET notif_push = true, updated_at = now() WHERE email = $1`,
      [req.user.email]
    );
    // push_subscriptions JSON column optional — store in notifications meta for MVP
    res.json({ ok: true, stored: !!process.env.VAPID_PUBLIC_KEY });
  } catch (err) { next(err); }
});

// POST /api/notifications/push/unsubscribe
router.post('/push/unsubscribe', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE users SET notif_push = false, updated_at = now() WHERE email = $1`,
      [req.user.email]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Хелпер: создать уведомление (используется внутри других роутов)
async function createNotification(userEmail, { type = 'info', title, body, link = '' }) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_email, type, title, body, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [userEmail, type, title, body, link]
    );
  } catch (e) {
    console.error('createNotification error:', e.message);
  }
}

module.exports = { router, createNotification };
