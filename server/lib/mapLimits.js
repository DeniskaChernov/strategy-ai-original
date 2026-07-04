const { pool } = require('../db');
const { TIERS } = require('../routes/tiers');

/**
 * ID карт пользователя, превышающих лимит тарифа (read-only после downgrade).
 * Сохраняем самые старые карты в пределах лимита; остальные — только чтение.
 */
async function getOverLimitMapIds(userEmail, tier) {
  const tierCfg = TIERS[tier || 'free'] || TIERS.free;
  const mapsLimit = tierCfg.maps >= 999999 ? Infinity : tierCfg.maps;
  if (!Number.isFinite(mapsLimit)) return new Set();

  const { rows } = await pool.query(
    `SELECT m.id FROM maps m
     JOIN projects p ON m.project_id = p.id
     WHERE m.is_scenario = false
       AND (p.owner_email = $1 OR p.members @> $2::jsonb)
     ORDER BY m.created_at ASC`,
    [userEmail, JSON.stringify([{ email: userEmail }])]
  );

  const over = new Set();
  rows.forEach((r, i) => {
    if (i >= mapsLimit) over.add(r.id);
  });
  return over;
}

async function isMapOverLimit(userEmail, tier, mapId) {
  const over = await getOverLimitMapIds(userEmail, tier);
  return over.has(mapId);
}

module.exports = { getOverLimitMapIds, isMapOverLimit };
