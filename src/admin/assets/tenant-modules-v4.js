(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantModulesV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const MODULE_CATALOG = [
    {
      featureKey: 'bot_delivery',
      title: 'งานส่งของ',
      description: 'ควบคุมงานส่งของ คิวส่ง และการส่งต่อของให้ผู้เล่นในจุดที่ใช้งานจริง',
      dependencies: ['orders_module', 'execute_agent'],
      actionHref: '/tenant/orders',
      actionLabel: 'เปิดหน้าส่งของ',
      dependencyActions: {
        orders_module: { href: '/tenant/orders', label: 'เปิดคำสั่งซื้อ' },
        execute_agent: { href: '/tenant/delivery-agents', label: 'เปิด Delivery Agent' },
      },
      runtimeRole: 'execute',
      runtimeHref: '/tenant/delivery-agents',
    },
    {
      featureKey: 'bot_log',
      title: 'ซิงก์บันทึกเซิร์ฟเวอร์',
      description: 'ดึงข้อมูลจาก SCUM.log ให้ส่วนกลางเห็นสถานะและเหตุการณ์ของเซิร์ฟเวอร์',
      dependencies: ['sync_agent'],
      actionHref: '/tenant/logs-sync',
      actionLabel: 'เปิดหน้าบันทึกและการซิงก์',
      dependencyActions: {
        sync_agent: { href: '/tenant/server-bots', label: 'เปิด Server Bot' },
      },
      runtimeRole: 'sync',
      runtimeHref: '/tenant/server-bots',
    },
    {
      featureKey: 'donation_module',
      title: 'ผู้สนับสนุน',
      description: 'เปิดแพ็กเกจผู้สนับสนุนและเส้นทางซื้อของสำหรับคนที่ช่วยซัพพอร์ตชุมชน',
      dependencies: ['orders_module', 'player_module'],
      actionHref: '/tenant/donations',
      actionLabel: 'เปิดหน้าผู้สนับสนุน',
      dependencyActions: {
        orders_module: { href: '/tenant/orders', label: 'เปิดคำสั่งซื้อ' },
        player_module: { href: '/tenant/players', label: 'เปิดผู้เล่น' },
      },
    },
    {
      featureKey: 'event_module',
      title: 'กิจกรรม',
      description: 'เปิดเครื่องมือสร้างกิจกรรม คำขอเรด และการประกาศรอบกิจกรรมให้ผู้เล่นเห็น',
      dependencies: [],
      actionHref: '/tenant/events',
      actionLabel: 'เปิดหน้ากิจกรรม',
    },
    {
      featureKey: 'wallet_module',
      title: 'กระเป๋าเงิน',
      description: 'ดูแลยอดคงเหลือ รางวัล และเส้นทางซื้อของที่อ้างอิงยอดในกระเป๋าเงิน',
      dependencies: ['orders_module', 'player_module'],
      actionHref: '/tenant/orders',
      actionLabel: 'เปิดคำสั่งซื้อ',
      dependencyActions: {
        orders_module: { href: '/tenant/orders', label: 'เปิดคำสั่งซื้อ' },
        player_module: { href: '/tenant/players', label: 'เปิดผู้เล่น' },
      },
    },
    {
      featureKey: 'ranking_module',
      title: 'อันดับและสถิติ',
      description: 'เปิดอันดับ สถิติ และสรุปความเคลื่อนไหวของผู้เล่นแบบที่ใช้สื่อสารกับชุมชนได้จริง',
      dependencies: ['player_module'],
      actionHref: '/tenant/players',
      actionLabel: 'เปิดผู้เล่น',
      dependencyActions: {
        player_module: { href: '/tenant/players', label: 'เปิดผู้เล่น' },
      },
    },
    {
      featureKey: 'support_module',
      title: 'การแจ้งเตือนและซัพพอร์ต',
      description: 'ช่วยให้ทีมงานตามเรื่องผู้เล่นและส่งการแจ้งเตือนที่เกี่ยวกับชุมชนได้ต่อเนื่อง',
      dependencies: ['discord_integration'],
      actionHref: '/tenant/players',
      actionLabel: 'เปิดเครื่องมือซัพพอร์ต',
      dependencyActions: {
        discord_integration: { href: '/tenant/settings', label: 'เปิดหน้าตั้งค่า' },
      },
    },
    {
      featureKey: 'analytics_module',
      title: 'สรุปข้อมูล',
      description: 'ดูภาพรวมการใช้งาน ยอดสั่งซื้อ และตัวเลขสำคัญเพื่อใช้ตัดสินใจต่อในแต่ละวัน',
      dependencies: [],
      actionHref: '/tenant/analytics',
      actionLabel: 'เปิดหน้าสรุปข้อมูล',
    },
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function firstNonEmpty(values, fallback = '') {
    const list = Array.isArray(values) ? values : [values];
    for (const value of list) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return fallback;
  }

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('th-TH').format(numeric) : fallback;
  }

  function humanizeFeatureKey(value) {
    const key = String(value || '').trim();
    const dictionary = {
      bot_delivery: 'งานส่งของ',
      bot_log: 'ซิงก์บันทึกเซิร์ฟเวอร์',
      donation_module: 'ผู้สนับสนุน',
      event_module: 'กิจกรรม',
      wallet_module: 'กระเป๋าเงิน',
      ranking_module: 'อันดับและสถิติ',
      support_module: 'การแจ้งเตือนและซัพพอร์ต',
      analytics_module: 'สรุปข้อมูล',
      orders_module: 'คำสั่งซื้อ',
      player_module: 'ผู้เล่น',
      sync_agent: 'Server Bot',
      execute_agent: 'Delivery Agent',
      discord_integration: 'Discord',
    };
    return dictionary[key] || key;
  }

  function renderBadge(label, tone) {
    return `<span class="tdv4-badge tdv4-badge-${escapeHtml(tone || 'muted')}">${escapeHtml(label)}</span>`;
  }

  function renderNavGroup(group) {
    return [
      '<section class="tdv4-nav-group">',
      `<div class="tdv4-nav-group-label">${escapeHtml(group.label)}</div>`,
      '<div class="tdv4-nav-items">',
      ...(Array.isArray(group.items) ? group.items.map((item) => {
        const currentClass = item.current ? ' tdv4-nav-link-current' : '';
        return `<a class="tdv4-nav-link${currentClass}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label)}</a>`;
      }) : []),
      '</div>',
      '</section>',
    ].join('');
  }

  function renderSummaryCard(item) {
    return [
      `<article class="tdv4-kpi tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-kpi-label">${escapeHtml(item.label)}</div>`,
      `<div class="tdv4-kpi-value">${escapeHtml(item.value)}</div>`,
      `<div class="tdv4-kpi-detail">${escapeHtml(item.detail)}</div>`,
      '</article>',
    ].join('');
  }

  function buildRuntimeHealth(state) {
    const rows = Array.isArray(state?.agents) ? state.agents : [];
    const syncOnline = rows.some((row) => String(row?.role || '').trim() === 'sync' && String(row?.status || '').trim() === 'online');
    const executeOnline = rows.some((row) => String(row?.role || '').trim() === 'execute' && String(row?.status || '').trim() === 'online');
    return {
      syncOnline,
      executeOnline,
      syncCount: rows.filter((row) => String(row?.role || '').trim() === 'sync').length,
      executeCount: rows.filter((row) => String(row?.role || '').trim() === 'execute').length,
    };
  }

  function resolveRuntimeIssue(entry, runtimeHealth, effectiveEnabled) {
    if (!effectiveEnabled || !entry?.runtimeRole) return null;
    if (entry.runtimeRole === 'sync' && !runtimeHealth.syncOnline) {
      return {
        label: 'Server Bot ยังไม่พร้อม',
        detail: 'โมดูลนี้ต้องมี Server Bot ที่เชื่อมอยู่ก่อน จึงจะใช้งานได้ต่อเนื่องในงานจริง',
        href: entry.runtimeHref || '/tenant/server-bots',
        actionLabel: 'เปิดหน้า Server Bot',
      };
    }
    if (entry.runtimeRole === 'execute' && !runtimeHealth.executeOnline) {
      return {
        label: 'Delivery Agent ยังไม่พร้อม',
        detail: 'โมดูลนี้ต้องมี Delivery Agent ที่เชื่อมอยู่ก่อน จึงจะส่งของหรือทำงานหน้างานได้จริง',
        href: entry.runtimeHref || '/tenant/delivery-agents',
        actionLabel: 'เปิดหน้า Delivery Agent',
      };
    }
    return null;
  }

  function resolveModuleState(entry, runtimeHealth) {
    const packageEnabled = entry.packageEnabled === true;
    const effectiveEnabled = entry.effectiveEnabled === true;
    const manageable = entry.manageable === true;
    const missingDependencies = Array.isArray(entry.missingDependencies) ? entry.missingDependencies : [];
    const runtimeIssue = resolveRuntimeIssue(entry, runtimeHealth, effectiveEnabled);

    if (!manageable) {
      return {
        label: 'ต้องอัปเกรดแพ็กเกจ',
        tone: 'warning',
        detail: 'โมดูลนี้อยู่นอกแพ็กเกจปัจจุบัน จึงยังเปิดจากหน้านี้ไม่ได้',
      };
    }
    if (effectiveEnabled && missingDependencies.length > 0) {
      return {
        label: 'ยังติดของที่ต้องมีร่วม',
        tone: 'warning',
        detail: `ยังขาด: ${missingDependencies.map(humanizeFeatureKey).join(', ')}`,
      };
    }
    if (runtimeIssue) {
      return {
        label: runtimeIssue.label,
        tone: 'warning',
        detail: runtimeIssue.detail,
      };
    }
    if (effectiveEnabled) {
      return {
        label: 'พร้อมใช้งาน',
        tone: 'success',
        detail: 'โมดูลนี้เปิดใช้งานแล้ว และพร้อมใช้ในงานประจำวัน',
      };
    }
    if (packageEnabled) {
      return {
        label: 'เปิดได้ทันที',
        tone: 'info',
        detail: 'โมดูลนี้อยู่ในแพ็กเกจแล้ว เปิดใช้จากหน้านี้ได้เมื่อต้องการ',
      };
    }
    return {
      label: 'ยังถูกล็อก',
      tone: 'muted',
      detail: 'โมดูลนี้ยังไม่อยู่ในแพ็กเกจปัจจุบัน',
    };
  }

  function resolveNextAction(entry) {
    const missingDependencies = Array.isArray(entry?.missingDependencies) ? entry.missingDependencies : [];
    if (missingDependencies.length > 0) {
      const dependencyKey = missingDependencies[0];
      const dependencyAction = entry?.dependencyActions?.[dependencyKey];
      return {
        label: dependencyAction?.label || `ไปเปิด ${humanizeFeatureKey(dependencyKey)}`,
        href: dependencyAction?.href || '#',
        detail: `เคลียร์ ${humanizeFeatureKey(dependencyKey)} ก่อน แล้วค่อยเปิด ${entry?.title || humanizeFeatureKey(entry?.featureKey)} ต่อ`,
      };
    }
    if (entry?.runtimeIssue) {
      return {
        label: entry.runtimeIssue.actionLabel,
        href: entry.runtimeIssue.href,
        detail: entry.runtimeIssue.detail,
      };
    }
    if (entry?.manageable !== true) {
      return {
        label: 'ดูแพ็กเกจ',
        href: '/tenant/billing',
        detail: 'ใช้หน้าการเงินเพื่อดูสิทธิ์ที่มีและทางเลือกในการอัปเกรด',
      };
    }
    return {
      label: entry?.actionLabel || 'เปิดหน้าที่เกี่ยวข้อง',
      href: entry?.actionHref || '#',
      detail: entry?.effectiveEnabled
        ? 'เปิดหน้าที่ทีมงานใช้กับโมดูลนี้ในงานประจำวัน'
        : 'เปิดหน้าที่เกี่ยวข้องก่อน แล้วค่อยตัดสินใจว่าจะเปิดโมดูลนี้หรือไม่',
    };
  }

  function buildRolloutGroup(title, tone, rows, emptyDetail) {
    return {
      title,
      tone,
      count: rows.length,
      rows,
      emptyDetail,
    };
  }

  function createTenantModulesV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const runtimeHealth = buildRuntimeHealth(state);
    const packageFeatureSet = new Set(
      Array.isArray(state?.overview?.tenantFeatureAccess?.package?.features)
        ? state.overview.tenantFeatureAccess.package.features.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    const effectiveFeatureSet = new Set(
      Array.isArray(state?.overview?.tenantFeatureAccess?.enabledFeatureKeys)
        ? state.overview.tenantFeatureAccess.enabledFeatureKeys.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    const featureFlags = state?.tenantConfig?.featureFlags && typeof state.tenantConfig.featureFlags === 'object'
      ? state.tenantConfig.featureFlags
      : {};
    const locked = Boolean(state?.featureEntitlements?.actions?.can_use_modules?.locked);
    const lockReason = String(state?.featureEntitlements?.actions?.can_use_modules?.reason || '').trim();
    const modules = MODULE_CATALOG.map((entry) => {
      const packageEnabled = packageFeatureSet.has(entry.featureKey);
      const effectiveEnabled = effectiveFeatureSet.has(entry.featureKey);
      const manageable = packageEnabled || effectiveEnabled;
      const missingDependencies = entry.dependencies.filter((dependency) => !effectiveFeatureSet.has(dependency));
      const runtimeIssue = resolveRuntimeIssue({
        ...entry,
        packageEnabled,
        effectiveEnabled,
        manageable,
        missingDependencies,
      }, runtimeHealth, effectiveEnabled);
      const stateDescriptor = resolveModuleState({
        ...entry,
        packageEnabled,
        effectiveEnabled,
        manageable,
        missingDependencies,
        runtimeIssue,
      }, runtimeHealth);
      return {
        ...entry,
        packageEnabled,
        effectiveEnabled,
        manageable,
        missingDependencies,
        runtimeIssue,
        stateLabel: stateDescriptor.label,
        stateTone: stateDescriptor.tone,
        stateDetail: stateDescriptor.detail,
        overrideState: Object.prototype.hasOwnProperty.call(featureFlags, entry.featureKey)
          ? featureFlags[entry.featureKey]
          : null,
        nextAction: resolveNextAction({
          ...entry,
          packageEnabled,
          effectiveEnabled,
          manageable,
          missingDependencies,
          runtimeIssue,
        }),
      };
    });
    const runtimeBlockedCount = modules.filter((row) => row.runtimeIssue).length;
    const dependencyBlockedCount = modules.filter((row) => row.effectiveEnabled && row.missingDependencies.length > 0).length;
    const upgradeRequiredCount = modules.filter((row) => !row.manageable).length;
    const topActions = modules
      .filter((row) => row.nextAction && (row.runtimeIssue || row.missingDependencies.length > 0 || !row.manageable))
      .slice(0, 4)
      .map((row) => ({
        featureKey: row.featureKey,
        title: row.title,
        stateLabel: row.stateLabel,
        action: row.nextAction,
      }));
    const rolloutGroups = [
      buildRolloutGroup(
        'เปิดใช้ได้เลย',
        'success',
        modules.filter((row) => row.manageable && !row.effectiveEnabled && row.missingDependencies.length === 0 && !row.runtimeIssue),
        'ตอนนี้ยังไม่มีโมดูลที่พร้อมเปิดเพิ่มทันที',
      ),
      buildRolloutGroup(
        'ยังติดของที่ต้องมีร่วม',
        'warning',
        modules.filter((row) => row.missingDependencies.length > 0),
        'ตอนนี้ไม่มีโมดูลที่ติดเงื่อนไขร่วม',
      ),
      buildRolloutGroup(
        'ยังต้องให้บอทเชื่อมก่อน',
        'warning',
        modules.filter((row) => Boolean(row.runtimeIssue)),
        'ตอนนี้ไม่มีโมดูลที่ติดเพราะบอทยังไม่พร้อม',
      ),
      buildRolloutGroup(
        'ต้องอัปเกรดแพ็กเกจ',
        'muted',
        modules.filter((row) => !row.manageable),
        'โมดูลที่มองเห็นอยู่ตอนนี้อยู่ในแพ็กเกจแล้วทั้งหมด',
      ),
    ];

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: firstNonEmpty([
          state?.tenantLabel,
          state?.tenantConfig?.name,
          state?.overview?.tenantName,
          state?.me?.tenantId,
          'พื้นที่จัดการผู้เช่า',
        ]),
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups) ? state.__surfaceShell.navGroups : [],
      },
      header: {
        title: 'โมดูลของระบบ',
        subtitle: 'เปิดหรือปิดโมดูลที่ผู้เช่าใช้จริง โดยยังแยกเรื่องแพ็กเกจออกจากการทำงานประจำวันให้ชัด',
        statusChips: [
          { label: `${formatNumber(modules.filter((row) => row.effectiveEnabled).length)} โมดูลที่เปิดอยู่`, tone: 'success' },
          { label: `${formatNumber(modules.filter((row) => row.manageable).length)} โมดูลที่จัดการได้`, tone: 'info' },
          { label: runtimeBlockedCount ? `${formatNumber(runtimeBlockedCount)} โมดูลยังต้องรอบอท` : 'บอทพร้อมสำหรับโมดูลหลัก', tone: runtimeBlockedCount ? 'warning' : 'success' },
          { label: locked ? 'ติดสิทธิ์แพ็กเกจ' : 'พร้อมบันทึก', tone: locked ? 'warning' : 'success' },
        ],
        primaryAction: { label: 'บันทึกการเปลี่ยนแปลง', href: '#tenant-modules-save' },
      },
      summaryStrip: [
        { label: 'ที่เปิดใช้อยู่ตอนนี้', value: formatNumber(modules.filter((row) => row.effectiveEnabled).length), detail: 'โมดูลที่กำลังทำงานอยู่กับผู้เช่ารายนี้', tone: 'success' },
        { label: 'ติดสิทธิ์แพ็กเกจ', value: formatNumber(upgradeRequiredCount), detail: locked ? lockReason || 'โมดูลบางตัวต้องอัปเกรดแพ็กเกจก่อน' : 'โมดูลที่ติดสิทธิ์จะแสดงต่อไว้ตรงนี้', tone: upgradeRequiredCount ? 'warning' : 'muted' },
        { label: 'ยังติดเงื่อนไขร่วม', value: formatNumber(dependencyBlockedCount), detail: 'ถ้าเปิดแล้วแต่ยังขาดของที่เกี่ยวข้องอยู่ ระบบจะกันไม่ให้หลุดไปใช้งานจริง', tone: dependencyBlockedCount ? 'warning' : 'info' },
        { label: 'ยังต้องให้บอทเชื่อมก่อน', value: formatNumber(runtimeBlockedCount), detail: 'บางโมดูลต้องรอ Server Bot หรือ Delivery Agent ก่อนถึงจะนิ่งพอใช้งานจริง', tone: runtimeBlockedCount ? 'warning' : 'success' },
        { label: 'แหล่งที่บันทึก', value: 'ค่าเปิดปิดของผู้เช่า', detail: 'หน้านี้บันทึกเฉพาะค่าของผู้เช่า ไม่ได้เปลี่ยนแพ็กเกจหลัก', tone: 'info' },
      ],
      locked,
      lockReason,
      topActions,
      rolloutGroups,
      runtimeHealth,
      modules,
    };
  }

  function buildTenantModulesV4Html(model) {
    const safe = model || createTenantModulesV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row">',
      `<div class="tdv4-brand-mark">${escapeHtml(safe.shell.brand)}</div>`,
      '<div class="tdv4-brand-copy">',
      `<div class="tdv4-surface-label">${escapeHtml(safe.shell.surfaceLabel)}</div>`,
      `<div class="tdv4-workspace-label">${escapeHtml(safe.shell.workspaceLabel)}</div>`,
      '</div></div></header>',
      '<div class="tdv4-shell">',
      `<aside class="tdv4-sidebar">${(Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups : []).map(renderNavGroup).join('')}</aside>`,
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div>',
      `<h1 class="tdv4-page-title">${escapeHtml(safe.header.title)}</h1>`,
      `<p class="tdv4-page-subtitle">${escapeHtml(safe.header.subtitle)}</p>`,
      `<div class="tdv4-chip-row">${safe.header.statusChips.map((chip) => renderBadge(chip.label, chip.tone)).join('')}</div>`,
      '</div>',
      `<div class="tdv4-pagehead-actions"><button id="tenant-modules-save" class="tdv4-button tdv4-button-primary" type="button" data-tenant-modules-save${safe.locked ? ' disabled' : ''}>${escapeHtml(safe.header.primaryAction.label)}</button></div>`,
      '</section>',
      `<section class="tdv4-kpi-strip">${safe.summaryStrip.map(renderSummaryCard).join('')}</section>`,
      `<section class="tdv4-spotlight-grid"><article class="tdv4-panel tdv4-tone-${safe.locked ? 'warning' : 'info'}"><div class="tdv4-section-kicker">กติกาการใช้งาน</div><h2 class="tdv4-section-title">เปิดปิดเฉพาะของที่ผู้เช่าคุมได้จริง</h2><p class="tdv4-section-copy">หน้านี้ใช้จัดการโมดูลของผู้เช่าโดยตรง ถ้าโมดูลไหนติดแพ็กเกจหรือยังขาดบอทที่เกี่ยวข้อง ระบบจะบอกเหตุผลไว้ก่อนให้ครบ</p>${safe.locked ? `<div class="tdv4-chip-row">${renderBadge(safe.lockReason || 'อัปเกรดแพ็กเกจเพื่อปลดล็อกโมดูลเพิ่ม', 'warning')}</div>` : ''}<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-primary" href="#tenant-modules-save">บันทึกเมื่อพร้อม</a><a class="tdv4-button tdv4-button-secondary" href="/tenant/billing">ดูแพ็กเกจ</a><a class="tdv4-button tdv4-button-secondary" href="/tenant/server-bots">ดู Server Bot</a></div></article><article class="tdv4-spotlight-media" style="--tdv4-media-image: linear-gradient(135deg, rgba(8, 12, 10, 0.5), rgba(8, 12, 10, 0.18)), url('/admin/assets/tenant-panel-scene.svg');"><div class="tdv4-spotlight-overlay"><span class="tdv4-section-kicker">ภาพรวมโมดูล</span><h3 class="tdv4-section-title">ดูว่าควรเปิดอะไรต่อ และอะไรยังติดเงื่อนไข</h3><p class="tdv4-section-copy tdv4-spotlight-copy">หน้าที่ดีควรตอบได้ทันทีว่าโมดูลไหนพร้อมใช้ โมดูลไหนยังต้องเพิ่มสิทธิ์ หรือยังต้องรอการเชื่อมของบอทก่อน</p></div></article></section>`,
      '<section class="tdv4-panel" data-tenant-modules-rollout-board>',
      '<div class="tdv4-section-kicker">ภาพรวมความพร้อม</div>',
      '<h2 class="tdv4-section-title">บอร์ดความพร้อมของโมดูล</h2>',
      '<p class="tdv4-section-copy">ดูว่าโมดูลไหนเปิดได้เลย และโมดูลไหนยังติดแพ็กเกจ ของที่ต้องมีร่วม หรือการเชื่อมของบอท</p>',
      `<div class="tdv4-action-list">${(Array.isArray(safe.rolloutGroups) ? safe.rolloutGroups : []).map((group) => [
        `<article class="tdv4-panel tdv4-tone-${escapeHtml(group.tone || 'muted')}" data-tenant-module-rollout-group="${escapeHtml(group.title || '')}">`,
        `<div class="tdv4-section-kicker">${renderBadge(`${formatNumber(group.count)} โมดูล`, group.tone)}</div>`,
        `<h3 class="tdv4-section-title">${escapeHtml(group.title || '')}</h3>`,
        group.rows.length
          ? `<div class="tdv4-action-list">${group.rows.slice(0, 4).map((row) => [
            `<div class="tdv4-note-card" data-tenant-module-rollout-item="${escapeHtml(row.featureKey)}">`,
            `<strong>${escapeHtml(row.title)}</strong>`,
            `<p>${escapeHtml(row.stateDetail || row.stateLabel || '')}</p>`,
            row.nextAction
              ? `<a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(row.nextAction.href || '#')}">${escapeHtml(row.nextAction.label || 'เปิดหน้าที่เกี่ยวข้อง')}</a>`
              : '',
            '</div>',
          ].join('')).join('')}</div>`
          : `<div class="tdv4-note-card">${escapeHtml(group.emptyDetail || 'ตอนนี้ยังไม่มีรายการที่รออยู่')}</div>`,
        '</article>',
      ].join('')).join('')}</div>`,
      '</section>',
      '<section class="tdv4-panel" data-tenant-modules-next-actions>',
      '<div class="tdv4-section-kicker">ควรทำอะไรก่อน</div>',
      '<h2 class="tdv4-section-title">คิวติดตามงานของโมดูล</h2>',
      '<p class="tdv4-section-copy">เคลียร์รายการที่ติดแพ็กเกจ ติดของที่ต้องมีร่วม หรือยังรอบอทก่อน แล้วค่อยบันทึกการเปลี่ยนแปลงรอบใหญ่</p>',
      safe.topActions.length
        ? `<div class="tdv4-action-list">${safe.topActions.map((item) => [
          `<article class="tdv4-panel tdv4-tone-${escapeHtml(item.action?.href === '/tenant/billing' ? 'warning' : 'info')}">`,
          `<div class="tdv4-section-kicker">${escapeHtml(humanizeFeatureKey(item.featureKey))}</div>`,
          `<h3 class="tdv4-section-title">${escapeHtml(item.title)}</h3>`,
          `<p class="tdv4-section-copy">${escapeHtml(item.action?.detail || item.stateLabel || '')}</p>`,
          `<div class="tdv4-chip-row">${renderBadge(item.stateLabel, 'warning')}</div>`,
          `<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(item.action?.href || '#')}">${escapeHtml(item.action?.label || 'เปิดหน้าที่เกี่ยวข้อง')}</a></div>`,
          '</article>',
        ].join('')).join('')}</div>`
        : '<div class="tdv4-note-card">ตอนนี้ยังไม่มีงานโมดูลที่ต้องรีบตามต่อ</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">รายการทั้งหมด</div>',
      '<h2 class="tdv4-section-title">โมดูลที่ผู้เช่ารายนี้มองเห็นได้</h2>',
      '<p class="tdv4-section-copy">เปลี่ยนสถานะแล้วค่อยบันทึกเมื่อพร้อม ปุ่มรีเซ็ตจะพากลับไปตามสิทธิ์ตั้งต้นของแพ็กเกจก่อนบันทึก</p>',
      '<div class="tdv4-action-list">',
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-modules-reset${safe.locked ? ' disabled' : ''}>รีเซ็ตกลับตามแพ็กเกจ</button>`,
      '</div>',
      safe.modules.map((row) => [
        `<article class="tdv4-panel tdv4-tone-${row.stateTone}" data-tenant-module-card="${escapeHtml(row.featureKey)}">`,
        `<div class="tdv4-section-kicker">${escapeHtml(row.featureKey)}</div>`,
        `<h3 class="tdv4-section-title">${escapeHtml(row.title)}</h3>`,
        `<p class="tdv4-section-copy">${escapeHtml(row.description)}</p>`,
        '<div class="tdv4-chip-row">',
        renderBadge(row.packageEnabled ? 'อยู่ในแพ็กเกจ' : 'ต้องอัปเกรดแพ็กเกจ', row.packageEnabled ? 'info' : 'warning'),
        renderBadge(row.effectiveEnabled ? 'เปิดใช้อยู่' : 'ยังไม่เปิด', row.effectiveEnabled ? 'success' : 'muted'),
        renderBadge(row.stateLabel, row.stateTone),
        row.overrideState === true ? renderBadge('บังคับเปิด', 'success') : '',
        row.overrideState === false ? renderBadge('บังคับปิด', 'warning') : '',
        '</div>',
        `<div class="tdv4-kpi-detail" data-tenant-module-status="${escapeHtml(row.featureKey)}">${escapeHtml(row.stateDetail)}</div>`,
        `<div class="tdv4-kpi-detail">ของที่ต้องมีร่วม: ${escapeHtml(row.dependencies.length ? row.dependencies.map(humanizeFeatureKey).join(', ') : 'ไม่มี')}</div>`,
        row.missingDependencies.length
          ? `<div class="tdv4-kpi-detail">ตอนนี้ยังขาด: ${escapeHtml(row.missingDependencies.map(humanizeFeatureKey).join(', '))}</div>`
          : '<div class="tdv4-kpi-detail">ตอนนี้ของที่ต้องมีร่วมครบแล้ว</div>',
        row.nextAction
          ? `<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-secondary" data-tenant-module-action-link="${escapeHtml(row.featureKey)}" href="${escapeHtml(row.nextAction.href || '#')}">${escapeHtml(row.nextAction.label || 'เปิดหน้าที่เกี่ยวข้อง')}</a></div>`
          : '',
        '<label class="tdv4-basic-field">',
        '<div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">เปิดใช้งาน</div><div class="tdv4-basic-field-detail">โมดูลที่ติดแพ็กเกจยังจะแสดงอยู่ แต่ต้องอัปเกรดก่อนถึงจะเปิดจากหน้านี้ได้</div></div>',
        `<input type="checkbox" data-module-toggle data-module-feature-key="${escapeHtml(row.featureKey)}" data-module-package-enabled="${row.packageEnabled ? 'true' : 'false'}" data-module-depends-on="${escapeHtml(row.dependencies.join(','))}"${row.effectiveEnabled ? ' checked' : ''}${(!row.manageable || safe.locked) ? ' disabled' : ''}>`,
        '</label>',
        '</article>',
      ].join('')).join(''),
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantModulesV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantModulesV4 requires a root element');
    const model = source && source.header && Array.isArray(source.modules)
      ? source
      : createTenantModulesV4Model(source);
    rootElement.innerHTML = buildTenantModulesV4Html(model);
    return model;
  }

  return {
    buildTenantModulesV4Html,
    createTenantModulesV4Model,
    renderTenantModulesV4,
  };
});
