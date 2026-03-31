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

  function getQueryParam(key) {
    const url = new URL(window.location.href);
    return String(url.searchParams.get(key) || '').trim();
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
        window.location.href = data?.nextUrl || '/tenant/onboarding';
      } catch (error) {
        setStatus(status, error?.message || t('public.workspaceSignup.error', 'สร้างบัญชีและพื้นที่ทำงานไม่สำเร็จ'), 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  async function initLoginPage() {
    const tenantLink = $('tenantLoginLink');
    const playerLink = $('playerLoginLink');
    const status = $('publicAccessStatus');
    if (!tenantLink && !playerLink) return;

    setStatus(status, 'Loading access links...');
    try {
      const data = await requestJson('/api/public/product-links');
      if (tenantLink && data?.tenantLoginUrl) {
        tenantLink.href = data.tenantLoginUrl;
      }
      if (playerLink && data?.playerLoginUrl) {
        playerLink.href = data.playerLoginUrl;
      }
      setStatus(status, 'Choose Tenant Admin or Player Portal to continue.', 'success');
    } catch (error) {
      setStatus(status, error?.message || 'Could not load product links.', 'error');
    }
  }

  async function initForgotPasswordPage() {
    const form = $('publicPasswordResetForm');
    if (!form) return;
    const submit = $('publicPasswordResetSubmit');
    const status = $('publicPasswordResetStatus');
    const title = $('publicPasswordResetTitle');
    const copy = $('publicPasswordResetCopy');
    const passwordRow = $('publicPasswordResetPasswordRow');
    const confirmRow = $('publicPasswordResetPasswordConfirmRow');
    const emailField = $('publicPasswordResetEmail');
    const passwordField = $('publicPasswordResetPassword');
    const confirmField = $('publicPasswordResetPasswordConfirm');
    const token = getQueryParam('token');
    const completeMode = Boolean(token);

    if (completeMode) {
      if (title) title.textContent = t('public.accountRecovery.completeTitle', 'Set your new password');
      if (copy) copy.textContent = t('public.accountRecovery.completeCopy', 'This reset link is ready. Choose a new password for your workspace account.');
      if (submit) submit.textContent = t('public.accountRecovery.completeAction', 'Save new password');
      if (passwordRow) passwordRow.hidden = false;
      if (confirmRow) confirmRow.hidden = false;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) submit.disabled = true;
      setStatus(
        status,
        completeMode
          ? t('public.accountRecovery.completeWorking', 'Saving your new password...')
          : t('public.accountRecovery.working', 'กำลังส่งคำขอรีเซ็ตรหัสผ่าน...'),
      );
      try {
        if (completeMode) {
          const password = passwordField?.value || '';
          const confirmPassword = confirmField?.value || '';
          if (password !== confirmPassword) {
            throw new Error(t('public.accountRecovery.passwordMismatch', 'Passwords do not match.'));
          }
          await requestJson('/api/public/password-reset-complete', {
            method: 'POST',
            body: JSON.stringify({
              token,
              email: emailField?.value || '',
              password,
            }),
          });
          setStatus(status, t('public.accountRecovery.completeSuccess', 'Password updated. Redirecting you back to login...'), 'success');
          window.setTimeout(() => {
            window.location.href = '/login';
          }, 900);
        } else {
          await requestJson('/api/public/password-reset-request', {
            method: 'POST',
            body: JSON.stringify({
              email: emailField?.value || '',
            }),
          });
          setStatus(status, t('public.accountRecovery.sent', 'หากพบบัญชีนี้ในระบบ ระบบได้เตรียมขั้นตอนรีเซ็ตรหัสผ่านไว้แล้ว'), 'success');
        }
      } catch (error) {
        setStatus(
          status,
          error?.message || (completeMode
            ? t('public.accountRecovery.completeError', 'Could not update the password.')
            : t('public.accountRecovery.error', 'ส่งคำขอรีเซ็ตรหัสผ่านไม่สำเร็จ')),
          'error',
        );
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  async function initVerifyEmailPage() {
    const form = $('publicEmailVerificationForm');
    if (!form) return;
    const title = $('publicEmailVerificationTitle');
    const copy = $('publicEmailVerificationCopy');
    const emailField = $('publicEmailVerificationEmail');
    const emailRow = $('publicEmailVerificationEmailRow');
    const submit = $('publicEmailVerificationSubmit');
    const status = $('publicEmailVerificationStatus');
    const token = getQueryParam('token');
    const completeMode = Boolean(token);

    if (completeMode) {
      if (title) title.textContent = t('public.verifyEmail.completeTitle', 'Complete email verification');
      if (copy) copy.textContent = t('public.verifyEmail.completeCopy', 'This link is ready. Confirm the email now to finish account verification.');
      if (submit) submit.textContent = t('public.verifyEmail.completeAction', 'Verify email now');
      if (emailRow) emailRow.hidden = true;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit) submit.disabled = true;
      setStatus(
        status,
        completeMode
          ? t('public.verifyEmail.completeWorking', 'Completing your verification...')
          : t('public.verifyEmail.requestWorking', 'Queueing a fresh verification link...'),
      );
      try {
        if (completeMode) {
          await requestJson('/api/public/email-verification-complete', {
            method: 'POST',
            body: JSON.stringify({ token }),
          });
          setStatus(status, t('public.verifyEmail.completeSuccess', 'Email verified. Redirecting you back to login...'), 'success');
          window.setTimeout(() => {
            window.location.href = '/login';
          }, 900);
        } else {
          await requestJson('/api/public/email-verification-request', {
            method: 'POST',
            body: JSON.stringify({
              email: emailField?.value || '',
            }),
          });
          setStatus(status, t('public.verifyEmail.requestSuccess', 'If the account exists, a fresh verification link has been queued.'), 'success');
        }
      } catch (error) {
        setStatus(
          status,
          error?.message || (completeMode
            ? t('public.verifyEmail.completeError', 'Could not complete email verification.')
            : t('public.verifyEmail.requestError', 'Could not queue a new verification link.')),
          'error',
        );
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
    const status = $('checkoutStatus');
    if (signupCta) {
      signupCta.href = `/signup?package=${encodeURIComponent(packageId)}`;
      requestJson('/api/public/session')
        .then((data) => {
          if (!data?.session) {
            setStatus(status, t('public.checkout.signupFirst', 'Create your tenant workspace first, then continue in the real product.'));
            return;
          }
          signupCta.textContent = t('public.checkout.open', 'Open checkout');
          signupCta.addEventListener('click', async (event) => {
            event.preventDefault();
            if (signupCta.getAttribute('aria-busy') === 'true') return;
            signupCta.setAttribute('aria-busy', 'true');
            setStatus(status, t('public.checkout.working', 'Creating your checkout session...'));
            try {
              const data = await requestJson('/api/public/checkout/session', {
                method: 'POST',
                body: JSON.stringify({
                  packageId,
                  successUrl: '/payment-result',
                  cancelUrl: '/checkout',
                }),
              });
              window.location.href = data?.session?.checkoutUrl
                || `/payment-result?session=${encodeURIComponent(data?.session?.sessionToken || '')}`;
            } catch (error) {
              setStatus(status, error?.message || t('public.checkout.error', 'Could not create checkout session.'), 'error');
            } finally {
              signupCta.removeAttribute('aria-busy');
            }
          });
        })
        .catch(() => {
          setStatus(status, t('public.checkout.signupFirst', 'Create your tenant workspace first, then continue in the real product.'));
        });
    }
  }

  async function initPaymentResultPage() {
    const title = $('paymentResultTitle');
    if (!title) return;
    const copy = $('paymentResultCopy');
    const primary = $('paymentResultPrimary');
    const secondary = $('paymentResultSecondary');
    const sessionToken = getQueryParam('session');
    const stripeSessionId = getQueryParam('stripe_session_id') || getQueryParam('session_id');
    if (!sessionToken) return;
    const action = getQueryParam('status') || 'paid';
    title.textContent = t('public.payment.confirmingTitle', 'Confirming your payment...');
    if (copy) {
      copy.textContent = t('public.payment.confirmingCopy', 'We are applying your package and updating the workspace now.');
    }
    try {
      await requestJson(`/api/public/checkout/session?token=${encodeURIComponent(sessionToken)}`);
      const result = await requestJson('/api/public/checkout/complete', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken,
          action,
          stripeSessionId,
        }),
      });
      const isPaid = String(result?.invoice?.status || '').trim().toLowerCase() === 'paid';
      title.textContent = isPaid
        ? t('public.payment.successTitle', 'Package activated')
        : t('public.payment.pendingTitle', 'Checkout updated');
      if (copy) {
        copy.textContent = isPaid
          ? t('public.payment.successCopy', 'Your workspace is ready to continue with the updated package.')
          : t('public.payment.pendingCopy', 'The checkout was updated. You can review the workspace status or return to checkout.');
      }
      if (primary) {
        primary.href = result?.nextUrl || '/tenant/onboarding';
        primary.textContent = isPaid
          ? t('public.payment.primaryWorkspace', 'Open your workspace')
          : t('public.payment.primaryReview', 'Review workspace');
      }
      if (secondary) {
        secondary.href = action === 'canceled' ? '/checkout' : '/login';
        secondary.textContent = action === 'canceled'
          ? t('public.payment.secondaryCheckout', 'Back to checkout')
          : t('public.payment.secondaryLogin', 'Back to login');
      }
    } catch (error) {
      title.textContent = t('public.payment.errorTitle', 'Payment could not be confirmed');
      if (copy) {
        copy.textContent = error?.message || t('public.payment.errorCopy', 'Please try the checkout again or return to your workspace.');
      }
      if (primary) {
        primary.href = '/checkout';
        primary.textContent = t('public.payment.retry', 'Retry checkout');
      }
      if (secondary) {
        secondary.href = '/tenant/login';
        secondary.textContent = t('public.payment.secondaryWorkspace', 'Open workspace');
      }
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
    initVerifyEmailPage();
    initCheckoutPage();
    initPreviewPage();
    initPreviewLogout();
    initPaymentResultPage();
  });
})();
