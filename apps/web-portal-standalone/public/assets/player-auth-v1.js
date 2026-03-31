(function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
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
      throw new Error(String(payload?.error || 'Request failed'));
    }
    return payload?.data || {};
  }

  function getTokenParam() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('token') || '').trim();
  }

  function setStatus(message, tone) {
    const node = $('playerMagicLinkStatus');
    if (!node) return;
    node.textContent = String(message || '').trim();
    node.className = `form-status${message ? ` is-${tone || 'info'}` : ''}`;
  }

  function setDebugLink(url) {
    const node = $('playerMagicLinkDebug');
    if (!node) return;
    if (!url) {
      node.innerHTML = '';
      return;
    }
    node.innerHTML = `<a class="marketing-inline-link" href="${String(url).replace(/"/g, '&quot;')}">เปิดเมจิกลิงก์สำหรับทดสอบ</a>`;
  }

  function localizeAuthError(message) {
    const normalized = String(message || '').trim();
    const mapping = {
      'Request failed': 'คำขอล้มเหลว',
      'Could not prepare the magic link.': 'ไม่สามารถเตรียมเมจิกลิงก์ได้',
      'Magic link sign-in failed.': 'เข้าสู่ระบบด้วยเมจิกลิงก์ไม่สำเร็จ',
      'token-expired': 'ลิงก์เข้าสู่ระบบหมดอายุแล้ว',
      'token-not-found': 'ไม่พบลิงก์เข้าสู่ระบบนี้แล้ว',
      'user-not-found': 'ไม่พบบัญชีผู้เล่นนี้',
      'player-discord-link-required': 'บัญชีนี้ยังไม่ได้ผูก Discord',
      'invalid-email': 'อีเมลไม่ถูกต้อง',
    };
    return mapping[normalized] || normalized || 'คำขอล้มเหลว';
  }

  async function completeMagicLink(token) {
    setStatus('กำลังพาคุณเข้าสู่ระบบด้วยเมจิกลิงก์...', 'info');
    const data = await requestJson('/player/api/auth/email/complete', {
      token,
    });
    window.location.href = data?.nextUrl || '/player/home';
  }

  async function requestMagicLink(event) {
    event.preventDefault();
    const submit = $('playerMagicLinkSubmit');
    const email = String($('playerMagicLinkEmail')?.value || '').trim();
    if (!email) {
      setStatus('กรอกอีเมลผู้เล่นก่อน', 'warning');
      return;
    }
    submit.disabled = true;
    setDebugLink(null);
    setStatus('กำลังเตรียมเมจิกลิงก์...', 'info');
    try {
      const data = await requestJson('/player/api/auth/email/request', { email });
      setStatus('ถ้าบัญชีผู้เล่นนี้ผูกไว้แล้ว เมจิกลิงก์พร้อมใช้งานแล้ว', 'success');
      setDebugLink(data?.debugUrl || null);
    } catch (error) {
      setStatus(localizeAuthError(String(error?.message || 'Could not prepare the magic link.')), 'error');
    } finally {
      submit.disabled = false;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    $('playerMagicLinkForm')?.addEventListener('submit', requestMagicLink);
    const token = getTokenParam();
    if (token) {
      completeMagicLink(token).catch((error) => {
        setStatus(localizeAuthError(String(error?.message || 'Magic link sign-in failed.')), 'error');
      });
    }
  });
})();
