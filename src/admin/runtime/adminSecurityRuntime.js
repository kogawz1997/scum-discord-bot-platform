'use strict';

function createAdminSecurityRuntime(options = {}) {
  const {
    loginRateLimitWindowMs,
    loginRateLimitMaxAttempts,
    loginSpikeWindowMs,
    loginSpikeThreshold,
    loginSpikeIpThreshold,
    loginSpikeAlertCooldownMs,
    discordOauthStates = null,
    ssoStateTtlMs = 0,
    getClientIp,
    publishAdminLiveUpdate,
    addAdminNotification,
    recordAdminSecurityEvent,
    logger = console,
  } = options;

  const loginAttemptsByIp = new Map();
  const loginFailureEvents = [];
  const actionAttemptsByKey = new Map();
  let lastLoginSpikeAlertAt = 0;
  const actionRateLimits = normalizeActionRateLimits(options.actionRateLimits);

  function normalizeActionRateLimits(value) {
    const input = value && typeof value === 'object' ? value : {};
    const defaults = {
      'config-apply': { windowMs: 60_000, maxAttempts: 6 },
      restart: { windowMs: 60_000, maxAttempts: 4 },
      delivery: { windowMs: 60_000, maxAttempts: 12 },
      'tenant-public-login': { windowMs: 10 * 60_000, maxAttempts: 6 },
      'tenant-public-invite-accept': { windowMs: 10 * 60_000, maxAttempts: 6 },
    };
    const normalized = {};
    Object.entries(defaults).forEach(([actionType, fallback]) => {
      const override = input[actionType] && typeof input[actionType] === 'object'
        ? input[actionType]
        : {};
      const windowMs = Number(override.windowMs);
      const maxAttempts = Number(override.maxAttempts);
      normalized[actionType] = {
        windowMs: Number.isFinite(windowMs) && windowMs > 0 ? Math.trunc(windowMs) : fallback.windowMs,
        maxAttempts: Number.isFinite(maxAttempts) && maxAttempts > 0 ? Math.trunc(maxAttempts) : fallback.maxAttempts,
      };
    });
    return normalized;
  }

  function trimText(value, maxLen = 160) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.length <= maxLen ? text : text.slice(0, maxLen);
  }

  function buildActionRateLimitKey(actionType, req, optionsArg = {}) {
    const ip = trimText(getClientIp(req), 160) || 'unknown-ip';
    const tenantId = trimText(optionsArg.tenantId, 160) || 'global';
    const actor = trimText(optionsArg.actor, 160) || 'anonymous';
    return `${trimText(actionType, 80) || 'action'}::${tenantId}::${ip}::${actor}`;
  }

  function cleanupActionAttempts(now = Date.now()) {
    for (const [key, entry] of actionAttemptsByKey.entries()) {
      if (!entry || !entry.windowMs || now - entry.firstAt > entry.windowMs) {
        actionAttemptsByKey.delete(key);
      }
    }
  }

  function cleanupLoginAttempts(now = Date.now()) {
    for (const [ip, entry] of loginAttemptsByIp.entries()) {
      if (!entry || now - entry.firstAt > loginRateLimitWindowMs) {
        loginAttemptsByIp.delete(ip);
      }
    }
  }

  function cleanupLoginFailureEvents(now = Date.now()) {
    const cutoff = now - loginSpikeWindowMs;
    while (loginFailureEvents.length > 0 && loginFailureEvents[0].at < cutoff) {
      loginFailureEvents.shift();
    }
  }

  function cleanupDiscordOauthStates(now = Date.now()) {
    if (!(discordOauthStates instanceof Map) || ssoStateTtlMs <= 0) return;
    for (const [state, payload] of discordOauthStates.entries()) {
      if (!payload || now - Number(payload.createdAt || 0) > ssoStateTtlMs) {
        discordOauthStates.delete(state);
      }
    }
  }

  function getLoginFailureMetrics(now = Date.now()) {
    cleanupLoginFailureEvents(now);
    const byIp = new Map();
    for (const event of loginFailureEvents) {
      const ip = event?.ip || 'unknown';
      byIp.set(ip, (byIp.get(ip) || 0) + 1);
    }
    const hotIps = Array.from(byIp.entries())
      .filter(([, count]) => count >= loginSpikeIpThreshold)
      .sort((a, b) => b[1] - a[1])
      .map(([ip, count]) => ({ ip, count }));
    return {
      windowMs: loginSpikeWindowMs,
      failures: loginFailureEvents.length,
      threshold: loginSpikeThreshold,
      perIpThreshold: loginSpikeIpThreshold,
      hotIps,
    };
  }

  function buildSecurityNotificationMessage(event = {}) {
    const parts = [
      event.detail || event.type || 'security-event',
      event.actor ? `actor=${event.actor}` : '',
      event.targetUser ? `target=${event.targetUser}` : '',
      event.ip ? `ip=${event.ip}` : '',
      event.reason ? `reason=${event.reason}` : '',
    ].filter(Boolean);
    return parts.join(' | ');
  }

  function recordAdminSecuritySignal(type, optionsArg = {}) {
    const normalizedType = String(type || 'security-event').trim() || 'security-event';
    const severity =
      String(optionsArg.severity || (optionsArg.notify ? 'warn' : 'info')).trim() || 'info';
    const event = recordAdminSecurityEvent({
      type: normalizedType,
      severity,
      actor: optionsArg.actor || null,
      targetUser: optionsArg.targetUser || null,
      role: optionsArg.role || null,
      authMethod: optionsArg.authMethod || null,
      sessionId: optionsArg.sessionId || null,
      ip: optionsArg.ip || null,
      path: optionsArg.path || null,
      reason: optionsArg.reason || null,
      detail: optionsArg.detail || null,
      data: optionsArg.data || null,
    });
    publishAdminLiveUpdate('admin-security', event);
    if (optionsArg.notify === true || severity === 'warn' || severity === 'error') {
      addAdminNotification({
        type: 'security',
        source: 'admin-auth',
        kind: normalizedType,
        severity,
        title: optionsArg.title || 'Admin Security Event',
        message: buildSecurityNotificationMessage(event),
        entityKey: event.sessionId || event.targetUser || null,
        data: event,
      });
    }
    return event;
  }

  function maybeAlertLoginFailureSpike(now = Date.now()) {
    const metrics = getLoginFailureMetrics(now);
    const hasGlobalSpike = metrics.failures >= loginSpikeThreshold;
    const hasIpSpike = metrics.hotIps.length > 0;
    if (!hasGlobalSpike && !hasIpSpike) return;
    if (now - lastLoginSpikeAlertAt < loginSpikeAlertCooldownMs) return;
    lastLoginSpikeAlertAt = now;

    const payload = {
      source: 'admin-login',
      kind: hasGlobalSpike ? 'global-spike' : 'ip-spike',
      windowMs: metrics.windowMs,
      failures: metrics.failures,
      threshold: metrics.threshold,
      hotIps: metrics.hotIps.slice(0, 5),
    };
    logger.warn(
      `[admin-web][alert] login failure spike: failures=${metrics.failures} windowMs=${metrics.windowMs}`,
    );
    publishAdminLiveUpdate('ops-alert', payload);
  }

  function getLoginRateLimitState(req) {
    const now = Date.now();
    cleanupLoginAttempts(now);
    const ip = getClientIp(req);
    const entry = loginAttemptsByIp.get(ip);
    if (!entry) {
      return { limited: false, ip, retryAfterMs: 0 };
    }

    if (entry.count >= loginRateLimitMaxAttempts) {
      const retryAfterMs = Math.max(0, loginRateLimitWindowMs - (now - entry.firstAt));
      return { limited: retryAfterMs > 0, ip, retryAfterMs };
    }

    return { limited: false, ip, retryAfterMs: 0 };
  }

  function consumeActionRateLimit(actionType, req, optionsArg = {}) {
    const normalizedActionType = trimText(actionType, 80).toLowerCase();
    const config = actionRateLimits[normalizedActionType];
    const ip = trimText(getClientIp(req), 160) || 'unknown-ip';
    if (!config) {
      return {
        actionType: normalizedActionType,
        limited: false,
        ip,
        retryAfterMs: 0,
      };
    }
    const now = Date.now();
    cleanupActionAttempts(now);
    const key = buildActionRateLimitKey(normalizedActionType, req, optionsArg);
    const existing = actionAttemptsByKey.get(key);
    if (!existing || now - existing.firstAt > config.windowMs) {
      actionAttemptsByKey.set(key, {
        count: 1,
        firstAt: now,
        windowMs: config.windowMs,
      });
      return {
        actionType: normalizedActionType,
        limited: false,
        ip,
        retryAfterMs: 0,
      };
    }
    if (existing.count >= config.maxAttempts) {
      return {
        actionType: normalizedActionType,
        limited: true,
        ip,
        retryAfterMs: Math.max(0, config.windowMs - (now - existing.firstAt)),
      };
    }
    actionAttemptsByKey.set(key, {
      ...existing,
      count: existing.count + 1,
      windowMs: config.windowMs,
    });
    return {
      actionType: normalizedActionType,
      limited: false,
      ip,
      retryAfterMs: 0,
    };
  }

  function recordLoginAttempt(req, success) {
    const now = Date.now();
    cleanupLoginAttempts(now);
    cleanupLoginFailureEvents(now);
    const ip = getClientIp(req);

    if (success) {
      loginAttemptsByIp.delete(ip);
      recordAdminSecuritySignal('login-succeeded', {
        actor: String(req?.__pendingAdminUser || '').trim() || 'unknown',
        targetUser: String(req?.__pendingAdminUser || '').trim() || 'unknown',
        authMethod: String(req?.__pendingAdminAuthMethod || 'password'),
        ip,
        path: '/admin/api/login',
        detail: 'Admin login succeeded',
      });
      return;
    }

    loginFailureEvents.push({ at: now, ip });
    recordAdminSecuritySignal('login-failed', {
      severity: 'warn',
      actor: String(req?.__pendingAdminUser || '').trim() || 'unknown',
      targetUser: String(req?.__pendingAdminUser || '').trim() || 'unknown',
      authMethod: String(req?.__pendingAdminAuthMethod || 'password'),
      ip,
      path: '/admin/api/login',
      reason: String(req?.__pendingAdminFailureReason || 'invalid-credentials'),
      detail: 'Admin login failed',
      notify: true,
    });
    maybeAlertLoginFailureSpike(now);

    const existing = loginAttemptsByIp.get(ip);
    if (!existing || now - existing.firstAt > loginRateLimitWindowMs) {
      loginAttemptsByIp.set(ip, { count: 1, firstAt: now });
      return;
    }

    loginAttemptsByIp.set(ip, {
      count: existing.count + 1,
      firstAt: existing.firstAt,
    });
  }

  return {
    cleanupDiscordOauthStates,
    consumeActionRateLimit,
    getLoginFailureMetrics,
    getLoginRateLimitState,
    recordAdminSecuritySignal,
    recordLoginAttempt,
  };
}

module.exports = {
  createAdminSecurityRuntime,
};
