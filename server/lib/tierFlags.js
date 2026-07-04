const sharedTiers = require('../../shared/tiers.json');

/** Тарифы с доступом к контент-плану (из shared/tiers.json + правила продукта). */
const CONTENT_PLAN_TIERS = new Set(
  Object.keys(sharedTiers).filter((k) => ['pro', 'team', 'enterprise'].includes(k))
);

function tierHasContentPlan(tier) {
  return CONTENT_PLAN_TIERS.has(tier || 'free');
}

module.exports = { CONTENT_PLAN_TIERS, tierHasContentPlan };
