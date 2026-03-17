'use strict';

function createPortalResponseRuntime(options = {}) {
  const {
    secureCookie,
    safeJsonStringify,
    getFrameSrcOrigins,
    getLinkByUserId,
    getPlayerAccount,
    normalizeText,
  } = options;

  function walletReasonLabel(reason) {
    const key = normalizeText(reason).toLowerCase();
    const map = {
      daily_claim: 'รับรางวัลรายวัน',
      weekly_claim: 'รับรางวัลรายสัปดาห์',
      purchase_debit: 'ซื้อสินค้า',
      cart_checkout_debit: 'ชำระตะกร้า',
      redeem_code_coins: 'ใช้โค้ดแลกเหรียญ',
      wheel_spin_reward: 'วงล้อสุ่มรางวัล',
      wheel_spin_rollback: 'ย้อนกลับรางวัลวงล้อ',
      gift_transfer_out: 'โอนเหรียญออก',
      gift_transfer_in: 'รับเหรียญจากผู้เล่น',
      admin_wallet_set: 'แอดมินตั้งค่าเหรียญ',
      admin_wallet_add: 'แอดมินเพิ่มเหรียญ',
      admin_wallet_remove: 'แอดมินหักเหรียญ',
      wallet_add: 'เพิ่มเหรียญ',
      wallet_remove: 'หักเหรียญ',
      wallet_set: 'ตั้งค่ายอดเหรียญ',
      vip_purchase: 'ซื้อ VIP',
    };
    return map[key] || (key || 'unknown');
  }

  async function resolveSessionSteamLink(discordId, runtimeOptions = {}) {
    const [link, account] = await Promise.all([
      Promise.resolve(getLinkByUserId(discordId, runtimeOptions)),
      getPlayerAccount(discordId, runtimeOptions),
    ]);
    const steamId = link?.steamId || normalizeText(account?.steamId) || null;
    const inGameName = normalizeText(link?.inGameName) || null;
    return {
      linked: Boolean(steamId),
      steamId,
      inGameName,
      linkedAt: link?.linkedAt || null,
    };
  }

  function buildNotificationItems(payload = {}) {
    const items = [];
    const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
    const ledgers = Array.isArray(payload.ledgers) ? payload.ledgers : [];
    const rentals = Array.isArray(payload.rentals) ? payload.rentals : [];

    for (const row of purchases.slice(0, 10)) {
      items.push({
        type: 'purchase',
        title: `คำสั่งซื้อ ${row.code || '-'}`,
        message: `${row.itemName || row.itemId || '-'} | สถานะ ${row.status || '-'}`,
        createdAt: row.createdAt || null,
      });
    }

    for (const row of ledgers.slice(0, 10)) {
      items.push({
        type: 'wallet',
        title: walletReasonLabel(row.reason),
        message: `${row.delta >= 0 ? '+' : ''}${row.delta || 0} | ยอดหลังทำรายการ ${row.balanceAfter || 0}`,
        createdAt: row.createdAt || null,
      });
    }

    for (const row of rentals.slice(0, 10)) {
      items.push({
        type: 'rentbike',
        title: `เช่ารถ: ${row.status || '-'}`,
        message: `order: ${row.orderId || '-'} | vehicle: ${row.vehicleInstanceId || '-'}`,
        createdAt: row.updatedAt || row.createdAt || null,
      });
    }

    items.sort((a, b) => {
      const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
    return items.slice(0, 30);
  }

  function buildSecurityHeaders(extra = {}, options = {}) {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cache-Control': 'no-store',
    };

    if (secureCookie) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }

    if (options.isHtml) {
      const frameSrcList = ["'self'", ...getFrameSrcOrigins()];
      headers['Content-Security-Policy'] = [
        "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        `frame-src ${frameSrcList.join(' ')}`,
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ');
    }

    return { ...headers, ...extra };
  }

  function sendJson(res, statusCode, payload, extraHeaders = {}) {
    let effectiveStatus = statusCode;
    let body = '';
    try {
      body = safeJsonStringify(payload);
    } catch (error) {
      effectiveStatus = 500;
      body = safeJsonStringify({
        ok: false,
        error: 'Internal serialization error',
      });
      console.error(
        '[web-portal-standalone] sendJson serialize failed:',
        error?.message || error,
      );
    }

    res.writeHead(
      effectiveStatus,
      buildSecurityHeaders({
        'Content-Type': 'application/json; charset=utf-8',
        ...extraHeaders,
      }),
    );
    res.end(body);
  }

  function sendHtml(res, statusCode, html) {
    res.writeHead(
      statusCode,
      buildSecurityHeaders(
        {
          'Content-Type': 'text/html; charset=utf-8',
        },
        { isHtml: true },
      ),
    );
    res.end(html);
  }

  return {
    buildNotificationItems,
    buildSecurityHeaders,
    resolveSessionSteamLink,
    sendHtml,
    sendJson,
    walletReasonLabel,
  };
}

module.exports = {
  createPortalResponseRuntime,
};
