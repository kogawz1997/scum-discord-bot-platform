'use strict';

const crypto = require('node:crypto');
const { Prisma } = require('@prisma/client');

const { prisma, getTenantScopedPrismaClient } = require('../prisma');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function createId(prefix = 'bill') {
  if (typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function createSessionToken(prefix = 'chk') {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}.${crypto.randomBytes(20).toString('hex')}`;
}

function normalizeCurrency(value) {
  return trimText(value || 'THB', 12).toUpperCase() || 'THB';
}

function normalizeProvider(value) {
  const normalized = trimText(value || 'platform_local', 80).toLowerCase() || 'platform_local';
  if (normalized === 'stripe_checkout') return 'stripe';
  return normalized;
}

function normalizeInvoiceStatus(value, fallback = 'draft') {
  const normalized = trimText(value, 40).toLowerCase();
  return ['draft', 'open', 'paid', 'past_due', 'void', 'canceled', 'failed'].includes(normalized)
    ? normalized
    : fallback;
}

function normalizePaymentStatus(value, fallback = 'pending') {
  const normalized = trimText(value, 40).toLowerCase();
  return ['pending', 'requires_action', 'processing', 'succeeded', 'failed', 'canceled'].includes(normalized)
    ? normalized
    : fallback;
}

function normalizeSubscriptionStatus(value, fallback = 'active') {
  const normalized = trimText(value, 40).toLowerCase();
  return ['active', 'trialing', 'pending', 'past_due', 'canceled', 'expired'].includes(normalized)
    ? normalized
    : fallback;
}

function normalizeBillingCycle(value) {
  const normalized = trimText(value, 40).toLowerCase();
  return ['monthly', 'quarterly', 'yearly', 'trial', 'one-time'].includes(normalized)
    ? normalized
    : 'monthly';
}

function parseJsonObject(value) {
  if (value == null || String(value).trim() === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function asInt(value, fallback = 0, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function buildJson(value) {
  return JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
}

function mergeMeta(left, right) {
  return {
    ...parseJsonObject(left),
    ...(right && typeof right === 'object' && !Array.isArray(right) ? right : {}),
  };
}

function addDays(date, days) {
  const base = parseDate(date) || new Date();
  return new Date(base.getTime() + Math.max(1, asInt(days, 1, 1)) * 24 * 60 * 60 * 1000);
}

function resolveBillingCycleDays(cycle) {
  const normalized = normalizeBillingCycle(cycle);
  if (normalized === 'yearly') return 365;
  if (normalized === 'quarterly') return 90;
  if (normalized === 'trial') return 14;
  if (normalized === 'one-time') return 0;
  return 30;
}

function getScopedBillingDb(tenantId, db = prisma) {
  if (db && db !== prisma) return db;
  const normalizedTenantId = trimText(tenantId, 160);
  return normalizedTenantId ? getTenantScopedPrismaClient(normalizedTenantId) : prisma;
}

function getConfiguredBillingProvider() {
  return normalizeProvider(process.env.PLATFORM_BILLING_PROVIDER || 'platform_local');
}

function getStripeSecretKey() {
  return trimText(process.env.PLATFORM_BILLING_STRIPE_SECRET_KEY, 240) || '';
}

function getStripePublishableKey() {
  return trimText(process.env.PLATFORM_BILLING_STRIPE_PUBLISHABLE_KEY, 240) || '';
}

function getBillingWebhookSecret() {
  return trimText(process.env.PLATFORM_BILLING_WEBHOOK_SECRET, 240) || '';
}

function getPortalBaseUrl() {
  const configured = trimText(
    process.env.WEB_PORTAL_BASE_URL
      || process.env.PLATFORM_PUBLIC_BASE_URL
      || '',
    800,
  );
  if (configured) return configured;
  return 'http://127.0.0.1:3200';
}

function buildAbsolutePortalUrl(pathOrUrl, query = {}) {
  const raw = trimText(pathOrUrl, 800) || '/payment-result';
  let url = null;
  try {
    url = new URL(raw);
  } catch {
    url = new URL(raw.startsWith('/') ? raw : `/${raw}`, getPortalBaseUrl());
  }
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function createStripeFormBody(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value == null || value === '') return;
    params.append(key, String(value));
  });
  return params;
}

async function stripeRequest(pathname, body, secretKey) {
  const response = await fetch(`https://api.stripe.com${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    return {
      ok: false,
      reason: 'billing-provider-request-failed',
      statusCode: response.status,
      payload,
    };
  }
  return {
    ok: true,
    payload,
  };
}

function computeBillingWebhookSignature(payload, secret) {
  const normalizedSecret = String(secret || '');
  if (!normalizedSecret) return '';
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload == null ? {} : payload);
  return crypto.createHmac('sha256', normalizedSecret).update(serialized, 'utf8').digest('hex');
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (!left.length || !right.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseStripeSignatureHeader(headerValue) {
  const segments = String(headerValue || '').split(',');
  const parsed = {
    timestamp: null,
    signatures: [],
  };
  segments.forEach((segment) => {
    const [prefix, value] = String(segment || '').split('=');
    const key = trimText(prefix, 8);
    const text = trimText(value, 400);
    if (!key || !text) return;
    if (key === 't') {
      parsed.timestamp = text;
      return;
    }
    if (key === 'v1') {
      parsed.signatures.push(text);
    }
  });
  return parsed;
}

function verifyStripeWebhookSignature(rawPayload, signatureHeader, secret, toleranceSeconds = 300) {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || !parsed.signatures.length || !secret) return false;
  const signedPayload = `${parsed.timestamp}.${String(rawPayload || '')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const matched = parsed.signatures.some((candidate) => safeCompare(candidate, expected));
  if (!matched) return false;
  const timestampSeconds = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) <= Math.max(0, asInt(toleranceSeconds, 300, 0));
}

function normalizeCustomerRow(row) {
  if (!row) return null;
  return {
    id: trimText(row.id, 160) || null,
    tenantId: trimText(row.tenantId, 160) || null,
    userId: trimText(row.userId, 160) || null,
    email: trimText(row.email, 200).toLowerCase() || null,
    displayName: trimText(row.displayName, 200) || null,
    externalRef: trimText(row.externalRef, 200) || null,
    status: trimText(row.status, 40) || 'active',
    metadata: parseJsonObject(row.metadataJson),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function normalizeInvoiceRow(row) {
  if (!row) return null;
  return {
    id: trimText(row.id, 160) || null,
    tenantId: trimText(row.tenantId, 160) || null,
    subscriptionId: trimText(row.subscriptionId, 160) || null,
    customerId: trimText(row.customerId, 160) || null,
    status: normalizeInvoiceStatus(row.status, 'draft'),
    currency: normalizeCurrency(row.currency),
    amountCents: asInt(row.amountCents, 0, 0),
    dueAt: toIso(row.dueAt),
    paidAt: toIso(row.paidAt),
    externalRef: trimText(row.externalRef, 200) || null,
    metadata: parseJsonObject(row.metadataJson),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function normalizePaymentAttemptRow(row) {
  if (!row) return null;
  return {
    id: trimText(row.id, 160) || null,
    invoiceId: trimText(row.invoiceId, 160) || null,
    tenantId: trimText(row.tenantId, 160) || null,
    provider: normalizeProvider(row.provider),
    status: normalizePaymentStatus(row.status, 'pending'),
    amountCents: asInt(row.amountCents, 0, 0),
    currency: normalizeCurrency(row.currency),
    externalRef: trimText(row.externalRef, 200) || null,
    errorCode: trimText(row.errorCode, 120) || null,
    errorDetail: trimText(row.errorDetail, 600) || null,
    attemptedAt: toIso(row.attemptedAt),
    completedAt: toIso(row.completedAt),
    metadata: parseJsonObject(row.metadataJson),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function normalizeSubscriptionEventRow(row) {
  if (!row) return null;
  return {
    id: trimText(row.id, 160) || null,
    tenantId: trimText(row.tenantId, 160) || null,
    subscriptionId: trimText(row.subscriptionId, 160) || null,
    eventType: trimText(row.eventType, 120) || null,
    billingStatus: trimText(row.billingStatus, 40) || null,
    actor: trimText(row.actor, 200) || null,
    payload: parseJsonObject(row.payloadJson),
    occurredAt: toIso(row.occurredAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function buildCheckoutSession(attempt, invoice = null) {
  const metadata = parseJsonObject(attempt?.metadata);
  return {
    id: trimText(attempt?.id, 160) || null,
    tenantId: trimText(attempt?.tenantId, 160) || trimText(invoice?.tenantId, 160) || null,
    subscriptionId: trimText(invoice?.subscriptionId, 160) || trimText(metadata.subscriptionId, 160) || null,
    invoiceId: trimText(invoice?.id, 160) || trimText(attempt?.invoiceId, 160) || trimText(metadata.invoiceId, 160) || null,
    customerId: trimText(invoice?.customerId, 160) || trimText(metadata.customerId, 160) || null,
    provider: normalizeProvider(attempt?.provider || metadata.provider),
    status: normalizePaymentStatus(attempt?.status || metadata.status, 'open'),
    sessionToken: trimText(attempt?.externalRef || metadata.sessionToken, 200) || null,
    checkoutUrl: trimText(metadata.checkoutUrl, 800) || null,
    successUrl: trimText(metadata.successUrl, 800) || null,
    cancelUrl: trimText(metadata.cancelUrl, 800) || null,
    expiresAt: toIso(metadata.expiresAt),
    completedAt: toIso(attempt?.completedAt),
    metadata,
    createdAt: toIso(attempt?.createdAt),
    updatedAt: toIso(attempt?.updatedAt),
  };
}

async function ensurePlatformBillingLifecycleTables(db = prisma) {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_billing_customers (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL UNIQUE,
      userId TEXT,
      email TEXT,
      displayName TEXT,
      externalRef TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_billing_invoices (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      subscriptionId TEXT,
      customerId TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      currency TEXT NOT NULL DEFAULT 'THB',
      amountCents INTEGER NOT NULL DEFAULT 0,
      dueAt TEXT,
      paidAt TEXT,
      externalRef TEXT,
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_billing_payment_attempts (
      id TEXT PRIMARY KEY,
      invoiceId TEXT,
      tenantId TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'platform_local',
      status TEXT NOT NULL DEFAULT 'pending',
      amountCents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'THB',
      externalRef TEXT,
      errorCode TEXT,
      errorDetail TEXT,
      attemptedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt TEXT,
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_subscription_events (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      subscriptionId TEXT NOT NULL,
      eventType TEXT NOT NULL,
      billingStatus TEXT,
      actor TEXT,
      payloadJson TEXT,
      occurredAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getCustomerRowByTenantRaw(db, tenantId) {
  const rows = await db.$queryRaw`
    SELECT id, tenantId, userId, email, displayName, externalRef, status, metadataJson, createdAt, updatedAt
    FROM platform_billing_customers
    WHERE tenantId = ${tenantId}
    LIMIT 1
  `;
  return normalizeCustomerRow(Array.isArray(rows) ? rows[0] : null);
}

async function getInvoiceRowByIdRaw(db, invoiceId) {
  const rows = await db.$queryRaw`
    SELECT id, tenantId, subscriptionId, customerId, status, currency, amountCents, dueAt, paidAt, externalRef, metadataJson, createdAt, updatedAt
    FROM platform_billing_invoices
    WHERE id = ${invoiceId}
    LIMIT 1
  `;
  return normalizeInvoiceRow(Array.isArray(rows) ? rows[0] : null);
}

async function getPaymentAttemptRowByIdRaw(db, attemptId) {
  const rows = await db.$queryRaw`
    SELECT id, invoiceId, tenantId, provider, status, amountCents, currency, externalRef, errorCode, errorDetail, attemptedAt, completedAt, metadataJson, createdAt, updatedAt
    FROM platform_billing_payment_attempts
    WHERE id = ${attemptId}
    LIMIT 1
  `;
  return normalizePaymentAttemptRow(Array.isArray(rows) ? rows[0] : null);
}

async function getPaymentAttemptRowByExternalRefRaw(db, externalRef) {
  const rows = await db.$queryRaw`
    SELECT id, invoiceId, tenantId, provider, status, amountCents, currency, externalRef, errorCode, errorDetail, attemptedAt, completedAt, metadataJson, createdAt, updatedAt
    FROM platform_billing_payment_attempts
    WHERE externalRef = ${externalRef}
    ORDER BY updatedAt DESC, createdAt DESC
    LIMIT 1
  `;
  return normalizePaymentAttemptRow(Array.isArray(rows) ? rows[0] : null);
}

async function listBillingInvoices(options = {}, db = prisma) {
  const tenantId = trimText(options.tenantId, 160) || null;
  const status = trimText(options.status, 40) || null;
  const limit = Math.max(1, Math.min(500, asInt(options.limit, 50, 1)));
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  const filters = [];
  if (tenantId) filters.push(Prisma.sql`tenantId = ${tenantId}`);
  if (status) filters.push(Prisma.sql`status = ${status}`);
  const whereSql = filters.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(filters, Prisma.sql` AND `)}`
    : Prisma.empty;
  const rows = await scopedDb.$queryRaw(Prisma.sql`
    SELECT id, tenantId, subscriptionId, customerId, status, currency, amountCents, dueAt, paidAt, externalRef, metadataJson, createdAt, updatedAt
    FROM platform_billing_invoices
    ${whereSql}
    ORDER BY updatedAt DESC, createdAt DESC
    LIMIT ${limit}
  `);
  return Array.isArray(rows) ? rows.map(normalizeInvoiceRow).filter(Boolean) : [];
}

async function listBillingPaymentAttempts(options = {}, db = prisma) {
  const tenantId = trimText(options.tenantId, 160) || null;
  const status = trimText(options.status, 40) || null;
  const provider = trimText(options.provider, 80) || null;
  const limit = Math.max(1, Math.min(500, asInt(options.limit, 50, 1)));
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  const filters = [];
  if (tenantId) filters.push(Prisma.sql`tenantId = ${tenantId}`);
  if (status) filters.push(Prisma.sql`status = ${status}`);
  if (provider) filters.push(Prisma.sql`provider = ${provider}`);
  const whereSql = filters.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(filters, Prisma.sql` AND `)}`
    : Prisma.empty;
  const rows = await scopedDb.$queryRaw(Prisma.sql`
    SELECT id, invoiceId, tenantId, provider, status, amountCents, currency, externalRef, errorCode, errorDetail, attemptedAt, completedAt, metadataJson, createdAt, updatedAt
    FROM platform_billing_payment_attempts
    ${whereSql}
    ORDER BY updatedAt DESC, createdAt DESC
    LIMIT ${limit}
  `);
  return Array.isArray(rows) ? rows.map(normalizePaymentAttemptRow).filter(Boolean) : [];
}

function getBillingProviderConfigSummary() {
  const provider = getConfiguredBillingProvider();
  const stripeSecretKey = getStripeSecretKey();
  const stripePublishableKey = getStripePublishableKey();
  const webhookSecret = getBillingWebhookSecret();
  const stripeConfigured = provider === 'stripe' && Boolean(stripeSecretKey);
  return {
    provider,
    mode: stripeConfigured ? 'stripe_checkout' : 'platform_local',
    webhookSecretConfigured: Boolean(webhookSecret),
    stripeConfigured,
    stripePublishableKeyConfigured: Boolean(stripePublishableKey),
    supportedProviders: ['platform_local', 'stripe'],
    portalBaseUrl: getPortalBaseUrl(),
  };
}

async function getSubscriptionEventRowByIdRaw(db, eventId) {
  const rows = await db.$queryRaw`
    SELECT id, tenantId, subscriptionId, eventType, billingStatus, actor, payloadJson, occurredAt, createdAt, updatedAt
    FROM platform_subscription_events
    WHERE id = ${eventId}
    LIMIT 1
  `;
  return normalizeSubscriptionEventRow(Array.isArray(rows) ? rows[0] : null);
}

async function ensureBillingCustomer(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  const existing = await getCustomerRowByTenantRaw(scopedDb, tenantId);
  const nextId = existing?.id || trimText(input.id, 160) || createId('cust');
  const metadataJson = buildJson(mergeMeta(existing?.metadata, input.metadata));
  if (existing) {
    await scopedDb.$executeRaw`
      UPDATE platform_billing_customers
      SET
        userId = ${trimText(input.userId, 160) || null},
        email = ${trimText(input.email, 200).toLowerCase() || null},
        displayName = ${trimText(input.displayName, 200) || null},
        externalRef = ${trimText(input.externalRef, 200) || null},
        status = ${trimText(input.status, 40) || 'active'},
        metadataJson = ${metadataJson},
        updatedAt = ${new Date().toISOString()}
      WHERE id = ${nextId}
    `;
  } else {
    await scopedDb.$executeRaw`
      INSERT INTO platform_billing_customers (
        id, tenantId, userId, email, displayName, externalRef, status, metadataJson, createdAt, updatedAt
      )
      VALUES (
        ${nextId},
        ${tenantId},
        ${trimText(input.userId, 160) || null},
        ${trimText(input.email, 200).toLowerCase() || null},
        ${trimText(input.displayName, 200) || null},
        ${trimText(input.externalRef, 200) || null},
        ${trimText(input.status, 40) || 'active'},
        ${metadataJson},
        ${new Date().toISOString()},
        ${new Date().toISOString()}
      )
    `;
  }
  return { ok: true, customer: await getCustomerRowByTenantRaw(scopedDb, tenantId) };
}

async function findInvoiceById(db, invoiceId) {
  const id = trimText(invoiceId, 160);
  if (!id) return null;
  return getInvoiceRowByIdRaw(db, id);
}

async function findPaymentAttemptByExternalRef(db, externalRef) {
  const ref = trimText(externalRef, 200);
  if (!ref) return null;
  return getPaymentAttemptRowByExternalRefRaw(db, ref);
}

async function createInvoiceDraft(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  const invoiceId = trimText(input.id, 160) || createId('inv');
  await scopedDb.$executeRaw`
    INSERT INTO platform_billing_invoices (
      id, tenantId, subscriptionId, customerId, status, currency, amountCents, dueAt, paidAt, externalRef, metadataJson, createdAt, updatedAt
    )
    VALUES (
      ${invoiceId},
      ${tenantId},
      ${trimText(input.subscriptionId, 160) || null},
      ${trimText(input.customerId, 160) || null},
      ${normalizeInvoiceStatus(input.status, 'draft')},
      ${normalizeCurrency(input.currency)},
      ${asInt(input.amountCents, 0, 0)},
      ${toIso(input.dueAt)},
      ${toIso(input.paidAt)},
      ${trimText(input.externalRef, 200) || null},
      ${buildJson(input.metadata)},
      ${new Date().toISOString()},
      ${new Date().toISOString()}
    )
  `;
  return { ok: true, invoice: await getInvoiceRowByIdRaw(scopedDb, invoiceId) };
}

async function updateInvoiceStatus(input = {}, db = prisma) {
  const invoiceId = trimText(input.invoiceId, 160);
  if (!invoiceId) return { ok: false, reason: 'invoice-required' };
  const scopedDb = getScopedBillingDb(input.tenantId, db);
  const existing = await getInvoiceRowByIdRaw(scopedDb, invoiceId);
  if (!existing) return { ok: false, reason: 'invoice-not-found' };
  const nextStatus = normalizeInvoiceStatus(input.status, existing.status || 'draft');
  await scopedDb.$executeRaw`
    UPDATE platform_billing_invoices
    SET
      status = ${nextStatus},
      paidAt = ${input.paidAt === null ? null : toIso(input.paidAt) || (nextStatus === 'paid' ? new Date().toISOString() : existing.paidAt)},
      externalRef = ${trimText(input.externalRef, 200) || existing.externalRef || null},
      metadataJson = ${buildJson(mergeMeta(existing.metadata, input.metadata))},
      updatedAt = ${new Date().toISOString()}
    WHERE id = ${invoiceId}
  `;
  return { ok: true, invoice: await getInvoiceRowByIdRaw(scopedDb, invoiceId) };
}

async function recordPaymentAttempt(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  const attemptId = trimText(input.id, 160) || createId('pay');
  await scopedDb.$executeRaw`
    INSERT INTO platform_billing_payment_attempts (
      id, invoiceId, tenantId, provider, status, amountCents, currency, externalRef, errorCode, errorDetail, attemptedAt, completedAt, metadataJson, createdAt, updatedAt
    )
    VALUES (
      ${attemptId},
      ${trimText(input.invoiceId, 160) || null},
      ${tenantId},
      ${normalizeProvider(input.provider)},
      ${normalizePaymentStatus(input.status, 'pending')},
      ${asInt(input.amountCents, 0, 0)},
      ${normalizeCurrency(input.currency)},
      ${trimText(input.externalRef, 200) || null},
      ${trimText(input.errorCode, 120) || null},
      ${trimText(input.errorDetail, 600) || null},
      ${toIso(input.attemptedAt) || new Date().toISOString()},
      ${toIso(input.completedAt)},
      ${buildJson(input.metadata)},
      ${new Date().toISOString()},
      ${new Date().toISOString()}
    )
  `;
  return { ok: true, attempt: await getPaymentAttemptRowByIdRaw(scopedDb, attemptId) };
}

async function updatePaymentAttempt(input = {}, db = prisma) {
  const attemptId = trimText(input.attemptId, 160);
  if (!attemptId) return { ok: false, reason: 'payment-attempt-required' };
  const scopedDb = getScopedBillingDb(input.tenantId, db);
  const existing = await getPaymentAttemptRowByIdRaw(scopedDb, attemptId);
  if (!existing) return { ok: false, reason: 'payment-attempt-not-found' };
  const nextStatus = normalizePaymentStatus(input.status, existing.status || 'pending');
  await scopedDb.$executeRaw`
    UPDATE platform_billing_payment_attempts
    SET
      status = ${nextStatus},
      completedAt = ${input.completedAt === null ? null : toIso(input.completedAt) || (['succeeded', 'failed', 'canceled'].includes(nextStatus) ? new Date().toISOString() : existing.completedAt)},
      externalRef = ${trimText(input.externalRef, 200) || existing.externalRef || null},
      errorCode = ${trimText(input.errorCode, 120) || null},
      errorDetail = ${trimText(input.errorDetail, 600) || null},
      metadataJson = ${buildJson(mergeMeta(existing.metadata, input.metadata))},
      updatedAt = ${new Date().toISOString()}
    WHERE id = ${attemptId}
  `;
  return { ok: true, attempt: await getPaymentAttemptRowByIdRaw(scopedDb, attemptId) };
}

async function recordSubscriptionEvent(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  const subscriptionId = trimText(input.subscriptionId, 160);
  if (!tenantId || !subscriptionId) return { ok: false, reason: 'subscription-event-invalid' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  const eventId = trimText(input.id, 160) || createId('subevt');
  await scopedDb.$executeRaw`
    INSERT INTO platform_subscription_events (
      id, tenantId, subscriptionId, eventType, billingStatus, actor, payloadJson, occurredAt, createdAt, updatedAt
    )
    VALUES (
      ${eventId},
      ${tenantId},
      ${subscriptionId},
      ${trimText(input.eventType, 120) || 'subscription.updated'},
      ${trimText(input.billingStatus, 40) || null},
      ${trimText(input.actor, 200) || null},
      ${buildJson(input.payload)},
      ${toIso(input.occurredAt) || new Date().toISOString()},
      ${new Date().toISOString()},
      ${new Date().toISOString()}
    )
  `;
  return { ok: true, event: await getSubscriptionEventRowByIdRaw(scopedDb, eventId) };
}

async function findTenantSubscription(scopedDb, tenantId, subscriptionId = null) {
  const requestedSubscriptionId = trimText(subscriptionId, 160);
  if (requestedSubscriptionId) return scopedDb.platformSubscription.findUnique({ where: { id: requestedSubscriptionId } }).catch(() => null);
  return scopedDb.platformSubscription.findFirst({
    where: { tenantId },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  }).catch(() => null);
}

async function updateSubscriptionBillingState(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  const existing = await findTenantSubscription(scopedDb, tenantId, input.subscriptionId);
  if (!existing) return { ok: false, reason: 'subscription-not-found' };
  const row = await scopedDb.platformSubscription.update({
    where: { id: existing.id },
    data: {
      planId: trimText(input.planId, 120) || existing.planId,
      billingCycle: normalizeBillingCycle(input.billingCycle || existing.billingCycle),
      status: normalizeSubscriptionStatus(input.status, existing.status || 'active'),
      currency: normalizeCurrency(input.currency || existing.currency),
      amountCents: input.amountCents == null ? existing.amountCents : asInt(input.amountCents, existing.amountCents || 0, 0),
      renewsAt: input.renewsAt === null ? null : parseDate(input.renewsAt) || existing.renewsAt,
      canceledAt: input.canceledAt === null ? null : parseDate(input.canceledAt) || existing.canceledAt,
      externalRef: trimText(input.externalRef, 200) || existing.externalRef || null,
      metadataJson: buildJson(mergeMeta(existing.metadataJson, input.metadata)),
    },
  });
  return { ok: true, subscription: row };
}

async function createStripeCheckoutSession(input = {}, invoice, customer, sessionToken) {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return { ok: false, reason: 'billing-provider-not-configured' };
  }
  const successUrl = buildAbsolutePortalUrl(input.successUrl || '/payment-result', {
    session: sessionToken,
    provider: 'stripe',
    stripe_session_id: '{CHECKOUT_SESSION_ID}',
    status: 'paid',
  });
  const cancelUrl = buildAbsolutePortalUrl(input.cancelUrl || '/checkout', {
    session: sessionToken,
    provider: 'stripe',
    status: 'canceled',
  });
  const productName = trimText(input.productName, 200)
    || trimText(input.planId, 120)
    || 'SCUM TH Platform';
  const formBody = createStripeFormBody({
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: sessionToken,
    customer: trimText(customer?.externalRef, 200) || null,
    customer_creation: customer?.externalRef ? null : 'always',
    customer_email: customer?.externalRef ? null : trimText(customer?.email || input.customerEmail, 200).toLowerCase() || null,
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': normalizeCurrency(invoice?.currency).toLowerCase(),
    'line_items[0][price_data][unit_amount]': asInt(invoice?.amountCents, 0, 0),
    'line_items[0][price_data][product_data][name]': productName,
    'metadata[tenantId]': trimText(input.tenantId, 160) || null,
    'metadata[invoiceId]': trimText(invoice?.id, 160) || null,
    'metadata[subscriptionId]': trimText(invoice?.subscriptionId, 160) || null,
    'metadata[sessionToken]': sessionToken,
    'metadata[planId]': trimText(input.planId, 120) || null,
    'metadata[packageId]': trimText(input.packageId, 120) || null,
  });
  const result = await stripeRequest('/v1/checkout/sessions', formBody, secretKey);
  if (!result.ok) return result;
  return {
    ok: true,
    providerSessionId: trimText(result.payload?.id, 200) || null,
    checkoutUrl: trimText(result.payload?.url, 800) || successUrl,
    expiresAt: result.payload?.expires_at
      ? new Date(Number(result.payload.expires_at) * 1000).toISOString()
      : null,
    customerRef: trimText(result.payload?.customer, 200) || null,
    payload: result.payload,
  };
}

async function retrieveStripeCheckoutSession(sessionId) {
  const secretKey = getStripeSecretKey();
  const normalizedSessionId = trimText(sessionId, 200);
  if (!secretKey || !normalizedSessionId) return null;
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(normalizedSessionId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
  const payload = await parseJsonResponse(response);
  if (!response.ok) return null;
  return payload;
}

async function createCheckoutSession(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  let invoice = input.invoiceId ? await findInvoiceById(scopedDb, input.invoiceId) : null;
  if (!invoice) {
    const created = await createInvoiceDraft({
      tenantId,
      subscriptionId: input.subscriptionId,
      customerId: input.customerId,
      status: normalizeInvoiceStatus(input.invoiceStatus, 'open'),
      currency: input.currency,
      amountCents: input.amountCents,
      dueAt: input.dueAt,
      metadata: {
        targetPlanId: trimText(input.planId, 120) || null,
        targetPackageId: trimText(input.packageId, 120) || null,
        targetBillingCycle: normalizeBillingCycle(input.billingCycle),
        source: trimText(input.source, 120) || 'checkout-session',
      },
    }, scopedDb);
    if (!created?.ok) return { ok: false, reason: 'invoice-create-failed' };
    invoice = created.invoice;
  }
  const provider = normalizeProvider(input.provider || getConfiguredBillingProvider());
  const customer = await getCustomerRowByTenantRaw(scopedDb, tenantId).catch(() => null);
  const sessionToken = trimText(input.sessionToken, 200) || createSessionToken('chk');
  const providerSession = provider === 'stripe'
    ? await createStripeCheckoutSession({
      ...input,
      tenantId,
      customerEmail: customer?.email || null,
    }, invoice, customer, sessionToken)
    : null;
  if (provider === 'stripe' && !providerSession?.ok) {
    return providerSession;
  }
  if (providerSession?.customerRef && customer && providerSession.customerRef !== customer.externalRef) {
    await ensureBillingCustomer({
      tenantId,
      userId: customer.userId,
      email: customer.email,
      displayName: customer.displayName,
      externalRef: providerSession.customerRef,
      metadata: mergeMeta(customer.metadata, { provider }),
    }, scopedDb).catch(() => null);
  }
  const metadata = {
    checkoutSession: true,
    sessionToken,
    checkoutUrl: trimText(providerSession?.checkoutUrl, 800)
      || buildAbsolutePortalUrl(trimText(input.checkoutUrl, 800) || '/payment-result', {
        session: sessionToken,
        provider,
        status: 'pending',
      }),
    successUrl: buildAbsolutePortalUrl(trimText(input.successUrl, 800) || '/preview', {
      session: sessionToken,
      provider,
      status: 'paid',
    }),
    cancelUrl: buildAbsolutePortalUrl(trimText(input.cancelUrl, 800) || '/checkout', {
      session: sessionToken,
      provider,
      status: 'canceled',
    }),
    expiresAt: toIso(providerSession?.expiresAt) || toIso(input.expiresAt) || toIso(addDays(new Date(), 1)),
    subscriptionId: invoice.subscriptionId || trimText(input.subscriptionId, 160) || null,
    customerId: invoice.customerId || trimText(input.customerId, 160) || null,
    provider,
    providerSessionId: trimText(providerSession?.providerSessionId, 200) || null,
    planId: trimText(input.planId, 120) || null,
    packageId: trimText(input.packageId, 120) || null,
    billingCycle: normalizeBillingCycle(input.billingCycle),
    targetAmountCents: invoice.amountCents,
    ...(input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {}),
  };
  const attempt = await recordPaymentAttempt({
    tenantId,
    invoiceId: invoice.id,
    provider,
    status: 'requires_action',
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    externalRef: sessionToken,
    metadata,
  }, scopedDb);
  if (invoice.subscriptionId) {
    await recordSubscriptionEvent({
      tenantId,
      subscriptionId: invoice.subscriptionId,
      eventType: 'checkout.session_created',
      billingStatus: 'requires_action',
      actor: trimText(input.actor, 200) || 'system',
      payload: {
        invoiceId: invoice.id,
        sessionToken,
        provider,
        providerSessionId: trimText(providerSession?.providerSessionId, 200) || null,
      },
    }, scopedDb).catch(() => null);
  }
  return { ok: true, session: buildCheckoutSession(attempt.attempt, invoice), invoice };
}

async function getCheckoutSessionByToken(input = {}, db = prisma) {
  const sessionToken = trimText(input.sessionToken || input.token, 200);
  if (!sessionToken) return null;
  const scopedDb = getScopedBillingDb(input.tenantId, db);
  const attempt = await findPaymentAttemptByExternalRef(scopedDb, sessionToken);
  if (!attempt) return null;
  const invoice = attempt.invoiceId ? await findInvoiceById(scopedDb, attempt.invoiceId) : null;
  return buildCheckoutSession(attempt, invoice);
}

async function processBillingWebhookEvent(input = {}, db = prisma) {
  let payload = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload : {};
  const rawPayload = typeof input.rawPayload === 'string' ? input.rawPayload : JSON.stringify(payload);
  const webhookSecret = trimText(input.webhookSecret || getBillingWebhookSecret(), 240);
  const stripeSignature = trimText(input.stripeSignature, 800);
  if (stripeSignature) {
    if (!verifyStripeWebhookSignature(rawPayload, stripeSignature, webhookSecret)) {
      return { ok: false, reason: 'billing-webhook-signature-invalid' };
    }
    if (!payload || !Object.keys(payload).length) {
      payload = rawPayload ? JSON.parse(rawPayload) : {};
    }
  } else if (webhookSecret && trimText(input.signature, 240)) {
    const computed = computeBillingWebhookSignature(rawPayload, webhookSecret);
    if (!safeCompare(trimText(input.signature, 240), computed)) {
      return { ok: false, reason: 'billing-webhook-signature-invalid' };
    }
  }
  const stripeObject = payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data.object || null
    : null;
  const stripeMetadata = parseJsonObject(stripeObject?.metadata);
  const provider = stripeSignature ? 'stripe' : normalizeProvider(input.provider || payload.provider || stripeMetadata.provider || getConfiguredBillingProvider());
  const eventType = trimText(input.eventType || payload.eventType || payload.type, 120).toLowerCase();
  const tenantId = trimText(input.tenantId || payload.tenantId || stripeMetadata.tenantId, 160);
  const externalRef = trimText(
    input.externalRef
      || payload.sessionToken
      || payload.externalRef
      || stripeObject?.client_reference_id
      || stripeMetadata.sessionToken
      || payload.id,
    200,
  );
  const scopedDb = getScopedBillingDb(tenantId, db);
  const existingAttempt = externalRef ? await findPaymentAttemptByExternalRef(scopedDb, externalRef) : null;
  const invoiceId = trimText(input.invoiceId || payload.invoiceId || stripeMetadata.invoiceId, 160);
  const invoice = invoiceId
    ? await findInvoiceById(scopedDb, invoiceId)
    : existingAttempt?.invoiceId
      ? await findInvoiceById(scopedDb, existingAttempt.invoiceId)
      : null;
  if (!invoice) return { ok: false, reason: 'billing-invoice-not-found' };
  if (provider === 'stripe' && stripeObject?.customer) {
    await ensureBillingCustomer({
      tenantId: invoice.tenantId,
      userId: null,
      email: trimText(stripeObject?.customer_details?.email || stripeObject?.customer_email, 200).toLowerCase() || null,
      displayName: trimText(stripeObject?.customer_details?.name, 200) || null,
      externalRef: trimText(stripeObject.customer, 200),
      metadata: { provider: 'stripe', lastStripeSessionId: trimText(stripeObject.id, 200) || null },
    }, scopedDb).catch(() => null);
  }
  const subscriptionId = trimText(input.subscriptionId || payload.subscriptionId || stripeMetadata.subscriptionId || invoice.subscriptionId, 160) || null;
  let invoiceStatus = invoice.status;
  let paymentStatus = existingAttempt?.status || 'pending';
  let subscriptionPatch = null;

  if (
    eventType === 'invoice.payment_failed'
    || eventType === 'payment.failed'
    || eventType === 'checkout.session.async_payment_failed'
  ) {
    invoiceStatus = 'past_due';
    paymentStatus = 'failed';
    subscriptionPatch = {
      status: 'past_due',
      externalRef: externalRef || invoice.externalRef || null,
      metadata: { lastPaymentFailureAt: new Date().toISOString(), lastBillingProvider: provider },
    };
  } else if (
    eventType === 'subscription.canceled'
    || eventType === 'invoice.canceled'
    || eventType === 'checkout.session.expired'
  ) {
    invoiceStatus = invoice.status === 'paid' ? 'paid' : 'canceled';
    paymentStatus = 'canceled';
    subscriptionPatch = {
      status: 'canceled',
      canceledAt: new Date(),
      externalRef: externalRef || invoice.externalRef || null,
      metadata: { canceledByProvider: provider },
    };
  } else if (provider === 'stripe' && eventType === 'checkout.session.completed' && String(stripeObject?.payment_status || '').trim().toLowerCase() !== 'paid') {
    invoiceStatus = invoice.status;
    paymentStatus = 'processing';
    subscriptionPatch = null;
  } else {
    const targetCycle = normalizeBillingCycle(payload.billingCycle || stripeMetadata.billingCycle || invoice.metadata?.targetBillingCycle || 'monthly');
    const renewDays = resolveBillingCycleDays(targetCycle);
    invoiceStatus = 'paid';
    paymentStatus = 'succeeded';
    subscriptionPatch = {
      planId: trimText(payload.planId || stripeMetadata.planId || invoice.metadata?.targetPlanId, 120) || undefined,
      billingCycle: targetCycle,
      status: 'active',
      amountCents: invoice.amountCents,
      currency: invoice.currency,
      renewsAt: renewDays > 0 ? addDays(new Date(), renewDays) : null,
      canceledAt: null,
      externalRef: externalRef || invoice.externalRef || null,
      metadata: {
        packageId: trimText(payload.packageId || stripeMetadata.packageId || invoice.metadata?.targetPackageId, 120) || null,
        lastSuccessfulPaymentAt: new Date().toISOString(),
        lastBillingProvider: provider,
      },
    };
  }

  const updatedInvoice = await updateInvoiceStatus({
    invoiceId: invoice.id,
    tenantId: invoice.tenantId,
    status: invoiceStatus,
    paidAt: invoiceStatus === 'paid' ? new Date() : null,
    externalRef: externalRef || invoice.externalRef || null,
    metadata: { lastWebhookEventType: eventType, lastWebhookAt: new Date().toISOString() },
  }, scopedDb);

  const attemptResult = existingAttempt?.id
    ? await updatePaymentAttempt({
      attemptId: existingAttempt.id,
      tenantId: existingAttempt.tenantId,
      status: paymentStatus,
      completedAt: ['succeeded', 'failed', 'canceled'].includes(paymentStatus) ? new Date() : null,
      externalRef: externalRef || existingAttempt.externalRef || null,
      errorCode: paymentStatus === 'failed' ? trimText(payload.errorCode, 120) || 'payment_failed' : null,
      errorDetail: paymentStatus === 'failed' ? trimText(payload.errorDetail || payload.message, 600) || null : null,
      metadata: { lastWebhookEventType: eventType, lastWebhookAt: new Date().toISOString() },
    }, scopedDb)
    : await recordPaymentAttempt({
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      provider,
      status: paymentStatus,
      amountCents: invoice.amountCents,
      currency: invoice.currency,
      externalRef,
      completedAt: ['succeeded', 'failed', 'canceled'].includes(paymentStatus) ? new Date() : null,
      errorCode: paymentStatus === 'failed' ? trimText(payload.errorCode, 120) || 'payment_failed' : null,
      errorDetail: paymentStatus === 'failed' ? trimText(payload.errorDetail || payload.message, 600) || null : null,
      metadata: { webhookReplay: true, eventType },
    }, scopedDb);

  const subscriptionResult = subscriptionId && subscriptionPatch
    ? await updateSubscriptionBillingState({
      tenantId: invoice.tenantId,
      subscriptionId,
      ...subscriptionPatch,
    }, scopedDb).catch(() => null)
    : null;

  const event = subscriptionId
    ? await recordSubscriptionEvent({
      tenantId: invoice.tenantId,
      subscriptionId,
      eventType: eventType || 'billing.webhook',
      billingStatus: subscriptionPatch?.status || invoiceStatus,
      actor: trimText(input.actor, 200) || 'billing-webhook',
      payload: { invoiceId: invoice.id, provider, externalRef, webhookPayload: payload },
    }, scopedDb).catch(() => null)
    : null;

  return {
    ok: true,
    invoice: updatedInvoice?.invoice || invoice,
    attempt: attemptResult?.attempt || null,
    subscription: subscriptionResult?.subscription || null,
    event: event?.event || null,
  };
}

async function finalizeCheckoutSession(input = {}, db = prisma) {
  const session = await getCheckoutSessionByToken({ sessionToken: input.sessionToken || input.token, tenantId: input.tenantId }, db);
  if (!session) return { ok: false, reason: 'checkout-session-not-found' };
  const stripeSessionId = trimText(
    input.stripeSessionId
      || input.stripe_session_id
      || input.providerSessionId
      || session.metadata?.providerSessionId,
    200,
  );
  if (session.provider === 'stripe' && stripeSessionId) {
    const stripeSession = await retrieveStripeCheckoutSession(stripeSessionId).catch(() => null);
    if (stripeSession) {
      const stripeEventType = String(stripeSession.payment_status || '').trim().toLowerCase() === 'paid'
        ? 'checkout.session.completed'
        : String(stripeSession.status || '').trim().toLowerCase() === 'expired'
          ? 'checkout.session.expired'
          : 'checkout.session.async_payment_failed';
      return processBillingWebhookEvent({
        tenantId: session.tenantId,
        provider: 'stripe',
        eventType: stripeEventType,
        invoiceId: session.invoiceId,
        subscriptionId: session.subscriptionId,
        externalRef: session.sessionToken,
        actor: trimText(input.actor, 200) || 'public-checkout',
        payload: {
          type: stripeEventType,
          data: {
            object: {
              id: stripeSession.id,
              payment_status: stripeSession.payment_status,
              status: stripeSession.status,
              customer: stripeSession.customer,
              customer_details: stripeSession.customer_details,
              client_reference_id: stripeSession.client_reference_id || session.sessionToken,
              metadata: stripeSession.metadata || {
                invoiceId: session.invoiceId,
                subscriptionId: session.subscriptionId,
                sessionToken: session.sessionToken,
              },
            },
          },
        },
      }, db);
    }
  }
  const action = trimText(input.action, 40).toLowerCase() || 'paid';
  const eventType = action === 'failed'
    ? 'invoice.payment_failed'
    : action === 'canceled'
      ? 'subscription.canceled'
      : 'invoice.paid';
  return processBillingWebhookEvent({
    tenantId: session.tenantId,
    provider: session.provider,
    eventType,
    invoiceId: session.invoiceId,
    subscriptionId: session.subscriptionId,
    externalRef: session.sessionToken,
    actor: trimText(input.actor, 200) || 'public-checkout',
    payload: { sessionToken: session.sessionToken, action, invoiceId: session.invoiceId, subscriptionId: session.subscriptionId, tenantId: session.tenantId },
  }, db);
}

module.exports = {
  computeBillingWebhookSignature,
  createCheckoutSession,
  createInvoiceDraft,
  ensureBillingCustomer,
  ensurePlatformBillingLifecycleTables,
  finalizeCheckoutSession,
  getBillingProviderConfigSummary,
  getCheckoutSessionByToken,
  listBillingInvoices,
  listBillingPaymentAttempts,
  processBillingWebhookEvent,
  recordPaymentAttempt,
  recordSubscriptionEvent,
  updateInvoiceStatus,
  updateSubscriptionBillingState,
};
