// Per-route SEO: подставляет в index.html уникальные <title>,
// <meta description>, OG/Twitter-теги, <link rel="canonical">,
// hreflang-альтернативы и JSON-LD для каждой публичной страницы.
//
// Работает как лёгкий SSR-заголовок поверх одного общего index.html:
// тело документа остаётся единым React-приложением, но шапка документа
// формируется на сервере — именно её в первую очередь смотрят краулеры.
const fs = require('fs');
const path = require('path');
const { bodyFor } = require('./seo-body');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');

const DEFAULT_SITE = (process.env.PUBLIC_SITE_URL || 'https://www.strategy-ai.uz').replace(/\/+$/, '');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function routeFor(pathname) {
  const p = (pathname || '/').trim().replace(/\/+$/, '') || '/';
  if (p === '/') return 'home';
  if (p === '/privacy') return 'privacy';
  if (p === '/terms') return 'terms';
  if (p === '/404') return 'notFound';
  if (p === '/app' || p.startsWith('/app/')) return 'app';
  return 'notFound';
}

function metaFor(route) {
  switch (route) {
    case 'privacy':
      return {
        path: '/privacy',
        title: 'Политика конфиденциальности — Strategy AI',
        description: 'Как Strategy AI обрабатывает персональные данные, cookies и платежи. Права пользователей, срок хранения и контакты.',
        robots: 'index,follow',
      };
    case 'terms':
      return {
        path: '/terms',
        title: 'Условия использования — Strategy AI',
        description: 'Условия использования сервиса Strategy AI: лицензия, оплата тарифов, возврат средств, ответственность сторон.',
        robots: 'index,follow',
      };
    case 'app':
      return {
        path: '/app',
        title: 'Strategy AI — Рабочее пространство',
        description: 'Карты целей, Gantt-план, AI-советник и симуляция сценариев — личное пространство Strategy AI.',
        robots: 'noindex,follow',
      };
    case 'notFound':
      return {
        path: '/404',
        title: 'Страница не найдена — Strategy AI',
        description: 'Запрошенная страница не существует. Вернитесь на главную или в рабочее пространство Strategy AI.',
        robots: 'noindex,follow',
      };
    case 'home':
    default:
      return {
        path: '/',
        title: 'Strategy AI — Визуальное стратегическое планирование с AI',
        description: 'Карты целей, Gantt-план, AI-советник уровня McKinsey и симуляция сценариев. Для предпринимателей и команд. Русский / English / O‘zbekcha.',
        robots: 'index,follow',
      };
  }
}

function hreflangsFor(route, site) {
  if (route === 'app' || route === 'notFound') return '';
  const url = site + metaFor(route).path;
  return [
    `<link rel="alternate" hreflang="ru" href="${esc(url)}"/>`,
    `<link rel="alternate" hreflang="en" href="${esc(url)}"/>`,
    `<link rel="alternate" hreflang="uz" href="${esc(url)}"/>`,
    `<link rel="alternate" hreflang="x-default" href="${esc(url)}"/>`,
  ].join('\n  ');
}

function jsonLdFor(route, site) {
  const home = site + '/';
  const webApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Strategy AI',
    url: home,
    description: 'Визуальное стратегическое планирование с AI-советником уровня McKinsey',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: ['ru', 'en', 'uz'],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Strategy AI',
    url: home,
    logo: site + '/logo.png',
  };
  if (route === 'home') {
    const website = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Strategy AI',
      url: home,
      inLanguage: ['ru', 'en', 'uz'],
    };
    return [webApp, org, website];
  }
  if (route === 'privacy' || route === 'terms') {
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: home },
        {
          '@type': 'ListItem',
          position: 2,
          name: route === 'privacy' ? 'Политика конфиденциальности' : 'Условия использования',
          item: site + metaFor(route).path,
        },
      ],
    };
    return [org, breadcrumb];
  }
  return [webApp, org];
}

let cachedRaw = null;
function readIndex() {
  if (process.env.NODE_ENV !== 'production' || !cachedRaw) {
    cachedRaw = fs.readFileSync(INDEX_FILE, 'utf8');
  }
  return cachedRaw;
}

function resolveSite(req) {
  const envSite = process.env.PUBLIC_SITE_URL;
  if (envSite && /^https?:\/\//i.test(envSite)) return envSite.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') return DEFAULT_SITE;
  const host = req && req.get && req.get('host');
  const proto = req && req.protocol ? req.protocol : 'https';
  if (host) return `${proto}://${host}`.replace(/\/+$/, '');
  return DEFAULT_SITE;
}

function renderIndex(pathname, req) {
  let html;
  try {
    html = readIndex();
  } catch (_) {
    return null;
  }
  const route = routeFor(pathname);
  const m = metaFor(route);
  const site = resolveSite(req);
  const absUrl = site + m.path;
  const ogImage = site + '/logo.png';

  const titleTag = `<title>${esc(m.title)}</title>`;
  const head = [
    `<meta name="description" content="${esc(m.description)}"/>`,
    `<meta name="robots" content="${esc(m.robots)}"/>`,
    `<link rel="canonical" href="${esc(absUrl)}"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:title" content="${esc(m.title)}"/>`,
    `<meta property="og:description" content="${esc(m.description)}"/>`,
    `<meta property="og:url" content="${esc(absUrl)}"/>`,
    `<meta property="og:image" content="${esc(ogImage)}"/>`,
    `<meta property="og:site_name" content="Strategy AI"/>`,
    `<meta property="og:locale" content="ru_RU"/>`,
    `<meta property="og:locale:alternate" content="en_US"/>`,
    `<meta property="og:locale:alternate" content="uz_UZ"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<meta name="twitter:title" content="${esc(m.title)}"/>`,
    `<meta name="twitter:description" content="${esc(m.description)}"/>`,
    `<meta name="twitter:image" content="${esc(ogImage)}"/>`,
  ].join('\n  ');

  const hreflangs = hreflangsFor(route, site);
  const ldScripts = jsonLdFor(route, site)
    .map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`)
    .join('\n  ');

  const injection = `${titleTag}\n  ${head}\n  ${hreflangs}\n  ${ldScripts}`;

  html = html.replace(
    /<!--\s*SEO:BEGIN\s*-->[\s\S]*?<!--\s*SEO:END\s*-->/,
    `<!-- SEO:BEGIN -->\n  ${injection}\n  <!-- SEO:END -->`
  );

  const body = bodyFor(route);
  html = html.replace(
    /<!--\s*SEO:MAIN:BEGIN\s*-->[\s\S]*?<!--\s*SEO:MAIN:END\s*-->/,
    `<!-- SEO:MAIN:BEGIN -->\n    ${body}\n    <!-- SEO:MAIN:END -->`
  );
  return html;
}

module.exports = { renderIndex, routeFor };
