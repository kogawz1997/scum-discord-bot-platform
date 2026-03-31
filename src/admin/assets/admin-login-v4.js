(function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function resolveLoginApiBase() {
    const path = String(window.location.pathname || '').trim().toLowerCase();
    if (path === '/owner' || path.startsWith('/owner/')) return '/owner/api';
    if (path === '/tenant' || path.startsWith('/tenant/')) return '/tenant/api';
    return '/admin/api';
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
    wrap.hidden = !visible;
    if (visible) {
      $('otpInput')?.focus();
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
    const submit = $('loginSubmit');
    const username = String($('usernameInput')?.value || '').trim();
    const password = String($('passwordInput')?.value || '');
    const otp = String($('otpInput')?.value || '').trim();

    if (!username || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'warning');
      return;
    }

    submit.disabled = true;
    setError('กำลังตรวจสอบสิทธิ์...', 'info');
    try {
      const data = await requestJson(`${resolveLoginApiBase()}/login`, {
        username,
        password,
        otp,
      });
      const role = String(data?.role || '').trim().toLowerCase();
      if (role === 'owner') {
        window.location.href = '/owner';
        return;
      }
      window.location.href = '/tenant';
    } catch (error) {
      const requiresOtp = Boolean(error?.payload?.requiresOtp);
      if (requiresOtp) {
        setOtpVisible(true);
        setError('กรุณากรอกรหัสยืนยัน 2FA แล้วลองอีกครั้ง', 'warning');
      } else {
        setError(String(error?.message || 'เข้าสู่ระบบไม่สำเร็จ'), 'danger');
      }
    } finally {
      submit.disabled = false;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const form = $('loginForm');
    if (!form) return;
    setOtpVisible(false);
    form.addEventListener('submit', handleSubmit);
  });
})();
