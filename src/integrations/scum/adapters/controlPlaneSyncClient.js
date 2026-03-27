'use strict';

const fs = require('node:fs');

const { getFilePath } = require('../../store/_persist');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function resolveControlPlaneBaseUrl(env = process.env) {
  const explicit = trimText(
    env.SCUM_SYNC_CONTROL_PLANE_URL
      || env.PLATFORM_API_BASE_URL
      || env.ADMIN_WEB_BASE_URL,
    400,
  );
  return explicit ? explicit.replace(/\/+$/, '') : '';
}

function readPlatformAgentState(env = process.env) {
  const runtimeKey = trimText(
    env.PLATFORM_AGENT_RUNTIME_KEY
    || env.SCUM_SERVER_BOT_RUNTIME_KEY
    || env.SCUM_SYNC_RUNTIME_KEY
    || 'platform-agent',
    120,
  ).replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  const filePath = trimText(env.PLATFORM_AGENT_STATE_FILE, 600)
    || getFilePath(`platform-agent-${runtimeKey}.json`);
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

async function postAgentSyncPayload(input = {}, env = process.env) {
  const baseUrl = resolveControlPlaneBaseUrl(env);
  const state = readPlatformAgentState(env);
  const token = trimText(
    env.SCUM_SYNC_AGENT_TOKEN
      || env.PLATFORM_AGENT_TOKEN
      || env.SCUM_AGENT_TOKEN,
    500,
  ) || trimText(state?.rawKey, 1200);
  if (!baseUrl) {
    return { ok: false, reason: 'control-plane-base-url-missing' };
  }
  if (!token) {
    return { ok: false, reason: 'agent-token-missing' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${baseUrl}/platform/api/v1/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) {
      return {
        ok: false,
        reason: trimText(payload?.error || payload?.message || `sync-http-${res.status}`, 300),
        status: res.status,
        payload,
      };
    }
    return {
      ok: true,
      data: payload.data || null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: trimText(error?.message || 'sync-request-failed', 300),
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  postAgentSyncPayload,
  resolveControlPlaneBaseUrl,
};
