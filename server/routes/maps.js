const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { TIERS } = require('./tiers');
const { getProjectAccess } = require('../lib/projectAccess');
const { validateMapBody } = require('../lib/mapPayload');
const { isMapOverLimit } = require('../lib/mapLimits');

// GET /api/projects/:projectId/maps
router.get('/:projectId/maps', requireAuth, async (req, res, next) => {
  try {
    const { project, role } = await getProjectAccess(req.params.projectId, req.user.email);
    if (!project) return res.status(404).json({ error: 'Проект не найден' });
    if (!role)    return res.status(403).json({ error: 'Нет доступа' });

    const { rows } = await pool.query(
      'SELECT * FROM maps WHERE project_id = $1 ORDER BY updated_at DESC',
      [req.params.projectId]
    );
    res.json({ maps: rows });
  } catch (err) { next(err); }
});

// POST /api/projects/:projectId/maps
router.post('/:projectId/maps', requireAuth, async (req, res, next) => {
  try {
    const { project, role } = await getProjectAccess(req.params.projectId, req.user.email);
    if (!project) return res.status(404).json({ error: 'Проект не найден' });
    if (!role || role === 'viewer') return res.status(403).json({ error: 'Нет прав для создания карты' });

    const tier = req.user.tier || 'free';
    const tierCfg = TIERS[tier] || TIERS.free;
    const isScenario = !!req.body.is_scenario;

    if (isScenario) {
      if ((tierCfg.scenarios || 0) === 0) {
        return res.status(403).json({
          error: 'Сценарии доступны с тарифа Starter. Улучшите тариф.',
          code: 'SCENARIO_TIER',
        });
      }
      const { rows: scRows } = await pool.query(
        `SELECT count(*) FROM maps m
         JOIN projects p ON m.project_id = p.id
         WHERE m.is_scenario = true
           AND (p.owner_email = $1 OR p.members @> $2::jsonb)`,
        [req.user.email, JSON.stringify([{ email: req.user.email }])]
      );
      const scLimit = tierCfg.scenarios >= 999999 ? 999999 : tierCfg.scenarios;
      if (parseInt(scRows[0].count) >= scLimit) {
        return res.status(403).json({
          error: `Лимит сценариев для тарифа ${tier}: ${scLimit}. Улучшите тариф.`,
          code: 'SCENARIO_LIMIT',
          tierLabel: tier,
          limit: scLimit,
        });
      }
    } else {
      const mapsLimit = tierCfg.maps >= 999999 ? 999999 : tierCfg.maps;
      const { rows: existing } = await pool.query(
        `SELECT count(*) FROM maps m
         JOIN projects p ON m.project_id = p.id
         WHERE m.is_scenario = false
           AND (p.owner_email = $1 OR p.members @> $2::jsonb)`,
        [req.user.email, JSON.stringify([{ email: req.user.email }])]
      );
      if (parseInt(existing[0].count) >= mapsLimit) {
        return res.status(403).json({
          error: `Лимит карт для тарифа ${tier}: ${mapsLimit}. Улучшите тариф.`,
          code: 'MAP_LIMIT',
          tierLabel: tier,
          limit: mapsLimit,
        });
      }
    }

    const { name, nodes, edges, ctx, is_scenario } = req.body;
    const v = validateMapBody({
      name,
      ctx,
      nodes: nodes !== undefined ? nodes : [],
      edges: edges !== undefined ? edges : [],
    });
    if (v) return res.status(400).json({ error: v, code: 'MAP_PAYLOAD_LIMIT' });

    const { rows } = await pool.query(
      `INSERT INTO maps (project_id, name, nodes, edges, ctx, is_scenario)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.params.projectId,
        name || 'Новая стратегия',
        JSON.stringify(nodes || []),
        JSON.stringify(edges || []),
        ctx || '',
        is_scenario || false,
      ]
    );
    res.status(201).json({ map: rows[0] });
  } catch (err) { next(err); }
});

// GET /api/projects/:projectId/maps/:mapId
router.get('/:projectId/maps/:mapId', requireAuth, async (req, res, next) => {
  try {
    const { project, role } = await getProjectAccess(req.params.projectId, req.user.email);
    if (!project) return res.status(404).json({ error: 'Проект не найден' });
    if (!role)    return res.status(403).json({ error: 'Нет доступа' });

    const { rows } = await pool.query(
      'SELECT * FROM maps WHERE id = $1 AND project_id = $2',
      [req.params.mapId, req.params.projectId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Карта не найдена' });
    const readOnly = await isMapOverLimit(req.user.email, req.user.tier, req.params.mapId);
    res.json({ map: rows[0], role, readOnly: readOnly || role === 'viewer' });
  } catch (err) { next(err); }
});

// PUT /api/projects/:projectId/maps/:mapId — полное обновление
router.put('/:projectId/maps/:mapId', requireAuth, async (req, res, next) => {
  try {
    const { project, role } = await getProjectAccess(req.params.projectId, req.user.email);
    if (!project) return res.status(404).json({ error: 'Проект не найден' });
    if (!role || role === 'viewer') return res.status(403).json({ error: 'Нет прав для сохранения' });

    if (await isMapOverLimit(req.user.email, req.user.tier, req.params.mapId)) {
      return res.status(403).json({
        error: 'Карта доступна только для чтения: превышен лимит карт для вашего тарифа. Улучшите тариф или удалите лишние карты.',
        code: 'MAP_READ_ONLY',
      });
    }

    const { name, nodes, edges, ctx, is_scenario } = req.body;
    const vPut = validateMapBody({ name, ctx, nodes, edges });
    if (vPut) return res.status(400).json({ error: vPut, code: 'MAP_PAYLOAD_LIMIT' });

    const { rows } = await pool.query(
      `UPDATE maps SET
         name        = COALESCE($1, name),
         nodes       = COALESCE($2, nodes),
         edges       = COALESCE($3, edges),
         ctx         = COALESCE($4, ctx),
         is_scenario = COALESCE($5, is_scenario),
         updated_at  = now()
       WHERE id = $6 AND project_id = $7 RETURNING *`,
      [
        name,
        nodes !== undefined ? JSON.stringify(nodes) : undefined,
        edges !== undefined ? JSON.stringify(edges) : undefined,
        ctx,
        is_scenario,
        req.params.mapId,
        req.params.projectId,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Карта не найдена' });

    // Автосохранение версии каждые 10 сохранений (не на каждый PUT)
    try {
      const { rows: vCount } = await pool.query(
        `SELECT count(*), MAX(created_at) as last_version FROM map_versions WHERE map_id = $1`,
        [req.params.mapId]
      );
      const totalVersions = parseInt(vCount[0].count);
      const lastVersion = vCount[0].last_version;
      const minutesSinceLast = lastVersion
        ? (Date.now() - new Date(lastVersion).getTime()) / 60000
        : Infinity;
      // Сохраняем версию: если первая или прошло больше 10 минут с последней
      const shouldSaveVersion = totalVersions === 0 || minutesSinceLast >= 10;

      if (shouldSaveVersion && nodes && Array.isArray(nodes)) {
        await pool.query(
          `INSERT INTO map_versions (map_id, user_email, label, nodes, edges, ctx)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.params.mapId, req.user.email, `Авто: ${new Date().toLocaleString('ru')}`,
           JSON.stringify(nodes || rows[0].nodes), JSON.stringify(edges || rows[0].edges), ctx || rows[0].ctx]
        );
        // Удаляем старые версии сверх 20
        await pool.query(
          `DELETE FROM map_versions WHERE id IN (
            SELECT id FROM map_versions WHERE map_id = $1 ORDER BY created_at DESC OFFSET 20
          )`, [req.params.mapId]
        );
      }
    } catch (vErr) {
      console.warn('Version save error (non-fatal):', vErr.message);
    }

    // Уведомляем других участников проекта об изменении карты (не чаще раза в 5 минут)
    // используем уже загруженный project из getProjectAccess выше
    if (project) {
      const mapName = rows[0].name || 'карта';
      const projName = project.name || 'проект';
      const members = project.members || [];
      // Включаем владельца (owner_email) и участников, исключая редактора и viewer
      const recipientEmails = [
        project.owner_email,
        ...members.filter(m => m.role !== 'viewer').map(m => m.email),
      ].filter((e, i, arr) => e && e !== req.user.email && arr.indexOf(e) === i);

      for (const email of recipientEmails) {
        createNotification(email, {
          type: 'info',
          title: `Карта обновлена`,
          body: `${req.user.name || req.user.email} обновил карту «${mapName}» в проекте «${projName}»`,
          link: `/?open=map&projectId=${req.params.projectId}&mapId=${req.params.mapId}`,
        }).catch(() => {});
      }
    }

    res.json({ map: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:projectId/maps/:mapId
router.delete('/:projectId/maps/:mapId', requireAuth, async (req, res, next) => {
  try {
    const { project, role } = await getProjectAccess(req.params.projectId, req.user.email);
    if (!project) return res.status(404).json({ error: 'Проект не найден' });
    if (!role || role === 'viewer') return res.status(403).json({ error: 'Нет прав для удаления' });

    const { rows } = await pool.query(
      'DELETE FROM maps WHERE id = $1 AND project_id = $2 RETURNING id',
      [req.params.mapId, req.params.projectId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Карта не найдена' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
