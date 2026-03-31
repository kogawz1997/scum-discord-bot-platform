/**
 * Player commerce routes for the standalone portal. This keeps purchase,
 * cart, redeem, bounty, and rentbike flows grouped outside the entry file.
 */

const {
  hasFeatureAccess,
  loadPlayerFeatureAccess,
  sendPlayerFeatureDenied,
} = require('./playerRouteEntitlements');

function createPlayerCommerceRoutes(deps) {
  const {
    sendJson,
    readJsonBody,
    normalizeText,
    normalizeAmount,
    normalizeQuantity,
    normalizePurchaseStatus,
    asInt,
    resolveItemIconUrl,
    buildBundleSummary,
    getDeliveryStatusText,
    serializeCartResolved,
    getResolvedCart,
    findShopItemByQuery,
    isGameItemShopKind,
    resolveSessionSteamLink,
    purchaseShopItemForUser,
    checkoutCart,
    listUserPurchases,
    listShopItems,
    listPurchaseStatusHistory,
    listCartItems,
    addCartItem,
    removeCartItem,
    clearCart,
    listActiveBountiesForUser,
    redeemCodeForUser,
    requestRentBikeForUser,
    createBountyForUser,
    normalizeShopKind,
  } = deps;

  async function getFeatureAccess(session) {
    return loadPlayerFeatureAccess(deps.getTenantFeatureAccess, session);
  }

  return async function handlePlayerCommerceRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
      method,
      session,
    } = context;
    const tenantOptions = {
      tenantId: session?.tenantId || undefined,
      serverId: session?.activeServerId || undefined,
    };

    if (pathname === '/player/api/shop/list' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['shop_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['shop_module']);
      }
      const q = normalizeText(urlObj.searchParams.get('q'));
      const kind = normalizeText(urlObj.searchParams.get('kind') || 'all') || 'all';
      const limit = asInt(urlObj.searchParams.get('limit'), 120, 1, 1000);
      const rows = await listShopItems(tenantOptions);
      const items = deps.filterShopItems(rows, { q, kind, limit });
      sendJson(res, 200, {
        ok: true,
        data: {
          query: q,
          kind,
          total: items.length,
          items,
        },
      });
      return true;
    }

    if ((pathname === '/player/api/shop/buy' || pathname === '/player/api/buy') && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['shop_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['shop_module']);
      }
      const body = await readJsonBody(req);
      const query = normalizeText(body.item || body.itemId || body.query);
      if (!query) {
        sendJson(res, 400, { ok: false, error: 'missing-item' });
        return true;
      }

      const item = await findShopItemByQuery(query, tenantOptions);
      if (!item) {
        sendJson(res, 404, { ok: false, error: 'item-not-found' });
        return true;
      }

      const itemKind = normalizeShopKind(item.kind);
      const result = await purchaseShopItemForUser({
        userId: session.discordId,
        item,
        guildId: normalizeText(body.guildId) || null,
        actor: `portal:${session.user}`,
        source: 'player-portal-buy',
        tenantId: tenantOptions.tenantId || null,
        resolveSteamLink: async () => resolveSessionSteamLink(session.discordId, tenantOptions),
      });
      if (!result.ok) {
        if (result.reason === 'steam-link-required') {
          sendJson(res, 400, {
            ok: false,
            error: 'steam-link-required',
            data: {
              message: 'ต้องผูก SteamID ก่อนซื้อสินค้าไอเทมในเกม',
            },
          });
          return true;
        }
        if (result.reason === 'insufficient-balance') {
          sendJson(res, 400, {
            ok: false,
            error: 'insufficient-balance',
            data: {
              required: normalizeAmount(item.price, 0),
              balance: normalizeAmount(result.balance, 0),
            },
          });
          return true;
        }
        sendJson(res, 500, {
          ok: false,
          error: 'purchase-failed',
          data: {
            message: 'ไม่สามารถสร้างคำสั่งซื้อได้ในตอนนี้ ระบบคืนเหรียญให้อัตโนมัติแล้ว',
          },
        });
        return true;
      }

      const { purchase, delivery } = result;
      const price = normalizeAmount(item.price, 0);

      sendJson(res, 200, {
        ok: true,
        data: {
          purchaseCode: purchase.code,
          item: {
            id: item.id,
            name: item.name,
            kind: itemKind,
            price,
            iconUrl: normalizeText(item.iconUrl) || resolveItemIconUrl(item),
            bundle: buildBundleSummary(item),
          },
          delivery: {
            queued: Boolean(delivery?.queued),
            reason: delivery?.reason || null,
            statusText: getDeliveryStatusText(delivery),
          },
        },
      });
      return true;
    }

    if (pathname === '/player/api/purchase/list' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['orders_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['orders_module']);
      }
      const statusFilter = normalizePurchaseStatus(urlObj.searchParams.get('status'));
      const limit = asInt(urlObj.searchParams.get('limit'), 40, 1, 200);
      const includeHistory = urlObj.searchParams.get('includeHistory') === '1';
      const [rows, shopRows] = await Promise.all([
        listUserPurchases(session.discordId, tenantOptions),
        listShopItems(tenantOptions),
      ]);
      const shopMap = new Map(
        (Array.isArray(shopRows) ? shopRows : []).map((row) => [String(row.id), row]),
      );

      let items = rows
        .filter((row) => !statusFilter || normalizePurchaseStatus(row?.status) === statusFilter)
        .slice(0, limit)
        .map((row) => {
          const item = shopMap.get(String(row.itemId));
          const status = normalizePurchaseStatus(row.status) || 'unknown';
          return {
            ...row,
            status,
            statusText: status === 'delivered'
              ? 'ส่งของแล้ว'
              : status === 'delivery_failed'
                ? 'ส่งของไม่สำเร็จ'
                : status === 'delivering'
                  ? 'กำลังส่งของ'
                  : 'รอส่งของ',
            itemName: normalizeText(item?.name) || normalizeText(row.itemId),
            itemKind: normalizeShopKind(item?.kind),
            iconUrl: normalizeText(item?.iconUrl) || resolveItemIconUrl(item || row),
            bundle: buildBundleSummary(item || {}),
          };
        });

      if (includeHistory && items.length > 0) {
        const historyRows = await Promise.all(
          items.map((row) => listPurchaseStatusHistory(row.code, 20, tenantOptions)),
        );
        items = items.map((row, index) => ({
          ...row,
          history: historyRows[index] || [],
        }));
      }

      sendJson(res, 200, {
        ok: true,
        data: {
          userId: session.discordId,
          includeHistory,
          total: items.length,
          items,
        },
      });
      return true;
    }

    if (pathname === '/player/api/cart' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['shop_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['shop_module']);
      }
      const raw = listCartItems(session.discordId, tenantOptions);
      const resolved = await getResolvedCart(session.discordId, tenantOptions);
      sendJson(res, 200, {
        ok: true,
        data: {
          raw,
          ...serializeCartResolved(resolved),
        },
      });
      return true;
    }

    if (pathname === '/player/api/cart/add' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['shop_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['shop_module']);
      }
      const body = await readJsonBody(req);
      const query = normalizeText(body.item || body.itemId || body.query);
      const quantity = normalizeQuantity(body.quantity, 1);
      if (!query) {
        sendJson(res, 400, { ok: false, error: 'missing-item' });
        return true;
      }

      const item = await findShopItemByQuery(query, tenantOptions);
      if (!item) {
        sendJson(res, 404, { ok: false, error: 'item-not-found' });
        return true;
      }

      if (isGameItemShopKind(item.kind)) {
        const steamLink = await resolveSessionSteamLink(session.discordId, tenantOptions);
        if (!steamLink.linked || !steamLink.steamId) {
          sendJson(res, 400, {
            ok: false,
            error: 'steam-link-required',
            data: {
              message: 'ต้องผูก SteamID ก่อนใส่สินค้าไอเทมลงตะกร้า',
            },
          });
          return true;
        }
      }

      addCartItem(session.discordId, item.id, quantity, tenantOptions);
      const resolved = await getResolvedCart(session.discordId, tenantOptions);
      sendJson(res, 200, {
        ok: true,
        data: {
          action: 'add',
          itemId: item.id,
          quantity,
          ...serializeCartResolved(resolved),
        },
      });
      return true;
    }

    if (pathname === '/player/api/cart/remove' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['shop_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['shop_module']);
      }
      const body = await readJsonBody(req);
      const query = normalizeText(body.item || body.itemId || body.query);
      const quantity = normalizeQuantity(body.quantity, 1);
      if (!query) {
        sendJson(res, 400, { ok: false, error: 'missing-item' });
        return true;
      }

      const item = await findShopItemByQuery(query, tenantOptions);
      const itemId = item?.id || query;
      const removed = removeCartItem(session.discordId, itemId, quantity, tenantOptions);
      if (!removed) {
        sendJson(res, 404, { ok: false, error: 'cart-item-not-found' });
        return true;
      }
      const resolved = await getResolvedCart(session.discordId, tenantOptions);
      sendJson(res, 200, {
        ok: true,
        data: {
          action: 'remove',
          itemId,
          quantity,
          ...serializeCartResolved(resolved),
        },
      });
      return true;
    }

    if (pathname === '/player/api/cart/clear' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['shop_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['shop_module']);
      }
      clearCart(session.discordId, tenantOptions);
      sendJson(res, 200, {
        ok: true,
        data: {
          action: 'clear',
          rows: [],
          missingItemIds: [],
          totalPrice: 0,
          totalUnits: 0,
        },
      });
      return true;
    }

    if (pathname === '/player/api/cart/checkout' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['shop_module', 'orders_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['shop_module', 'orders_module']);
      }
      const body = await readJsonBody(req).catch(() => ({}));
      const steamLink = await resolveSessionSteamLink(session.discordId, tenantOptions);
      const resolvedBeforeCheckout = await getResolvedCart(session.discordId, tenantOptions);
      const needsSteam = Array.isArray(resolvedBeforeCheckout?.rows)
        && resolvedBeforeCheckout.rows.some(
          (row) => isGameItemShopKind(row?.item?.kind),
        );
      if (needsSteam && (!steamLink.linked || !steamLink.steamId)) {
        sendJson(res, 400, {
          ok: false,
          error: 'steam-link-required',
          data: {
            ...serializeCartResolved(resolvedBeforeCheckout),
            message: 'ต้องผูก SteamID ก่อนชำระตะกร้าที่มีสินค้าไอเทมในเกม',
          },
        });
        return true;
      }

      const result = await checkoutCart(session.discordId, {
        guildId: normalizeText(body.guildId) || null,
        actor: `portal:${session.user}`,
        source: 'player-portal-cart-checkout',
        tenantId: tenantOptions.tenantId || null,
      });
      if (!result.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result.reason || 'checkout-failed',
          data: {
            ...serializeCartResolved(result),
            walletBalance: normalizeAmount(result.walletBalance, 0),
          },
        });
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        data: {
          ...serializeCartResolved(result),
          purchases: Array.isArray(result.purchases)
            ? result.purchases.map((entry) => ({
                purchaseCode: entry.purchase?.code || null,
                itemId: entry.itemId,
                itemName: entry.itemName,
                itemKind: entry.itemKind,
                bundle: entry.bundle || null,
                deliveryStatusText: getDeliveryStatusText(entry.delivery),
                delivery: entry.delivery || null,
              }))
            : [],
          failures: Array.isArray(result.failures) ? result.failures : [],
          refundedAmount: normalizeAmount(result.refundedAmount, 0),
        },
      });
      return true;
    }

    if (pathname === '/player/api/bounty/list' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['event_module', 'event_auto_reward', 'promo_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['event_module', 'event_auto_reward', 'promo_module']);
      }
      const items = listActiveBountiesForUser(tenantOptions);
      sendJson(res, 200, {
        ok: true,
        data: {
          total: items.length,
          items,
        },
      });
      return true;
    }

    if (pathname === '/player/api/redeem' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['orders_module', 'wallet_module', 'promo_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['orders_module', 'wallet_module', 'promo_module']);
      }
      const body = await readJsonBody(req);
      const code = normalizeText(body.code);
      if (!code) {
        sendJson(res, 400, {
          ok: false,
          error: 'Invalid request payload',
        });
        return true;
      }

      const result = await redeemCodeForUser({
        userId: session.discordId,
        code,
        actor: `portal:${session.user}`,
        source: 'player-portal-standalone',
        tenantId: tenantOptions.tenantId || null,
      });

      if (!result.ok) {
        const badRequestReasons = new Set([
          'invalid-input',
          'code-not-found',
          'code-already-used',
          'invalid-redeem-amount',
        ]);
        const status = badRequestReasons.has(result.reason) ? 400 : 500;
        sendJson(res, status, {
          ok: false,
          error: result.reason || 'redeem-failed',
          data: result,
        });
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        data: {
          ...result,
          message:
            result.type === 'coins'
              ? `ใช้โค้ดสำเร็จ ได้รับ ${result.amount} เหรียญ`
              : 'ใช้โค้ดสำเร็จ',
        },
      });
      return true;
    }

    if (pathname === '/player/api/rentbike/request' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['event_module', 'promo_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['event_module', 'promo_module']);
      }
      const body = await readJsonBody(req).catch(() => ({}));
      const result = await requestRentBikeForUser({
        discordUserId: session.discordId,
        guildId: normalizeText(body.guildId) || null,
        tenantId: tenantOptions.tenantId || null,
      });
      if (!result.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result.reason || 'rentbike-failed',
          data: result,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: result,
      });
      return true;
    }

    if (pathname === '/player/api/bounty/add' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['event_module', 'event_auto_reward', 'promo_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['event_module', 'event_auto_reward', 'promo_module']);
      }
      const body = await readJsonBody(req);
      const targetName = normalizeText(body.targetName);
      const amount = Number(body.amount);
      const result = await createBountyForUser({
        createdBy: session.discordId,
        targetName,
        amount,
        tenantId: tenantOptions.tenantId || null,
      });
      if (!result.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result.reason || 'bounty-create-failed',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: result,
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createPlayerCommerceRoutes,
};
