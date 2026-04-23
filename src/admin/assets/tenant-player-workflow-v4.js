(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantPlayerWorkflowV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  function createTenantPlayerWorkflowV4(deps) {
    const getCurrentUrl = typeof deps?.getCurrentUrl === 'function'
      ? deps.getCurrentUrl
      : () => new URL('https://local.invalid/');
    const writeTenantUrlState = typeof deps?.writeTenantUrlState === 'function'
      ? deps.writeTenantUrlState
      : () => {};

    function readUrlParam(name) {
      const url = getCurrentUrl();
      return String(url.searchParams.get(name) || '').trim();
    }

    function readUserIdFromUrl() {
      return readUrlParam('userId');
    }

    function readIdentityActionFromUrl() {
      return readUrlParam('identityAction');
    }

    function readSupportReasonFromUrl() {
      return readUrlParam('supportReason');
    }

    function readSupportSourceFromUrl() {
      return readUrlParam('supportSource');
    }

    function readSupportOutcomeFromUrl() {
      return readUrlParam('supportOutcome');
    }

    function writeUserIdToUrl(userId) {
      writeTenantUrlState({
        userId,
        identityAction: '',
        supportReason: '',
        supportSource: '',
        supportOutcome: '',
        code: '',
      });
    }

    function writePlayerIdentityWorkflowToUrl(userId, identityAction, supportReason, supportSource, supportOutcome) {
      writeTenantUrlState({
        userId,
        identityAction,
        supportReason,
        supportSource,
        supportOutcome,
        code: '',
      });
    }

    function normalizeIdentitySupportIntent(value, fallbackIntent = 'review') {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'set') return 'bind';
      if (normalized === 'remove' || normalized === 'unbind') return 'unlink';
      if (['bind', 'unlink', 'relink', 'conflict', 'review'].includes(normalized)) {
        return normalized;
      }
      return String(fallbackIntent || 'review').trim().toLowerCase() || 'review';
    }

    function resolveIdentitySupportFormAction(intent) {
      const normalizedIntent = normalizeIdentitySupportIntent(intent);
      if (normalizedIntent === 'review' || normalizedIntent === 'conflict') return 'review';
      return normalizedIntent === 'unlink' ? 'remove' : 'set';
    }

    function describeIdentitySupportIntent(intent) {
      switch (normalizeIdentitySupportIntent(intent)) {
        case 'bind':
          return 'ผูก Steam ให้ผู้เล่น';
        case 'unlink':
          return 'ถอด Steam ของผู้เล่น';
        case 'relink':
          return 'เตรียม relink Steam ของผู้เล่น';
        case 'conflict':
          return 'ตรวจทาน conflict และ handoff';
        default:
          return 'ตรวจทาน identity handoff';
      }
    }

    function resolveIdentityFollowupAction(intent, submittedAction, requestedFollowupAction) {
      const requested = String(requestedFollowupAction || '').trim();
      if (requested) {
        return normalizeIdentitySupportIntent(requested, 'review');
      }
      const normalizedIntent = normalizeIdentitySupportIntent(intent);
      const normalizedAction = String(submittedAction || '').trim().toLowerCase();
      if (normalizedAction === 'review') {
        if (normalizedIntent === 'relink') return 'bind';
        if (normalizedIntent === 'conflict') return 'conflict';
        if (normalizedIntent === 'bind') return 'bind';
        if (normalizedIntent === 'unlink') return 'unlink';
        return 'review';
      }
      if (normalizedIntent === 'relink' && normalizedAction === 'remove') {
        return 'bind';
      }
      return 'review';
    }

    function buildIdentitySupportSuccessMessage(intent, submittedAction, userId, followupAction) {
      const normalizedIntent = normalizeIdentitySupportIntent(intent);
      const normalizedAction = String(submittedAction || '').trim().toLowerCase();
      const nextAction = resolveIdentityFollowupAction(normalizedIntent, normalizedAction, followupAction);
      if (normalizedAction === 'review') {
        if (normalizedIntent === 'conflict') {
          return `บันทึก conflict handoff ของผู้เล่น ${userId} แล้ว ขั้นต่อไปคือ ${describeIdentitySupportIntent(nextAction)}`;
        }
        return `บันทึก review ของผู้เล่น ${userId} แล้ว ขั้นต่อไปคือ ${describeIdentitySupportIntent(nextAction)}`;
      }
      if (normalizedIntent === 'relink' && normalizedAction === 'remove') {
        return `ถอด Steam เดิมของผู้เล่น ${userId} แล้ว เตรียมผูก Steam ใหม่ต่อ`;
      }
      if (normalizedIntent === 'relink') {
        return `อัปเดต Steam ของผู้เล่น ${userId} สำหรับเคส relink แล้ว`;
      }
      if (normalizedIntent === 'conflict') {
        return `บันทึก identity action สำหรับเคส conflict ของผู้เล่น ${userId} แล้ว`;
      }
      return normalizedAction === 'remove'
        ? `ถอด Steam ของผู้เล่น ${userId} แล้ว`
        : `ผูก Steam ให้ผู้เล่น ${userId} แล้ว`;
    }

    function normalizeIdentitySupportOutcome(value, fallback = 'reviewing') {
      const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
      if (['resolved', 'pending-verification', 'pending-player-reply', 'reviewing'].includes(normalized)) {
        return normalized;
      }
      return String(fallback || 'reviewing').trim().toLowerCase() || 'reviewing';
    }

    return {
      readUserIdFromUrl,
      readIdentityActionFromUrl,
      readSupportReasonFromUrl,
      readSupportSourceFromUrl,
      readSupportOutcomeFromUrl,
      writeUserIdToUrl,
      writePlayerIdentityWorkflowToUrl,
      normalizeIdentitySupportIntent,
      resolveIdentitySupportFormAction,
      describeIdentitySupportIntent,
      resolveIdentityFollowupAction,
      buildIdentitySupportSuccessMessage,
      normalizeIdentitySupportOutcome,
    };
  }

  return {
    createTenantPlayerWorkflowV4,
  };
});
