const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/ticketService.js');
const storePath = path.resolve(__dirname, '../src/store/ticketStore.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function loadService(mocks) {
  clearModule(servicePath);
  installMock(storePath, mocks.ticketStore);
  installMock(prismaPath, mocks.prisma);
  return require(servicePath);
}

function createStrictEnv() {
  return {
    DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
  };
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(storePath);
  clearModule(prismaPath);
});

test('ticket service requires tenant scope in strict isolation mode', () => {
  const service = loadService({
    ticketStore: {
      createTicket() {
        throw new Error('should-not-create-ticket');
      },
      getTicketByChannel() {
        return null;
      },
      claimTicket() {
        return null;
      },
      closeTicket() {
        return null;
      },
      listTickets() {
        return [];
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  assert.throws(
    () => service.createSupportTicket({
      guildId: 'guild-1',
      userId: 'user-1',
      channelId: 'chan-1',
      category: 'support',
      reason: 'Need help',
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('ticket service uses resolved default tenant scope when strict isolation is enabled', () => {
  let receivedScope = null;
  const service = loadService({
    ticketStore: {
      createTicket(payload, options) {
        receivedScope = options;
        return { id: 1, ...payload };
      },
      getTicketByChannel() {
        return null;
      },
      claimTicket() {
        return null;
      },
      closeTicket() {
        return null;
      },
      listTickets() {
        return [];
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-ticket-default';
      },
    },
  });

  const result = service.createSupportTicket({
    guildId: 'guild-1',
    userId: 'user-1',
    channelId: 'chan-1',
    category: 'support',
    reason: 'Need help',
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(receivedScope.tenantId, 'tenant-ticket-default');
  assert.equal(receivedScope.defaultTenantId, 'tenant-ticket-default');
});

test('player support ticket service creates a portal ticket and lists it for the same player', () => {
  const created = [];
  const service = loadService({
    ticketStore: {
      createTicket(payload) {
        const ticket = {
          ...payload,
          status: 'open',
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z',
        };
        created.push(ticket);
        return ticket;
      },
      getTicketByChannel(channelId) {
        return created.find((ticket) => ticket.channelId === channelId) || null;
      },
      claimTicket() {
        return null;
      },
      closeTicket(channelId) {
        const ticket = created.find((row) => row.channelId === channelId);
        if (!ticket) return null;
        ticket.status = 'closed';
        ticket.updatedAt = '2026-04-04T10:05:00.000Z';
        return ticket;
      },
      listTickets() {
        return created.slice();
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-ticket-default';
      },
    },
  });

  const createdResult = service.createPlayerSupportTicket({
    userId: 'platform-user-1',
    tenantId: 'tenant-ticket-default',
    category: 'identity',
    reason: 'Need help linking Steam',
    env: createStrictEnv(),
  });

  assert.equal(createdResult.ok, true);
  assert.match(createdResult.ticket.channelId, /^portal-ticket-/);
  assert.equal(createdResult.ticket.guildId, 'portal:tenant-ticket-default');

  const listed = service.listSupportTicketsForUser({
    userId: 'platform-user-1',
    tenantId: 'tenant-ticket-default',
    env: createStrictEnv(),
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].category, 'identity');
});

test('player support ticket service rejects duplicate open portal tickets for the same player', () => {
  const existingTicket = {
    guildId: 'portal:tenant-ticket-default',
    userId: 'platform-user-1',
    channelId: 'portal-ticket-existing',
    category: 'support',
    reason: 'Existing issue',
    status: 'open',
    createdAt: '2026-04-04T10:00:00.000Z',
  };
  const service = loadService({
    ticketStore: {
      createTicket() {
        throw new Error('should-not-create-duplicate-ticket');
      },
      getTicketByChannel() {
        return existingTicket;
      },
      claimTicket() {
        return null;
      },
      closeTicket() {
        return null;
      },
      listTickets() {
        return [existingTicket];
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-ticket-default';
      },
    },
  });

  const result = service.createPlayerSupportTicket({
    userId: 'platform-user-1',
    tenantId: 'tenant-ticket-default',
    category: 'support',
    reason: 'Need help again',
    env: createStrictEnv(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ticket-already-open');
  assert.equal(result.ticket.channelId, 'portal-ticket-existing');
});

test('player support ticket service closes only the owner ticket', () => {
  const tickets = [
    {
      guildId: 'portal:tenant-ticket-default',
      userId: 'platform-user-1',
      channelId: 'portal-ticket-1',
      category: 'support',
      reason: 'Need help',
      status: 'open',
      createdAt: '2026-04-04T10:00:00.000Z',
    },
  ];
  const service = loadService({
    ticketStore: {
      createTicket() {
        return null;
      },
      getTicketByChannel(channelId) {
        return tickets.find((ticket) => ticket.channelId === channelId) || null;
      },
      claimTicket() {
        return null;
      },
      closeTicket(channelId) {
        const ticket = tickets.find((row) => row.channelId === channelId);
        if (!ticket) return null;
        ticket.status = 'closed';
        return ticket;
      },
      listTickets() {
        return tickets.slice();
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-ticket-default';
      },
    },
  });

  const forbidden = service.closeSupportTicketForUser({
    channelId: 'portal-ticket-1',
    userId: 'platform-user-other',
    tenantId: 'tenant-ticket-default',
    env: createStrictEnv(),
  });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.reason, 'forbidden');

  const closed = service.closeSupportTicketForUser({
    channelId: 'portal-ticket-1',
    userId: 'platform-user-1',
    tenantId: 'tenant-ticket-default',
    env: createStrictEnv(),
  });
  assert.equal(closed.ok, true);
  assert.equal(closed.ticket.status, 'closed');
});
