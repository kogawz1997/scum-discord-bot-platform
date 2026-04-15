(function () {
  'use strict';

  const OWNER_LAST_USERNAME_KEY = 'scum.owner.lastUsername';

  function $(id) {
    return document.getElementById(id);
  }

  function getLocale() {
    const runtimeLocale = window.AdminUiI18n?.getLocale?.();
    const documentLocale = document.documentElement?.lang;
    const browserLocale = window.navigator?.language;
    const source = String(runtimeLocale || documentLocale || browserLocale || 'en').trim().toLowerCase();
    return source.startsWith('th') ? 'th' : 'en';
  }

  function copy(english, thai) {
    return getLocale() === 'th' ? thai : english;
  }

  function translate(key, english, thai) {
    const fallback = copy(english, thai);
    return window.AdminUiI18n?.t?.(key, fallback) || fallback;
  }

  function resolveLoginApiBase() {
    const path = String(window.location.pathname || '').trim().toLowerCase();
    if (path === '/owner' || path.startsWith('/owner/')) return '/owner/api';
    if (path === '/tenant' || path.startsWith('/tenant/')) return '/tenant/api';
    return '/admin/api';
  }

  function isOwnerLoginRoute() {
    const path = String(window.location.pathname || '').trim().toLowerCase();
    return path === '/owner/login' || path === '/owner/login/';
  }

  function readRememberedOwnerUsername() {
    if (!isOwnerLoginRoute()) return '';
    try {
      return String(window.localStorage?.getItem(OWNER_LAST_USERNAME_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  function writeRememberedOwnerUsername(username) {
    if (!isOwnerLoginRoute()) return;
    try {
      const normalized = String(username || '').trim();
      if (!normalized) {
        window.localStorage?.removeItem(OWNER_LAST_USERNAME_KEY);
        return;
      }
      window.localStorage?.setItem(OWNER_LAST_USERNAME_KEY, normalized);
    } catch {
      // Ignore storage failures. Login flow should remain functional without local storage.
    }
  }

  function setError(message, tone) {
    const node = $('errorBox');
    if (!node) return;
    node.textContent = String(message || '').trim();
    node.dataset.tone = tone || 'danger';
  }

  function setOtpVisible(visible) {
    const wrap = $('otpWrap');
    if (!wrap) return;
    const alwaysVisible = wrap.dataset.mode === 'always';
    wrap.hidden = alwaysVisible ? false : !visible;
    if (visible || alwaysVisible) {
      $('otpInput')?.focus();
    }
  }

  function setSubmitState(submit, pending) {
    if (!submit) return;
    if (!submit.dataset.defaultLabel) {
      submit.dataset.defaultLabel = String(submit.textContent || '').trim();
    }
    submit.disabled = Boolean(pending);
    submit.textContent = pending
      ? translate('owner.login.submitBusy', 'Signing in...', '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e25\u0e07\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e02\u0e49\u0e32\u0e43\u0e0a\u0e49...')
      : submit.dataset.defaultLabel;
  }

  function getFriendlyErrorMessage(error) {
    const rawError = String(error?.payload?.error || error?.message || '').trim();
    if (!rawError || rawError === 'Request failed') {
      return copy(
        'Sign in failed. Please try again.',
        '\u0e25\u0e07\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e02\u0e49\u0e32\u0e43\u0e0a\u0e49\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07',
      );
    }

    const normalized = rawError.toLowerCase();
    const knownMessages = {
      'admin-2fa-required': copy(
        'Enter your 2FA code and try again.',
        '\u0e01\u0e23\u0e2d\u0e01\u0e23\u0e2b\u0e31\u0e2a 2FA \u0e41\u0e25\u0e49\u0e27\u0e25\u0e2d\u0e07\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07',
      ),
      'invalid-credentials': copy(
        'Incorrect username or password.',
        '\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e2b\u0e23\u0e37\u0e2d\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19\u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07',
      ),
      'invalid-otp': copy(
        'The 2FA code is not valid.',
        '\u0e23\u0e2b\u0e31\u0e2a 2FA \u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07',
      ),
      'login-failed': copy(
        'Sign in failed. Please try again.',
        '\u0e25\u0e07\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e02\u0e49\u0e32\u0e43\u0e0a\u0e49\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07',
      ),
      'admin-login-failed': copy(
        'Sign in failed. Please try again.',
        '\u0e25\u0e07\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e02\u0e49\u0e32\u0e43\u0e0a\u0e49\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07',
      ),
      'too-many-requests': copy(
        'Too many attempts. Please wait and try again.',
        '\u0e1e\u0e22\u0e32\u0e22\u0e32\u0e21\u0e2b\u0e25\u0e32\u0e22\u0e04\u0e23\u0e31\u0e49\u0e07\u0e40\u0e01\u0e34\u0e19\u0e44\u0e1b \u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48',
      ),
    };

    return knownMessages[normalized] || rawError;
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
    const submit = $('loginSubmit');
    const username = String($('usernameInput')?.value || '').trim();
    const password = String($('passwordInput')?.value || '');
    const otp = String($('otpInput')?.value || '').trim();

    if (!username || !password) {
      setError(
        copy(
          'Enter your username and password.',
          '\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e41\u0e25\u0e30\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19',
        ),
        'warning',
      );
      return;
    }

    setSubmitState(submit, true);
    setError(
      copy(
        'Checking access...',
        '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c...',
      ),
      'info',
    );

    try {
      const data = await requestJson(`${resolveLoginApiBase()}/login`, {
        username,
        password,
        otp,
      });
      writeRememberedOwnerUsername(username);
      const role = String(data?.role || '').trim().toLowerCase();
      window.location.href = role === 'owner' ? '/owner' : '/tenant';
    } catch (error) {
      const requiresOtp = Boolean(error?.payload?.requiresOtp);
      if (requiresOtp) {
        setOtpVisible(true);
        setError(
          copy(
            'Enter your 2FA code and submit again.',
            '\u0e01\u0e23\u0e2d\u0e01\u0e23\u0e2b\u0e31\u0e2a 2FA \u0e41\u0e25\u0e49\u0e27\u0e01\u0e14\u0e25\u0e07\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e02\u0e49\u0e32\u0e43\u0e0a\u0e49\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07',
          ),
          'warning',
        );
      } else {
        setError(getFriendlyErrorMessage(error), 'danger');
      }
    } finally {
      setSubmitState(submit, false);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const form = $('loginForm');
    if (!form) return;

    const usernameInput = $('usernameInput');
    const passwordInput = $('passwordInput');
    const rememberedUsername = readRememberedOwnerUsername();
    if (usernameInput && rememberedUsername && !String(usernameInput.value || '').trim()) {
      usernameInput.value = rememberedUsername;
      if (passwordInput) {
        passwordInput.focus();
      }
    }

    const submit = $('loginSubmit');
    if (submit && !submit.dataset.defaultLabel) {
      submit.dataset.defaultLabel = String(submit.textContent || '').trim();
    }

    setOtpVisible(false);
    form.addEventListener('submit', handleSubmit);

    const search = new URLSearchParams(window.location.search || '');
    if (search.get('switch') === '1') {
      setError(
        copy(
          'This account cannot open the requested surface. Sign in with the correct role.',
          '\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e1b\u0e34\u0e14\u0e1e\u0e37\u0e49\u0e19\u0e17\u0e35\u0e48\u0e17\u0e35\u0e48\u0e23\u0e49\u0e2d\u0e07\u0e02\u0e2d\u0e44\u0e14\u0e49 \u0e42\u0e1b\u0e23\u0e14\u0e43\u0e0a\u0e49\u0e1a\u0e31\u0e0d\u0e0a\u0e35\u0e17\u0e35\u0e48\u0e21\u0e35\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07',
        ),
        'warning',
      );
    }
  });
})();
