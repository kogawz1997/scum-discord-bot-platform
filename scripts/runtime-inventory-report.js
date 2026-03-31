'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_OUTPUT_PATH = path.join(
  process.cwd(),
  'artifacts',
  'runtime-inventory',
  'latest.json',
);

function trimText(value) {
  return String(value || '').trim();
}

function normalizeRole(value) {
  const text = trimText(value).toLowerCase();
  if (!text) return '';
  if (text === 'server-bot' || text === 'watcher' || text === 'sync-node') {
    return 'server-bot';
  }
  if (text === 'delivery-agent' || text === 'console-agent' || text === 'execute-node') {
    return 'delivery-agent';
  }
  return text;
}

function toIso(value) {
  const text = trimText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toISOString();
}

function compareIsoDesc(left, right) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return rightTime - leftTime;
}

function pickLatestByTimestamp(items, selector) {
  const rows = Array.isArray(items) ? items.slice() : [];
  rows.sort((left, right) => compareIsoDesc(selector(left), selector(right)));
  return rows[0] || null;
}

function isStatusActive(value) {
  const status = trimText(value).toLowerCase();
  return status === '' || status === 'active' || status === 'online' || status === 'pending_activation';
}

function classifyInventoryStatus(agent, devices, sessions, provisioningTokens) {
  const normalizedAgentStatus = trimText(agent?.status).toLowerCase();
  const latestSession = pickLatestByTimestamp(
    sessions.filter((row) => trimText(row?.status).toLowerCase() !== 'revoked'),
    (row) => row?.lastSeenAt || row?.updatedAt || row?.createdAt,
  );
  const activeDevice = pickLatestByTimestamp(
    devices.filter((row) => trimText(row?.status).toLowerCase() !== 'revoked'),
    (row) => row?.lastSeenAt || row?.updatedAt || row?.createdAt,
  );
  const pendingToken = pickLatestByTimestamp(
    provisioningTokens.filter((row) => trimText(row?.status).toLowerCase() === 'pending_activation'),
    (row) => row?.updatedAt || row?.createdAt || row?.expiresAt,
  );

  if (normalizedAgentStatus === 'online') {
    return 'online';
  }
  if (trimText(latestSession?.status).toLowerCase() === 'online') {
    return 'online';
  }
  if (activeDevice) {
    return 'bound';
  }
  if (pendingToken) {
    return 'awaiting-install';
  }
  if (normalizedAgentStatus === 'revoked') {
    return 'revoked';
  }
  if (normalizedAgentStatus === 'pending') {
    return 'pending';
  }
  return 'inactive';
}

function buildRuntimeInventory(snapshot, filters = {}) {
  const normalizedFilters = {
    tenantId: trimText(filters.tenantId),
    serverId: trimText(filters.serverId),
    role: normalizeRole(filters.role),
  };

  const serversById = new Map(
    (Array.isArray(snapshot?.servers) ? snapshot.servers : []).map((server) => [server.id, server]),
  );

  const runtimes = (Array.isArray(snapshot?.agents) ? snapshot.agents : [])
    .filter((agent) => {
      if (normalizedFilters.tenantId && trimText(agent?.tenantId) !== normalizedFilters.tenantId) {
        return false;
      }
      if (normalizedFilters.serverId && trimText(agent?.serverId) !== normalizedFilters.serverId) {
        return false;
      }
      if (normalizedFilters.role && normalizeRole(agent?.role) !== normalizedFilters.role) {
        return false;
      }
      return true;
    })
    .map((agent) => {
      const server = serversById.get(agent.serverId) || null;
      const devices = (snapshot.agentDevices || []).filter((row) => trimText(row?.agentId) === trimText(agent.agentId));
      const sessions = (snapshot.agentSessions || []).filter((row) => trimText(row?.agentId) === trimText(agent.agentId));
      const provisioningTokens = (snapshot.agentProvisioningTokens || []).filter(
        (row) => trimText(row?.agentId) === trimText(agent.agentId),
      );
      const tokenBindings = (snapshot.agentTokenBindings || []).filter((row) => trimText(row?.agentId) === trimText(agent.agentId));
      const credentials = (snapshot.agentCredentials || []).filter((row) => trimText(row?.agentId) === trimText(agent.agentId));
      const latestSession = pickLatestByTimestamp(
        sessions,
        (row) => row?.lastSeenAt || row?.updatedAt || row?.createdAt,
      );
      const latestDevice = pickLatestByTimestamp(
        devices,
        (row) => row?.lastSeenAt || row?.updatedAt || row?.createdAt,
      );
      const latestProvisioningToken = pickLatestByTimestamp(
        provisioningTokens,
        (row) => row?.updatedAt || row?.createdAt || row?.expiresAt,
      );
      const status = classifyInventoryStatus(agent, devices, sessions, provisioningTokens);

      return {
        tenantId: trimText(agent.tenantId),
        serverId: trimText(agent.serverId),
        serverName: trimText(server?.name) || trimText(server?.slug) || null,
        agentId: trimText(agent.agentId),
        runtimeKey: trimText(agent.runtimeKey) || null,
        displayName: trimText(agent.displayName) || null,
        role: normalizeRole(agent.role) || trimText(agent.role) || 'unknown',
        scope: trimText(agent.scope) || null,
        status,
        agentStatus: trimText(agent.status) || null,
        lastSeenAt: toIso(
          latestSession?.lastSeenAt
            || latestDevice?.lastSeenAt
            || agent?.lastSeenAt
            || latestSession?.updatedAt
            || latestDevice?.updatedAt,
        ),
        machineName: trimText(latestDevice?.hostname) || trimText(agent?.hostname) || null,
        activeDevices: devices.filter((row) => isStatusActive(row?.status)).length,
        activeCredentials: credentials.filter((row) => isStatusActive(row?.status)).length,
        activeBindings: tokenBindings.filter((row) => isStatusActive(row?.status)).length,
        pendingSetupTokens: provisioningTokens.filter(
          (row) => trimText(row?.status).toLowerCase() === 'pending_activation',
        ).length,
        latestSetupTokenPrefix: trimText(latestProvisioningToken?.tokenPrefix) || null,
        latestCredentialPrefix: trimText(
          pickLatestByTimestamp(credentials, (row) => row?.updatedAt || row?.createdAt)?.keyPrefix,
        ) || null,
        latestSessionStatus: trimText(latestSession?.status) || null,
        version: trimText(agent?.version) || null,
      };
    })
    .sort((left, right) => {
      if (left.tenantId !== right.tenantId) return left.tenantId.localeCompare(right.tenantId);
      if (left.serverId !== right.serverId) return left.serverId.localeCompare(right.serverId);
      if (left.role !== right.role) return left.role.localeCompare(right.role);
      return left.agentId.localeCompare(right.agentId);
    });

  const summary = {
    totalRuntimes: runtimes.length,
    online: runtimes.filter((row) => row.status === 'online').length,
    awaitingInstall: runtimes.filter((row) => row.status === 'awaiting-install').length,
    inactive: runtimes.filter((row) => row.status === 'inactive' || row.status === 'pending').length,
    revoked: runtimes.filter((row) => row.status === 'revoked').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    filters: normalizedFilters,
    summary,
    runtimes,
  };
}

function formatRuntimeInventoryReport(report) {
  const lines = [];
  const filters = report.filters || {};
  lines.push('Runtime Inventory');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(
    `Filters: tenant=${filters.tenantId || 'all'} | server=${filters.serverId || 'all'} | role=${filters.role || 'all'}`,
  );
  lines.push(
    `Summary: total=${report.summary.totalRuntimes} | online=${report.summary.online} | awaiting-install=${report.summary.awaitingInstall} | inactive=${report.summary.inactive} | revoked=${report.summary.revoked}`,
  );
  lines.push('');

  if (report.runtimes.length === 0) {
    lines.push('No runtimes matched the selected filters.');
    return lines.join('\n');
  }

  for (const runtime of report.runtimes) {
    lines.push(
      [
        `- ${runtime.agentId}`,
        `[${runtime.role}]`,
        `status=${runtime.status}`,
        runtime.serverName ? `server=${runtime.serverName}` : `serverId=${runtime.serverId}`,
      ].join(' '),
    );
    lines.push(
      `  tenant=${runtime.tenantId} | runtimeKey=${runtime.runtimeKey || '-'} | machine=${runtime.machineName || '-'} | lastSeen=${runtime.lastSeenAt || '-'}`,
    );
    lines.push(
      `  setupPrefix=${runtime.latestSetupTokenPrefix || '-'} | credentialPrefix=${runtime.latestCredentialPrefix || '-'} | devices=${runtime.activeDevices} | credentials=${runtime.activeCredentials} | bindings=${runtime.activeBindings}`,
    );
  }

  return lines.join('\n');
}

function parseArgs(argv) {
  const options = {
    tenantId: '',
    serverId: '',
    role: '',
    asJson: false,
    outputPath: DEFAULT_OUTPUT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = trimText(argv[index]);
    if (!arg) continue;

    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/runtime-inventory-report.js [options]');
      console.log('');
      console.log('Options:');
      console.log('  --tenant-id <id>   Filter by tenant');
      console.log('  --server-id <id>   Filter by server');
      console.log('  --role <name>      delivery-agent | server-bot | hybrid');
      console.log('  --output <path>    Write JSON report to a custom path');
      console.log('  --json             Print JSON to stdout instead of text');
      process.exit(0);
    }

    if (arg === '--json') {
      options.asJson = true;
      continue;
    }

    if (arg === '--tenant-id') {
      index += 1;
      options.tenantId = argv[index];
      continue;
    }

    if (arg.startsWith('--tenant-id=')) {
      options.tenantId = arg.slice('--tenant-id='.length);
      continue;
    }

    if (arg === '--server-id') {
      index += 1;
      options.serverId = argv[index];
      continue;
    }

    if (arg.startsWith('--server-id=')) {
      options.serverId = arg.slice('--server-id='.length);
      continue;
    }

    if (arg === '--role') {
      index += 1;
      options.role = argv[index];
      continue;
    }

    if (arg.startsWith('--role=')) {
      options.role = arg.slice('--role='.length);
      continue;
    }

    if (arg === '--output') {
      index += 1;
      options.outputPath = argv[index];
      continue;
    }

    if (arg.startsWith('--output=')) {
      options.outputPath = arg.slice('--output='.length);
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  options.outputPath = path.resolve(process.cwd(), trimText(options.outputPath) || DEFAULT_OUTPUT_PATH);
  return options;
}

async function createRuntimeInventorySnapshot() {
  const { getFilePath } = require('../src/store/_persist');
  const registryPath = getFilePath('control-plane-registry.json');
  if (fs.existsSync(registryPath)) {
    try {
      const raw = fs.readFileSync(registryPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          version: 1,
          updatedAt: new Date().toISOString(),
          servers: [],
          serverDiscordLinks: [],
          agents: [],
          agentTokenBindings: [],
          agentProvisioningTokens: [],
          agentDevices: [],
          agentCredentials: [],
          agentSessions: [],
          syncRuns: [],
          syncEvents: [],
          ...parsed,
        };
      }
    } catch {
      // Fall through to live registry readers below.
    }
  }

  const {
    listAgents,
    listAgentCredentials,
    listAgentDevices,
    listAgentProvisioningTokens,
    listAgentSessions,
    listAgentTokenBindings,
    listServers,
  } = require('../src/data/repositories/controlPlaneRegistryRepository');

  return {
    servers: listServers({}),
    agents: listAgents({}),
    agentDevices: listAgentDevices({}),
    agentCredentials: listAgentCredentials({}),
    agentProvisioningTokens: listAgentProvisioningTokens({}),
    agentTokenBindings: listAgentTokenBindings({}),
    agentSessions: listAgentSessions({}),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = await createRuntimeInventorySnapshot();
  const report = buildRuntimeInventory(snapshot, options);
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (options.asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatRuntimeInventoryReport(report)}\n`);
  process.stdout.write(`\nJSON report: ${options.outputPath}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  buildRuntimeInventory,
  formatRuntimeInventoryReport,
  normalizeRole,
  parseArgs,
};
