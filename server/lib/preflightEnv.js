/** @param {Record<string, unknown>} env */
function validateProductionEnv(env) {
  const isProd = env.NODE_ENV === "production";
  const DEFAULT_JWT = "strategy-ai-secret-change-in-production";
  const hard = [];
  const soft = [];

  if (!env.DATABASE_URL) hard.push("DATABASE_URL");
  if (isProd) {
    if (!env.JWT_SECRET || env.JWT_SECRET === DEFAULT_JWT) hard.push("JWT_SECRET");
    if (!env.JWT_REFRESH_SECRET) hard.push("JWT_REFRESH_SECRET");
    if (!env.ALLOWED_ORIGINS) hard.push("ALLOWED_ORIGINS");
    if (!env.APP_URL) soft.push("APP_URL (нужно для Stripe redirect)");
    if (!env.PUBLIC_SITE_URL) soft.push("PUBLIC_SITE_URL (SEO canonical; без него — дефолт strategyai.ru)");
    if (!env.OPENAI_KEY) soft.push("OPENAI_KEY (AI не будет работать)");
    if (!env.STRIPE_SECRET_KEY) soft.push("STRIPE_SECRET_KEY (платежи отдадут 503)");
    if (!env.STRIPE_WEBHOOK_SECRET) soft.push("STRIPE_WEBHOOK_SECRET (webhook не пройдёт подпись)");
    if (!env.RESEND_API_KEY) soft.push("RESEND_API_KEY (письма не уйдут)");
    if (!env.SENTRY_DSN) soft.push("SENTRY_DSN (мониторинг ошибок выключен)");
    if (env.DEV_EMAIL || env.DEV_PASSWORD) {
      soft.push("DEV_EMAIL/DEV_PASSWORD заданы в production — seed отключён, но лучше убрать");
    }
    if (env.DEV_EMAILS) {
      soft.push("DEV_EMAILS задан в production — мгновенная смена тарифа без оплаты будет доступна этим email");
    }
  }

  return { hard, soft, ok: hard.length === 0 };
}

module.exports = { validateProductionEnv };
