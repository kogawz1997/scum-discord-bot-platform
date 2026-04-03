'use strict';

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePublicServerSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parsePublicServerPagePath(pathname) {
  const match = String(pathname || '').match(/^\/s\/([^/]+?)(?:\/(stats|shop|events|donate))?\/?$/);
  if (!match) return null;
  return {
    slug: normalizePublicServerSlug(decodeURIComponent(match[1] || '')),
    section: String(match[2] || 'workspace').trim().toLowerCase() || 'workspace',
  };
}

const PUBLIC_SERVER_PAGE_COPY = Object.freeze({
  en: {
    pageTitlePrefix: 'SCUM Community',
    navAriaLabel: 'Public server sections',
    nav: {
      workspace: 'Overview',
      stats: 'Stats',
      shop: 'Shop',
      events: 'Events',
      donate: 'Donate',
    },
    topbar: {
      language: 'Language',
      packages: 'Platform packages',
      playerPortal: 'Player Portal',
    },
    loadingBrandTitle: 'Loading server workspace',
    loadingBrandDetail: 'Preparing public server data for {slug}',
    heroKicker: 'Public server workspace',
    heroLoadingTitle: 'Loading community details',
    heroLoadingCopy:
      'We are loading stats, shop items, events, and supporter info for this server.',
    heroReadyTitle: '{name} public workspace',
    heroReadyCopy:
      'Track stats, browse shop items, see events, and check supporter activity from one public server page.',
    liveSummaryKicker: 'Live public summary',
    liveSummaryTitle: 'Community snapshot',
    currentSectionKicker: 'Current section',
    loadingSectionTitle: 'Loading',
    quickLinksKicker: 'Quick links',
    quickLinksTitle: 'Navigate this server',
    workspaceApi: 'Workspace API',
    currentApi: 'Current API',
    platformHome: 'Platform home',
    defaultBrandTitle: 'SCUM Community',
    defaultBrandDetail: 'Public server workspace',
    statusUnknown: 'unknown',
    serverStatusLine: 'Status: {status}',
    kpis: {
      servers: 'Servers',
      playersTracked: 'Players tracked',
      shopItems: 'Shop items',
      events: 'Events',
    },
    sections: {
      stats: {
        kicker: 'Stats',
        title: 'Top players and recent kills',
        empty: 'No player stats are available yet.',
        line: 'Kills: {kills} | KD: {kd}',
      },
      shop: {
        kicker: 'Shop',
        title: 'Available shop items',
        empty: 'No public shop items are available yet.',
        descFallback: 'Shop item',
      },
      events: {
        kicker: 'Events',
        title: 'Upcoming and live events',
        empty: 'No public events are scheduled yet.',
        line: '{time} | {status}',
        timeTbd: 'Time TBD',
        defaultStatus: 'scheduled',
      },
      donate: {
        kicker: 'Donate',
        title: 'Supporter packages and recent activity',
        empty: 'No supporter packages are available yet.',
        line: 'Orders: {orders} | Revenue: {revenue}',
      },
      workspace: {
        kicker: 'Overview',
        title: 'Public workspace summary',
        eventsEmpty: 'No public events yet.',
        shopEmpty: 'No public shop items yet.',
        itemKindFallback: 'shop item',
      },
    },
    errors: {
      workspaceUnavailable: 'Public server workspace is unavailable right now.',
      unableToLoad: 'Unable to load this server',
    },
  },
  th: {
    pageTitlePrefix: 'ชุมชน SCUM',
    navAriaLabel: 'เมนูหน้าสาธารณะของเซิร์ฟเวอร์',
    nav: {
      workspace: 'ภาพรวม',
      stats: 'สถิติ',
      shop: 'ร้านค้า',
      events: 'กิจกรรม',
      donate: 'สนับสนุน',
    },
    topbar: {
      language: 'ภาษา',
      packages: 'แพ็กเกจแพลตฟอร์ม',
      playerPortal: 'พอร์ทัลผู้เล่น',
    },
    loadingBrandTitle: 'กำลังโหลดหน้าสาธารณะของเซิร์ฟเวอร์',
    loadingBrandDetail: 'กำลังเตรียมข้อมูลสาธารณะสำหรับ {slug}',
    heroKicker: 'พื้นที่สาธารณะของเซิร์ฟเวอร์',
    heroLoadingTitle: 'กำลังโหลดรายละเอียดชุมชน',
    heroLoadingCopy:
      'เรากำลังโหลดสถิติ ร้านค้า กิจกรรม และข้อมูลผู้สนับสนุนของเซิร์ฟเวอร์นี้',
    heroReadyTitle: 'ศูนย์ข้อมูลสาธารณะของ {name}',
    heroReadyCopy:
      'ดูสถิติ ตรวจร้านค้า ติดตามกิจกรรม และเช็กการสนับสนุนของชุมชนได้จากหน้าเดียว',
    liveSummaryKicker: 'สรุปสาธารณะแบบสด',
    liveSummaryTitle: 'ภาพรวมชุมชน',
    currentSectionKicker: 'ส่วนที่กำลังดู',
    loadingSectionTitle: 'กำลังโหลด',
    quickLinksKicker: 'ลิงก์ด่วน',
    quickLinksTitle: 'ไปยังส่วนต่าง ๆ ของเซิร์ฟเวอร์',
    workspaceApi: 'API ภาพรวม',
    currentApi: 'API ของหน้านี้',
    platformHome: 'หน้าแรกแพลตฟอร์ม',
    defaultBrandTitle: 'ชุมชน SCUM',
    defaultBrandDetail: 'พื้นที่สาธารณะของเซิร์ฟเวอร์',
    statusUnknown: 'ไม่ทราบสถานะ',
    serverStatusLine: 'สถานะ: {status}',
    kpis: {
      servers: 'จำนวนเซิร์ฟเวอร์',
      playersTracked: 'ผู้เล่นที่ติดตาม',
      shopItems: 'สินค้าในร้าน',
      events: 'กิจกรรม',
    },
    sections: {
      stats: {
        kicker: 'สถิติ',
        title: 'ผู้เล่นเด่นและคิลล่าสุด',
        empty: 'ยังไม่มีข้อมูลสถิติผู้เล่น',
        line: 'คิล: {kills} | KD: {kd}',
      },
      shop: {
        kicker: 'ร้านค้า',
        title: 'สินค้าที่เปิดให้ดูสาธารณะ',
        empty: 'ยังไม่มีสินค้าสาธารณะในตอนนี้',
        descFallback: 'สินค้าในร้าน',
      },
      events: {
        kicker: 'กิจกรรม',
        title: 'กิจกรรมที่กำลังจะมาและกำลังเปิดอยู่',
        empty: 'ยังไม่มีกิจกรรมที่เปิดให้ดูสาธารณะ',
        line: '{time} | {status}',
        timeTbd: 'รอระบุเวลา',
        defaultStatus: 'scheduled',
      },
      donate: {
        kicker: 'สนับสนุน',
        title: 'แพ็กเกจสนับสนุนและกิจกรรมล่าสุด',
        empty: 'ยังไม่มีแพ็กเกจสนับสนุนที่เปิดให้ดู',
        line: 'ออเดอร์: {orders} | รายได้: {revenue}',
      },
      workspace: {
        kicker: 'ภาพรวม',
        title: 'สรุปหน้าสาธารณะของเซิร์ฟเวอร์',
        eventsEmpty: 'ยังไม่มีกิจกรรมสาธารณะ',
        shopEmpty: 'ยังไม่มีสินค้าสาธารณะ',
        itemKindFallback: 'สินค้าในร้าน',
      },
    },
    errors: {
      workspaceUnavailable: 'หน้าสาธารณะของเซิร์ฟเวอร์ไม่พร้อมใช้งานในขณะนี้',
      unableToLoad: 'ไม่สามารถโหลดข้อมูลเซิร์ฟเวอร์นี้ได้',
    },
  },
});

function normalizePortalLocale(value, fallback = 'th') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized.startsWith('th')) return 'th';
  if (normalized.startsWith('en')) return 'en';
  return fallback;
}

function resolvePortalLocale(req, urlObj, fallback = 'th') {
  const queryLocale = normalizePortalLocale(
    urlObj?.searchParams?.get('lang') || urlObj?.searchParams?.get('locale'),
    '',
  );
  if (queryLocale) return queryLocale;
  const acceptLanguage = String(req?.headers?.['accept-language'] || '');
  const preferred = acceptLanguage
    .split(',')
    .map((entry) => normalizePortalLocale(String(entry || '').split(';')[0], ''))
    .find(Boolean);
  return preferred || fallback;
}

function formatPublicServerText(template, params = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) return '';
    const value = params[key];
    return value == null ? '' : String(value);
  });
}

function buildPublicServerPageHtml({ slug, section, locale }) {
  const safeSlug = escapeHtml(slug);
  const safeSection = escapeHtml(section);
  const normalizedLocale = normalizePortalLocale(locale, 'th');
  const copy = PUBLIC_SERVER_PAGE_COPY[normalizedLocale] || PUBLIC_SERVER_PAGE_COPY.th;
  const localeParam = `lang=${encodeURIComponent(normalizedLocale)}`;
  const withLocale = (pathname) => `${pathname}${pathname.includes('?') ? '&' : '?'}${localeParam}`;
  const currentPagePath = section === 'workspace' ? `/s/${slug}` : `/s/${slug}/${section}`;
  const workspaceUrl = `/api/public/server/${encodeURIComponent(slug)}/workspace`;
  const sectionUrl = `/api/public/server/${encodeURIComponent(slug)}/${encodeURIComponent(section)}`;

  return `<!doctype html>
<html lang="${escapeHtml(normalizedLocale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(copy.pageTitlePrefix)} | ${safeSlug}</title>
  <link rel="stylesheet" href="/player/assets/ui/platform-site-v3.css?v=20260327-live-1">
</head>
<body class="public-v3" data-public-server-slug="${safeSlug}" data-public-server-section="${safeSection}">
  <div class="site-shell">
    <header class="site-topbar">
      <div class="site-topbar-main">
        <a class="site-brand" href="${escapeHtml(withLocale(`/s/${slug}`))}">
          <span class="site-brand-mark" id="public-server-brand-mark">SCUM</span>
          <span class="site-brand-copy">
            <strong class="site-brand-title" id="public-server-title">${escapeHtml(copy.loadingBrandTitle)}</strong>
            <span class="site-brand-detail" id="public-server-detail">${escapeHtml(formatPublicServerText(copy.loadingBrandDetail, { slug }))}</span>
          </span>
        </a>
        <nav class="site-nav" aria-label="${escapeHtml(copy.navAriaLabel)}">
          <a class="site-nav-link${section === 'workspace' ? ' is-active' : ''}" href="${escapeHtml(withLocale(`/s/${slug}`))}">${escapeHtml(copy.nav.workspace)}</a>
          <a class="site-nav-link${section === 'stats' ? ' is-active' : ''}" href="${escapeHtml(withLocale(`/s/${slug}/stats`))}">${escapeHtml(copy.nav.stats)}</a>
          <a class="site-nav-link${section === 'shop' ? ' is-active' : ''}" href="${escapeHtml(withLocale(`/s/${slug}/shop`))}">${escapeHtml(copy.nav.shop)}</a>
          <a class="site-nav-link${section === 'events' ? ' is-active' : ''}" href="${escapeHtml(withLocale(`/s/${slug}/events`))}">${escapeHtml(copy.nav.events)}</a>
          <a class="site-nav-link${section === 'donate' ? ' is-active' : ''}" href="${escapeHtml(withLocale(`/s/${slug}/donate`))}">${escapeHtml(copy.nav.donate)}</a>
        </nav>
      </div>
      <div class="site-topbar-tools">
        <div class="site-tool-cluster" aria-label="${escapeHtml(copy.topbar.language)}">
          <a class="site-button${normalizedLocale === 'th' ? ' site-button-primary' : ''}" href="${escapeHtml(`${currentPagePath}?lang=th`)}">TH</a>
          <a class="site-button${normalizedLocale === 'en' ? ' site-button-primary' : ''}" href="${escapeHtml(`${currentPagePath}?lang=en`)}">EN</a>
        </div>
        <a class="site-button" href="${escapeHtml(withLocale('/pricing'))}">${escapeHtml(copy.topbar.packages)}</a>
        <a class="site-button site-button-primary" href="${escapeHtml(withLocale('/player/login'))}">${escapeHtml(copy.topbar.playerPortal)}</a>
      </div>
    </header>

    <main class="site-main">
      <section class="site-hero">
        <div class="site-hero-copy">
          <span class="site-kicker" id="public-server-kicker">${escapeHtml(copy.heroKicker)}</span>
          <h1 class="site-hero-title" id="public-server-hero">${escapeHtml(copy.heroLoadingTitle)}</h1>
          <p class="site-copy" id="public-server-copy">${escapeHtml(copy.heroLoadingCopy)}</p>
          <div class="site-tool-cluster" id="public-server-links">
            <a class="site-button" href="${escapeHtml(withLocale(`/s/${slug}`))}">${escapeHtml(copy.nav.workspace)}</a>
            <a class="site-button" href="${escapeHtml(withLocale(`/s/${slug}/stats`))}">${escapeHtml(copy.nav.stats)}</a>
            <a class="site-button" href="${escapeHtml(withLocale(`/s/${slug}/shop`))}">${escapeHtml(copy.nav.shop)}</a>
            <a class="site-button" href="${escapeHtml(withLocale(`/s/${slug}/events`))}">${escapeHtml(copy.nav.events)}</a>
            <a class="site-button" href="${escapeHtml(withLocale(`/s/${slug}/donate`))}">${escapeHtml(copy.nav.donate)}</a>
          </div>
        </div>
        <div class="site-hero-media">
          <div class="site-hero-shot" id="public-server-banner"></div>
          <article class="site-scene-card">
            <span class="site-kicker">${escapeHtml(copy.liveSummaryKicker)}</span>
            <h2 class="site-card-title">${escapeHtml(copy.liveSummaryTitle)}</h2>
            <div class="site-grid-2" id="public-server-kpis"></div>
          </article>
        </div>
      </section>

      <section class="site-grid-2">
        <article class="site-panel">
          <span class="site-kicker" id="public-server-section-kicker">${escapeHtml(copy.currentSectionKicker)}</span>
          <h2 class="site-card-title" id="public-server-section-title">${escapeHtml(copy.loadingSectionTitle)}</h2>
          <div id="public-server-section-content"></div>
        </article>
        <article class="site-panel">
          <span class="site-kicker">${escapeHtml(copy.quickLinksKicker)}</span>
          <h2 class="site-card-title">${escapeHtml(copy.quickLinksTitle)}</h2>
          <div class="site-tool-cluster">
            <a class="site-button" href="${escapeHtml(workspaceUrl)}">${escapeHtml(copy.workspaceApi)}</a>
            <a class="site-button" href="${escapeHtml(sectionUrl)}">${escapeHtml(copy.currentApi)}</a>
            <a class="site-button" href="${escapeHtml(withLocale('/landing'))}">${escapeHtml(copy.platformHome)}</a>
          </div>
          <div id="public-server-side-panel"></div>
        </article>
      </section>
    </main>
  </div>
  <script>
    (() => {
      const workspaceUrl = ${JSON.stringify(workspaceUrl)};
      const section = ${JSON.stringify(section)};
      const copy = ${JSON.stringify(copy)};
      const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      const formatText = (template, params = {}) => String(template || '').replace(/\\{(\\w+)\\}/g, (match, key) => {
        if (!Object.prototype.hasOwnProperty.call(params, key)) return '';
        const value = params[key];
        return value == null ? '' : String(value);
      });
      const setTheme = (brand) => {
        const tokens = brand && brand.themeTokens ? brand.themeTokens : null;
        if (!tokens) return;
        const root = document.documentElement;
        if (tokens.primary) root.style.setProperty('--site-accent', tokens.primary);
        if (tokens.accent) root.style.setProperty('--site-accent-strong', tokens.accent);
        if (tokens.surface) root.style.setProperty('--site-surface-strong', tokens.surface);
        if (tokens.text) root.style.setProperty('--site-text', tokens.text);
      };
      const renderList = (items, renderItem, emptyText) => {
        if (!Array.isArray(items) || items.length === 0) {
          return '<p class="site-copy">' + escapeHtml(emptyText) + '</p>';
        }
        return '<div class="site-stack">' + items.map(renderItem).join('') + '</div>';
      };
      const renderSection = (data) => {
        const titleEl = document.getElementById('public-server-title');
        const detailEl = document.getElementById('public-server-detail');
        const brandMarkEl = document.getElementById('public-server-brand-mark');
        const bannerEl = document.getElementById('public-server-banner');
        const heroEl = document.getElementById('public-server-hero');
        const copyEl = document.getElementById('public-server-copy');
        const kpisEl = document.getElementById('public-server-kpis');
        const sectionKickerEl = document.getElementById('public-server-section-kicker');
        const sectionTitleEl = document.getElementById('public-server-section-title');
        const sectionContentEl = document.getElementById('public-server-section-content');
        const sidePanelEl = document.getElementById('public-server-side-panel');
        const brand = data.brand || {};
        const overview = data.overview || {};
        const resolvedName = brand.siteName || data.tenant?.name || copy.defaultBrandTitle;
        titleEl.textContent = resolvedName;
        detailEl.textContent = brand.siteDetail || copy.defaultBrandDetail;
        if (brandMarkEl) {
          if (brand.logoUrl) {
            brandMarkEl.innerHTML = '<img src="' + escapeHtml(brand.logoUrl) + '" alt="' + escapeHtml(resolvedName) + '" style="width:100%;height:100%;object-fit:contain;border-radius:10px;">';
          } else {
            brandMarkEl.textContent = brand.brandMark || 'SCUM';
          }
        }
        if (bannerEl && brand.bannerUrl) {
          bannerEl.style.backgroundImage = 'linear-gradient(180deg, rgba(7, 10, 8, 0.18), rgba(8, 10, 8, 0.54)), url("' + String(brand.bannerUrl).replace(/"/g, '\\"') + '")';
        }
        heroEl.textContent = formatText(copy.heroReadyTitle, { name: resolvedName });
        copyEl.textContent = copy.heroReadyCopy;
        kpisEl.innerHTML = [
          [copy.kpis.servers, overview.serverCount ?? 0],
          [copy.kpis.playersTracked, overview.playersTracked ?? 0],
          [copy.kpis.shopItems, overview.shopItemCount ?? 0],
          [copy.kpis.events, overview.eventCount ?? 0],
        ].map(([label, value]) => '<div class="site-panel"><strong class="site-card-title">' + escapeHtml(value) + '</strong><p class="site-copy">' + escapeHtml(label) + '</p></div>').join('');
        sidePanelEl.innerHTML = renderList(
          data.servers || [],
          (server) => '<div class="site-panel"><strong>' + escapeHtml(server.name || copy.defaultBrandTitle) + '</strong><p class="site-copy">' + escapeHtml(formatText(copy.serverStatusLine, { status: server.status || copy.statusUnknown })) + '</p></div>',
          copy.sidePanelEmpty
        );
        setTheme(brand);

        if (section === 'stats') {
          sectionKickerEl.textContent = copy.sections.stats.kicker;
          sectionTitleEl.textContent = copy.sections.stats.title;
          sectionContentEl.innerHTML = renderList(
            (data.stats && data.stats.topPlayers) || [],
            (player) => '<div class="site-panel"><strong>' + escapeHtml(player.userId) + '</strong><p class="site-copy">' + escapeHtml(formatText(copy.sections.stats.line, { kills: player.kills, kd: player.kd })) + '</p></div>',
            copy.sections.stats.empty
          );
          return;
        }
        if (section === 'shop') {
          sectionKickerEl.textContent = copy.sections.shop.kicker;
          sectionTitleEl.textContent = copy.sections.shop.title;
          sectionContentEl.innerHTML = renderList(
            (data.shop && data.shop.items) || [],
            (item) => '<div class="site-panel"><strong>' + escapeHtml(item.name || item.id || 'Item') + '</strong><p class="site-copy">' + escapeHtml(item.description || item.kind || copy.sections.shop.descFallback) + '</p></div>',
            copy.sections.shop.empty
          );
          return;
        }
        if (section === 'events') {
          sectionKickerEl.textContent = copy.sections.events.kicker;
          sectionTitleEl.textContent = copy.sections.events.title;
          sectionContentEl.innerHTML = renderList(
            (data.events && data.events.items) || [],
            (event) => '<div class="site-panel"><strong>' + escapeHtml(event.name || 'Event') + '</strong><p class="site-copy">' + escapeHtml(formatText(copy.sections.events.line, { time: event.time || copy.sections.events.timeTbd, status: event.status || copy.sections.events.defaultStatus })) + '</p></div>',
            copy.sections.events.empty
          );
          return;
        }
        if (section === 'donate') {
          sectionKickerEl.textContent = copy.sections.donate.kicker;
          sectionTitleEl.textContent = copy.sections.donate.title;
          sectionContentEl.innerHTML = renderList(
            (data.donate && data.donate.topPackages) || [],
            (entry) => '<div class="site-panel"><strong>' + escapeHtml(entry.itemName || entry.name || 'Supporter package') + '</strong><p class="site-copy">' + escapeHtml(formatText(copy.sections.donate.line, { orders: entry.ordersCount || 0, revenue: entry.revenueCoins || 0 })) + '</p></div>',
            copy.sections.donate.empty
          );
          return;
        }

        sectionKickerEl.textContent = copy.sections.workspace.kicker;
        sectionTitleEl.textContent = copy.sections.workspace.title;
        sectionContentEl.innerHTML = [
          renderList(
            (data.events && data.events.items) || [],
            (event) => '<div class="site-panel"><strong>' + escapeHtml(event.name || 'Event') + '</strong><p class="site-copy">' + escapeHtml(event.time || copy.sections.events.timeTbd) + '</p></div>',
            copy.sections.workspace.eventsEmpty
          ),
          renderList(
            (data.shop && data.shop.items) || [],
            (item) => '<div class="site-panel"><strong>' + escapeHtml(item.name || item.id || 'Item') + '</strong><p class="site-copy">' + escapeHtml(item.kind || copy.sections.workspace.itemKindFallback) + '</p></div>',
            copy.sections.workspace.shopEmpty
          ),
        ].join('');
      };
      fetch(workspaceUrl, { headers: { Accept: 'application/json' } })
        .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
        .then(({ ok, body }) => {
          if (!ok || !body || !body.ok || !body.data) {
            throw new Error((body && body.error) || 'public-server-load-failed');
          }
          renderSection(body.data);
        })
        .catch((error) => {
          const detail = document.getElementById('public-server-detail');
          const sectionTitle = document.getElementById('public-server-section-title');
          const sectionContent = document.getElementById('public-server-section-content');
          detail.textContent = copy.errors.workspaceUnavailable;
          sectionTitle.textContent = copy.errors.unableToLoad;
          sectionContent.innerHTML = '<p class="site-copy">' + escapeHtml(error && error.message ? error.message : 'public-server-load-failed') + '</p>';
        });
    })();
  </script>
</body>
</html>`;
}

function createPortalPageRoutes(deps) {
  const {
    allowCaptureAuth,
    captureAuthToken,
    createCaptureSession,
    buildSessionCookie,
    tryServePortalStaticAsset,
    tryServeStaticScumIcon,
    buildAdminProductUrl,
    buildLegacyAdminUrl,
    getCanonicalRedirectUrl,
    readJsonBody,
    sendJson,
    sendHtml,
    sendFavicon,
    buildHealthPayload,
    tryServePublicDoc,
    getLandingHtml,
    getDashboardHtml,
    getPricingHtml,
    getSignupHtml,
    getForgotPasswordHtml,
    getVerifyEmailHtml,
    getCheckoutHtml,
    getPaymentResultHtml,
    getPreviewHtml,
    getShowcaseHtml,
    getTrialHtml,
    getPlayerHtml,
    getLegacyPlayerHtml,
    getPlatformPublicOverview,
    isDiscordStartPath,
    isDiscordCallbackPath,
    handleDiscordStart,
    handleDiscordCallback,
    getSession,
    getPreviewSession,
    getAuthLoginHtml,
    renderPlayerLoginPage,
  } = deps;
  const servePortalStaticAsset = typeof tryServePortalStaticAsset === 'function'
    ? tryServePortalStaticAsset
    : async () => false;
  const serveLegacyPlayerHtml = typeof getLegacyPlayerHtml === 'function'
    ? getLegacyPlayerHtml
    : getPlayerHtml;
  const readBody = typeof readJsonBody === 'function'
    ? readJsonBody
    : async () => ({});

  return async function handlePortalPageRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
      method,
    } = context;

    if (await servePortalStaticAsset(req, res, pathname)) {
      return true;
    }

    if (await tryServeStaticScumIcon(req, res, pathname)) {
      return true;
    }

    if (pathname.startsWith('/admin')) {
      const target = buildLegacyAdminUrl(pathname, urlObj.search);
      if (!target) {
        sendJson(res, 503, {
          ok: false,
          error: 'Legacy admin URL is invalid',
        });
        return true;
      }
      sendRedirect(res, target);
      return true;
    }

    const canonicalRedirectUrl = getCanonicalRedirectUrl(req);
    if (canonicalRedirectUrl && (method === 'GET' || method === 'HEAD')) {
      sendRedirect(res, canonicalRedirectUrl);
      return true;
    }

    if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
      sendFavicon(res);
      return true;
    }

    if (allowCaptureAuth && pathname === '/player/capture-auth' && method === 'POST') {
      const body = await readBody(req);
      const token = String(body?.token || '').trim();
      if (!token || token !== String(captureAuthToken || '').trim()) {
        sendJson(res, 403, {
          ok: false,
          error: 'Capture auth token is invalid',
        });
        return true;
      }
      const sessionId = createCaptureSession();
      res.writeHead(302, {
        Location: '/player',
        'Set-Cookie': buildSessionCookie(sessionId, req),
      });
      res.end();
      return true;
    }

    if (pathname === '/healthz' && method === 'GET') {
      sendJson(res, 200, buildHealthPayload());
      return true;
    }

    if (method === 'GET' && tryServePublicDoc(pathname, res)) {
      return true;
    }

    const publicServerPage = parsePublicServerPagePath(pathname);
    if (publicServerPage && method === 'GET') {
      sendHtml(res, 200, buildPublicServerPageHtml({
        ...publicServerPage,
        locale: resolvePortalLocale(req, urlObj, 'th'),
      }));
      return true;
    }

    if (pathname === '/') {
      sendRedirect(res, '/landing');
      return true;
    }

    if (pathname === '/showcase/' && method === 'GET') {
      sendRedirect(res, '/showcase');
      return true;
    }

    if (pathname === '/landing/' && method === 'GET') {
      sendRedirect(res, '/landing');
      return true;
    }

    if (pathname === '/landing' && method === 'GET') {
      sendHtml(res, 200, getLandingHtml());
      return true;
    }

    if (pathname === '/dashboard/' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/dashboard' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/pricing/' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/pricing' && method === 'GET') {
      sendHtml(res, 200, getPricingHtml());
      return true;
    }

    if (pathname === '/signup/' && method === 'GET') {
      sendRedirect(res, '/signup');
      return true;
    }

    if (pathname === '/signup' && method === 'GET') {
      sendHtml(res, 200, getSignupHtml());
      return true;
    }

    if (pathname === '/forgot-password/' && method === 'GET') {
      sendRedirect(res, '/forgot-password');
      return true;
    }

    if (pathname === '/forgot-password' && method === 'GET') {
      sendHtml(res, 200, getForgotPasswordHtml());
      return true;
    }

    if (pathname === '/verify-email/' && method === 'GET') {
      sendRedirect(res, '/verify-email');
      return true;
    }

    if (pathname === '/verify-email' && method === 'GET') {
      sendHtml(res, 200, getVerifyEmailHtml());
      return true;
    }

    if (pathname === '/checkout/' && method === 'GET') {
      sendRedirect(res, '/checkout');
      return true;
    }

    if (pathname === '/checkout' && method === 'GET') {
      sendHtml(res, 200, getCheckoutHtml());
      return true;
    }

    if (pathname === '/payment-result/' && method === 'GET') {
      sendRedirect(res, '/payment-result');
      return true;
    }

    if (pathname === '/payment-result' && method === 'GET') {
      sendHtml(res, 200, getPaymentResultHtml());
      return true;
    }

    if (pathname === '/preview/' && method === 'GET') {
      const target = typeof buildAdminProductUrl === 'function'
        ? buildAdminProductUrl('/tenant/onboarding')
        : '/tenant/onboarding';
      sendRedirect(res, target);
      return true;
    }

    if (pathname === '/preview' && method === 'GET') {
      const target = typeof buildAdminProductUrl === 'function'
        ? buildAdminProductUrl('/tenant/onboarding')
        : '/tenant/onboarding';
      sendRedirect(res, target);
      return true;
    }

    if (pathname === '/showcase' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/trial/' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/trial' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/api/platform/public/overview' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        data: await getPlatformPublicOverview(),
      });
      return true;
    }

    if (pathname === '/player/') {
      sendRedirect(res, '/player');
      return true;
    }

    if (pathname === '/player/legacy/' && method === 'GET') {
      sendRedirect(res, '/player/legacy');
      return true;
    }

    if (pathname === '/player/login/') {
      sendRedirect(res, '/player/login');
      return true;
    }

    if (isDiscordStartPath(pathname) && method === 'GET') {
      await handleDiscordStart(req, res);
      return true;
    }

    if (isDiscordCallbackPath(pathname) && method === 'GET') {
      await handleDiscordCallback(req, res, urlObj);
      return true;
    }

    if (pathname === '/login' && method === 'GET') {
      sendHtml(res, 200, getAuthLoginHtml());
      return true;
    }

    if (pathname === '/player/login' && method === 'GET') {
      const session = getSession(req);
      if (session) {
        sendRedirect(res, '/player');
        return true;
      }
      sendHtml(
        res,
        200,
        renderPlayerLoginPage(String(urlObj.searchParams.get('error') || '')),
      );
      return true;
    }

    if (
      (pathname === '/player' || pathname.startsWith('/player/'))
      && pathname !== '/player/login'
      && pathname !== '/player/legacy'
      && !pathname.startsWith('/player/api/')
      && method === 'GET'
    ) {
      const session = getSession(req);
      if (!session) {
        sendRedirect(res, '/player/login');
        return true;
      }
      sendHtml(res, 200, getPlayerHtml());
      return true;
    }

    if (pathname === '/player/legacy' && method === 'GET') {
      const session = getSession(req);
      if (!session) {
        sendRedirect(res, '/player/login');
        return true;
      }
      sendHtml(res, 200, serveLegacyPlayerHtml());
      return true;
    }

    return false;
  };
}

module.exports = {
  createPortalPageRoutes,
};
