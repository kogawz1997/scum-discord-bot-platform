const { prisma } = require('../prisma');

const { getDefaultTenantScopedPrismaClient } = require('../prisma');

function getRentBikeDb() {
  if (!prisma) {
    return getDefaultTenantScopedPrismaClient();
  }
  return getDefaultTenantScopedPrismaClient();
}

async function ensureTables() {
  // Tables are managed by Prisma migrations.
  return true;
}

function normalizeDailyRent(row) {
  if (!row) return null;
  return {
    userKey: String(row.userKey || ''),
    date: String(row.date || ''),
    used: Boolean(row.used),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
}

function normalizeRental(row) {
  if (!row) return null;
  return {
    orderId: String(row.orderId || ''),
    userKey: String(row.userKey || ''),
    guildId: row.guildId ? String(row.guildId) : null,
    vehicleInstanceId: row.vehicleInstanceId ? String(row.vehicleInstanceId) : null,
    status: String(row.status || 'pending'),
    createdAt: row.createdAt ? new Date(row.createdAt) : null,
    destroyedAt: row.destroyedAt ? new Date(row.destroyedAt) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    attemptCount: Number(row.attemptCount || 0),
    lastError: row.lastError ? String(row.lastError) : null,
  };
}

async function getDailyRent(userKey, date) {
  await ensureTables();
  const row = await getRentBikeDb().dailyRent.findUnique({
    where: {
      userKey_date: {
        userKey: String(userKey || ''),
        date: String(date || ''),
      },
    },
  });
  return normalizeDailyRent(row);
}

async function markDailyRentUsed(userKey, date) {
  await ensureTables();
  await getRentBikeDb().dailyRent.upsert({
    where: {
      userKey_date: {
        userKey: String(userKey || ''),
        date: String(date || ''),
      },
    },
    update: {
      used: true,
      updatedAt: new Date(),
    },
    create: {
      userKey: String(userKey || ''),
      date: String(date || ''),
      used: true,
    },
  });
  return getDailyRent(userKey, date);
}

async function createRentalOrder({ orderId, userKey, guildId = null }) {
  await ensureTables();
  await getRentBikeDb().rentalVehicle.create({
    data: {
      orderId: String(orderId || ''),
      userKey: String(userKey || ''),
      guildId: guildId == null ? null : String(guildId),
      vehicleInstanceId: null,
      status: 'pending',
      attemptCount: 0,
      lastError: null,
      destroyedAt: null,
    },
  });
  return getRentalOrder(orderId);
}

async function getRentalOrder(orderId) {
  await ensureTables();
  const row = await getRentBikeDb().rentalVehicle.findUnique({
    where: { orderId: String(orderId || '') },
  });
  return normalizeRental(row);
}

async function setRentalOrderStatus(orderId, status, extra = {}) {
  await ensureTables();
  const current = await getRentalOrder(orderId);
  if (!current) return null;

  await getRentBikeDb().rentalVehicle.update({
    where: { orderId: String(orderId || '') },
    data: {
      status: String(status || current.status || 'pending'),
      vehicleInstanceId:
        extra.vehicleInstanceId == null
          ? current.vehicleInstanceId
          : String(extra.vehicleInstanceId),
      destroyedAt:
        extra.destroyedAt == null
          ? current.destroyedAt
          : new Date(extra.destroyedAt),
      attemptCount:
        extra.attemptCount == null
          ? Number(current.attemptCount || 0)
          : Number(extra.attemptCount || 0),
      lastError:
        extra.lastError === undefined
          ? current.lastError
          : extra.lastError == null
            ? null
            : String(extra.lastError),
      updatedAt: new Date(),
    },
  });

  return getRentalOrder(orderId);
}

async function updateRentalAttempt(orderId, attemptCount, lastError = null) {
  await ensureTables();
  await getRentBikeDb().rentalVehicle.updateMany({
    where: { orderId: String(orderId || '') },
    data: {
      attemptCount: Number(attemptCount || 0),
      lastError: lastError == null ? null : String(lastError),
      updatedAt: new Date(),
    },
  });
  return getRentalOrder(orderId);
}

async function listRentalVehiclesByStatuses(statuses, limit = 5000) {
  await ensureTables();
  const values = Array.isArray(statuses)
    ? statuses
        .map((s) => String(s || '').trim())
        .filter((s) => s.length > 0)
    : [];
  if (values.length === 0) return [];

  const rows = await getRentBikeDb().rentalVehicle.findMany({
    where: {
      status: { in: values },
    },
    orderBy: { createdAt: 'asc' },
    take: Math.max(1, Number(limit || 5000)),
  });
  return rows.map(normalizeRental);
}

async function listRentalVehicles(limit = 500) {
  await ensureTables();
  const rows = await getRentBikeDb().rentalVehicle.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Number(limit || 500)),
  });
  return rows.map(normalizeRental);
}

async function listDailyRents(limit = 1000) {
  await ensureTables();
  const rows = await getRentBikeDb().dailyRent.findMany({
    orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
    take: Math.max(1, Number(limit || 1000)),
  });
  return rows.map(normalizeDailyRent);
}

async function getLatestRentalByUser(userKey) {
  await ensureTables();
  const row = await getRentBikeDb().rentalVehicle.findFirst({
    where: { userKey: String(userKey || '') },
    orderBy: { createdAt: 'desc' },
  });
  return normalizeRental(row);
}

async function replaceRentBikeData(nextDailyRents = [], nextRentalVehicles = []) {
  await ensureTables();

  await getRentBikeDb().$transaction(async (tx) => {
    await tx.dailyRent.deleteMany();
    await tx.rentalVehicle.deleteMany();

    for (const row of Array.isArray(nextDailyRents) ? nextDailyRents : []) {
      if (!row || typeof row !== 'object') continue;
      const userKey = String(row.userKey || row.user_key || '').trim();
      const date = String(row.date || '').trim();
      if (!userKey || !date) continue;
      await tx.dailyRent.create({
        data: {
          userKey,
          date,
          used: row.used === true || Number(row.used || 0) === 1,
        },
      });
    }

    for (const row of Array.isArray(nextRentalVehicles) ? nextRentalVehicles : []) {
      if (!row || typeof row !== 'object') continue;
      const orderId = String(row.orderId || row.order_id || '').trim();
      const userKey = String(row.userKey || row.user_key || '').trim();
      if (!orderId || !userKey) continue;

      await tx.rentalVehicle.create({
        data: {
          orderId,
          userKey,
          guildId:
            row.guildId == null && row.guild_id == null
              ? null
              : String(row.guildId || row.guild_id),
          vehicleInstanceId:
            row.vehicleInstanceId == null && row.vehicle_instance_id == null
              ? null
              : String(row.vehicleInstanceId || row.vehicle_instance_id),
          status: String(row.status || 'pending'),
          createdAt:
            row.createdAt || row.created_at
              ? new Date(row.createdAt || row.created_at)
              : new Date(),
          destroyedAt:
            row.destroyedAt || row.destroyed_at
              ? new Date(row.destroyedAt || row.destroyed_at)
              : null,
          attemptCount: Number(row.attemptCount || row.attempt_count || 0),
          lastError: row.lastError == null ? null : String(row.lastError || row.last_error),
        },
      });
    }
  });

  return {
    dailyRents: Array.isArray(nextDailyRents) ? nextDailyRents.length : 0,
    rentalVehicles: Array.isArray(nextRentalVehicles) ? nextRentalVehicles.length : 0,
  };
}

module.exports = {
  ensureRentBikeTables: ensureTables,
  getDailyRent,
  markDailyRentUsed,
  createRentalOrder,
  getRentalOrder,
  setRentalOrderStatus,
  updateRentalAttempt,
  listRentalVehiclesByStatuses,
  listRentalVehicles,
  listDailyRents,
  getLatestRentalByUser,
  replaceRentBikeData,
};
