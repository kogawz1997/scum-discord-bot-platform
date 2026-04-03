'use strict';

const {
  buildTenantPortalBranding,
} = require('../../../src/services/platformPortalBrandingService');

function trimText(value, maxLen = 320) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeEmail(value) {
  return trimText(value, 240).toLowerCase();
}

function getClientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').trim();
  if (forwarded) {
    return trimText(forwarded.split(',')[0], 120) || 'unknown';
  }
  const realIp = String(req?.headers?.['x-real-ip'] || '').trim();
  if (realIp) return trimText(realIp, 120) || 'unknown';
  return trimText(req?.socket?.remoteAddress, 120) || 'unknown';
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function parsePublicServerPath(pathname) {
  const match = String(pathname || '').match(/^\/api\/public\/server\/([^/]+?)(?:\/(workspace|stats|shop|events|donate))?\/?$/);
  if (!match) return null;
  return {
    slug: normalizeSlug(decodeURIComponent(match[1] || '')),
    section: String(match[2] || 'workspace').trim().toLowerCase() || 'workspace',
  };
}

async function readOptional(readFn, fallback) {
  try {
    return await Promise.resolve().then(() => readFn());
  } catch {
    return fallback;
  }
}

function buildPublicBrand(tenant, tenantConfig) {
  return buildTenantPortalBranding({
    tenant,
    tenantConfig,
    surface: 'public',
    fallbackSiteDetail: `Public server hub for ${tenant?.name || tenant?.slug || 'this community'}.`,
  });
}

function buildStatsPayload(rows, killfeed) {
  const statsRows = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      userId: trimText(row?.userId, 120) || null,
      kills: Math.max(0, normalizeInteger(row?.kills, 0)),
      deaths: Math.max(0, normalizeInteger(row?.deaths, 0)),
      playtimeMinutes: Math.max(0, normalizeInteger(row?.playtimeMinutes, 0)),
      squad: trimText(row?.squad, 120) || null,
    }))
    .filter((row) => row.userId);
  const topPlayers = [...statsRows]
    .sort((left, right) => {
      if (right.kills !== left.kills) return right.kills - left.kills;
      if (right.playtimeMinutes !== left.playtimeMinutes) return right.playtimeMinutes - left.playtimeMinutes;
      return String(left.userId).localeCompare(String(right.userId));
    })
    .slice(0, 10)
    .map((row) => ({
      ...row,
      kd: row.deaths > 0 ? Number((row.kills / row.deaths).toFixed(2)) : row.kills,
    }));
  return {
    playersTracked: statsRows.length,
    totalKills: statsRows.reduce((sum, row) => sum + row.kills, 0),
    totalDeaths: statsRows.reduce((sum, row) => sum + row.deaths, 0),
    totalPlaytimeMinutes: statsRows.reduce((sum, row) => sum + row.playtimeMinutes, 0),
    topPlayers,
    killfeed: Array.isArray(killfeed) ? killfeed : [],
  };
}

function buildShopPayload(rows) {
  return {
    total: Array.isArray(rows) ? rows.length : 0,
    items: Array.isArray(rows) ? rows : [],
  };
}

function buildEventsPayload(rows) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: row?.id,
      name: trimText(row?.name, 160) || 'Event',
      time: trimText(row?.time, 160) || null,
      reward: trimText(row?.reward, 160) || null,
      status: trimText(row?.status, 80) || 'scheduled',
    }))
    .slice(0, 12);
  return {
    total: items.length,
    items,
  };
}

/**
 * Public product-site routes for signup, pricing, and pre-auth commercial
 * flows. The public site should hand users into the real Tenant or Player
 * products instead of a fake preview workspace.
 */

function createPublicPlatformRoutes(deps = {}) {
  const {
    sendJson,
    readJsonBody,
    readRawBody,
    getPlatformPublicOverview,
    getPlatformTenantBySlug,
    getPlatformTenantConfig,
    registerTenantOwnerAccount,
    registerPreviewAccount,
    authenticatePreviewAccount,
    getPreviewState,
    requestEmailVerification,
    completeEmailVerification,
    requestPasswordReset,
    completePasswordReset,
    createCheckoutSession,
    getCheckoutSessionByToken,
    finalizeCheckoutSession,
    processBillingWebhookEvent,
    billingWebhookSecret,
    buildAdminProductUrl,
    createPreviewSession,
    getPreviewSession,
    buildPreviewSessionCookie,
    buildClearPreviewSessionCookie,
    removePreviewSession,
    listAllStats,
    listShopItems,
    filterShopItems,
    listServerEvents,
    buildTenantDonationOverview,
    listKillFeedEntries,
    listServerRegistry,
  } = deps;
  const rateLimitState = new Map();

  function consumeRateLimit(action, req, input = {}) {
    const policies = {
      signup: { windowMs: 15 * 60 * 1000, maxByIp: 6, maxByEmail: 3 },
      login: { windowMs: 10 * 60 * 1000, maxByIp: 12, maxByEmail: 8 },
      passwordReset: { windowMs: 15 * 60 * 1000, maxByIp: 6, maxByEmail: 4 },
      emailVerification: { windowMs: 15 * 60 * 1000, maxByIp: 6, maxByEmail: 4 },
    };
    const policy = policies[action];
    if (!policy) return { limited: false, retryAfterSec: 0 };
    const now = Date.now();
    if (rateLimitState.size > 5000) {
      for (const [key, entry] of rateLimitState.entries()) {
        if (!entry || now - Number(entry.firstAt || 0) > policy.windowMs) {
          rateLimitState.delete(key);
        }
      }
    }
    const checks = [
      { key: `${action}:ip:${getClientIp(req)}`, limit: policy.maxByIp },
    ];
    const email = normalizeEmail(input.email);
    if (email) {
      checks.push({ key: `${action}:email:${email}`, limit: policy.maxByEmail });
    }
    let retryAfterMs = 0;
    for (const check of checks) {
      const existing = rateLimitState.get(check.key);
      const expired = !existing || now - Number(existing.firstAt || 0) > policy.windowMs;
      const entry = expired
        ? { count: 1, firstAt: now }
        : { count: Number(existing.count || 0) + 1, firstAt: Number(existing.firstAt || now) };
      rateLimitState.set(check.key, entry);
      if (entry.count > check.limit) {
        retryAfterMs = Math.max(retryAfterMs, Math.max(0, policy.windowMs - (now - entry.firstAt)));
      }
    }
    return {
      limited: retryAfterMs > 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  async function buildPublicServerWorkspace(slug) {
    const normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug || typeof getPlatformTenantBySlug !== 'function') {
      return { ok: false, reason: 'tenant-not-found' };
    }

    const tenant = await getPlatformTenantBySlug(normalizedSlug);
    if (!tenant?.id) {
      return { ok: false, reason: 'tenant-not-found' };
    }

    const tenantId = trimText(tenant.id, 120);
    const [
      tenantConfig,
      serverRegistry,
      statsRows,
      killfeedRows,
      rawShopRows,
      eventRows,
      donationOverview,
    ] = await Promise.all([
      readOptional(
        () => (typeof getPlatformTenantConfig === 'function' ? getPlatformTenantConfig(tenantId) : null),
        null,
      ),
      readOptional(
        () => (typeof listServerRegistry === 'function' ? listServerRegistry({ tenantId }) : []),
        [],
      ),
      readOptional(
        () => (typeof listAllStats === 'function' ? listAllStats({ tenantId }) : []),
        [],
      ),
      readOptional(
        () => (typeof listKillFeedEntries === 'function' ? listKillFeedEntries({ tenantId, limit: 8 }) : []),
        [],
      ),
      readOptional(
        () => (typeof listShopItems === 'function' ? listShopItems({ tenantId, includeDisabled: false }) : []),
        [],
      ),
      readOptional(
        () => (typeof listServerEvents === 'function' ? listServerEvents({ tenantId }) : []),
        [],
      ),
      readOptional(
        () => (
          typeof buildTenantDonationOverview === 'function'
            ? buildTenantDonationOverview({ tenantId, limit: 6 })
            : null
        ),
        null,
      ),
    ]);

    const shopRows = typeof filterShopItems === 'function'
      ? filterShopItems(rawShopRows, { kind: 'all', limit: 12 })
      : (Array.isArray(rawShopRows) ? rawShopRows.slice(0, 12) : []);
    const stats = buildStatsPayload(statsRows, killfeedRows);
    const shop = buildShopPayload(shopRows);
    const events = buildEventsPayload(eventRows);
    const brand = buildPublicBrand(tenant, tenantConfig);
    const servers = (Array.isArray(serverRegistry) ? serverRegistry : [])
      .map((server) => ({
        id: trimText(server?.id, 120) || null,
        name: trimText(server?.name, 160) || 'SCUM Server',
        region: trimText(server?.region, 120) || null,
        status: trimText(server?.status, 80) || 'unknown',
        guildLinks: Array.isArray(server?.guildLinks) ? server.guildLinks.length : 0,
      }))
      .filter((server) => server.id || server.name);
    const primaryServer = servers[0] || null;
    const donationData = donationOverview && typeof donationOverview === 'object'
      ? {
          summary: donationOverview.summary || null,
          readiness: donationOverview.readiness || null,
          issues: Array.isArray(donationOverview.issues) ? donationOverview.issues : [],
          topPackages: Array.isArray(donationOverview.topPackages) ? donationOverview.topPackages.slice(0, 6) : [],
          recentPurchases: Array.isArray(donationOverview.recentPurchases) ? donationOverview.recentPurchases.slice(0, 6) : [],
        }
      : {
          summary: null,
          readiness: null,
          issues: [],
          topPackages: [],
          recentPurchases: [],
        };

    return {
      ok: true,
      tenant: {
        id: tenantId,
        slug: trimText(tenant.slug, 160) || normalizedSlug,
        name: trimText(tenant.name, 160) || trimText(tenant.slug, 160) || 'SCUM Community',
      },
      brand,
      links: {
        workspace: `/s/${normalizedSlug}`,
        stats: `/s/${normalizedSlug}/stats`,
        shop: `/s/${normalizedSlug}/shop`,
        events: `/s/${normalizedSlug}/events`,
        donate: `/s/${normalizedSlug}/donate`,
      },
      overview: {
        tenantId,
        tenantName: trimText(tenant.name, 160) || trimText(tenant.slug, 160) || 'SCUM Community',
        serverCount: servers.length,
        primaryServerName: primaryServer?.name || null,
        playersTracked: stats.playersTracked,
        shopItemCount: shop.total,
        eventCount: events.total,
        supporterRevenueCoins30d: Number(donationData.summary?.supporterRevenueCoins30d || 0) || 0,
        supporterPurchases30d: Number(donationData.summary?.supporterPurchases30d || 0) || 0,
        lastPurchaseAt: donationData.summary?.lastPurchaseAt || null,
      },
      servers,
      stats,
      shop,
      events,
      donate: donationData,
    };
  }

  return async function handlePublicApiRoute(context) {
    const {
      req,
      res,
      pathname,
      method,
    } = context;
    const resolveAdminUrl = (pathname, search = '') => {
      const built = typeof buildAdminProductUrl === 'function'
        ? buildAdminProductUrl(pathname, search)
        : null;
      return built || `${pathname}${search || ''}`;
    };
    const publicServerRequest = parsePublicServerPath(pathname);

    if (publicServerRequest && method === 'GET') {
      const workspace = await buildPublicServerWorkspace(publicServerRequest.slug);
      if (!workspace?.ok) {
        sendJson(res, 404, {
          ok: false,
          error: workspace?.reason || 'tenant-not-found',
        });
        return true;
      }

      const baseData = {
        tenant: workspace.tenant,
        brand: workspace.brand,
        links: workspace.links,
        overview: workspace.overview,
      };
      const section = publicServerRequest.section;

      if (section === 'stats') {
        sendJson(res, 200, { ok: true, data: { ...baseData, section, stats: workspace.stats } });
        return true;
      }
      if (section === 'shop') {
        sendJson(res, 200, { ok: true, data: { ...baseData, section, shop: workspace.shop } });
        return true;
      }
      if (section === 'events') {
        sendJson(res, 200, { ok: true, data: { ...baseData, section, events: workspace.events } });
        return true;
      }
      if (section === 'donate') {
        sendJson(res, 200, { ok: true, data: { ...baseData, section, donate: workspace.donate } });
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        data: {
          ...baseData,
          section: 'workspace',
          servers: workspace.servers,
          stats: workspace.stats,
          shop: workspace.shop,
          events: workspace.events,
          donate: workspace.donate,
        },
      });
      return true;
    }

    if (pathname === '/api/public/packages' && method === 'GET') {
      const overview = await getPlatformPublicOverview();
      sendJson(res, 200, {
        ok: true,
        data: {
          packages: overview?.billing?.packages || [],
          features: overview?.billing?.features || [],
          plans: overview?.billing?.plans || [],
        },
      });
      return true;
    }

    if (pathname === '/api/public/session' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        data: {
          session: null,
        },
      });
      return true;
    }

    if (pathname === '/api/public/product-links' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        data: {
          tenantLoginUrl: resolveAdminUrl('/tenant/login'),
          tenantSignupTarget: resolveAdminUrl('/tenant/onboarding'),
          playerLoginUrl: '/player/login',
        },
      });
      return true;
    }

    if (pathname === '/api/public/signup' && method === 'POST') {
      const body = await readJsonBody(req);
      const rateLimit = consumeRateLimit('signup', req, body);
      if (rateLimit.limited) {
        sendJson(
          res,
          429,
          { ok: false, error: 'too-many-attempts' },
          { 'Retry-After': String(rateLimit.retryAfterSec) },
        );
        return true;
      }
      const result = typeof registerTenantOwnerAccount === 'function'
        ? await registerTenantOwnerAccount(body)
        : await registerPreviewAccount(body);
      if (!result?.ok) {
        const status = result?.reason === 'email-exists'
          ? 409
          : ['invalid-email', 'weak-password', 'community-required'].includes(result?.reason)
            ? 400
            : 500;
        sendJson(res, status, {
          ok: false,
          error: result?.reason || 'signup-failed',
        });
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            user: result.user || null,
            tenant: result.tenant,
            subscription: result.subscription,
            bootstrapToken: result.bootstrapToken || null,
            nextMethod: result.bootstrapToken ? 'POST' : 'GET',
            nextUrl: resolveAdminUrl('/tenant/onboarding'),
          },
        },
        {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      );
      return true;
    }

    if (pathname === '/api/public/login' && method === 'POST') {
      const body = await readJsonBody(req);
      const rateLimit = consumeRateLimit('login', req, body);
      if (rateLimit.limited) {
        sendJson(
          res,
          429,
          { ok: false, error: 'too-many-attempts' },
          { 'Retry-After': String(rateLimit.retryAfterSec) },
        );
        return true;
      }
      const result = await authenticatePreviewAccount(body);
      if (!result?.ok) {
        sendJson(res, 401, {
          ok: false,
          error: result?.reason || 'invalid-credentials',
        });
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            account: result.account,
            nextUrl: resolveAdminUrl('/tenant/login'),
          },
        },
      );
      return true;
    }

    if (pathname === '/api/public/logout' && method === 'POST') {
      removePreviewSession(req);
      sendJson(
        res,
        200,
        { ok: true, data: { loggedOut: true } },
        { 'Set-Cookie': buildClearPreviewSessionCookie(req) },
      );
      return true;
    }

    if (pathname === '/api/public/password-reset-request' && method === 'POST') {
      const body = await readJsonBody(req);
      const rateLimit = consumeRateLimit('passwordReset', req, body);
      if (rateLimit.limited) {
        sendJson(
          res,
          429,
          { ok: false, error: 'too-many-attempts' },
          { 'Retry-After': String(rateLimit.retryAfterSec) },
        );
        return true;
      }
      const result = await requestPasswordReset(body);
      if (!result?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result?.reason || 'invalid-request',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          queued: true,
        },
      });
      return true;
    }

    if (pathname === '/api/public/password-reset-complete' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = await completePasswordReset(body);
      if (!result?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result?.reason || 'password-reset-complete-failed',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: result,
      });
      return true;
    }

    if (pathname === '/api/public/email-verification-request' && method === 'POST') {
      const body = await readJsonBody(req);
      const rateLimit = consumeRateLimit('emailVerification', req, body);
      if (rateLimit.limited) {
        sendJson(
          res,
          429,
          { ok: false, error: 'too-many-attempts' },
          { 'Retry-After': String(rateLimit.retryAfterSec) },
        );
        return true;
      }
      const result = await requestEmailVerification(body);
      if (!result?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result?.reason || 'invalid-request',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          queued: true,
        },
      });
      return true;
    }

    if (pathname === '/api/public/email-verification-complete' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = await completeEmailVerification(body);
      if (!result?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result?.reason || 'email-verification-complete-failed',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: result,
      });
      return true;
    }

    if (pathname === '/api/public/checkout/session' && method === 'POST') {
      const session = getPreviewSession(req);
      if (!session?.accountId) {
        sendJson(res, 401, { ok: false, error: 'preview-session-required' });
        return true;
      }
      const [body, state, overview] = await Promise.all([
        readJsonBody(req),
        getPreviewState(session.accountId),
        getPlatformPublicOverview(),
      ]);
      if (!state?.ok || !state?.state?.account) {
        sendJson(res, 400, { ok: false, error: 'preview-state-unavailable' });
        return true;
      }
      const plans = Array.isArray(overview?.billing?.plans) ? overview.billing.plans : [];
      const requestedPlanId = String(body?.planId || '').trim();
      const plan = plans.find((entry) => String(entry?.id || '').trim() === requestedPlanId)
        || plans.find((entry) => Number(entry?.amountCents || 0) > 0 && String(entry?.billingCycle || '').trim().toLowerCase() !== 'trial')
        || null;
      if (!plan || Number(plan?.amountCents || 0) <= 0) {
        sendJson(res, 400, { ok: false, error: 'billable-plan-required' });
        return true;
      }
      const account = state.state.account;
      const result = await createCheckoutSession({
        tenantId: session.tenantId || account.tenantId || state.state.tenant?.tenantId || null,
        subscriptionId: account.subscriptionId || null,
        planId: String(plan.id || '').trim(),
        packageId: String(body?.packageId || account.packageId || '').trim() || null,
        billingCycle: String(plan.billingCycle || '').trim() || 'monthly',
        amountCents: Number(plan.amountCents || 0),
        currency: String(plan.currency || overview?.billing?.currency || 'THB').trim() || 'THB',
        successUrl: String(body?.successUrl || '/payment-result').trim(),
        cancelUrl: String(body?.cancelUrl || '/checkout').trim(),
        metadata: {
          source: 'public-checkout',
          previewAccountId: account.id || session.accountId,
          previewEmail: account.email || null,
        },
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'checkout-session-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/api/public/checkout/session/resolve' && method === 'POST') {
      const previewSession = getPreviewSession(req);
      if (!previewSession?.accountId) {
        sendJson(res, 401, { ok: false, error: 'preview-session-required' });
        return true;
      }
      const body = await readJsonBody(req);
      const token = String(body?.sessionToken || body?.token || '').trim();
      if (!token) {
        sendJson(res, 400, { ok: false, error: 'checkout-session-token-required' });
        return true;
      }
      const checkoutSession = await getCheckoutSessionByToken({ sessionToken: token });
      if (!checkoutSession) {
        sendJson(res, 404, { ok: false, error: 'checkout-session-not-found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: { session: checkoutSession } });
      return true;
    }

    if (pathname === '/api/public/checkout/complete' && method === 'POST') {
      const session = getPreviewSession(req);
      if (!session?.accountId) {
        sendJson(res, 401, { ok: false, error: 'preview-session-required' });
        return true;
      }
      const body = await readJsonBody(req);
      const result = await finalizeCheckoutSession({
        sessionToken: body?.sessionToken || body?.token,
        action: body?.action || 'paid',
        actor: 'public-checkout',
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'checkout-complete-failed' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          ...result,
          nextUrl: body?.action === 'canceled' ? '/checkout' : resolveAdminUrl('/tenant/onboarding'),
        },
      });
      return true;
    }

    if (pathname === '/api/public/billing/webhook' && method === 'POST') {
      const configuredWebhookSecret = trimText(billingWebhookSecret, 240);
      if (!configuredWebhookSecret) {
        sendJson(res, 503, {
          ok: false,
          error: 'billing-webhook-secret-missing',
        });
        return true;
      }
      let body = {};
      let rawPayload = '';
      if (typeof readRawBody === 'function') {
        const rawBodyBuffer = await readRawBody(req, 1024 * 1024);
        rawPayload = rawBodyBuffer.toString('utf8');
        body = rawPayload ? JSON.parse(rawPayload) : {};
      } else {
        body = await readJsonBody(req);
        rawPayload = JSON.stringify(body || {});
      }
      const result = await processBillingWebhookEvent({
        ...body,
        rawPayload,
        signature: req?.headers?.['x-platform-billing-signature'] || req?.headers?.['X-Platform-Billing-Signature'],
        stripeSignature: req?.headers?.['stripe-signature'] || req?.headers?.['Stripe-Signature'],
        webhookSecret: configuredWebhookSecret,
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'billing-webhook-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    return false;
  };
}

module.exports = {
  createPublicPlatformRoutes,
};
