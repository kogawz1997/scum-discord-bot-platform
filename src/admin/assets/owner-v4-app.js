(function () {
  'use strict';

  const PAGE_ALIASES = {
    '': 'dashboard',
    overview: 'dashboard',
    dashboard: 'dashboard',
    tenants: 'tenants',
    packages: 'tenants',
    subscriptions: 'tenants',
    billing: 'tenants',
    commercial: 'tenants',
    quota: 'tenants',
    fleet: 'runtime',
    'fleet-assets': 'runtime',
    incidents: 'runtime',
    observability: 'runtime',
    jobs: 'runtime',
    audit: 'runtime',
    security: 'runtime',
    support: 'runtime',
    control: 'runtime',
    access: 'runtime',
    recovery: 'runtime',
    runtime: 'runtime',
    'runtime-health': 'runtime',
    settings: 'dashboard',
    diagnostics: 'runtime',
  };

  const PAGE_TITLES = {
    dashboard: 'ภาพรวมระบบ',
    tenants: 'ผู้เช่าและแพ็กเกจ',
    runtime: 'สุขภาพรันไทม์และเหตุการณ์',
  };

  const state = {
    payload: null,
    refreshing: false,
    timerId: null,
    requestId: 0,
  };

  const OWNER_OVERVIEW_FALLBACK = {
    analytics: {
      tenants: { total: 0, active: 0, trialing: 0, reseller: 0 },
      subscriptions: { total: 0, active: 0, mrrCents: 0 },
      delivery: { queueDepth: 0, deadLetters: 0, failureRatePct: 0, lastSyncAt: null },
    },
    publicOverview: null,
    permissionCatalog: [],
    plans: [],
    packages: [],
    features: [],
    tenantFeatureAccess: null,
    opsState: null,
    automationState: null,
    automationConfig: null,
    tenantConfig: null,
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function root() {
    return document.getElementById('ownerV4AppRoot');
  }

  function statusNode() {
    return document.getElementById('ownerV4Status');
  }

  function setStatus(message, tone) {
    const node = statusNode();
    if (!node) return;
    node.textContent = String(message || '').trim();
    node.dataset.tone = tone || 'muted';
  }

  function renderMessageCard(title, detail) {
    const target = root();
    if (!target) return;
    target.innerHTML = [
      '<section style="padding:32px;border:1px solid rgba(212,186,113,.18);border-radius:24px;background:rgba(13,17,14,.92);box-shadow:0 24px 56px rgba(0,0,0,.28)">',
      `<h1 style="margin:0 0 12px;font:700 32px/1.05 'IBM Plex Sans Thai','Segoe UI',sans-serif;color:#f4efe4">${escapeHtml(title)}</h1>`,
      `<p style="margin:0;color:rgba(244,239,228,.74);font:400 15px/1.7 'IBM Plex Sans Thai','Segoe UI',sans-serif">${escapeHtml(detail)}</p>`,
      '</section>',
    ].join('');
  }

  async function api(path, fallback, options = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 && controller
      ? window.setTimeout(() => controller.abort(), options.timeoutMs)
      : null;
    try {
      const response = await fetch(path, {
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
        signal: controller ? controller.signal : undefined,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        if (response.status === 401) {
          window.location.href = '/owner/login';
          return fallback;
        }
        throw new Error(String(payload?.error || `Request failed (${response.status})`));
      }
      return payload?.data ?? fallback;
    } catch (error) {
      const aborted = error?.name === 'AbortError';
      if (aborted && options.allowTimeoutFallback) {
        return fallback;
      }
      throw error;
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  function normalizeHashRoute() {
    const raw = String(window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
    return PAGE_ALIASES[raw] || 'dashboard';
  }

  async function loadQuotaSnapshots(rows) {
    const tenants = Array.isArray(rows) ? rows : [];
    const selected = tenants.slice(0, 12);
    const snapshots = await Promise.all(selected.map(async (row) => {
      const tenantId = String(row?.id || '').trim();
      if (!tenantId) return null;
      try {
        return await api(`/admin/api/platform/quota?tenantId=${encodeURIComponent(tenantId)}`, null);
      } catch {
        return null;
      }
    }));
    return snapshots.filter(Boolean);
  }

  async function refreshState(options = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    const requestId = Date.now();
    state.requestId = requestId;
    if (!options.silent) {
      setStatus('กำลังโหลดข้อมูลเจ้าของระบบ...', 'info');
      renderMessageCard('กำลังเตรียมข้อมูล', 'กำลังดึงภาพรวมผู้เช่า สถานะรันไทม์ และเหตุการณ์ล่าสุดเพื่อประกอบหน้า V4');
    }
    try {
      const me = await api('/admin/api/me', null);
      if (me?.tenantId) {
        window.location.href = '/tenant';
        return;
      }
      const [
        overview,
        tenants,
        subscriptions,
        licenses,
        agents,
        notifications,
        securityEvents,
        runtimeSupervisor,
        requestLogs,
        deliveryLifecycle,
      ] = await Promise.all([
        api('/admin/api/platform/overview', OWNER_OVERVIEW_FALLBACK, {
          timeoutMs: 2500,
          allowTimeoutFallback: true,
        }),
        api('/admin/api/platform/tenants?limit=50', []),
        api('/admin/api/platform/subscriptions?limit=50', []),
        api('/admin/api/platform/licenses?limit=50', []),
        api('/admin/api/platform/agents?limit=50', []),
        api('/admin/api/notifications?acknowledged=false&limit=20', { items: [] }),
        api('/admin/api/auth/security-events?limit=20', []),
        api('/admin/api/runtime/supervisor', null),
        api('/admin/api/observability/requests?limit=20&onlyErrors=true', { metrics: {}, items: [] }),
        api('/admin/api/delivery/lifecycle?limit=80&pendingOverdueMs=1200000', {}),
      ]);

      state.payload = {
        me,
        overview,
        tenants,
        subscriptions,
        licenses,
        agents,
        notifications: Array.isArray(notifications?.items) ? notifications.items : [],
        securityEvents,
        runtimeSupervisor,
        requestLogs,
        deliveryLifecycle,
        tenantQuotaSnapshots: [],
      };
      renderCurrentPage();
      setStatus('กำลังเติมข้อมูลเชิงลึกของผู้เช่า...', 'info');

      loadQuotaSnapshots(tenants)
        .then((tenantQuotaSnapshots) => {
          if (state.requestId !== requestId || !state.payload) return;
          state.payload = {
            ...state.payload,
            tenantQuotaSnapshots,
          };
          renderCurrentPage();
          setStatus('พร้อมใช้งาน', 'success');
        })
        .catch(() => {
          if (state.requestId !== requestId) return;
          setStatus('พร้อมใช้งาน', 'success');
        });
    } catch (error) {
      renderMessageCard('โหลดหน้าเจ้าของระบบไม่สำเร็จ', String(error?.message || error));
      setStatus('โหลดข้อมูลไม่สำเร็จ', 'danger');
    } finally {
      state.refreshing = false;
    }
  }

  function renderCurrentPage() {
    const target = root();
    if (!target) return;
    if (!state.payload) {
      renderMessageCard('ยังไม่มีข้อมูล', 'รอให้ระบบดึงข้อมูลล่าสุดก่อน');
      return;
    }

    const page = normalizeHashRoute();
    if (page === 'tenants') {
      window.OwnerTenantsV4.renderOwnerTenantsV4(target, state.payload);
    } else if (page === 'runtime') {
      window.OwnerRuntimeHealthV4.renderOwnerRuntimeHealthV4(target, state.payload);
    } else {
      window.OwnerDashboardV4.renderOwnerDashboardV4(target, state.payload);
    }
    document.title = `SCUM TH Platform | Owner | ${PAGE_TITLES[page] || 'ภาพรวมระบบ'}`;
  }

  window.addEventListener('DOMContentLoaded', () => {
    const refreshButton = document.getElementById('ownerV4RefreshBtn');
    refreshButton?.addEventListener('click', () => refreshState({ silent: false }));
    window.addEventListener('hashchange', renderCurrentPage);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshState({ silent: true });
    });
    state.timerId = window.setInterval(() => {
      if (!document.hidden) refreshState({ silent: true });
    }, 60000);
    refreshState({ silent: false });
  });
})();
