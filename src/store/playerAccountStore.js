const {
  prisma,
  getTenantScopedPrismaClient,
  resolveDefaultTenantId,
  resolveTenantScopedDatasourceUrl,
} = require('../prisma');
const { assertTenantDbIsolationScope } = require('../utils/tenantDbIsolation');

function normalizeDiscordId(value) {
  const id = String(value || '').trim();
  if (!/^\d{14,25}$/.test(id)) return null;
  return id;
}

function normalizeSteamId(value) {
  const id = String(value || '').trim();
  if (!id) return null;
  if (!/^\d{15,25}$/.test(id)) return null;
  return id;
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function resolveStoreScope(options = {}) {
  const tenantId = resolveDefaultTenantId(options);
  assertTenantDbIsolationScope({
    tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'player account store scope',
    env: options.env || process.env,
  });
  if (!tenantId) {
    return {
      tenantId: null,
      datasourceKey: '__default__',
      db: prisma,
    };
  }
  return {
    tenantId,
    datasourceKey: resolveTenantScopedDatasourceUrl(tenantId, options) || tenantId,
    db: getTenantScopedPrismaClient(tenantId, options),
  };
}

async function upsertPlayerAccount(input = {}, options = {}) {
  const discordId = normalizeDiscordId(input.discordId || input.userId);
  if (!discordId) {
    return { ok: false, reason: 'invalid-discord-id' };
  }

  const steamId = normalizeSteamId(input.steamId);
  const { db } = resolveStoreScope(options);
  try {
    const row = await db.playerAccount.upsert({
      where: { discordId },
      update: {
        username: normalizeText(input.username),
        displayName: normalizeText(input.displayName),
        avatarUrl: normalizeText(input.avatarUrl),
        steamId,
        isActive: input.isActive === false ? false : true,
      },
      create: {
        discordId,
        username: normalizeText(input.username),
        displayName: normalizeText(input.displayName),
        avatarUrl: normalizeText(input.avatarUrl),
        steamId,
        isActive: input.isActive === false ? false : true,
      },
    });
    return { ok: true, data: row };
  } catch (error) {
    if (error?.code === 'P2002') {
      return { ok: false, reason: 'steam-id-already-bound' };
    }
    throw error;
  }
}

async function bindPlayerSteamId(discordId, steamId, options = {}) {
  const did = normalizeDiscordId(discordId);
  const sid = normalizeSteamId(steamId);
  if (!did || !sid) {
    return { ok: false, reason: 'invalid-input' };
  }
  return upsertPlayerAccount({
    discordId: did,
    steamId: sid,
    isActive: true,
  }, options);
}

async function unbindPlayerSteamId(discordId, options = {}) {
  const did = normalizeDiscordId(discordId);
  if (!did) return { ok: false, reason: 'invalid-discord-id' };
  const { db } = resolveStoreScope(options);

  const row = await db.playerAccount.upsert({
    where: { discordId: did },
    update: {
      steamId: null,
    },
    create: {
      discordId: did,
      steamId: null,
      isActive: true,
    },
  });
  return { ok: true, data: row };
}

async function getPlayerAccount(discordId, options = {}) {
  const did = normalizeDiscordId(discordId);
  if (!did) return null;
  const { db } = resolveStoreScope(options);
  return db.playerAccount.findUnique({
    where: { discordId: did },
  });
}

async function listPlayerAccounts(limit = 100, options = {}) {
  const take = Math.max(1, Math.min(1000, Math.trunc(Number(limit || 100))));
  const { db } = resolveStoreScope(options);
  return db.playerAccount.findMany({
    orderBy: { updatedAt: 'desc' },
    take,
  });
}

async function getPlayerDashboard(discordId, options = {}) {
  const did = normalizeDiscordId(discordId);
  if (!did) {
    return { ok: false, reason: 'invalid-discord-id' };
  }
  const { db } = resolveStoreScope(options);

  const [account, wallet, stats, vip, links, recentPurchases] = await Promise.all([
    db.playerAccount.findUnique({ where: { discordId: did } }),
    db.userWallet.findUnique({ where: { userId: did } }),
    db.stats.findUnique({ where: { userId: did } }),
    db.vipMembership.findUnique({ where: { userId: did } }),
    db.link.findMany({ where: { userId: did }, take: 1 }),
    db.purchase.findMany({
      where: { userId: did },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const counters = {
    purchasesTotal: recentPurchases.length,
    purchasesDelivered: recentPurchases.filter((row) => row.status === 'delivered')
      .length,
    purchasesPending: recentPurchases.filter(
      (row) => row.status === 'pending' || row.status === 'delivering',
    ).length,
    purchasesFailed: recentPurchases.filter((row) => row.status === 'delivery_failed')
      .length,
  };

  return {
    ok: true,
    data: {
      discordId: did,
      account,
      steamLink: links[0] || null,
      wallet,
      stats,
      vip,
      counters,
      recentPurchases,
    },
  };
}

module.exports = {
  normalizeDiscordId,
  normalizeSteamId,
  resolveStoreScope,
  upsertPlayerAccount,
  bindPlayerSteamId,
  unbindPlayerSteamId,
  getPlayerAccount,
  listPlayerAccounts,
  getPlayerDashboard,
};
