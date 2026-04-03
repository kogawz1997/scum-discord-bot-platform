(function () {
  'use strict';

  const STORAGE_KEY = 'scum.ui.language';
  const DEFAULT_LOCALE = 'th';
  const COPY = {
    th: {
      documentTitle: 'SCUM TH Platform | เข้าสู่ระบบผู้เล่น',
      languageLabel: 'ภาษา',
      brandTitle: 'พอร์ทัลผู้เล่น',
      brandDetail:
        'ใช้ Discord หรือเมจิกลิงก์ทางอีเมลเพื่อเข้าดูโปรไฟล์ผู้เล่น คำสั่งซื้อ การส่งของ และกิจกรรมของคุณ',
      kicker: 'ทางเข้าผู้เล่น',
      title: 'เข้าพอร์ทัลผู้เล่นได้จากทางเดียว',
      intro:
        'ใช้ Discord หรือเมจิกลิงก์ทางอีเมลเพื่อเข้าโปรไฟล์ผู้เล่น คำสั่งซื้อ การส่งของ กิจกรรม และการสนับสนุนเซิร์ฟเวอร์ โดยไม่ต้องแยกบัญชีอีกชุด',
      chipProfile: 'โปรไฟล์ผู้เล่น',
      chipOrders: 'คำสั่งซื้อและการส่งของ',
      chipEvents: 'กิจกรรมและแรงก์',
      discordButton: 'เข้าสู่ระบบด้วย Discord',
      emailLabel: 'อีเมล',
      emailPlaceholder: 'player@example.com',
      magicLinkButton: 'ส่งเมจิกลิงก์',
      infoKicker: 'ก่อนเริ่มใช้งาน',
      infoTitle: 'สิ่งที่ผู้เล่นควรรู้ก่อนเข้า',
      noteDiscordTitle: 'Discord เป็นทางเข้าหลัก',
      noteDiscordCopy:
        'ถ้าบัญชี Discord ของคุณอยู่ในชุมชนของเซิร์ฟเวอร์แล้ว มักเข้าใช้งานได้เร็วที่สุดจากปุ่มด้านซ้าย',
      noteMagicTitle: 'เมจิกลิงก์ใช้กับบัญชีที่ผูกไว้แล้ว',
      noteMagicCopy:
        'ระบบจะส่งลิงก์เข้าใช้งานให้อีเมลที่เชื่อมกับบัญชีผู้เล่น โดยไม่ต้องตั้งรหัสผ่านใหม่',
      noteScopeTitle: 'งานดูแลเซิร์ฟเวอร์ไม่อยู่ในหน้านี้',
      noteScopeCopy:
        'หน้าผู้เล่นจะโฟกัสที่โปรไฟล์ สถิติ ร้านค้า คำสั่งซื้อ การส่งของ และกิจกรรมเท่านั้น',
      debugLink: 'เปิดเมจิกลิงก์สำหรับทดสอบ',
      statuses: {
        signingInWithMagicLink: 'กำลังพาคุณเข้าสู่ระบบด้วยเมจิกลิงก์...',
        emailRequired: 'กรอกอีเมลผู้เล่นก่อน',
        requestingMagicLink: 'กำลังเตรียมเมจิกลิงก์...',
        magicLinkReady: 'ถ้าบัญชีผู้เล่นนี้ผูกไว้แล้ว เมจิกลิงก์พร้อมใช้งานแล้ว',
      },
      errors: {
        default: 'คำขอล้มเหลว',
        requestFailed: 'คำขอล้มเหลว',
        couldNotPrepareMagicLink: 'ไม่สามารถเตรียมเมจิกลิงก์ได้',
        magicLinkSignInFailed: 'เข้าสู่ระบบด้วยเมจิกลิงก์ไม่สำเร็จ',
        magicLinkRequestRateLimited: 'มีการขอเมจิกลิงก์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
        magicLinkCompleteRateLimited: 'มีการลองใช้เมจิกลิงก์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
        tokenExpired: 'ลิงก์เข้าสู่ระบบหมดอายุแล้ว',
        tokenNotFound: 'ไม่พบลิงก์เข้าสู่ระบบนี้แล้ว',
        userNotFound: 'ไม่พบบัญชีผู้เล่นนี้',
        playerDiscordLinkRequired: 'บัญชีนี้ยังไม่ได้ผูก Discord',
        invalidEmail: 'อีเมลไม่ถูกต้อง',
        denied: 'การเข้าสู่ระบบถูกปฏิเสธ',
      },
    },
    en: {
      documentTitle: 'SCUM TH Platform | Player Sign In',
      languageLabel: 'Language',
      brandTitle: 'Player Portal',
      brandDetail:
        'Use Discord or an email magic link to open your player profile, orders, delivery, and community activity.',
      kicker: 'Player access',
      title: 'Enter the player portal from one place',
      intro:
        'Use Discord or an email magic link to reach your player profile, purchases, delivery, events, and community support flow without managing a separate account.',
      chipProfile: 'Player profile',
      chipOrders: 'Orders and delivery',
      chipEvents: 'Events and ranks',
      discordButton: 'Continue with Discord',
      emailLabel: 'Email',
      emailPlaceholder: 'player@example.com',
      magicLinkButton: 'Send magic link',
      infoKicker: 'Before you start',
      infoTitle: 'What players should know first',
      noteDiscordTitle: 'Discord is the primary sign-in path',
      noteDiscordCopy:
        'If your Discord account is already in the server community, the button on the left is usually the fastest way in.',
      noteMagicTitle: 'Magic links work for already-linked accounts',
      noteMagicCopy:
        'The system sends a one-time sign-in link to the email already linked to your player account, so no new password is needed.',
      noteScopeTitle: 'Server management does not live here',
      noteScopeCopy:
        'The player surface stays focused on profile, stats, shop, orders, delivery, and events only.',
      debugLink: 'Open test magic link',
      statuses: {
        signingInWithMagicLink: 'Signing you in with a magic link...',
        emailRequired: 'Enter your player email first.',
        requestingMagicLink: 'Preparing your magic link...',
        magicLinkReady:
          'If this player account is already linked, the magic link is ready to use.',
      },
      errors: {
        default: 'Request failed',
        requestFailed: 'Request failed',
        couldNotPrepareMagicLink: 'Could not prepare the magic link.',
        magicLinkSignInFailed: 'Magic link sign-in failed.',
        magicLinkRequestRateLimited: 'Too many magic link requests. Please wait and try again.',
        magicLinkCompleteRateLimited: 'Too many magic link sign-in attempts. Please wait and try again.',
        tokenExpired: 'The sign-in link has expired.',
        tokenNotFound: 'That sign-in link could not be found.',
        userNotFound: 'The player account could not be found.',
        playerDiscordLinkRequired: 'This account is not linked to Discord yet.',
        invalidEmail: 'Email is invalid.',
        denied: 'Sign-in was denied.',
      },
    },
  };

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeLocale(value, fallback) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return fallback || DEFAULT_LOCALE;
    if (normalized.startsWith('en')) return 'en';
    if (normalized.startsWith('th')) return 'th';
    return fallback || DEFAULT_LOCALE;
  }

  function getCurrentCopy() {
    return COPY[currentLocale] || COPY[DEFAULT_LOCALE];
  }

  function getUrl() {
    return new URL(window.location.href);
  }

  function getQueryLocale() {
    const url = getUrl();
    return normalizeLocale(url.searchParams.get('lang') || url.searchParams.get('locale'), '');
  }

  function getStoredLocale() {
    try {
      return normalizeLocale(window.localStorage.getItem(STORAGE_KEY), '');
    } catch {
      return '';
    }
  }

  function detectLocale() {
    return (
      getQueryLocale()
      || getStoredLocale()
      || (Array.isArray(navigator.languages)
        ? navigator.languages.map((value) => normalizeLocale(value, '')).find(Boolean)
        : '')
      || normalizeLocale(navigator.language, '')
      || DEFAULT_LOCALE
    );
  }

  function persistLocale(locale) {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {}
    const url = getUrl();
    url.searchParams.set('lang', locale);
    window.history.replaceState({}, '', url.toString());
  }

  function requestJson(url, body) {
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(String(payload?.error || 'Request failed'));
      }
      return payload?.data || {};
    });
  }

  function getTokenParam() {
    return String(getUrl().searchParams.get('token') || '').trim();
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
    node.innerHTML = `<a class="marketing-inline-link" href="${String(url).replace(/"/g, '&quot;')}">${getCurrentCopy().debugLink}</a>`;
  }

  function localizeAuthError(message) {
    const normalized = String(message || '').trim();
    const copy = getCurrentCopy();
    const mapping = {
      'Request failed': copy.errors.requestFailed,
      'Could not prepare the magic link.': copy.errors.couldNotPrepareMagicLink,
      'Magic link sign-in failed.': copy.errors.magicLinkSignInFailed,
      'Too many magic link requests. Please wait 600s and try again.': copy.errors.magicLinkRequestRateLimited,
      'Too many magic link sign-in attempts. Please wait 600s and try again.': copy.errors.magicLinkCompleteRateLimited,
      'token-expired': copy.errors.tokenExpired,
      'token-not-found': copy.errors.tokenNotFound,
      'user-not-found': copy.errors.userNotFound,
      'player-discord-link-required': copy.errors.playerDiscordLinkRequired,
      'invalid-email': copy.errors.invalidEmail,
      denied: copy.errors.denied,
    };
    if (normalized.startsWith('Too many magic link requests.')) {
      return copy.errors.magicLinkRequestRateLimited;
    }
    if (normalized.startsWith('Too many magic link sign-in attempts.')) {
      return copy.errors.magicLinkCompleteRateLimited;
    }
    return mapping[normalized] || normalized || copy.errors.default;
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value;
  }

  function setPlaceholder(id, value) {
    const node = $(id);
    if (node) node.placeholder = value;
  }

  function setPageTitle(value) {
    document.title = value;
  }

  function applyLocale(locale) {
    currentLocale = normalizeLocale(locale, DEFAULT_LOCALE);
    const copy = getCurrentCopy();
    document.documentElement.lang = currentLocale;
    setPageTitle(copy.documentTitle);
    if ($('playerAuthLocale')) $('playerAuthLocale').value = currentLocale;
    setText('playerAuthLanguageLabel', copy.languageLabel);
    setText('playerAuthBrandTitle', copy.brandTitle);
    setText('playerAuthBrandDetail', copy.brandDetail);
    setText('playerAuthKicker', copy.kicker);
    setText('playerAuthTitle', copy.title);
    setText('playerAuthIntro', copy.intro);
    setText('playerAuthChipProfile', copy.chipProfile);
    setText('playerAuthChipOrders', copy.chipOrders);
    setText('playerAuthChipEvents', copy.chipEvents);
    setText('playerAuthDiscordLink', copy.discordButton);
    setText('playerAuthEmailLabel', copy.emailLabel);
    setPlaceholder('playerMagicLinkEmail', copy.emailPlaceholder);
    setText('playerMagicLinkSubmit', copy.magicLinkButton);
    setText('playerAuthInfoKicker', copy.infoKicker);
    setText('playerAuthInfoTitle', copy.infoTitle);
    setText('playerAuthNoteDiscordTitle', copy.noteDiscordTitle);
    setText('playerAuthNoteDiscordCopy', copy.noteDiscordCopy);
    setText('playerAuthNoteMagicTitle', copy.noteMagicTitle);
    setText('playerAuthNoteMagicCopy', copy.noteMagicCopy);
    setText('playerAuthNoteScopeTitle', copy.noteScopeTitle);
    setText('playerAuthNoteScopeCopy', copy.noteScopeCopy);

    const errorNode = $('playerAuthError');
    if (errorNode) {
      const errorText = String(errorNode.textContent || '').trim();
      errorNode.textContent = errorText ? localizeAuthError(errorText) : '';
    }
  }

  async function completeMagicLink(token) {
    setStatus(getCurrentCopy().statuses.signingInWithMagicLink, 'info');
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
      setStatus(getCurrentCopy().statuses.emailRequired, 'warning');
      return;
    }
    submit.disabled = true;
    setDebugLink(null);
    setStatus(getCurrentCopy().statuses.requestingMagicLink, 'info');
    try {
      await requestJson('/player/api/auth/email/request', { email });
      setStatus(getCurrentCopy().statuses.magicLinkReady, 'success');
    } catch (error) {
      setStatus(localizeAuthError(String(error?.message || 'Could not prepare the magic link.')), 'error');
    } finally {
      submit.disabled = false;
    }
  }

  let currentLocale = detectLocale();

  window.addEventListener('DOMContentLoaded', () => {
    applyLocale(currentLocale);
    $('playerAuthLocale')?.addEventListener('change', (event) => {
      const locale = normalizeLocale(event?.target?.value, DEFAULT_LOCALE);
      persistLocale(locale);
      applyLocale(locale);
    });
    $('playerMagicLinkForm')?.addEventListener('submit', requestMagicLink);
    const token = getTokenParam();
    if (token) {
      completeMagicLink(token).catch((error) => {
        setStatus(localizeAuthError(String(error?.message || 'Magic link sign-in failed.')), 'error');
      });
    }
  });
})();
