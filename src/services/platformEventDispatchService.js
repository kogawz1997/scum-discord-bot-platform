'use strict';

const crypto = require('node:crypto');

function createPlatformEventDispatchService(deps) {
  const {
    trimText,
    nowIso,
    publishAdminLiveUpdate,
    assertTenantDbIsolationScope,
    runWithOptionalTenantDbIsolation,
  } = deps;

  function hmacSha256(secret, payload) {
    return crypto.createHmac('sha256', String(secret || '')).update(String(payload || '')).digest('hex');
  }

  async function dispatchPlatformWebhookEvent(eventType, payload = {}, options = {}) {
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: options.tenantId,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform webhook dispatch',
    });
    return runWithOptionalTenantDbIsolation(tenantId, async (db) => {
      const endpoints = await db.platformWebhookEndpoint.findMany({
        where: {
          enabled: true,
          ...(tenantId ? { tenantId } : {}),
          OR: [
            { eventType: String(eventType || '').trim() || 'unknown' },
            { eventType: '*' },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      const body = JSON.stringify({
        eventType: String(eventType || 'platform.unknown'),
        deliveredAt: nowIso(),
        payload: payload && typeof payload === 'object' ? payload : {},
      });
      const results = [];
      for (const endpoint of endpoints) {
        const signature = hmacSha256(endpoint.secretValue, body);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(endpoint.targetUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'content-type': 'application/json',
              'x-scum-platform-event': String(eventType || 'platform.unknown'),
              'x-scum-signature': `sha256=${signature}`,
            },
            body,
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          await db.platformWebhookEndpoint.update({
            where: { id: endpoint.id },
            data: {
              lastSuccessAt: new Date(),
              lastError: null,
            },
          });
          results.push({ id: endpoint.id, ok: true, status: res.status });
        } catch (error) {
          await db.platformWebhookEndpoint.update({
            where: { id: endpoint.id },
            data: {
              lastFailureAt: new Date(),
              lastError: trimText(error?.message || error, 400),
            },
          });
          publishAdminLiveUpdate('ops-alert', {
            source: 'platform-webhook',
            kind: 'platform-webhook-failed',
            tenantId: endpoint.tenantId,
            endpointId: endpoint.id,
            targetUrl: endpoint.targetUrl,
            eventType,
            error: trimText(error?.message || error, 240),
          });
          results.push({ id: endpoint.id, ok: false, error: trimText(error?.message || error, 400) });
        } finally {
          clearTimeout(timeout);
        }
      }
      return results;
    });
  }

  async function emitPlatformEvent(eventType, payload = {}, options = {}) {
    publishAdminLiveUpdate('platform-event', {
      eventType,
      source: 'platform-service',
      ...payload,
    });
    try {
      await dispatchPlatformWebhookEvent(eventType, payload, options);
    } catch (error) {
      console.error('[platform] webhook dispatch failed:', error.message);
    }
  }

  return {
    dispatchPlatformWebhookEvent,
    emitPlatformEvent,
  };
}

module.exports = {
  createPlatformEventDispatchService,
};
