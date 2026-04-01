function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildBillingExportCsv(payload = {}) {
  const tenantId = String(payload?.tenantId || 'global').trim() || 'global';
  const provider = payload && typeof payload.provider === 'object' ? payload.provider : {};
  const summary = payload && typeof payload.summary === 'object' ? payload.summary : {};
  const invoices = Array.isArray(payload?.invoices) ? payload.invoices : [];
  const paymentAttempts = Array.isArray(payload?.paymentAttempts) ? payload.paymentAttempts : [];
  const headers = [
    'section',
    'tenantId',
    'recordId',
    'status',
    'amountCents',
    'currency',
    'provider',
    'timestamp',
    'detail',
  ];
  const lines = [headers.join(',')];

  function pushRow(row = {}) {
    lines.push(headers.map((key) => escapeCsvCell(row?.[key] ?? '')).join(','));
  }

  pushRow({
    section: 'provider',
    tenantId,
    recordId: 'billing-provider',
    status: String(provider?.mode || '').trim(),
    provider: String(provider?.provider || '').trim(),
    detail: provider?.configured === true ? 'configured' : '',
  });
  Object.entries(summary).forEach(([key, value]) => {
    pushRow({
      section: 'summary',
      tenantId,
      recordId: key,
      detail: value,
    });
  });
  invoices.forEach((row) => {
    pushRow({
      section: 'invoice',
      tenantId: String(row?.tenantId || tenantId).trim() || tenantId,
      recordId: row?.id,
      status: row?.status,
      amountCents: row?.amountCents,
      currency: row?.currency,
      timestamp: row?.paidAt || row?.dueAt || row?.updatedAt || row?.createdAt || row?.issuedAt,
      detail: row?.subscriptionId || row?.externalRef || '',
    });
  });
  paymentAttempts.forEach((row) => {
    pushRow({
      section: 'payment_attempt',
      tenantId: String(row?.tenantId || tenantId).trim() || tenantId,
      recordId: row?.id,
      status: row?.status,
      amountCents: row?.amountCents,
      currency: row?.currency,
      provider: row?.provider,
      timestamp: row?.attemptedAt || row?.completedAt || row?.updatedAt || row?.createdAt,
      detail: row?.invoiceId || row?.errorCode || '',
    });
  });
  return `${lines.join('\n')}\n`;
}

function createAdminBillingGetRouteHandler(deps) {
  const {
    ensureRole,
    sendJson,
    sendDownload,
    requiredString,
    resolveScopedTenantId,
    getAuthTenantId,
    readOptionalAdminData,
    listBillingInvoices,
    listBillingPaymentAttempts,
    getBillingProviderConfigSummary,
    asInt,
    jsonReplacer,
  } = deps;

  return async function handleAdminBillingGetRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (pathname === '/admin/api/platform/billing/overview') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      const [invoices, paymentAttempts] = await Promise.all([
        readOptionalAdminData('billing-overview-invoices', () => listBillingInvoices({
          tenantId,
          limit: asInt(urlObj.searchParams.get('invoiceLimit'), 100) || 100,
        }), []),
        readOptionalAdminData('billing-overview-payment-attempts', () => listBillingPaymentAttempts({
          tenantId,
          limit: asInt(urlObj.searchParams.get('attemptLimit'), 100) || 100,
        }), []),
      ]);
      const paidInvoices = invoices.filter((row) => row?.status === 'paid');
      const openInvoices = invoices.filter((row) => ['draft', 'open', 'past_due'].includes(String(row?.status || '').trim().toLowerCase()));
      const failedAttempts = paymentAttempts.filter((row) => row?.status === 'failed');
      sendJson(res, 200, {
        ok: true,
        data: {
          provider: getBillingProviderConfigSummary(),
          summary: {
            invoiceCount: invoices.length,
            openInvoiceCount: openInvoices.length,
            paidInvoiceCount: paidInvoices.length,
            collectedCents: paidInvoices.reduce((sum, row) => sum + Number(row?.amountCents || 0), 0),
            failedAttemptCount: failedAttempts.length,
          },
        },
      });
      return true;
    }

    if (pathname === '/admin/api/platform/billing/invoices') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await readOptionalAdminData('billing-invoices', () => listBillingInvoices({
          tenantId,
          status: requiredString(urlObj.searchParams.get('status')),
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
        }), []),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/billing/payment-attempts') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await readOptionalAdminData('billing-payment-attempts', () => listBillingPaymentAttempts({
          tenantId,
          provider: requiredString(urlObj.searchParams.get('provider')),
          status: requiredString(urlObj.searchParams.get('status')),
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
        }), []),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/billing/export') {
      const auth = ensureRole(req, urlObj, 'owner', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      const [invoices, paymentAttempts] = await Promise.all([
        readOptionalAdminData('billing-export-invoices', () => listBillingInvoices({
          tenantId,
          status: requiredString(urlObj.searchParams.get('status')),
          limit: asInt(urlObj.searchParams.get('invoiceLimit'), 250) || 250,
        }), []),
        readOptionalAdminData('billing-export-payment-attempts', () => listBillingPaymentAttempts({
          tenantId,
          provider: requiredString(urlObj.searchParams.get('provider')),
          status: requiredString(urlObj.searchParams.get('attemptStatus')) || requiredString(urlObj.searchParams.get('status')),
          limit: asInt(urlObj.searchParams.get('attemptLimit'), 250) || 250,
        }), []),
      ]);
      const paidInvoices = invoices.filter((row) => row?.status === 'paid');
      const openInvoices = invoices.filter((row) => ['draft', 'open', 'past_due'].includes(String(row?.status || '').trim().toLowerCase()));
      const disputedInvoices = invoices.filter((row) => String(row?.status || '').trim().toLowerCase() === 'disputed');
      const refundedInvoices = invoices.filter((row) => String(row?.status || '').trim().toLowerCase() === 'refunded');
      const failedAttempts = paymentAttempts.filter((row) => row?.status === 'failed');
      const data = {
        tenantId: tenantId || getAuthTenantId(auth) || null,
        generatedAt: new Date().toISOString(),
        provider: getBillingProviderConfigSummary(),
        summary: {
          invoiceCount: invoices.length,
          openInvoiceCount: openInvoices.length,
          paidInvoiceCount: paidInvoices.length,
          disputedInvoiceCount: disputedInvoices.length,
          refundedInvoiceCount: refundedInvoices.length,
          collectedCents: paidInvoices.reduce((sum, row) => sum + Number(row?.amountCents || 0), 0),
          failedAttemptCount: failedAttempts.length,
          paymentAttemptCount: paymentAttempts.length,
        },
        invoices,
        paymentAttempts,
      };
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scopeLabel = tenantId || getAuthTenantId(auth) || 'global';
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildBillingExportCsv(data),
          {
            filename: `billing-export-${scopeLabel}-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify({ ok: true, data }, jsonReplacer, 2)}\n`,
        {
          filename: `billing-export-${scopeLabel}-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    return false;
  };
}

module.exports = {
  buildBillingExportCsv,
  createAdminBillingGetRouteHandler,
};
