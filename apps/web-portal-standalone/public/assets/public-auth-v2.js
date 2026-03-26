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
      setStatus(status, t('public.signup.working', 'Creating preview account...'));
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
        setStatus(status, error?.message || t('public.signup.error', 'Failed to create preview account.'), 'error');
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
      if (data?.session && data?.preview?.account) {
        sessionBox.hidden = false;
        sessionBox.innerHTML = `<strong>${t('public.login.previewResumeTitle', 'Preview session ready')}</strong><p>${t('public.login.previewResumeDetail', 'Continue where you left off in the preview tenant dashboard.')}</p><div class="button-row"><a class="button button-primary" href="/preview">${t('public.login.previewResumeAction', 'Open Preview')}</a></div>`;
      }
    } catch {}

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) submit.disabled = true;
      setStatus(status, t('public.login.working', 'Signing in...'));
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
        setStatus(status, error?.message || t('public.login.error', 'Unable to sign in.'), 'error');
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
      setStatus(status, t('public.forgot.working', 'Submitting reset request...'));
      try {
        await requestJson('/api/public/password-reset-request', {
          method: 'POST',
          body: JSON.stringify({
            email: $('publicPasswordResetEmail')?.value || '',
          }),
        });
        setStatus(status, t('public.forgot.sent', 'If the account exists, reset instructions are now queued.'), 'success');
      } catch (error) {
        setStatus(status, error?.message || t('public.forgot.error', 'Reset request failed.'), 'error');
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
      ['public.preview.nav.dashboard', 'Dashboard', []],
      ['public.preview.nav.subscription', 'Subscription', []],
      ['public.preview.nav.servers', 'Servers', ['server_hosting']],
      ['public.preview.nav.serverStatus', 'Server Status', ['server_status']],
      ['public.preview.nav.serverConfig', 'Server Config', ['server_settings']],
      ['public.preview.nav.deliveryAgents', 'Delivery Agents', ['execute_agent']],
      ['public.preview.nav.serverBots', 'Server Bots', ['sync_agent']],
      ['public.preview.nav.logs', 'Logs & Sync', ['bot_log', 'log_dashboard']],
      ['public.preview.nav.shop', 'Shop', ['shop_module']],
      ['public.preview.nav.orders', 'Orders', ['orders_module']],
      ['public.preview.nav.delivery', 'Delivery', ['bot_delivery', 'delivery_dashboard']],
      ['public.preview.nav.players', 'Players', ['player_module']],
      ['public.preview.nav.donations', 'Donations', ['donation_module']],
      ['public.preview.nav.events', 'Events', ['event_module']],
      ['public.preview.nav.modules', 'Bot Modules', ['support_module', 'analytics_module']],
      ['public.preview.nav.help', 'Help', ['support_module']],
    ];
    container.innerHTML = items
      .map(([key, fallback, requirements]) => {
        const unlocked = !requirements.length || requirements.some((featureKey) => enabled.has(featureKey));
        return `<div class="preview-nav-link${unlocked ? '' : ' is-locked'}"><span>${t(key, fallback)}</span><span class="${unlocked ? 'status-pill' : 'locked-pill'}">${unlocked ? t('public.preview.unlocked', 'Open') : t('public.preview.locked', 'Locked')}</span></div>`;
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
    const cards = [
      [t('public.preview.stat.package', 'Package'), preview?.tenant?.package?.title || preview?.account?.packageId || '-', t('public.preview.stat.packageDetail', 'Current preview bundle')],
      [t('public.preview.stat.features', 'Features'), String(enabledCount), t('public.preview.stat.featuresDetail', 'Entitlements visible right now')],
      [t('public.preview.stat.apiKeys', 'API keys'), `${usage.apiKeys ?? 0}/${quota.apiKeys ?? '-'}`, t('public.preview.stat.apiKeysDetail', 'Preview quota posture')],
      [t('public.preview.stat.agents', 'Agents'), `${usage.agentRuntimes ?? 0}/${quota.agentRuntimes ?? '-'}`, t('public.preview.stat.agentsDetail', 'Delivery Agent and Server Bot allowance')],
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
      $('previewCommunityName').textContent = preview?.account?.communityName || preview?.account?.displayName || 'SCUM Preview';
      $('previewPageLead').textContent = t('public.preview.pageLeadReady', 'Preview mode is active. Inspect the sidebar, locked modules, and next-step path before you activate a package.');
      $('previewAccountSummary').textContent = `${preview?.account?.email || '-'} - ${t('public.preview.state', 'State')}: ${preview?.account?.accountState || 'preview'}`;
      $('previewUpgradeBtn').href = `/checkout?package=${encodeURIComponent(preview?.account?.packageId || 'BOT_LOG_DELIVERY')}`;
      renderPreviewSidebar($('previewSidebarNav'), preview);
      renderPreviewStats($('previewStatsGrid'), preview);

      renderList(
        $('previewFeatureList'),
        (preview?.entitlements?.features || [])
          .filter((entry) => entry?.enabled)
          .map((entry) => ({
            badge: t('public.preview.enabledBadge', 'Enabled'),
            title: entry.title || entry.key,
            detail: entry.key,
          })),
        t('public.preview.enabledEmpty', 'No enabled features yet.'),
      );

      renderList(
        $('previewLockedList'),
        (preview?.entitlements?.features || [])
          .filter((entry) => !entry?.enabled)
          .slice(0, 8)
          .map((entry) => ({
            badge: t('public.preview.lockedBadge', 'Locked'),
            title: entry.title || entry.key,
            detail: t('public.preview.lockedReason', 'Upgrade package or provision the required runtime before using this area.'),
            locked: true,
          })),
        t('public.preview.lockedEmpty', 'No locked features.'),
      );

      renderList(
        $('previewIdentityList'),
        [
          {
            badge: preview?.account?.linkedIdentities?.discordLinked
              ? t('public.preview.identity.linked', 'Linked')
              : t('public.preview.identity.pending', 'Pending'),
            title: t('public.preview.identity.discord', 'Discord account'),
            detail: t('public.preview.identity.discordPending', 'Discord can be linked later from the player or tenant side.'),
          },
          {
            badge: preview?.account?.linkedIdentities?.steamLinked
              ? t('public.preview.identity.linked', 'Linked')
              : t('public.preview.identity.pending', 'Pending'),
            title: t('public.preview.identity.steam', 'Steam identity'),
            detail: t('public.preview.identity.steamPending', 'Steam linking becomes important before delivery and profile matching go live.'),
          },
          {
            badge: preview?.account?.linkedIdentities?.playerMatched
              ? t('public.preview.identity.ready', 'Ready')
              : t('public.preview.identity.pending', 'Pending'),
            title: t('public.preview.identity.player', 'In-game profile'),
            detail: t('public.preview.identity.playerPending', 'Server Bot sync is required before in-game player matching can become active.'),
          },
        ],
        t('public.preview.identity.empty', 'No identity signals yet.'),
      );

      renderList(
        $('previewNextSteps'),
        [
          {
            badge: '1',
            title: t('public.preview.stepOneTitle', 'Review package fit'),
            detail: t('public.preview.stepOneDetail', 'Compare BOT_LOG, BOT_LOG_DELIVERY, FULL_OPTION, and SERVER_ONLY before going live.'),
          },
          {
            badge: '2',
            title: t('public.preview.stepTwoTitle', 'Provision the correct runtime'),
            detail: t('public.preview.stepTwoDetail', 'Delivery features need a Delivery Agent. Log and config flows need a Server Bot.'),
          },
          {
            badge: '3',
            title: t('public.preview.stepThreeTitle', 'Activate and onboard'),
            detail: t('public.preview.stepThreeDetail', 'After package activation, the same structure becomes writable and fully operational.'),
          },
        ],
        t('public.preview.nextEmpty', 'No next steps.'),
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
