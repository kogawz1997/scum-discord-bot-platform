(function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function t(key, fallback, params) {
    return window.PortalUiI18n?.t(key, fallback, params) || fallback || key;
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(String(payload?.error || `Request failed (${response.status})`));
    }
    return payload?.data;
  }

  function setStatus(element, message, tone = 'info') {
    if (!element) return;
    element.textContent = String(message || '');
    element.className = `form-status${message ? ` is-${tone}` : ''}`;
  }

  function getRequestedPackage() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('package') || '').trim().toUpperCase() || 'BOT_LOG_DELIVERY';
  }

  function buildPackageOptions(select, packages, selectedPackageId) {
    if (!select) return;
    const rows = Array.isArray(packages) ? packages : [];
    select.innerHTML = rows
      .map((entry) => {
        const id = String(entry?.id || '').trim();
        const title = String(entry?.title || id).trim();
        return `<option value="${id}">${title}</option>`;
      })
      .join('');
    if (selectedPackageId && rows.some((entry) => String(entry?.id || '') === selectedPackageId)) {
      select.value = selectedPackageId;
    }
  }

  async function initSignupPage() {
    const form = $('previewSignupForm');
    if (!form) return;
    const select = $('previewSignupPackageId');
    const submit = $('previewSignupSubmit');
    const status = $('previewSignupStatus');

    try {
      const data = await requestJson('/api/public/packages');
      buildPackageOptions(select, data?.packages, getRequestedPackage());
    } catch {
      buildPackageOptions(select, [{ id: 'BOT_LOG_DELIVERY', title: 'BOT_LOG_DELIVERY' }], 'BOT_LOG_DELIVERY');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) submit.disabled = true;
      setStatus(status, t('public.workspaceSignup.working', 'กำลังสร้างบัญชีและพื้นที่ทำงาน...'));
      try {
        const data = await requestJson('/api/public/signup', {
          method: 'POST',
          body: JSON.stringify({
            displayName: $('previewSignupDisplayName')?.value || '',
            email: $('previewSignupEmail')?.value || '',
            password: $('previewSignupPassword')?.value || '',
            communityName: $('previewSignupCommunityName')?.value || '',
            packageId: select?.value || getRequestedPackage(),
            locale: window.PortalUiI18n?.getLocale?.() || 'en',
          }),
        });
        window.location.href = data?.nextUrl || '/preview';
      } catch (error) {
        setStatus(status, error?.message || t('public.workspaceSignup.error', 'สร้างบัญชีและพื้นที่ทำงานไม่สำเร็จ'), 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  async function initLoginPage() {
    const form = $('previewLoginForm');
    if (!form) return;
    const submit = $('previewLoginSubmit');
    const status = $('previewLoginStatus');
    const sessionBox = $('previewLoginSession');

    try {
      const data = await requestJson('/api/public/session');
      if (data?.session && data?.preview?.account && sessionBox) {
        sessionBox.hidden = false;
        sessionBox.innerHTML = `<strong>${t('public.workspaceLogin.resumeTitle', 'พร้อมกลับไปยังพื้นที่เดิม')}</strong><p>${t('public.workspaceLogin.resumeDetail', 'ระบบพบเซสชันล่าสุดของคุณแล้ว สามารถกลับไปทำงานต่อจากจุดเดิมได้ทันที')}</p><div class="button-row"><a class="button button-primary" href="/preview">${t('public.workspaceLogin.resumeAction', 'เปิดพื้นที่ของคุณ')}</a></div>`;
      }
    } catch {}

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) submit.disabled = true;
      setStatus(status, t('public.workspaceLogin.working', 'กำลังเข้าสู่ระบบ...'));
      try {
        const data = await requestJson('/api/public/login', {
          method: 'POST',
          body: JSON.stringify({
            email: $('previewLoginEmail')?.value || '',
            password: $('previewLoginPassword')?.value || '',
          }),
        });
        window.location.href = data?.nextUrl || '/preview';
      } catch (error) {
        setStatus(status, error?.message || t('public.workspaceLogin.error', 'เข้าสู่ระบบไม่สำเร็จ'), 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  async function initForgotPasswordPage() {
    const form = $('publicPasswordResetForm');
    if (!form) return;
    const submit = $('publicPasswordResetSubmit');
    const status = $('publicPasswordResetStatus');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) submit.disabled = true;
      setStatus(status, t('public.accountRecovery.working', 'กำลังส่งคำขอรีเซ็ตรหัสผ่าน...'));
      try {
        await requestJson('/api/public/password-reset-request', {
          method: 'POST',
          body: JSON.stringify({
            email: $('publicPasswordResetEmail')?.value || '',
          }),
        });
        setStatus(status, t('public.accountRecovery.sent', 'หากพบบัญชีนี้ในระบบ ระบบได้เตรียมขั้นตอนรีเซ็ตรหัสผ่านไว้แล้ว'), 'success');
      } catch (error) {
        setStatus(status, error?.message || t('public.accountRecovery.error', 'ส่งคำขอรีเซ็ตรหัสผ่านไม่สำเร็จ'), 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  function renderList(container, items, emptyText) {
    if (!container) return;
    if (!Array.isArray(items) || !items.length) {
      container.innerHTML = `<li class="empty-state-panel">${emptyText}</li>`;
      return;
    }
    container.innerHTML = items
      .map((item) => `<li><span class="${item.locked ? 'locked-pill' : 'status-pill'}">${item.badge}</span><div><strong>${item.title}</strong><p>${item.detail}</p></div></li>`)
      .join('');
  }

  function renderPreviewSidebar(container, preview) {
    if (!container) return;
    const enabled = new Set(preview?.entitlements?.enabledFeatureKeys || []);
    const items = [
      ['public.workspace.nav.dashboard', 'ภาพรวม', []],
      ['public.workspace.nav.subscription', 'แพ็กเกจและสิทธิ์', []],
      ['public.workspace.nav.servers', 'เซิร์ฟเวอร์', ['server_hosting']],
      ['public.workspace.nav.serverStatus', 'สถานะเซิร์ฟเวอร์', ['server_status']],
      ['public.workspace.nav.serverConfig', 'ตั้งค่าเซิร์ฟเวอร์', ['server_settings']],
      ['public.workspace.nav.deliveryAgents', 'Delivery Agents', ['execute_agent']],
      ['public.workspace.nav.serverBots', 'Server Bots', ['sync_agent']],
      ['public.workspace.nav.logs', 'Logs และ Sync', ['bot_log', 'log_dashboard']],
      ['public.workspace.nav.shop', 'ร้านค้า', ['shop_module']],
      ['public.workspace.nav.orders', 'คำสั่งซื้อ', ['orders_module']],
      ['public.workspace.nav.delivery', 'การส่งของ', ['bot_delivery', 'delivery_dashboard']],
      ['public.workspace.nav.players', 'ผู้เล่น', ['player_module']],
      ['public.workspace.nav.donations', 'การสนับสนุน', ['donation_module']],
      ['public.workspace.nav.events', 'กิจกรรม', ['event_module']],
      ['public.workspace.nav.modules', 'โมดูลระบบ', ['support_module', 'analytics_module']],
      ['public.workspace.nav.help', 'ความช่วยเหลือ', ['support_module']],
    ];
    container.innerHTML = items
      .map(([key, fallback, requirements]) => {
        const unlocked = !requirements.length || requirements.some((featureKey) => enabled.has(featureKey));
        return `<div class="preview-nav-link${unlocked ? '' : ' is-locked'}"><span>${t(key, fallback)}</span><span class="${unlocked ? 'status-pill' : 'locked-pill'}">${unlocked ? t('public.workspace.unlocked', 'พร้อมใช้') : t('public.workspace.locked', 'ต้องเปิดเพิ่ม')}</span></div>`;
      })
      .join('');
  }

  function renderPreviewStats(container, preview) {
    if (!container) return;
    const quota = preview?.tenant?.quotas || {};
    const usage = preview?.tenant?.usage || {};
    const enabledCount = Array.isArray(preview?.entitlements?.enabledFeatureKeys)
      ? preview.entitlements.enabledFeatureKeys.length
      : 0;

    const readQuotaLimit = (value) => {
      if (value == null) return '-';
      if (typeof value === 'number' || typeof value === 'string') return value;
      if (typeof value === 'object') {
        if (value.limit != null) return value.limit;
        if (value.allowed != null) return value.allowed;
        if (value.max != null) return value.max;
      }
      return '-';
    };

    const readUsageValue = (value) => {
      if (value == null) return 0;
      if (typeof value === 'number' || typeof value === 'string') return value;
      if (typeof value === 'object') {
        if (value.used != null) return value.used;
        if (value.count != null) return value.count;
        if (value.total != null) return value.total;
      }
      return 0;
    };

    const cards = [
      [t('public.workspace.stat.package', 'แพ็กเกจ'), preview?.tenant?.package?.title || preview?.account?.packageId || '-', t('public.workspace.stat.packageDetail', 'ชุดสิทธิ์ปัจจุบันของพื้นที่นี้')],
      [t('public.workspace.stat.features', 'ฟีเจอร์ที่เปิดใช้'), String(enabledCount), t('public.workspace.stat.featuresDetail', 'จำนวนสิทธิ์ที่พร้อมใช้ในตอนนี้')],
      [t('public.workspace.stat.apiKeys', 'API Keys'), `${readUsageValue(usage.apiKeys)}/${readQuotaLimit(quota.apiKeys)}`, t('public.workspace.stat.apiKeysDetail', 'ภาพรวมโควตาของพื้นที่นี้')],
      [t('public.workspace.stat.agents', 'Runtime'), `${readUsageValue(usage.agentRuntimes)}/${readQuotaLimit(quota.agentRuntimes)}`, t('public.workspace.stat.agentsDetail', 'จำนวน Delivery Agent และ Server Bot ที่เปิดได้')],
    ];

    container.innerHTML = cards
      .map((item) => `<article class="marketing-panel preview-stat"><span class="marketing-kicker">${item[0]}</span><strong>${item[1]}</strong><p>${item[2]}</p></article>`)
      .join('');
  }

  async function initPreviewPage() {
    if (!$('previewSidebarNav')) return;
    try {
      const data = await requestJson('/api/public/session');
      if (!data?.session || !data?.preview) {
        window.location.href = '/login';
        return;
      }
      const preview = data.preview;
      $('previewCommunityName').textContent = preview?.account?.communityName || preview?.account?.displayName || 'SCUM Workspace';
      $('previewPageLead').textContent = t('public.workspace.pageLeadReady', 'พื้นที่นี้พร้อมให้ตรวจเมนู สิทธิ์ และขั้นตอนก่อนเปิดใช้งานจริงแล้ว');
      $('previewAccountSummary').textContent = `${preview?.account?.email || '-'} · ${t('public.workspace.state', 'สถานะ')}: ${preview?.account?.accountState || 'preview'}`;
      $('previewUpgradeBtn').href = `/checkout?package=${encodeURIComponent(preview?.account?.packageId || 'BOT_LOG_DELIVERY')}`;

      renderPreviewSidebar($('previewSidebarNav'), preview);
      renderPreviewStats($('previewStatsGrid'), preview);

      renderList(
        $('previewFeatureList'),
        (preview?.entitlements?.features || [])
          .filter((entry) => entry?.enabled)
          .map((entry) => ({
            badge: t('public.workspace.enabledBadge', 'พร้อมใช้'),
            title: entry.title || entry.key,
            detail: entry.key,
          })),
        t('public.workspace.enabledEmpty', 'ยังไม่มีฟีเจอร์ที่เปิดใช้ในพื้นที่นี้'),
      );

      renderList(
        $('previewLockedList'),
        (preview?.entitlements?.features || [])
          .filter((entry) => !entry?.enabled)
          .slice(0, 8)
          .map((entry) => ({
            badge: t('public.workspace.lockedBadge', 'ต้องเปิดเพิ่ม'),
            title: entry.title || entry.key,
            detail: t('public.workspace.lockedReason', 'อัปเกรดแพ็กเกจหรือเปิด runtime ที่เกี่ยวข้องก่อนจึงจะใช้งานส่วนนี้ได้'),
            locked: true,
          })),
        t('public.workspace.lockedEmpty', 'ตอนนี้ไม่มีฟีเจอร์ที่ถูกล็อก'),
      );

      renderList(
        $('previewIdentityList'),
        [
          {
            badge: preview?.account?.linkedIdentities?.discordLinked
              ? t('public.workspace.identity.linked', 'เชื่อมแล้ว')
              : t('public.workspace.identity.pending', 'รอเชื่อม'),
            title: t('public.workspace.identity.discord', 'บัญชี Discord'),
            detail: t('public.workspace.identity.discordPending', 'สามารถเชื่อม Discord เพิ่มภายหลังได้จากฝั่งผู้เล่นหรือผู้ดูแล'),
          },
          {
            badge: preview?.account?.linkedIdentities?.steamLinked
              ? t('public.workspace.identity.linked', 'เชื่อมแล้ว')
              : t('public.workspace.identity.pending', 'รอเชื่อม'),
            title: t('public.workspace.identity.steam', 'บัญชี Steam'),
            detail: t('public.workspace.identity.steamPending', 'การเชื่อม Steam จะสำคัญเมื่อเริ่มใช้การส่งของและการจับคู่โปรไฟล์ผู้เล่นจริง'),
          },
          {
            badge: preview?.account?.linkedIdentities?.playerMatched
              ? t('public.workspace.identity.ready', 'พร้อมใช้')
              : t('public.workspace.identity.pending', 'รอข้อมูล'),
            title: t('public.workspace.identity.player', 'โปรไฟล์ในเกม'),
            detail: t('public.workspace.identity.playerPending', 'ต้องมีการซิงก์ข้อมูลจาก Server Bot ก่อนจึงจะจับคู่โปรไฟล์ในเกมได้สมบูรณ์'),
          },
        ],
        t('public.workspace.identity.empty', 'ยังไม่มีสัญญาณตัวตนจากระบบ'),
      );

      renderList(
        $('previewNextSteps'),
        [
          {
            badge: '1',
            title: t('public.workspace.stepOneTitle', 'ตรวจว่าแพ็กเกจเหมาะกับงานจริงหรือไม่'),
            detail: t('public.workspace.stepOneDetail', 'เปรียบเทียบ BOT_LOG, BOT_LOG_DELIVERY, FULL_OPTION และ SERVER_ONLY ก่อนเปิดใช้งานจริง'),
          },
          {
            badge: '2',
            title: t('public.workspace.stepTwoTitle', 'เปิด runtime ที่ตรงกับงาน'),
            detail: t('public.workspace.stepTwoDetail', 'งานส่งของใช้ Delivery Agent ส่วนงาน log, config และ server control ใช้ Server Bot'),
          },
          {
            badge: '3',
            title: t('public.workspace.stepThreeTitle', 'เปิดใช้งานและ onboard ต่อจากพื้นที่เดิม'),
            detail: t('public.workspace.stepThreeDetail', 'หลังเปิดสิทธิ์จริงแล้ว ระบบจะใช้โครงเดิมของพื้นที่นี้ต่อได้ทันที'),
          },
        ],
        t('public.workspace.nextEmpty', 'ยังไม่มีขั้นตอนแนะนำเพิ่มเติม'),
      );
    } catch {
      window.location.href = '/login';
    }
  }

  function initCheckoutPage() {
    if (!$('checkoutSelectedPackage')) return;
    const packageId = getRequestedPackage();
    $('checkoutSelectedPackage').textContent = packageId;
    const signupCta = $('checkoutSignupCta');
    if (signupCta) {
      signupCta.href = `/signup?package=${encodeURIComponent(packageId)}`;
    }
  }

  function initPreviewLogout() {
    const button = $('previewLogoutBtn');
    if (!button) return;
    button.addEventListener('click', async () => {
      try {
        await requestJson('/api/public/logout', {
          method: 'POST',
          body: '{}',
        });
      } catch {}
      window.location.href = '/login';
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    initSignupPage();
    initLoginPage();
    initForgotPasswordPage();
    initCheckoutPage();
    initPreviewPage();
    initPreviewLogout();
  });
})();
