'use strict';

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
