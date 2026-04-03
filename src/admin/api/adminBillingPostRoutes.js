function createAdminBillingPostRouteHandler(deps) {
  const {
    sendJson,
    requiredString,
    getAuthTenantId,
    resolveScopedTenantId,
    createSubscription,
    updateSubscriptionBillingState,
    updateInvoiceStatus,
    updatePaymentAttempt,
    createCheckoutSession,
    findPlanById,
    resolvePackageForPlan,
    listPlatformSubscriptions,
  } = deps;

  function trimText(value) {
    return String(value || '').trim();
  }

  function resolveTenantCheckoutPlan(planId) {
    if (typeof findPlanById !== 'function') return null;
    const plan = findPlanById(planId);
    if (!plan) return null;
    if (String(plan.billingCycle || '').trim().toLowerCase() === 'trial') return null;
    if (Number(plan.amountCents || 0) <= 0) return null;
    return plan;
  }

  return async function handleAdminBillingPostRoute(context) {
    const {
      req,
      res,
      pathname,
      body,
      auth,
    } = context;

    if (pathname === '/admin/api/platform/subscription') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? { ...body.metadata }
        : {};
      const packageId = requiredString(body, 'packageId');
      if (packageId) {
        metadata.packageId = packageId;
      }
      const result = await createSubscription({
        id: requiredString(body, 'id'),
        tenantId,
        planId: requiredString(body, 'planId'),
        packageId,
        billingCycle: requiredString(body, 'billingCycle'),
        status: requiredString(body, 'status'),
        currency: requiredString(body, 'currency'),
        amountCents: body.amountCents,
        intervalDays: body.intervalDays,
        startedAt: body.startedAt,
        renewsAt: body.renewsAt,
        canceledAt: body.canceledAt,
        externalRef: requiredString(body, 'externalRef'),
        metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-subscription-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.subscription });
      return true;
    }

    if (pathname === '/admin/api/platform/subscription/update') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot change platform subscriptions directly' });
        return true;
      }
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? { ...body.metadata }
        : {};
      const packageId = requiredString(body, 'packageId');
      if (packageId) {
        metadata.packageId = packageId;
      }
      const result = await updateSubscriptionBillingState?.({
        tenantId,
        subscriptionId: requiredString(body, 'subscriptionId'),
        planId: requiredString(body, 'planId'),
        billingCycle: requiredString(body, 'billingCycle'),
        status: requiredString(body, 'status'),
        currency: requiredString(body, 'currency'),
        amountCents: body.amountCents,
        renewsAt: Object.prototype.hasOwnProperty.call(body || {}, 'renewsAt') ? body.renewsAt : undefined,
        canceledAt: Object.prototype.hasOwnProperty.call(body || {}, 'canceledAt') ? body.canceledAt : undefined,
        externalRef: requiredString(body, 'externalRef'),
        metadata,
        actor: `owner-web:${auth?.user || 'unknown'}`,
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-subscription-update-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.subscription });
      return true;
    }

    if (pathname === '/admin/api/platform/billing/invoice/update') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot change platform invoices directly' });
        return true;
      }
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await updateInvoiceStatus?.({
        tenantId,
        invoiceId: requiredString(body, 'invoiceId'),
        status: requiredString(body, 'status'),
        paidAt: Object.prototype.hasOwnProperty.call(body || {}, 'paidAt') ? body.paidAt : undefined,
        externalRef: requiredString(body, 'externalRef'),
        metadata: body?.metadata,
        actor: `owner-web:${auth?.user || 'unknown'}`,
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-invoice-update-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.invoice });
      return true;
    }

    if (pathname === '/admin/api/platform/billing/payment-attempt/update') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot change payment attempts directly' });
        return true;
      }
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await updatePaymentAttempt?.({
        tenantId,
        attemptId: requiredString(body, 'attemptId'),
        status: requiredString(body, 'status'),
        completedAt: Object.prototype.hasOwnProperty.call(body || {}, 'completedAt') ? body.completedAt : undefined,
        externalRef: requiredString(body, 'externalRef'),
        errorCode: requiredString(body, 'errorCode'),
        errorDetail: requiredString(body, 'errorDetail'),
        metadata: body?.metadata,
        actor: `owner-web:${auth?.user || 'unknown'}`,
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-payment-attempt-update-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.attempt });
      return true;
    }

    if (pathname === '/admin/api/platform/billing/checkout-session') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const authTenantId = getAuthTenantId(auth);
      if (authTenantId) {
        const plan = resolveTenantCheckoutPlan(requiredString(body, 'planId'));
        if (!plan) {
          sendJson(res, 400, { ok: false, error: 'billable-plan-required' });
          return true;
        }
        const subscriptionRows = typeof listPlatformSubscriptions === 'function'
          ? await listPlatformSubscriptions({ tenantId, limit: 12 }).catch(() => [])
          : [];
        const requestedSubscriptionId = requiredString(body, 'subscriptionId');
        const subscription = requestedSubscriptionId
          ? subscriptionRows.find((entry) => trimText(entry?.id) === requestedSubscriptionId) || null
          : subscriptionRows[0] || null;
        if (!subscription) {
          sendJson(res, 400, { ok: false, error: 'subscription-not-found' });
          return true;
        }
        const requestedPackageId = requiredString(body, 'packageId');
        const resolvedPackage = typeof resolvePackageForPlan === 'function'
          ? resolvePackageForPlan(plan.id, {
            packageId: requestedPackageId || subscription?.packageId || null,
          })
          : null;
        const result = await createCheckoutSession?.({
          tenantId,
          subscriptionId: subscription.id,
          idempotencyKey: requiredString(body, 'idempotencyKey'),
          planId: plan.id,
          packageId: requestedPackageId || resolvedPackage?.id || subscription?.packageId || null,
          billingCycle: String(plan.billingCycle || 'monthly').trim() || 'monthly',
          currency: String(plan.currency || body?.currency || 'THB').trim() || 'THB',
          amountCents: Number(plan.amountCents || 0),
          successUrl: requiredString(body, 'successUrl') || '/tenant/billing',
          cancelUrl: requiredString(body, 'cancelUrl') || '/tenant/billing',
          checkoutUrl: requiredString(body, 'checkoutUrl') || '/payment-result',
          metadata: {
            ...(body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
              ? body.metadata
              : {}),
            source: 'tenant-billing-self-service',
            requestedByTenant: true,
          },
          actor: `tenant-web:${auth?.user || 'unknown'}`,
        });
        if (!result?.ok) {
          sendJson(res, 400, { ok: false, error: result?.reason || 'platform-checkout-session-failed' });
          return true;
        }
        sendJson(res, 200, { ok: true, data: { session: result.session, invoice: result.invoice } });
        return true;
      }
      const result = await createCheckoutSession?.({
        tenantId,
        invoiceId: requiredString(body, 'invoiceId'),
        subscriptionId: requiredString(body, 'subscriptionId'),
        customerId: requiredString(body, 'customerId'),
        idempotencyKey: requiredString(body, 'idempotencyKey'),
        planId: requiredString(body, 'planId'),
        packageId: requiredString(body, 'packageId'),
        billingCycle: requiredString(body, 'billingCycle'),
        currency: requiredString(body, 'currency'),
        amountCents: body?.amountCents,
        successUrl: requiredString(body, 'successUrl'),
        cancelUrl: requiredString(body, 'cancelUrl'),
        checkoutUrl: requiredString(body, 'checkoutUrl'),
        metadata: body?.metadata,
        actor: `owner-web:${auth?.user || 'unknown'}`,
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-checkout-session-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: { session: result.session, invoice: result.invoice } });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminBillingPostRouteHandler,
};
