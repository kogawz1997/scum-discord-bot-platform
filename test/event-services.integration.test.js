const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/prisma');
const {
  createServerEvent,
  listServerEvents,
  joinServerEvent,
  startServerEvent,
  finishServerEvent,
} = require('../src/services/eventService');
const { replaceEvents, flushEventStoreWrites } = require('../src/store/eventStore');

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

const TEST_TENANT_ID = 'tenant-event-service-integration';

function scope() {
  return { tenantId: TEST_TENANT_ID };
}

async function resetEvents() {
  replaceEvents([], [], 1, scope());
  await flushEventStoreWrites(scope());
  await prisma.guildEventParticipant.deleteMany({});
  await prisma.guildEvent.deleteMany({});
}

test('eventService create/join/start/end flow works', { concurrency: false }, async () => {
  await resetEvents();

  const joinUserId = uniqueId('event-user');
  const created = await createServerEvent({
    name: 'คืนนี้ยิงซอมบี้',
    time: '21:00',
    reward: '200 เหรียญ',
    ...scope(),
  });

  assert.equal(created.ok, true);
  assert.equal(created.event.status, 'scheduled');
  assert.equal(
    listServerEvents(scope()).some((event) => event.id === created.event.id),
    true,
  );

  const joined = await joinServerEvent({
    id: created.event.id,
    userId: joinUserId,
    ...scope(),
  });
  assert.equal(joined.ok, true);
  assert.equal(joined.participantsCount, 1);

  const started = await startServerEvent({ id: created.event.id, ...scope() });
  assert.equal(started.ok, true);
  assert.equal(started.event.status, 'started');

  const finished = await finishServerEvent({
    id: created.event.id,
    actor: 'test-suite',
    ...scope(),
  });
  assert.equal(finished.ok, true);
  assert.equal(finished.event.status, 'ended');
  assert.equal(finished.rewardGranted, false);
  assert.equal(finished.participants.length, 1);

  await resetEvents();
});

test('eventService can credit winner when finishing event', { concurrency: false }, async () => {
  await resetEvents();

  const winnerUserId = uniqueId('event-winner');
  const created = await createServerEvent({
    name: 'แข่งล่าค่าหัว',
    time: '22:00',
    reward: '500 เหรียญ',
    ...scope(),
  });
  assert.equal(created.ok, true);

  const finished = await finishServerEvent({
    id: created.event.id,
    winnerUserId,
    coins: 500,
    actor: 'test-suite',
    ...scope(),
  });

  assert.equal(finished.ok, true);
  assert.equal(finished.rewardGranted, true);
  assert.equal(finished.coins, 500);

  const wallet = await prisma.userWallet.findUnique({ where: { userId: winnerUserId } });
  assert.equal(Number(wallet?.balance || 0), 500);

  await prisma.walletLedger.deleteMany({ where: { userId: winnerUserId } });
  await prisma.userWallet.deleteMany({ where: { userId: winnerUserId } });
  await resetEvents();
});
