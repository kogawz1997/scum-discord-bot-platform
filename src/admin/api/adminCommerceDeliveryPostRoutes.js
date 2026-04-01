/**
 * Admin mutations for wallet, shop, purchase, delivery, and lightweight
 * runtime actions. Grouped outside the main admin server file.
 */

const {
  requireTenantActionEntitlement,
} = require('./tenantRouteEntitlements');
const {
  requireTenantPermission,
} = require('./tenantRoutePermissions');

function createAdminCommerceDeliveryPostRoutes(deps) {
  const {
    sendJson,
    requiredString,
    asInt,
    parseStringArray,
    getAuthTenantId,
    resolveScopedTenantId,
    listKnownPurchaseStatuses,
    setCoinsExact,
    creditCoins,
    debitCoins,
    addShopItemForAdmin,
    updateShopItemForAdmin,
    setShopItemPriceForAdmin,
    setShopItemStatusForAdmin,
    deleteShopItemForAdmin,
    updatePurchaseStatusForActor,
    queueLeaderboardRefreshForAllGuilds,
    parseDeliveryItemsBody,
    enqueuePurchaseDeliveryByCode,
    retryDeliveryNow,
    retryDeliveryNowMany,
    retryDeliveryDeadLetter,
    retryDeliveryDeadLetterMany,
    removeDeliveryDeadLetter,
    cancelDeliveryJob,
    previewDeliveryCommands,
    getDeliveryPreflightReport,
    simulateDeliveryPlan,
    setDeliveryCommandOverride,
    sendTestDeliveryCommand,
    saveAdminCommandCapabilityPreset,
    getAdminCommandCapabilityPresetById,
    deleteAdminCommandCapabilityPreset,
    testScumAdminCommandCapability,
    runRentBikeMidnightReset,
    getRentBikeRuntime,
    updateScumStatusForAdmin,
    getStatus,
    getDeliveryDetailsByPurchaseCode,
    getTenantFeatureAccess,
    buildTenantProductEntitlements,
  } = deps;

  async function getScopedDeliveryCase(code, tenantId) {
    if (!tenantId || typeof getDeliveryDetailsByPurchaseCode !== 'function') {
      return null;
    }
    try {
      return await getDeliveryDetailsByPurchaseCode(code, 10, { tenantId });
    } catch {
      return null;
    }
  }

  function hasScopedDeliveryCase(detail) {
    return Boolean(detail?.purchase || detail?.queueJob || detail?.deadLetter);
  }

  return async function handleAdminCommerceDeliveryPostRoute(context) {
    const {
      client,
      req,
      pathname,
      body,
      res,
      auth,
    } = context;
    const authTenantId = String(auth?.tenantId || '').trim() || undefined;

    if (pathname === '/admin/api/wallet/set') {
      const tenantId = authTenantId || requiredString(body, 'tenantId');
      const playerPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_players',
        message: 'Your tenant role cannot change player balances.',
      });
      if (!playerPermission.allowed) return true;
      if (tenantId) {
        const walletCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_players',
          message: 'Wallet adjustments are locked until the current package includes player management.',
        });
        if (!walletCheck.allowed) return true;
      }
      const userId = requiredString(body, 'userId');
      const balance = asInt(body.balance);
      if (!userId || balance == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await setCoinsExact({
        userId,
        amount: balance,
        reason: 'admin_wallet_set',
        actor: `admin-web:${auth?.user || 'unknown'}`,
        tenantId: authTenantId,
        meta: { role: auth?.role || 'unknown' },
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      queueLeaderboardRefreshForAllGuilds(client, 'admin-wallet-set', { tenantId: authTenantId });
      sendJson(res, 200, { ok: true, data: { userId, balance: result.balance } });
      return true;
    }

    if (pathname === '/admin/api/wallet/add') {
      const tenantId = authTenantId || requiredString(body, 'tenantId');
      const playerPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_players',
        message: 'Your tenant role cannot change player balances.',
      });
      if (!playerPermission.allowed) return true;
      if (tenantId) {
        const walletCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_players',
          message: 'Wallet adjustments are locked until the current package includes player management.',
        });
        if (!walletCheck.allowed) return true;
      }
      const userId = requiredString(body, 'userId');
      const amount = asInt(body.amount);
      if (!userId || amount == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await creditCoins({
        userId,
        amount,
        reason: 'admin_wallet_add',
        actor: `admin-web:${auth?.user || 'unknown'}`,
        tenantId: authTenantId,
        meta: { role: auth?.role || 'unknown' },
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      queueLeaderboardRefreshForAllGuilds(client, 'admin-wallet-add', { tenantId: authTenantId });
      sendJson(res, 200, { ok: true, data: { userId, balance: result.balance } });
      return true;
    }

    if (pathname === '/admin/api/wallet/remove') {
      const tenantId = authTenantId || requiredString(body, 'tenantId');
      const playerPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_players',
        message: 'Your tenant role cannot change player balances.',
      });
      if (!playerPermission.allowed) return true;
      if (tenantId) {
        const walletCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_players',
          message: 'Wallet adjustments are locked until the current package includes player management.',
        });
        if (!walletCheck.allowed) return true;
      }
      const userId = requiredString(body, 'userId');
      const amount = asInt(body.amount);
      if (!userId || amount == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await debitCoins({
        userId,
        amount,
        reason: 'admin_wallet_remove',
        actor: `admin-web:${auth?.user || 'unknown'}`,
        tenantId: authTenantId,
        meta: { role: auth?.role || 'unknown' },
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      queueLeaderboardRefreshForAllGuilds(client, 'admin-wallet-remove', { tenantId: authTenantId });
      sendJson(res, 200, { ok: true, data: { userId, balance: result.balance } });
      return true;
    }

    if (pathname === '/admin/api/shop/add') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const donationPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_donations',
        message: 'Your tenant role cannot create donation packages.',
      });
      if (!donationPermission.allowed) return true;
      if (tenantId) {
        const donationCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_donations',
          message: 'Donation package creation is locked until the current package includes donation tools.',
        });
        if (!donationCheck.allowed) return true;
      }
      const id = requiredString(body, 'id');
      const name = requiredString(body, 'name');
      const price = asInt(body.price);
      const description = String(body.description || '').trim();
      const kindRaw = requiredString(body, 'kind') || 'item';
      const kind = String(kindRaw).trim().toLowerCase() === 'vip' ? 'vip' : 'item';
      const gameItemId = requiredString(body, 'gameItemId');
      const quantity = asInt(body.quantity) ?? 1;
      const iconUrl = requiredString(body, 'iconUrl');
      const deliveryProfile = requiredString(body, 'deliveryProfile');
      const deliveryTeleportMode = requiredString(body, 'deliveryTeleportMode');
      const deliveryTeleportTarget = requiredString(body, 'deliveryTeleportTarget');
      const deliveryPreCommands = body.deliveryPreCommands;
      const deliveryPostCommands = body.deliveryPostCommands;
      const deliveryReturnTarget = requiredString(body, 'deliveryReturnTarget');
      const deliveryItems = parseDeliveryItemsBody(body.deliveryItems);
      const fallbackDeliveryItem = gameItemId
        ? [{ gameItemId, quantity: Math.max(1, Number(quantity || 1)), iconUrl }]
        : [];
      const resolvedDeliveryItems = kind === 'item'
        ? (deliveryItems.length > 0 ? deliveryItems : fallbackDeliveryItem)
        : [];
      const primaryDeliveryItem = resolvedDeliveryItems[0] || null;

      if (!id || !name || price == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (kind === 'item' && resolvedDeliveryItems.length === 0) {
        sendJson(res, 400, { ok: false, error: 'Request failed' });
        return true;
      }

      const result = await addShopItemForAdmin({
        tenantId,
        id,
        name,
        price,
        description,
        kind,
        gameItemId: kind === 'item' ? primaryDeliveryItem?.gameItemId || gameItemId : null,
        quantity: kind === 'item'
          ? Math.max(1, Number(primaryDeliveryItem?.quantity || quantity || 1))
          : 1,
        iconUrl: kind === 'item' ? primaryDeliveryItem?.iconUrl || iconUrl : null,
        deliveryItems: resolvedDeliveryItems,
        deliveryProfile: kind === 'item' ? deliveryProfile : null,
        deliveryTeleportMode: kind === 'item' ? deliveryTeleportMode : null,
        deliveryTeleportTarget: kind === 'item' ? deliveryTeleportTarget : null,
        deliveryPreCommands: kind === 'item' ? deliveryPreCommands : [],
        deliveryPostCommands: kind === 'item' ? deliveryPostCommands : [],
        deliveryReturnTarget: kind === 'item' ? deliveryReturnTarget : null,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error || result.reason || 'Request failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.item });
      return true;
    }

    if (pathname === '/admin/api/shop/price') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const donationPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_donations',
        message: 'Your tenant role cannot change donation package pricing.',
      });
      if (!donationPermission.allowed) return true;
      if (tenantId) {
        const donationCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_donations',
          message: 'Donation package pricing is locked until the current package includes donation tools.',
        });
        if (!donationCheck.allowed) return true;
      }
      const idOrName = requiredString(body, 'idOrName');
      const price = asInt(body.price);
      if (!idOrName || price == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await setShopItemPriceForAdmin({ idOrName, price, tenantId });
      if (!result.ok && result.reason === 'not-found') {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Invalid request payload' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.item });
      return true;
    }

    if (pathname === '/admin/api/shop/update') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const donationPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_donations',
        message: 'Your tenant role cannot edit donation packages.',
      });
      if (!donationPermission.allowed) return true;
      if (tenantId) {
        const donationCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_donations',
          message: 'Donation package edits are locked until the current package includes donation tools.',
        });
        if (!donationCheck.allowed) return true;
      }
      const idOrName = requiredString(body, 'idOrName');
      const name = requiredString(body, 'name');
      const price = asInt(body.price);
      const description = String(body.description || '').trim();
      const kindRaw = requiredString(body, 'kind') || 'item';
      const kind = String(kindRaw).trim().toLowerCase() === 'vip' ? 'vip' : 'item';
      if (!idOrName || !name || price == null || !description) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await updateShopItemForAdmin({
        tenantId,
        idOrName,
        name,
        price,
        description,
        kind,
        gameItemId: requiredString(body, 'gameItemId'),
        quantity: asInt(body.quantity) ?? 1,
      });
      if (!result.ok && result.reason === 'not-found') {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error || result.reason || 'Invalid request payload' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.item });
      return true;
    }

    if (pathname === '/admin/api/shop/status') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const donationPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_donations',
        message: 'Your tenant role cannot enable or disable donation packages.',
      });
      if (!donationPermission.allowed) return true;
      if (tenantId) {
        const donationCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_donations',
          message: 'Donation package visibility is locked until the current package includes donation tools.',
        });
        if (!donationCheck.allowed) return true;
      }
      const idOrName = requiredString(body, 'idOrName');
      const status = requiredString(body, 'status');
      if (!idOrName || !status) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await setShopItemStatusForAdmin({
        tenantId,
        idOrName,
        status,
      });
      if (!result.ok && result.reason === 'not-found') {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error || result.reason || 'Invalid request payload' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.item });
      return true;
    }

    if (pathname === '/admin/api/shop/delete') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const donationPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_donations',
        message: 'Your tenant role cannot delete donation packages.',
      });
      if (!donationPermission.allowed) return true;
      if (tenantId) {
        const donationCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_donations',
          message: 'Donation package deletion is locked until the current package includes donation tools.',
        });
        if (!donationCheck.allowed) return true;
      }
      const idOrName = requiredString(body, 'idOrName');
      if (!idOrName) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await deleteShopItemForAdmin({ idOrName, tenantId });
      if (!result.ok && result.reason === 'not-found') {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Invalid request payload' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.item });
      return true;
    }

    if (pathname === '/admin/api/purchase/status') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const code = requiredString(body, 'code');
      const status = requiredString(body, 'status');
      if (!code || !status) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (authTenantId) {
        const scopedDetail = await getScopedDeliveryCase(code, tenantId || authTenantId);
        if (!hasScopedDeliveryCase(scopedDetail)) {
          sendJson(res, 404, { ok: false, error: 'Resource not found' });
          return true;
        }
      }
      const ordersPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_orders',
        message: 'Your tenant role cannot change order status.',
      });
      if (!ordersPermission.allowed) return true;
      if (tenantId) {
        const orderCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_orders',
          message: 'Order status changes are locked until the current package includes order tools.',
        });
        if (!orderCheck.allowed) return true;
      }
      const result = await updatePurchaseStatusForActor({
        code,
        status,
        force: body?.force === true,
        actor: `admin-web:${auth?.user || 'unknown'}`,
        reason: requiredString(body, 'reason') || 'admin-manual-status-update',
        tenantId,
        meta: { role: auth?.role || 'unknown' },
        recordIfSame: body?.recordIfSame === true,
        historyLimit: 20,
      });
      if (!result.ok && result.reason === 'not-found') {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      if (!result.ok) {
        sendJson(res, 400, {
          ok: false,
          error: 'Invalid purchase status transition',
          data: {
            code,
            currentStatus: result.currentStatus || '',
            targetStatus: result.targetStatus || '',
            reason: result.reason,
            allowedTransitions: Array.isArray(result.allowedTransitions)
              ? result.allowedTransitions
              : [],
            knownStatuses: Array.isArray(result.knownStatuses)
              ? result.knownStatuses
              : listKnownPurchaseStatuses(),
          },
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          purchase: result.purchase,
          history: result.history,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/enqueue') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const code = requiredString(body, 'code');
      if (!code) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (authTenantId) {
        const scopedDetail = await getScopedDeliveryCase(code, tenantId || authTenantId);
        if (!hasScopedDeliveryCase(scopedDetail)) {
          sendJson(res, 404, { ok: false, error: 'Resource not found' });
          return true;
        }
      }
      const ordersPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_orders',
        message: 'Your tenant role cannot enqueue delivery jobs.',
      });
      if (!ordersPermission.allowed) return true;
      if (tenantId) {
        const orderCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_orders',
          message: 'Delivery retries are locked until the current package includes order tools.',
        });
        if (!orderCheck.allowed) return true;
      }
      const result = await enqueuePurchaseDeliveryByCode(code, {
        guildId: requiredString(body, 'guildId') || undefined,
        tenantId: tenantId || undefined,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'ไม่สามารถเพิ่มคิวส่งของได้' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/delivery/retry') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const code = requiredString(body, 'code');
      if (!code) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (authTenantId) {
        const scopedDetail = await getScopedDeliveryCase(code, tenantId || authTenantId);
        if (!hasScopedDeliveryCase(scopedDetail)) {
          sendJson(res, 404, { ok: false, error: 'Resource not found' });
          return true;
        }
      }
      const ordersPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_orders',
        message: 'Your tenant role cannot retry failed deliveries.',
      });
      if (!ordersPermission.allowed) return true;
      if (tenantId) {
        const orderCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_orders',
          message: 'Delivery retries are locked until the current package includes order tools.',
        });
        if (!orderCheck.allowed) return true;
      }
      const result = retryDeliveryNow(code, { tenantId: tenantId || undefined });
      if (!result) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/delivery/retry-many') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const ordersPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_orders',
        message: 'Your tenant role cannot retry failed deliveries.',
      });
      if (!ordersPermission.allowed) return true;
      if (tenantId) {
        const orderCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_orders',
          message: 'Delivery retries are locked until the current package includes order tools.',
        });
        if (!orderCheck.allowed) return true;
      }
      const codes = parseStringArray(body?.codes);
      if (codes.length === 0) {
        sendJson(res, 400, { ok: false, error: 'codes is required' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: retryDeliveryNowMany(codes, { tenantId: tenantId || undefined }),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/dead-letter/retry') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const code = requiredString(body, 'code');
      if (!code) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (authTenantId) {
        const scopedDetail = await getScopedDeliveryCase(code, tenantId || authTenantId);
        if (!hasScopedDeliveryCase(scopedDetail)) {
          sendJson(res, 404, { ok: false, error: 'Resource not found' });
          return true;
        }
      }
      const ordersPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_orders',
        message: 'Your tenant role cannot retry dead-letter deliveries.',
      });
      if (!ordersPermission.allowed) return true;
      if (tenantId) {
        const orderCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_orders',
          message: 'Delivery retries are locked until the current package includes order tools.',
        });
        if (!orderCheck.allowed) return true;
      }
      const result = await retryDeliveryDeadLetter(code, {
        guildId: requiredString(body, 'guildId') || undefined,
        tenantId: tenantId || undefined,
      });
      if (!result?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result?.reason || 'ไม่สามารถ retry dead-letter ได้',
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/delivery/dead-letter/retry-many') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const ordersPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_orders',
        message: 'Your tenant role cannot retry dead-letter deliveries.',
      });
      if (!ordersPermission.allowed) return true;
      if (tenantId) {
        const orderCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_orders',
          message: 'Delivery retries are locked until the current package includes order tools.',
        });
        if (!orderCheck.allowed) return true;
      }
      const codes = parseStringArray(body?.codes);
      if (codes.length === 0) {
        sendJson(res, 400, { ok: false, error: 'codes is required' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: await retryDeliveryDeadLetterMany(codes, {
          guildId: requiredString(body, 'guildId') || undefined,
          tenantId: tenantId || undefined,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/dead-letter/delete') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const code = requiredString(body, 'code');
      if (!code) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (authTenantId) {
        const scopedDetail = await getScopedDeliveryCase(code, tenantId || authTenantId);
        if (!hasScopedDeliveryCase(scopedDetail)) {
          sendJson(res, 404, { ok: false, error: 'Resource not found' });
          return true;
        }
      }
      const ordersPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_orders',
        message: 'Your tenant role cannot clear dead-letter deliveries.',
      });
      if (!ordersPermission.allowed) return true;
      if (tenantId) {
        const orderCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_orders',
          message: 'Delivery cleanup is locked until the current package includes order tools.',
        });
        if (!orderCheck.allowed) return true;
      }
      const removed = removeDeliveryDeadLetter(code, { tenantId: tenantId || undefined });
      if (!removed) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: removed });
      return true;
    }

    if (pathname === '/admin/api/delivery/cancel') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const code = requiredString(body, 'code');
      if (!code) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (authTenantId) {
        const scopedDetail = await getScopedDeliveryCase(code, tenantId || authTenantId);
        if (!hasScopedDeliveryCase(scopedDetail)) {
          sendJson(res, 404, { ok: false, error: 'Resource not found' });
          return true;
        }
      }
      const ordersPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_orders',
        message: 'Your tenant role cannot cancel deliveries.',
      });
      if (!ordersPermission.allowed) return true;
      if (tenantId) {
        const orderCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_manage_orders',
          message: 'Delivery cancellation is locked until the current package includes order tools.',
        });
        if (!orderCheck.allowed) return true;
      }
      const result = cancelDeliveryJob(
        code,
        requiredString(body, 'reason') || 'admin-web',
        { tenantId: tenantId || undefined },
      );
      if (!result) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/delivery/preview') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const itemId = requiredString(body, 'itemId');
      const gameItemId = requiredString(body, 'gameItemId');
      if (!itemId && !gameItemId) {
        sendJson(res, 400, { ok: false, error: 'itemId or gameItemId is required' });
        return true;
      }
      try {
        sendJson(res, 200, {
          ok: true,
          data: await previewDeliveryCommands({
            itemId: itemId || undefined,
            gameItemId: gameItemId || undefined,
            itemName: requiredString(body, 'itemName') || undefined,
            quantity: asInt(body.quantity, undefined) || undefined,
            steamId: requiredString(body, 'steamId') || undefined,
            userId: requiredString(body, 'userId') || undefined,
            purchaseCode: requiredString(body, 'purchaseCode') || undefined,
            tenantId: tenantId || undefined,
            serverId: requiredString(body, 'serverId') || undefined,
            guildId: requiredString(body, 'guildId') || undefined,
          }),
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'ไม่สามารถพรีวิวคำสั่งส่งของได้'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/delivery/preflight') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      try {
        sendJson(res, 200, {
          ok: true,
          data: await getDeliveryPreflightReport({
            itemId: requiredString(body, 'itemId') || undefined,
            gameItemId: requiredString(body, 'gameItemId') || undefined,
            itemName: requiredString(body, 'itemName') || undefined,
            quantity: asInt(body.quantity, undefined) || undefined,
            steamId: requiredString(body, 'steamId') || undefined,
            userId: requiredString(body, 'userId') || undefined,
            purchaseCode: requiredString(body, 'purchaseCode') || undefined,
            inGameName: requiredString(body, 'inGameName') || undefined,
            teleportMode: requiredString(body, 'teleportMode') || undefined,
            teleportTarget: requiredString(body, 'teleportTarget') || undefined,
            returnTarget: requiredString(body, 'returnTarget') || undefined,
            tenantId: tenantId || undefined,
            serverId: requiredString(body, 'serverId') || undefined,
            guildId: requiredString(body, 'guildId') || undefined,
          }),
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'ไม่สามารถตรวจ preflight ส่งของได้'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/delivery/simulate') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const itemId = requiredString(body, 'itemId');
      const gameItemId = requiredString(body, 'gameItemId');
      if (!itemId && !gameItemId) {
        sendJson(res, 400, { ok: false, error: 'itemId or gameItemId is required' });
        return true;
      }
      try {
        sendJson(res, 200, {
          ok: true,
          data: await simulateDeliveryPlan({
            itemId: itemId || undefined,
            gameItemId: gameItemId || undefined,
            itemName: requiredString(body, 'itemName') || undefined,
            quantity: asInt(body.quantity, undefined) || undefined,
            steamId: requiredString(body, 'steamId') || undefined,
            userId: requiredString(body, 'userId') || undefined,
            purchaseCode: requiredString(body, 'purchaseCode') || undefined,
            inGameName: requiredString(body, 'inGameName') || undefined,
            teleportMode: requiredString(body, 'teleportMode') || undefined,
            teleportTarget: requiredString(body, 'teleportTarget') || undefined,
            returnTarget: requiredString(body, 'returnTarget') || undefined,
            tenantId: tenantId || undefined,
            serverId: requiredString(body, 'serverId') || undefined,
            guildId: requiredString(body, 'guildId') || undefined,
          }),
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'ไม่สามารถ simulate delivery plan ได้'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/delivery/command-template') {
      try {
        sendJson(res, 200, {
          ok: true,
          data: setDeliveryCommandOverride({
            lookupKey: requiredString(body, 'lookupKey') || undefined,
            itemId: requiredString(body, 'itemId') || undefined,
            gameItemId: requiredString(body, 'gameItemId') || undefined,
            command: body?.command,
            commands: body?.commands,
            clear: body?.clear === true,
            actor: auth?.user || 'unknown',
          }),
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'ไม่สามารถบันทึก command template ได้'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/delivery/test-send') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const itemId = requiredString(body, 'itemId');
      const gameItemId = requiredString(body, 'gameItemId');
      if (!itemId && !gameItemId) {
        sendJson(res, 400, { ok: false, error: 'itemId or gameItemId is required' });
        return true;
      }
      try {
        sendJson(res, 200, {
          ok: true,
          data: await sendTestDeliveryCommand({
            itemId: itemId || undefined,
            gameItemId: gameItemId || undefined,
            itemName: requiredString(body, 'itemName') || undefined,
            quantity: asInt(body.quantity, undefined) || undefined,
            steamId: requiredString(body, 'steamId') || undefined,
            userId: requiredString(body, 'userId') || undefined,
            purchaseCode: requiredString(body, 'purchaseCode') || undefined,
            tenantId: tenantId || undefined,
            serverId: requiredString(body, 'serverId') || undefined,
            guildId: requiredString(body, 'guildId') || undefined,
          }),
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'ไม่สามารถส่ง test item ได้'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/delivery/capability-preset') {
      try {
        sendJson(res, 200, {
          ok: true,
          data: saveAdminCommandCapabilityPreset({
            id: requiredString(body, 'id') || undefined,
            name: requiredString(body, 'name') || undefined,
            description: requiredString(body, 'description') || undefined,
            commands: body?.commands,
            defaults: {
              announceText: requiredString(body, 'announceText') || undefined,
              steamId: requiredString(body, 'steamId') || undefined,
              gameItemId: requiredString(body, 'gameItemId') || undefined,
              quantity: asInt(body.quantity, undefined) || undefined,
              teleportTarget: requiredString(body, 'teleportTarget') || undefined,
              returnTarget: requiredString(body, 'returnTarget') || undefined,
              inGameName: requiredString(body, 'inGameName') || undefined,
              itemName: requiredString(body, 'itemName') || undefined,
            },
            tags: parseStringArray(body?.tags),
          }, `admin-web:${auth?.user || 'unknown'}`),
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'ไม่สามารถบันทึก capability preset ได้'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/delivery/capability-preset/delete') {
      const presetId = requiredString(body, 'presetId') || requiredString(body, 'id');
      if (!presetId) {
        sendJson(res, 400, { ok: false, error: 'presetId is required' });
        return true;
      }
      const removed = deleteAdminCommandCapabilityPreset(presetId);
      if (!removed) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          id: removed.id,
          name: removed.name,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/capability-test') {
      const presetId = requiredString(body, 'presetId');
      const preset = presetId ? getAdminCommandCapabilityPresetById(presetId) : null;
      if (presetId && !preset) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      try {
        sendJson(res, 200, {
          ok: true,
          data: await testScumAdminCommandCapability({
            capabilityId: requiredString(body, 'capabilityId') || undefined,
            presetId: preset?.id || null,
            name: preset?.name || undefined,
            description: preset?.description || undefined,
            commands: body?.commands || preset?.commandTemplates || undefined,
            dryRun: body?.dryRun === true,
            announceText: requiredString(body, 'announceText') || preset?.defaults?.announceText || undefined,
            steamId: requiredString(body, 'steamId') || preset?.defaults?.steamId || undefined,
            gameItemId: requiredString(body, 'gameItemId') || preset?.defaults?.gameItemId || undefined,
            quantity: asInt(body.quantity, undefined) || preset?.defaults?.quantity || undefined,
            teleportTarget: requiredString(body, 'teleportTarget') || preset?.defaults?.teleportTarget || undefined,
            returnTarget: requiredString(body, 'returnTarget') || preset?.defaults?.returnTarget || undefined,
            inGameName: requiredString(body, 'inGameName') || preset?.defaults?.inGameName || undefined,
            itemId: requiredString(body, 'itemId') || undefined,
            itemName: requiredString(body, 'itemName') || preset?.defaults?.itemName || undefined,
            purchaseCode: requiredString(body, 'purchaseCode') || undefined,
            userId: requiredString(body, 'userId') || undefined,
          }),
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'ไม่สามารถทดสอบ SCUM admin capability ได้'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/rentbike/reset-now') {
      const reason = requiredString(body, 'reason') || `admin-web:${auth?.user || 'unknown'}`;
      await runRentBikeMidnightReset(reason);
      sendJson(res, 200, {
        ok: true,
        data: {
          resetTriggered: true,
          reason,
          runtime: getRentBikeRuntime(),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/scum/status') {
      const onlinePlayers = asInt(body.onlinePlayers, undefined);
      const maxPlayers = asInt(body.maxPlayers, undefined);
      const pingMs = asInt(body.pingMs, undefined);
      const uptimeMinutes = asInt(body.uptimeMinutes, undefined);
      const result = updateScumStatusForAdmin({
        onlinePlayers,
        maxPlayers,
        pingMs,
        uptimeMinutes,
        tenantId: authTenantId,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: getStatus({ tenantId: authTenantId }) });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminCommerceDeliveryPostRoutes,
};
