'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachFallbackAgents,
  buildRuntimeInventory,
  buildLocalFallbackAgents,
  formatRuntimeInventoryReport,
  normalizeRole,
  parseArgs,
} = require('../scripts/runtime-inventory-report');

test('normalizeRole collapses runtime aliases', () => {
  assert.equal(normalizeRole('watcher'), 'server-bot');
  assert.equal(normalizeRole('console-agent'), 'delivery-agent');
  assert.equal(normalizeRole('HYBRID'), 'hybrid');
});

test('buildRuntimeInventory summarizes runtime status and filters', () => {
  const snapshot = {
    servers: [
      {
        id: 'server-main',
        name: 'Main Server',
      },
    ],
    agents: [
      {
        tenantId: 'tenant-a',
        serverId: 'server-main',
        agentId: 'bot-1',
        runtimeKey: 'server-bot-main',
        displayName: 'Main Server Bot',
        role: 'watcher',
        scope: 'sync',
        status: 'active',
      },
      {
        tenantId: 'tenant-a',
        serverId: 'server-main',
        agentId: 'agent-1',
        runtimeKey: 'delivery-main',
        displayName: 'Main Delivery Agent',
        role: 'console-agent',
        scope: 'execute',
        status: 'pending',
      },
    ],
    agentDevices: [
      {
        agentId: 'bot-1',
        hostname: 'SERVER-NODE',
        status: 'online',
        lastSeenAt: '2026-03-28T10:00:00.000Z',
      },
    ],
    agentCredentials: [
      {
        agentId: 'bot-1',
        status: 'active',
        keyPrefix: 'pk_bot',
        updatedAt: '2026-03-28T10:00:00.000Z',
      },
    ],
    agentProvisioningTokens: [
      {
        agentId: 'agent-1',
        status: 'pending_activation',
        tokenPrefix: 'stp_agent',
        createdAt: '2026-03-28T09:30:00.000Z',
      },
    ],
    agentTokenBindings: [
      {
        agentId: 'bot-1',
        status: 'active',
      },
    ],
    agentSessions: [
      {
        agentId: 'bot-1',
        status: 'online',
        lastSeenAt: '2026-03-28T10:05:00.000Z',
      },
    ],
  };

  const report = buildRuntimeInventory(snapshot, {
    tenantId: 'tenant-a',
  });

  assert.equal(report.summary.totalRuntimes, 2);
  assert.equal(report.summary.online, 1);
  assert.equal(report.summary.awaitingInstall, 1);
  assert.equal(report.runtimes[0].role, 'delivery-agent');
  assert.equal(report.runtimes[0].status, 'awaiting-install');
  assert.equal(report.runtimes[1].role, 'server-bot');
  assert.equal(report.runtimes[1].status, 'online');
  assert.match(formatRuntimeInventoryReport(report), /Runtime Inventory/);
});

test('parseArgs accepts filters and json mode', () => {
  const parsed = parseArgs([
    '--tenant-id=tenant-a',
    '--server-id',
    'server-main',
    '--role',
    'watcher',
    '--json',
  ]);

  assert.equal(parsed.tenantId, 'tenant-a');
  assert.equal(parsed.serverId, 'server-main');
  assert.equal(parsed.role, 'watcher');
  assert.equal(parsed.asJson, true);
});

test('buildLocalFallbackAgents creates runtime rows from local health payloads', () => {
  const agents = buildLocalFallbackAgents({
    serverBot: {
      ok: true,
      ready: true,
      scope: 'sync_only',
      now: '2026-04-01T23:00:00.000Z',
      lastSnapshotAt: '2026-04-01T22:58:00.000Z',
    },
    deliveryAgent: {
      ok: true,
      ready: true,
      now: '2026-04-01T23:00:00.000Z',
      lastSuccessAt: '2026-04-01T22:57:00.000Z',
    },
  }, {
    PLATFORM_TENANT_ID: 'tenant-demo',
    PLATFORM_SERVER_ID: 'server-demo',
    SCUM_SERVER_BOT_AGENT_ID: 'server-bot-main',
    SCUM_SERVER_BOT_RUNTIME_KEY: 'server-bot-main',
    SCUM_SERVER_BOT_NAME: 'Main Server Bot',
    SCUM_AGENT_ID: 'delivery-agent-main',
    SCUM_AGENT_RUNTIME_KEY: 'delivery-agent-main',
    SCUM_CONSOLE_AGENT_NAME: 'Delivery Agent',
  }, 'LOCALHOST');

  assert.equal(agents.length, 2);
  assert.equal(agents[0].role, 'server-bot');
  assert.equal(agents[0].status, 'online');
  assert.equal(agents[1].role, 'delivery-agent');
  assert.equal(agents[1].hostname, 'LOCALHOST');
});

test('attachFallbackAgents preserves registry agents and fills empty snapshots from local fallback', () => {
  const fallbackAgents = [
    {
      agentId: 'server-bot-local',
      role: 'server-bot',
      status: 'online',
    },
  ];

  const filled = attachFallbackAgents({
    agents: [],
    servers: [],
  }, fallbackAgents);

  assert.equal(filled.agents.length, 1);
  assert.equal(filled.agents[0].agentId, 'server-bot-local');

  const preserved = attachFallbackAgents({
    agents: [
      {
        agentId: 'registry-agent',
        role: 'delivery-agent',
      },
    ],
    servers: [],
  }, fallbackAgents);

  assert.equal(preserved.agents.length, 1);
  assert.equal(preserved.agents[0].agentId, 'registry-agent');
});
