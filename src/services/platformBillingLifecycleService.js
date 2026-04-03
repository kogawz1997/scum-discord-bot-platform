'use strict';

const crypto = require('node:crypto');
const { Prisma } = require('@prisma/client');

const { prisma, getTenantScopedPrismaClient } = require('../prisma');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const {
  getCompatibilityClientKey,
  ensureSqliteDateTimeSchemaCompatibility,
  reconcileSqliteDateColumns,
} = require('../utils/sqliteDateTimeCompatibility');

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

function createStableHash(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
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
  return ['draft', 'open', 'paid', 'past_due', 'void', 'canceled', 'failed', 'refunded', 'disputed'].includes(normalized)
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
  if (normalized === 'trial') return 'trialing';
  return ['active', 'trialing', 'pending', 'past_due', 'suspended', 'canceled', 'expired'].includes(normalized)
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

function hasOwn(obj, key) {
  return Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);
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

function resolveCheckoutIdempotencyKey(input = {}) {
  return trimText(
    input.idempotencyKey
      || input?.metadata?.idempotencyKey,
    200,
  ) || null;
}

function buildCheckoutFingerprint(input = {}) {
  return createStableHash(JSON.stringify({
    tenantId: trimText(input.tenantId, 160) || null,
    subscriptionId: trimText(input.subscriptionId, 160) || null,
    customerId: trimText(input.customerId, 160) || null,
    invoiceId: trimText(input.invoiceId, 160) || null,
    planId: trimText(input.planId, 120) || null,
    packageId: trimText(input.packageId, 120) || null,
    billingCycle: normalizeBillingCycle(input.billingCycle),
    amountCents: asInt(input.amountCents, 0, 0),
    currency: normalizeCurrency(input.currency),
    provider: normalizeProvider(input.provider || getConfiguredBillingProvider()),
  }));
}

function canReuseCheckoutAttempt(attempt, invoice = null) {
  const status = normalizePaymentStatus(attempt?.status, '');
  if (!['pending', 'requires_action', 'processing'].includes(status)) {
    return false;
  }
  const metadata = parseJsonObject(attempt?.metadata || attempt?.metadataJson);
  if (metadata.checkoutSession !== true) return false;
  const expiresAt = parseDate(metadata.expiresAt);
  if (expiresAt && expiresAt.getTime() <= Date.now()) return false;
  const invoiceStatus = normalizeInvoiceStatus(invoice?.status, 'open');
  if (['paid', 'void', 'canceled', 'refunded'].includes(invoiceStatus)) {
    return false;
  }
  return true;
}

function matchesCheckoutShape(metadata = {}, input = {}) {
  return (
    trimText(metadata.subscriptionId, 160) === (trimText(input.subscriptionId, 160) || null)
    && trimText(metadata.customerId, 160) === (trimText(input.customerId, 160) || null)
    && trimText(metadata.planId, 120) === (trimText(input.planId, 120) || null)
    && trimText(metadata.packageId, 120) === (trimText(input.packageId, 120) || null)
    && normalizeBillingCycle(metadata.billingCycle) === normalizeBillingCycle(input.billingCycle)
    && asInt(metadata.targetAmountCents, 0, 0) === asInt(input.amountCents, 0, 0)
    && normalizeCurrency(metadata.currency || input.currency) === normalizeCurrency(input.currency)
  );
}

function getBillingCustomerDelegate(client = null) {
  const delegate = client && typeof client === 'object' ? client.platformBillingCustomer : null;
  if (!delegate || typeof delegate.findUnique !== 'function' || typeof delegate.create !== 'function') {
    return null;
  }
  return delegate;
}

function getBillingInvoiceDelegate(client = null) {
  const delegate = client && typeof client === 'object' ? client.platformBillingInvoice : null;
  if (!delegate || typeof delegate.findUnique !== 'function' || typeof delegate.create !== 'function') {
    return null;
  }
  return delegate;
}

function getBillingPaymentAttemptDelegate(client = null) {
  const delegate = client && typeof client === 'object' ? client.platformBillingPaymentAttempt : null;
  if (!delegate || typeof delegate.findUnique !== 'function' || typeof delegate.create !== 'function') {
    return null;
  }
  return delegate;
}

function getBillingSubscriptionEventDelegate(client = null) {
  const delegate = client && typeof client === 'object' ? client.platformSubscriptionEvent : null;
  if (!delegate || typeof delegate.findUnique !== 'function' || typeof delegate.create !== 'function') {
    return null;
  }
  return delegate;
}

function getBillingDelegates(client = null) {
  const customer = getBillingCustomerDelegate(client);
  const invoice = getBillingInvoiceDelegate(client);
  const paymentAttempt = getBillingPaymentAttemptDelegate(client);
  const subscriptionEvent = getBillingSubscriptionEventDelegate(client);
  if (!customer || !invoice || !paymentAttempt || !subscriptionEvent) {
    return null;
  }
  return {
    customer,
    invoice,
    paymentAttempt,
    subscriptionEvent,
  };
}

function getBillingDelegatesOrThrow(client = null) {
  const delegates = getBillingDelegates(client);
  if (delegates) return delegates;
  throw new Error('platform-billing-lifecycle-delegates-unavailable');
}

function isSharedBillingPrismaClient(client = null) {
  if (!client || !prisma) return false;
  if (client === prisma) return true;
  const clientOriginal = client && typeof client === 'object' ? client._originalClient : null;
  const sharedOriginal = prisma && typeof prisma === 'object' ? prisma._originalClient : null;
  return Boolean(clientOriginal && sharedOriginal && clientOriginal === sharedOriginal);
}

const sharedBillingSqliteCompatibilityReady = new WeakSet();
const BILLING_SQLITE_COMPATIBILITY_TABLES = [
  {
    tableName: 'platform_billing_customers',
    columns: ['id', 'tenantId', 'userId', 'email', 'displayName', 'externalRef', 'status', 'metadataJson', 'createdAt', 'updatedAt'],
    dateColumns: ['createdAt', 'updatedAt'],
    createTableSql: `
      CREATE TABLE "platform_billing_customers" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "userId" TEXT,
        "email" TEXT,
        "displayName" TEXT,
        "externalRef" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "metadataJson" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    indexSql: [
      'CREATE UNIQUE INDEX "platform_billing_customers_tenantId_key" ON "platform_billing_customers"("tenantId");',
      'CREATE INDEX "platform_billing_customers_status_updatedAt_idx" ON "platform_billing_customers"("status", "updatedAt");',
      'CREATE INDEX "platform_billing_customers_userId_updatedAt_idx" ON "platform_billing_customers"("userId", "updatedAt");',
    ],
  },
  {
    tableName: 'platform_billing_invoices',
    columns: ['id', 'tenantId', 'subscriptionId', 'customerId', 'status', 'currency', 'amountCents', 'dueAt', 'paidAt', 'externalRef', 'metadataJson', 'createdAt', 'updatedAt'],
    dateColumns: ['dueAt', 'paidAt', 'createdAt', 'updatedAt'],
    createTableSql: `
      CREATE TABLE "platform_billing_invoices" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "subscriptionId" TEXT,
        "customerId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "currency" TEXT NOT NULL DEFAULT 'THB',
        "amountCents" INTEGER NOT NULL DEFAULT 0,
        "dueAt" DATETIME,
        "paidAt" DATETIME,
        "externalRef" TEXT,
        "metadataJson" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    indexSql: [
      'CREATE INDEX "platform_billing_invoices_tenant_createdAt_idx" ON "platform_billing_invoices"("tenantId", "createdAt");',
      'CREATE INDEX "platform_billing_invoices_subscription_status_updatedAt_idx" ON "platform_billing_invoices"("subscriptionId", "status", "updatedAt");',
      'CREATE INDEX "platform_billing_invoices_customer_status_updatedAt_idx" ON "platform_billing_invoices"("customerId", "status", "updatedAt");',
    ],
  },
  {
    tableName: 'platform_billing_payment_attempts',
    columns: ['id', 'invoiceId', 'tenantId', 'provider', 'status', 'amountCents', 'currency', 'externalRef', 'errorCode', 'errorDetail', 'attemptedAt', 'completedAt', 'metadataJson', 'createdAt', 'updatedAt'],
    dateColumns: ['attemptedAt', 'completedAt', 'createdAt', 'updatedAt'],
    createTableSql: `
      CREATE TABLE "platform_billing_payment_attempts" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "invoiceId" TEXT,
        "tenantId" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "amountCents" INTEGER NOT NULL DEFAULT 0,
        "currency" TEXT NOT NULL DEFAULT 'THB',
        "externalRef" TEXT,
        "errorCode" TEXT,
        "errorDetail" TEXT,
        "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" DATETIME,
        "metadataJson" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    indexSql: [
      'CREATE INDEX "platform_billing_payment_attempts_tenant_attemptedAt_idx" ON "platform_billing_payment_attempts"("tenantId", "attemptedAt");',
      'CREATE INDEX "platform_billing_payment_attempts_invoice_status_attemptedAt_idx" ON "platform_billing_payment_attempts"("invoiceId", "status", "attemptedAt");',
      'CREATE INDEX "platform_billing_payment_attempts_provider_status_attemptedAt_idx" ON "platform_billing_payment_attempts"("provider", "status", "attemptedAt");',
    ],
  },
  {
    tableName: 'platform_subscription_events',
    columns: ['id', 'tenantId', 'subscriptionId', 'eventType', 'billingStatus', 'actor', 'payloadJson', 'occurredAt', 'createdAt', 'updatedAt'],
    dateColumns: ['occurredAt', 'createdAt', 'updatedAt'],
    createTableSql: `
      CREATE TABLE "platform_subscription_events" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "subscriptionId" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "billingStatus" TEXT,
        "actor" TEXT,
        "payloadJson" TEXT,
        "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    indexSql: [
      'CREATE INDEX "platform_subscription_events_tenant_occurredAt_idx" ON "platform_subscription_events"("tenantId", "occurredAt");',
      'CREATE INDEX "platform_subscription_events_subscription_occurredAt_idx" ON "platform_subscription_events"("subscriptionId", "occurredAt");',
      'CREATE INDEX "platform_subscription_events_type_occurredAt_idx" ON "platform_subscription_events"("eventType", "occurredAt");',
    ],
  },
];

function hasSharedBillingSqliteCompatibility(client = null) {
  const key = getCompatibilityClientKey(client);
  return Boolean(key && sharedBillingSqliteCompatibilityReady.has(key));
}

async function ensureSharedBillingSqliteCompatibility(client = prisma) {
  const runtime = resolveDatabaseRuntime();
  if (!runtime.isSqlite) return { ok: false, reason: 'runtime-not-sqlite' };
  if (!isSharedBillingPrismaClient(client) || !getBillingDelegates(client)) {
    return { ok: false, reason: 'shared-billing-client-unavailable' };
  }
  const key = getCompatibilityClientKey(client);
  if (key && sharedBillingSqliteCompatibilityReady.has(key)) {
    return { ok: true, reused: true, tables: [] };
  }

  if (runtime.filePath) {
    ensureSqliteDateTimeSchemaCompatibility(runtime.filePath, BILLING_SQLITE_COMPATIBILITY_TABLES);
  }

  const tables = [];
  tables.push(await reconcileSqliteDateColumns(client, {
    tableName: 'platform_billing_customers',
    idColumn: 'id',
    dateColumns: ['createdAt', 'updatedAt'],
  }));
  tables.push(await reconcileSqliteDateColumns(client, {
    tableName: 'platform_billing_invoices',
    idColumn: 'id',
    dateColumns: ['dueAt', 'paidAt', 'createdAt', 'updatedAt'],
  }));
  tables.push(await reconcileSqliteDateColumns(client, {
    tableName: 'platform_billing_payment_attempts',
    idColumn: 'id',
    dateColumns: ['attemptedAt', 'completedAt', 'createdAt', 'updatedAt'],
  }));
  tables.push(await reconcileSqliteDateColumns(client, {
    tableName: 'platform_subscription_events',
    idColumn: 'id',
    dateColumns: ['occurredAt', 'createdAt', 'updatedAt'],
  }));

  if (key) {
    sharedBillingSqliteCompatibilityReady.add(key);
  }
  return { ok: true, reused: false, tables };
}

function getBillingPersistenceMode(client = null) {
  if (client && getBillingDelegates(client)) {
    if (!isSharedBillingPrismaClient(client)) return 'prisma';
    if (hasSharedBillingSqliteCompatibility(client)) return 'prisma';
  }
  const runtime = resolveDatabaseRuntime();
  return runtime.isServerEngine ? 'prisma' : 'sql';
}

async function ensurePlatformBillingLifecycleTables(db = prisma) {
  await ensureSharedBillingSqliteCompatibility(db).catch(() => null);
  if (getBillingPersistenceMode(db) !== 'prisma') return;
  getBillingDelegatesOrThrow(db);
}

async function getCustomerRowByTenantRaw(db, tenantId) {
  if (getBillingPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw`
      SELECT id, tenantId, userId, email, displayName, externalRef, status, metadataJson, createdAt, updatedAt
      FROM platform_billing_customers
      WHERE tenantId = ${tenantId}
      LIMIT 1
    `;
    return normalizeCustomerRow(Array.isArray(rows) ? rows[0] : null);
  }
  const { customer } = getBillingDelegatesOrThrow(db);
  const row = await customer.findUnique({
    where: { tenantId },
  }).catch(() => null);
  return normalizeCustomerRow(row);
}

async function getInvoiceRowByIdRaw(db, invoiceId) {
  if (getBillingPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw`
      SELECT id, tenantId, subscriptionId, customerId, status, currency, amountCents, dueAt, paidAt, externalRef, metadataJson, createdAt, updatedAt
      FROM platform_billing_invoices
      WHERE id = ${invoiceId}
      LIMIT 1
    `;
    return normalizeInvoiceRow(Array.isArray(rows) ? rows[0] : null);
  }
  const { invoice } = getBillingDelegatesOrThrow(db);
  const row = await invoice.findUnique({
    where: { id: invoiceId },
  }).catch(() => null);
  return normalizeInvoiceRow(row);
}

async function getPaymentAttemptRowByIdRaw(db, attemptId) {
  if (getBillingPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw`
      SELECT id, invoiceId, tenantId, provider, status, amountCents, currency, externalRef, errorCode, errorDetail, attemptedAt, completedAt, metadataJson, createdAt, updatedAt
      FROM platform_billing_payment_attempts
      WHERE id = ${attemptId}
      LIMIT 1
    `;
    return normalizePaymentAttemptRow(Array.isArray(rows) ? rows[0] : null);
  }
  const { paymentAttempt } = getBillingDelegatesOrThrow(db);
  const row = await paymentAttempt.findUnique({
    where: { id: attemptId },
  }).catch(() => null);
  return normalizePaymentAttemptRow(row);
}

async function getPaymentAttemptRowByExternalRefRaw(db, externalRef) {
  if (getBillingPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw`
      SELECT id, invoiceId, tenantId, provider, status, amountCents, currency, externalRef, errorCode, errorDetail, attemptedAt, completedAt, metadataJson, createdAt, updatedAt
      FROM platform_billing_payment_attempts
      WHERE externalRef = ${externalRef}
      ORDER BY updatedAt DESC, createdAt DESC
      LIMIT 1
    `;
    return normalizePaymentAttemptRow(Array.isArray(rows) ? rows[0] : null);
  }
  const { paymentAttempt } = getBillingDelegatesOrThrow(db);
  const row = await paymentAttempt.findFirst({
    where: { externalRef },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  }).catch(() => null);
  return normalizePaymentAttemptRow(row);
}

async function listBillingInvoices(options = {}, db = prisma) {
  const tenantId = trimText(options.tenantId, 160) || null;
  const status = trimText(options.status, 40) || null;
  const limit = Math.max(1, Math.min(500, asInt(options.limit, 50, 1)));
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  if (getBillingPersistenceMode(scopedDb) !== 'prisma') {
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
  const { invoice } = getBillingDelegatesOrThrow(scopedDb);
  const rows = await invoice.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  }).catch(() => []);
  return Array.isArray(rows) ? rows.map(normalizeInvoiceRow).filter(Boolean) : [];
}

async function listBillingPaymentAttempts(options = {}, db = prisma) {
  const tenantId = trimText(options.tenantId, 160) || null;
  const status = trimText(options.status, 40) || null;
  const provider = trimText(options.provider, 80) || null;
  const limit = Math.max(1, Math.min(500, asInt(options.limit, 50, 1)));
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  if (getBillingPersistenceMode(scopedDb) !== 'prisma') {
    const rows = await scopedDb.$queryRaw(Prisma.sql`
      SELECT id, invoiceId, tenantId, provider, status, amountCents, currency, externalRef, errorCode, errorDetail, attemptedAt, completedAt, metadataJson, createdAt, updatedAt
      FROM platform_billing_payment_attempts
      ${tenantId || status || provider ? Prisma.sql`WHERE 1 = 1` : Prisma.empty}
      ${tenantId ? Prisma.sql`AND tenantId = ${tenantId}` : Prisma.empty}
      ${status ? Prisma.sql`AND status = ${status}` : Prisma.empty}
      ${provider ? Prisma.sql`AND provider = ${provider}` : Prisma.empty}
      ORDER BY updatedAt DESC, createdAt DESC
      LIMIT ${limit}
    `);
    return Array.isArray(rows) ? rows.map(normalizePaymentAttemptRow).filter(Boolean) : [];
  }
  const { paymentAttempt } = getBillingDelegatesOrThrow(scopedDb);
  const rows = await paymentAttempt.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(status ? { status } : {}),
      ...(provider ? { provider } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  }).catch(() => []);
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
  if (getBillingPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw`
      SELECT id, tenantId, subscriptionId, eventType, billingStatus, actor, payloadJson, occurredAt, createdAt, updatedAt
      FROM platform_subscription_events
      WHERE id = ${eventId}
      LIMIT 1
    `;
    return normalizeSubscriptionEventRow(Array.isArray(rows) ? rows[0] : null);
  }
  const { subscriptionEvent } = getBillingDelegatesOrThrow(db);
  const row = await subscriptionEvent.findUnique({
    where: { id: eventId },
  }).catch(() => null);
  return normalizeSubscriptionEventRow(row);
}

async function ensureBillingCustomer(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  if (getBillingPersistenceMode(scopedDb) !== 'prisma') {
    const existing = await getCustomerRowByTenantRaw(scopedDb, tenantId);
    const nextId = existing?.id || trimText(input.id, 160) || createId('cust');
    const metadataJson = buildJson(mergeMeta(existing?.metadata, input.metadata));
    const now = new Date().toISOString();
    if (existing) {
      await scopedDb.$executeRaw`
        UPDATE platform_billing_customers
        SET
          userId = ${trimText(input.userId, 160) || existing.userId || null},
          email = ${trimText(input.email, 200).toLowerCase() || existing.email || null},
          displayName = ${trimText(input.displayName, 200) || existing.displayName || null},
          externalRef = ${trimText(input.externalRef, 200) || existing.externalRef || null},
          status = ${trimText(input.status, 40) || existing.status || 'active'},
          metadataJson = ${metadataJson},
          updatedAt = ${now}
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
          ${now},
          ${now}
        )
      `;
    }
    return { ok: true, customer: await getCustomerRowByTenantRaw(scopedDb, tenantId) };
  }
  const { customer } = getBillingDelegatesOrThrow(scopedDb);
  const existing = await getCustomerRowByTenantRaw(scopedDb, tenantId);
  const nextId = existing?.id || trimText(input.id, 160) || createId('cust');
  const metadataJson = buildJson(mergeMeta(existing?.metadata, input.metadata));
  const now = new Date();
  if (existing) {
    await customer.update({
      where: { id: nextId },
      data: {
        userId: trimText(input.userId, 160) || existing.userId || null,
        email: trimText(input.email, 200).toLowerCase() || existing.email || null,
        displayName: trimText(input.displayName, 200) || existing.displayName || null,
        externalRef: trimText(input.externalRef, 200) || existing.externalRef || null,
        status: trimText(input.status, 40) || existing.status || 'active',
        metadataJson,
        updatedAt: now,
      },
    });
  } else {
    await customer.create({
      data: {
        id: nextId,
        tenantId,
        userId: trimText(input.userId, 160) || null,
        email: trimText(input.email, 200).toLowerCase() || null,
        displayName: trimText(input.displayName, 200) || null,
        externalRef: trimText(input.externalRef, 200) || null,
        status: trimText(input.status, 40) || 'active',
        metadataJson,
        createdAt: now,
        updatedAt: now,
      },
    });
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

async function findReusableCheckoutSession(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return null;
  const scopedDb = getScopedBillingDb(tenantId, db);
  const provider = normalizeProvider(input.provider || getConfiguredBillingProvider());
  const targetInvoiceId = trimText(input.invoiceId, 160) || null;
  const idempotencyKey = resolveCheckoutIdempotencyKey(input);
  const checkoutFingerprint = buildCheckoutFingerprint({
    ...input,
    tenantId,
    provider,
  });
  const attempts = await listBillingPaymentAttempts({
    tenantId,
    limit: 40,
  }, scopedDb).catch(() => []);

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    if (normalizeProvider(attempt?.provider) !== provider) continue;
    const metadata = parseJsonObject(attempt?.metadata || attempt?.metadataJson);
    const invoice = attempt?.invoiceId
      ? await findInvoiceById(scopedDb, attempt.invoiceId).catch(() => null)
      : null;
    if (!canReuseCheckoutAttempt(attempt, invoice)) continue;
    const matchesInvoice = targetInvoiceId && trimText(attempt?.invoiceId, 160) === targetInvoiceId;
    const matchesIdempotencyKey =
      idempotencyKey
      && trimText(metadata.idempotencyKey, 200) === idempotencyKey;
    const matchesFingerprint =
      trimText(metadata.checkoutFingerprint, 120) === checkoutFingerprint;
    const matchesShape = matchesCheckoutShape(metadata, input);
    if (!matchesInvoice && !matchesIdempotencyKey && !matchesFingerprint && !matchesShape) continue;
    return {
      invoice,
      attempt,
      session: buildCheckoutSession(attempt, invoice),
    };
  }
  return null;
}

async function createInvoiceDraft(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  if (getBillingPersistenceMode(scopedDb) !== 'prisma') {
    const invoiceId = trimText(input.id, 160) || createId('inv');
    const now = new Date().toISOString();
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
        ${now},
        ${now}
      )
    `;
    return { ok: true, invoice: await getInvoiceRowByIdRaw(scopedDb, invoiceId) };
  }
  const { invoice } = getBillingDelegatesOrThrow(scopedDb);
  const invoiceId = trimText(input.id, 160) || createId('inv');
  const now = new Date();
  await invoice.create({
    data: {
      id: invoiceId,
      tenantId,
      subscriptionId: trimText(input.subscriptionId, 160) || null,
      customerId: trimText(input.customerId, 160) || null,
      status: normalizeInvoiceStatus(input.status, 'draft'),
      currency: normalizeCurrency(input.currency),
      amountCents: asInt(input.amountCents, 0, 0),
      dueAt: parseDate(input.dueAt),
      paidAt: parseDate(input.paidAt),
      externalRef: trimText(input.externalRef, 200) || null,
      metadataJson: buildJson(input.metadata),
      createdAt: now,
      updatedAt: now,
    },
  });
  return { ok: true, invoice: await getInvoiceRowByIdRaw(scopedDb, invoiceId) };
}

async function updateInvoiceStatus(input = {}, db = prisma) {
  const invoiceId = trimText(input.invoiceId, 160);
  if (!invoiceId) return { ok: false, reason: 'invoice-required' };
  const scopedDb = getScopedBillingDb(input.tenantId, db);
  const existing = await getInvoiceRowByIdRaw(scopedDb, invoiceId);
  if (!existing) return { ok: false, reason: 'invoice-not-found' };
  const nextStatus = normalizeInvoiceStatus(input.status, existing.status || 'draft');
  const paidAt = input.paidAt === null
    ? null
    : parseDate(input.paidAt) || (nextStatus === 'paid' ? new Date() : parseDate(existing.paidAt));
  const externalRef = trimText(input.externalRef, 200) || existing.externalRef || null;
  const mergedMetadata = mergeMeta(existing.metadata, input.metadata);
  if (getBillingPersistenceMode(scopedDb) !== 'prisma') {
    await scopedDb.$executeRaw`
      UPDATE platform_billing_invoices
      SET
        status = ${nextStatus},
        paidAt = ${toIso(paidAt)},
        externalRef = ${externalRef},
        metadataJson = ${buildJson(mergedMetadata)},
        updatedAt = ${new Date().toISOString()}
      WHERE id = ${invoiceId}
    `;
  } else {
    const { invoice } = getBillingDelegatesOrThrow(scopedDb);
    await invoice.update({
      where: { id: invoiceId },
      data: {
        status: nextStatus,
        paidAt,
        externalRef,
        metadataJson: buildJson(mergedMetadata),
        updatedAt: new Date(),
      },
    });
  }

  const invoice = await getInvoiceRowByIdRaw(scopedDb, invoiceId);
  if (!invoice || input.applyLifecycle === false || !invoice.subscriptionId) {
    return { ok: true, invoice };
  }

  const invoiceMetadata = parseJsonObject(invoice.metadata || invoice.metadataJson);
  const existingSubscription = await findTenantSubscription(scopedDb, invoice.tenantId, invoice.subscriptionId).catch(() => null);
  if (!existingSubscription) {
    return { ok: true, invoice };
  }

  let subscriptionResult = null;
  const actor = trimText(input.actor, 200) || 'owner-billing';
  if (nextStatus === 'paid') {
    subscriptionResult = await updateSubscriptionBillingState({
      tenantId: invoice.tenantId,
      subscriptionId: invoice.subscriptionId,
      planId: trimText(input.planId || invoiceMetadata.targetPlanId, 120) || undefined,
      billingCycle: trimText(input.billingCycle || invoiceMetadata.targetBillingCycle, 40) || undefined,
      status: 'active',
      amountCents: invoice.amountCents,
      currency: invoice.currency,
      canceledAt: null,
      externalRef,
      metadata: {
        packageId: trimText(input.packageId || invoiceMetadata.targetPackageId, 120) || null,
        lastInvoiceId: invoice.id,
        lastInvoiceStatus: nextStatus,
        lastSuccessfulPaymentAt: toIso(paidAt || new Date()),
      },
      actor,
    }, scopedDb).catch(() => null);
  } else if (nextStatus === 'past_due' || nextStatus === 'failed') {
    subscriptionResult = await updateSubscriptionBillingState({
      tenantId: invoice.tenantId,
      subscriptionId: invoice.subscriptionId,
      status: 'past_due',
      externalRef,
      metadata: {
        lastInvoiceId: invoice.id,
        lastInvoiceStatus: nextStatus,
        lastPaymentFailureAt: toIso(new Date()),
      },
      actor,
    }, scopedDb).catch(() => null);
  } else if (nextStatus === 'void' || nextStatus === 'canceled') {
    const currentSubscriptionStatus = normalizeSubscriptionStatus(existingSubscription.status, 'active');
    if (['pending', 'trialing', 'past_due'].includes(currentSubscriptionStatus)) {
      subscriptionResult = await updateSubscriptionBillingState({
        tenantId: invoice.tenantId,
        subscriptionId: invoice.subscriptionId,
        status: 'canceled',
        canceledAt: new Date(),
        externalRef,
        metadata: {
          lastInvoiceId: invoice.id,
          lastInvoiceStatus: nextStatus,
          canceledByInvoiceStatus: nextStatus,
        },
        actor,
      }, scopedDb).catch(() => null);
    }
  } else if (nextStatus === 'disputed') {
    const currentSubscriptionStatus = normalizeSubscriptionStatus(existingSubscription.status, 'active');
    if (!['canceled', 'expired'].includes(currentSubscriptionStatus)) {
      subscriptionResult = await updateSubscriptionBillingState({
        tenantId: invoice.tenantId,
        subscriptionId: invoice.subscriptionId,
        status: 'past_due',
        externalRef,
        metadata: {
          lastInvoiceId: invoice.id,
          lastInvoiceStatus: nextStatus,
          billingReviewState: 'disputed',
          disputedAt: toIso(new Date()),
        },
        actor,
      }, scopedDb).catch(() => null);
    }
  } else if (nextStatus === 'refunded') {
    const currentSubscriptionStatus = normalizeSubscriptionStatus(existingSubscription.status, 'active');
    if (['pending', 'trialing', 'past_due'].includes(currentSubscriptionStatus)) {
      subscriptionResult = await updateSubscriptionBillingState({
        tenantId: invoice.tenantId,
        subscriptionId: invoice.subscriptionId,
        status: 'canceled',
        canceledAt: new Date(),
        externalRef,
        metadata: {
          lastInvoiceId: invoice.id,
          lastInvoiceStatus: nextStatus,
          billingReviewState: 'refunded',
          refundedAt: toIso(new Date()),
        },
        actor,
      }, scopedDb).catch(() => null);
    } else if (!['canceled', 'expired'].includes(currentSubscriptionStatus)) {
      subscriptionResult = await updateSubscriptionBillingState({
        tenantId: invoice.tenantId,
        subscriptionId: invoice.subscriptionId,
        status: 'past_due',
        externalRef,
        metadata: {
          lastInvoiceId: invoice.id,
          lastInvoiceStatus: nextStatus,
          billingReviewState: 'refunded',
          refundedAt: toIso(new Date()),
        },
        actor,
      }, scopedDb).catch(() => null);
    }
  }

  return {
    ok: true,
    invoice,
    subscription: subscriptionResult?.subscription || null,
    event: subscriptionResult?.event || null,
  };
}

async function recordPaymentAttempt(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  if (getBillingPersistenceMode(scopedDb) !== 'prisma') {
    const attemptId = trimText(input.id, 160) || createId('pay');
    const now = new Date().toISOString();
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
        ${toIso(input.attemptedAt) || now},
        ${toIso(input.completedAt)},
        ${buildJson(input.metadata)},
        ${now},
        ${now}
      )
    `;
    return { ok: true, attempt: await getPaymentAttemptRowByIdRaw(scopedDb, attemptId) };
  }
  const { paymentAttempt } = getBillingDelegatesOrThrow(scopedDb);
  const attemptId = trimText(input.id, 160) || createId('pay');
  const now = new Date();
  await paymentAttempt.create({
    data: {
      id: attemptId,
      invoiceId: trimText(input.invoiceId, 160) || null,
      tenantId,
      provider: normalizeProvider(input.provider),
      status: normalizePaymentStatus(input.status, 'pending'),
      amountCents: asInt(input.amountCents, 0, 0),
      currency: normalizeCurrency(input.currency),
      externalRef: trimText(input.externalRef, 200) || null,
      errorCode: trimText(input.errorCode, 120) || null,
      errorDetail: trimText(input.errorDetail, 600) || null,
      attemptedAt: parseDate(input.attemptedAt) || now,
      completedAt: parseDate(input.completedAt),
      metadataJson: buildJson(input.metadata),
      createdAt: now,
      updatedAt: now,
    },
  });
  return { ok: true, attempt: await getPaymentAttemptRowByIdRaw(scopedDb, attemptId) };
}

async function updatePaymentAttempt(input = {}, db = prisma) {
  const attemptId = trimText(input.attemptId, 160);
  if (!attemptId) return { ok: false, reason: 'payment-attempt-required' };
  const scopedDb = getScopedBillingDb(input.tenantId, db);
  const existing = await getPaymentAttemptRowByIdRaw(scopedDb, attemptId);
  if (!existing) return { ok: false, reason: 'payment-attempt-not-found' };
  const nextStatus = normalizePaymentStatus(input.status, existing.status || 'pending');
  const completedAt = input.completedAt === null
    ? null
    : parseDate(input.completedAt) || (['succeeded', 'failed', 'canceled'].includes(nextStatus) ? new Date() : parseDate(existing.completedAt));
  const externalRef = trimText(input.externalRef, 200) || existing.externalRef || null;
  const errorCode = trimText(input.errorCode, 120) || null;
  const errorDetail = trimText(input.errorDetail, 600) || null;
  const mergedMetadata = mergeMeta(existing.metadata, input.metadata);
  if (getBillingPersistenceMode(scopedDb) !== 'prisma') {
    await scopedDb.$executeRaw`
      UPDATE platform_billing_payment_attempts
      SET
        status = ${nextStatus},
        completedAt = ${toIso(completedAt)},
        externalRef = ${externalRef},
        errorCode = ${errorCode},
        errorDetail = ${errorDetail},
        metadataJson = ${buildJson(mergedMetadata)},
        updatedAt = ${new Date().toISOString()}
      WHERE id = ${attemptId}
    `;
  } else {
    const { paymentAttempt } = getBillingDelegatesOrThrow(scopedDb);
    await paymentAttempt.update({
      where: { id: attemptId },
      data: {
        status: nextStatus,
        completedAt,
        externalRef,
        errorCode,
        errorDetail,
        metadataJson: buildJson(mergedMetadata),
        updatedAt: new Date(),
      },
    });
  }
  const attempt = await getPaymentAttemptRowByIdRaw(scopedDb, attemptId);
  if (!attempt || input.applyLifecycle === false || !attempt.invoiceId) {
    return { ok: true, attempt };
  }

  const invoice = await findInvoiceById(scopedDb, attempt.invoiceId);
  if (!invoice) {
    return { ok: true, attempt };
  }

  const invoiceMetadata = parseJsonObject(invoice.metadata || invoice.metadataJson);
  const lifecycleAt = completedAt || new Date();
  let invoiceResult = null;
  let subscriptionResult = null;
  const actor = trimText(input.actor, 200) || 'owner-billing';

  if (nextStatus === 'failed') {
    invoiceResult = await updateInvoiceStatus({
      invoiceId: invoice.id,
      tenantId: invoice.tenantId,
      applyLifecycle: false,
      status: 'past_due',
      paidAt: null,
      externalRef,
      metadata: {
        lastPaymentAttemptId: attempt.id,
        lastPaymentAttemptStatus: nextStatus,
        lastPaymentFailureAt: toIso(lifecycleAt),
        lastBillingProvider: attempt.provider,
      },
    }, scopedDb);
    if (invoice.subscriptionId) {
      subscriptionResult = await updateSubscriptionBillingState({
        tenantId: invoice.tenantId,
        subscriptionId: invoice.subscriptionId,
        status: 'past_due',
        externalRef,
        metadata: {
          lastPaymentFailureAt: toIso(lifecycleAt),
          lastBillingProvider: attempt.provider,
          lastPaymentAttemptId: attempt.id,
        },
        actor,
      }, scopedDb).catch(() => null);
    }
  } else if (nextStatus === 'succeeded') {
    const targetCycle = normalizeBillingCycle(
      input.billingCycle
        || invoiceMetadata.targetBillingCycle
        || 'monthly',
    );
    const renewDays = resolveBillingCycleDays(targetCycle);
    invoiceResult = await updateInvoiceStatus({
      invoiceId: invoice.id,
      tenantId: invoice.tenantId,
      applyLifecycle: false,
      status: 'paid',
      paidAt: lifecycleAt,
      externalRef,
      metadata: {
        lastPaymentAttemptId: attempt.id,
        lastPaymentAttemptStatus: nextStatus,
        lastSuccessfulPaymentAt: toIso(lifecycleAt),
        lastBillingProvider: attempt.provider,
      },
    }, scopedDb);
    if (invoice.subscriptionId) {
      subscriptionResult = await updateSubscriptionBillingState({
        tenantId: invoice.tenantId,
        subscriptionId: invoice.subscriptionId,
        planId: trimText(input.planId || invoiceMetadata.targetPlanId, 120) || undefined,
        billingCycle: targetCycle,
        status: 'active',
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        renewsAt: renewDays > 0 ? addDays(lifecycleAt, renewDays) : null,
        canceledAt: null,
        externalRef,
        metadata: {
          packageId: trimText(input.packageId || invoiceMetadata.targetPackageId, 120) || null,
          lastSuccessfulPaymentAt: toIso(lifecycleAt),
          lastBillingProvider: attempt.provider,
          lastPaymentAttemptId: attempt.id,
        },
        actor,
      }, scopedDb).catch(() => null);
    }
  } else if (nextStatus === 'canceled') {
    invoiceResult = await updateInvoiceStatus({
      invoiceId: invoice.id,
      tenantId: invoice.tenantId,
      applyLifecycle: false,
      status: normalizeInvoiceStatus(invoice.status, 'open') === 'paid' ? 'paid' : 'canceled',
      paidAt: normalizeInvoiceStatus(invoice.status, 'open') === 'paid' ? invoice.paidAt : null,
      externalRef,
      metadata: {
        lastPaymentAttemptId: attempt.id,
        lastPaymentAttemptStatus: nextStatus,
        canceledByAttempt: true,
        lastBillingProvider: attempt.provider,
      },
    }, scopedDb);
    if (invoice.subscriptionId) {
      const existingSubscription = await findTenantSubscription(scopedDb, invoice.tenantId, invoice.subscriptionId).catch(() => null);
      const currentSubscriptionStatus = normalizeSubscriptionStatus(existingSubscription?.status, 'active');
      if (existingSubscription && ['pending', 'trialing', 'past_due'].includes(currentSubscriptionStatus)) {
        subscriptionResult = await updateSubscriptionBillingState({
          tenantId: invoice.tenantId,
          subscriptionId: invoice.subscriptionId,
          status: 'canceled',
          canceledAt: lifecycleAt,
          externalRef,
          metadata: {
            canceledByAttempt: true,
            lastBillingProvider: attempt.provider,
            lastPaymentAttemptId: attempt.id,
          },
          actor,
        }, scopedDb).catch(() => null);
      }
    }
  }

  return {
    ok: true,
    attempt,
    invoice: invoiceResult?.invoice || invoice,
    subscription: subscriptionResult?.subscription || null,
    event: subscriptionResult?.event || null,
  };
}

async function recordSubscriptionEvent(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  const subscriptionId = trimText(input.subscriptionId, 160);
  if (!tenantId || !subscriptionId) return { ok: false, reason: 'subscription-event-invalid' };
  const scopedDb = getScopedBillingDb(tenantId, db);
  await ensurePlatformBillingLifecycleTables(scopedDb);
  if (getBillingPersistenceMode(scopedDb) !== 'prisma') {
    const eventId = trimText(input.id, 160) || createId('subevt');
    const now = new Date().toISOString();
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
        ${toIso(input.occurredAt) || now},
        ${now},
        ${now}
      )
    `;
    return { ok: true, event: await getSubscriptionEventRowByIdRaw(scopedDb, eventId) };
  }
  const { subscriptionEvent } = getBillingDelegatesOrThrow(scopedDb);
  const eventId = trimText(input.id, 160) || createId('subevt');
  const now = new Date();
  await subscriptionEvent.create({
    data: {
      id: eventId,
      tenantId,
      subscriptionId,
      eventType: trimText(input.eventType, 120) || 'subscription.updated',
      billingStatus: trimText(input.billingStatus, 40) || null,
      actor: trimText(input.actor, 200) || null,
      payloadJson: buildJson(input.payload),
      occurredAt: parseDate(input.occurredAt) || now,
      createdAt: now,
      updatedAt: now,
    },
  });
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
  const nextBillingCycle = normalizeBillingCycle(input.billingCycle || existing.billingCycle);
  const nextStatus = normalizeSubscriptionStatus(input.status, existing.status || 'active');
  const now = new Date();
  const currentRenewsAt = parseDate(existing.renewsAt);
  const currentCanceledAt = parseDate(existing.canceledAt);
  const nextRenewsAt = hasOwn(input, 'renewsAt')
    ? (input.renewsAt === null ? null : parseDate(input.renewsAt) || currentRenewsAt)
    : (
      nextStatus === 'active'
      && ['canceled', 'past_due', 'suspended', 'expired'].includes(normalizeSubscriptionStatus(existing.status, 'active'))
      && (!currentRenewsAt || currentRenewsAt.getTime() <= now.getTime())
        ? (() => {
          const renewDays = resolveBillingCycleDays(nextBillingCycle);
          return renewDays > 0 ? addDays(now, renewDays) : null;
        })()
        : currentRenewsAt
    );
  const nextCanceledAt = hasOwn(input, 'canceledAt')
    ? (input.canceledAt === null ? null : parseDate(input.canceledAt) || currentCanceledAt)
    : (nextStatus === 'canceled' ? currentCanceledAt || now : null);
  const previousStatus = normalizeSubscriptionStatus(existing.status, 'active');
  const nextMetadata = mergeMeta(existing.metadataJson, input.metadata);
  nextMetadata.currentPeriodStart = (
    nextStatus === 'active' && previousStatus !== 'active'
      ? now
      : parseDate(nextMetadata.currentPeriodStart) || parseDate(existing.startedAt) || now
  ).toISOString();
  nextMetadata.currentPeriodEnd = toIso(nextRenewsAt);
  nextMetadata.trialEndsAt = nextBillingCycle === 'trial' || nextStatus === 'trialing'
    ? toIso(nextRenewsAt)
    : null;
  nextMetadata.billingCycle = nextBillingCycle;
  const nextMetadataJson = buildJson(nextMetadata);
  const row = await scopedDb.platformSubscription.update({
    where: { id: existing.id },
    data: {
      planId: trimText(input.planId, 120) || existing.planId,
      billingCycle: nextBillingCycle,
      status: nextStatus,
      currency: normalizeCurrency(input.currency || existing.currency),
      amountCents: input.amountCents == null ? existing.amountCents : asInt(input.amountCents, existing.amountCents || 0, 0),
      renewsAt: nextRenewsAt,
      canceledAt: nextCanceledAt,
      externalRef: trimText(input.externalRef, 200) || existing.externalRef || null,
      metadataJson: nextMetadataJson,
    },
  });
  let event = null;
  if (input.recordEvent !== false) {
    const eventType = nextStatus === 'canceled' && previousStatus !== 'canceled'
      ? 'subscription.canceled'
      : previousStatus === 'canceled' && nextStatus === 'active'
        ? 'subscription.reactivated'
        : nextStatus === 'suspended' && previousStatus !== 'suspended'
          ? 'subscription.suspended'
          : previousStatus === 'suspended' && nextStatus === 'active'
            ? 'subscription.reactivated'
        : previousStatus === 'past_due' && nextStatus === 'active'
          ? 'subscription.recovered'
          : nextStatus === 'past_due' && previousStatus !== 'past_due'
            ? 'subscription.past_due'
            : 'subscription.updated';
    event = await recordSubscriptionEvent({
      tenantId,
      subscriptionId: row.id,
      eventType,
      billingStatus: nextStatus,
      actor: trimText(input.actor, 200) || 'billing-admin',
      payload: {
        previousStatus,
        nextStatus,
        previousPlanId: trimText(existing.planId, 120) || null,
        nextPlanId: trimText(row.planId, 120) || null,
        billingCycle: nextBillingCycle,
        amountCents: row.amountCents,
        currency: row.currency,
        renewsAt: row.renewsAt ? new Date(row.renewsAt).toISOString() : null,
        canceledAt: row.canceledAt ? new Date(row.canceledAt).toISOString() : null,
      },
    }, scopedDb).catch(() => null);
  }
  return { ok: true, subscription: row, event: event?.event || null };
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
  const provider = normalizeProvider(input.provider || getConfiguredBillingProvider());
  const idempotencyKey = resolveCheckoutIdempotencyKey(input);
  const checkoutFingerprint = buildCheckoutFingerprint({
    ...input,
    tenantId,
    provider,
  });
  const existingSession = await findReusableCheckoutSession({
    ...input,
    tenantId,
    provider,
    idempotencyKey,
  }, scopedDb);
  if (existingSession?.session) {
    return {
      ok: true,
      reused: true,
      session: existingSession.session,
      invoice: existingSession.invoice || null,
    };
  }
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
    idempotencyKey,
    checkoutFingerprint,
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
    applyLifecycle: false,
    status: invoiceStatus,
    paidAt: invoiceStatus === 'paid' ? new Date() : null,
    externalRef: externalRef || invoice.externalRef || null,
    metadata: { lastWebhookEventType: eventType, lastWebhookAt: new Date().toISOString() },
  }, scopedDb);

  const attemptResult = existingAttempt?.id
    ? await updatePaymentAttempt({
      attemptId: existingAttempt.id,
      tenantId: existingAttempt.tenantId,
      applyLifecycle: false,
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
      recordEvent: false,
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
  updatePaymentAttempt,
  updateSubscriptionBillingState,
};
