'use strict';

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

  return async function handlePublicApiRoute(context) {
    const {
      req,
      res,
      pathname,
      method,
    } = context;
    const url = new URL(String(req?.url || pathname || ''), 'http://local.public');

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
      const bootstrapSearch = result.bootstrapToken
        ? `?bootstrap=${encodeURIComponent(String(result.bootstrapToken || ''))}`
        : '';
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            user: result.user || null,
            tenant: result.tenant,
            subscription: result.subscription,
            nextUrl: resolveAdminUrl('/tenant/onboarding', bootstrapSearch),
          },
        },
      );
      return true;
    }

    if (pathname === '/api/public/login' && method === 'POST') {
      const body = await readJsonBody(req);
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
        data: result,
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

    if (pathname === '/api/public/checkout/session' && method === 'GET') {
      const token = String(url.searchParams.get('token') || '').trim();
      if (!token) {
        sendJson(res, 400, { ok: false, error: 'checkout-session-token-required' });
        return true;
      }
      const session = await getCheckoutSessionByToken({ sessionToken: token });
      if (!session) {
        sendJson(res, 404, { ok: false, error: 'checkout-session-not-found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: { session } });
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
        webhookSecret: billingWebhookSecret || '',
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
