(function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function setError(message, tone) {
    const node = $('tenantLoginError');
    if (!node) return;
    node.textContent = String(message || '').trim();
    node.dataset.tone = tone || 'danger';
  }

  function looksLikeEmail(value) {
    const text = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  }

  function humanizeLoginError(error) {
    const raw = String(error?.message || '').trim().toLowerCase();
    if (raw === 'invalid-credentials') {
      return 'Use the tenant email address for this workspace. Username-style values like "admin" will not work here.';
    }
    if (raw === 'token-expired') {
      return 'This invite link has expired. Ask a tenant owner to send a new invite.';
    }
    if (raw === 'token-already-used') {
      return 'This invite link was already used. Sign in with the tenant account password for this workspace.';
    }
    if (raw === 'password-required' || raw === 'weak-password') {
      return 'Set a password with at least 8 characters to finish accepting this invite.';
    }
    return String(error?.message || 'Tenant login failed.');
  }

  function resolveSafeTenantNextUrl() {
    const url = new URL(window.location.href);
    const nextUrl = String(url.searchParams.get('next') || '').trim();
    if (!nextUrl) return '';
    if (!nextUrl.startsWith('/tenant')) return '';
    if (nextUrl.startsWith('//') || /[\r\n]/.test(nextUrl)) return '';
    return nextUrl;
  }

  function getInviteContext() {
    const url = new URL(window.location.href);
    const token = String(url.searchParams.get('inviteToken') || url.searchParams.get('invite') || '').trim();
    return {
      active: Boolean(token),
      token,
      email: String(url.searchParams.get('email') || '').trim(),
    };
  }

  function applyInviteMode(invite) {
    if (!invite?.active) return;
    const email = $('tenantLoginEmail');
    const password = $('tenantLoginPassword');
    const displayNameWrap = $('tenantLoginDisplayNameWrap');
    const submit = $('tenantLoginSubmit');
    const notice = $('tenantInviteNotice');

    if (notice) notice.hidden = false;
    if (displayNameWrap) displayNameWrap.hidden = false;
    if (email && invite.email) {
      email.value = invite.email;
      email.readOnly = true;
    }
    if (password) {
      password.autocomplete = 'new-password';
      password.placeholder = 'Set a password with at least 8 characters';
    }
    if (submit) {
      submit.textContent = 'Accept invite and open workspace';
    }
  }

  async function requestJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      const error = new Error(String(payload?.error || 'Request failed'));
      error.payload = payload;
      throw error;
    }
    return payload?.data || {};
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const submit = $('tenantLoginSubmit');
    const email = String($('tenantLoginEmail')?.value || '').trim();
    const password = String($('tenantLoginPassword')?.value || '');
    const displayName = String($('tenantLoginDisplayName')?.value || '').trim();
    const invite = getInviteContext();

    if (!email || !password) {
      setError('Please enter your tenant email and password.', 'warning');
      return;
    }
    if (!looksLikeEmail(email)) {
      setError('Enter the tenant email address here. Username-style values like "admin" will not work.', 'warning');
      return;
    }

    submit.disabled = true;
    setError(invite.active ? 'Checking your tenant invite...' : 'Checking your tenant access...', 'info');
    try {
      const nextUrl = resolveSafeTenantNextUrl();
      const data = invite.active
        ? await requestJson('/tenant/api/auth/accept-invite', {
          email,
          token: invite.token,
          password,
          displayName,
          nextUrl,
        })
        : await requestJson('/tenant/api/auth/login', {
          email,
          password,
          nextUrl,
        });
      window.location.href = data?.nextUrl || nextUrl || '/tenant';
    } catch (error) {
      setError(humanizeLoginError(error), 'danger');
    } finally {
      submit.disabled = false;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    applyInviteMode(getInviteContext());
    $('tenantLoginForm')?.addEventListener('submit', handleSubmit);
  });
})();
