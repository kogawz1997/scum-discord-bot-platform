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

    if (!email || !password) {
      setError('Please enter your tenant email and password.', 'warning');
      return;
    }
    if (!looksLikeEmail(email)) {
      setError('Enter the tenant email address here. Username-style values like "admin" will not work.', 'warning');
      return;
    }

    submit.disabled = true;
    setError('Checking your tenant access...', 'info');
    try {
      const nextUrl = resolveSafeTenantNextUrl();
      const data = await requestJson('/tenant/api/auth/login', {
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
    $('tenantLoginForm')?.addEventListener('submit', handleSubmit);
  });
})();
