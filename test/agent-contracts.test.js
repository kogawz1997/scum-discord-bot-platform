const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveScopesForAgent,
  normalizeAgentRegistrationInput,
  normalizeAgentSyncPayload,
} = require('../src/contracts/agent/agentContracts');

test('normalizeAgentRegistrationInput derives role and scope defaults safely', () => {
  const syncAgent = normalizeAgentRegistrationInput({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    runtimeKey: 'sync-a',
    role: 'sync',
  });
  assert.equal(syncAgent.role, 'sync');
  assert.equal(syncAgent.scope, 'sync_only');

  const executeAgent = normalizeAgentRegistrationInput({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    runtimeKey: 'exec-a',
    role: 'execute',
  });
  assert.equal(executeAgent.role, 'execute');
  assert.equal(executeAgent.scope, 'execute_only');

  const explicitHybridScope = normalizeAgentRegistrationInput({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    runtimeKey: 'hybrid-a',
    role: 'hybrid',
    scope: 'sync_execute',
  });
  assert.equal(explicitHybridScope.role, 'hybrid');
  assert.equal(explicitHybridScope.scope, 'sync_execute');

  const explicitExecuteScope = normalizeAgentRegistrationInput({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    runtimeKey: 'explicit-exec',
    role: 'execute',
    scope: 'execute_only',
  });
  assert.equal(explicitExecuteScope.role, 'execute');
  assert.equal(explicitExecuteScope.scope, 'execute_only');
});

test('deriveScopesForAgent separates read/sync and execute scopes', () => {
  const syncScopes = deriveScopesForAgent('sync', 'sync_only');
  assert.ok(syncScopes.includes('agent:sync'));
  assert.ok(!syncScopes.includes('agent:execute'));

  const executeScopes = deriveScopesForAgent('execute', 'execute_only');
  assert.ok(executeScopes.includes('agent:execute'));
  assert.ok(!executeScopes.includes('agent:sync'));

  const hybridScopes = deriveScopesForAgent('hybrid', 'sync_execute');
  assert.ok(hybridScopes.includes('agent:sync'));
  assert.ok(hybridScopes.includes('agent:execute'));
});

test('normalizeAgentSyncPayload keeps server-scoped event envelope', () => {
  const payload = normalizeAgentSyncPayload({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    guildId: 'guild-a',
    agentId: 'agent-sync',
    runtimeKey: 'sync-runtime',
    events: [{ type: 'kill' }],
  });

  assert.equal(payload.tenantId, 'tenant-a');
  assert.equal(payload.serverId, 'server-a');
  assert.equal(payload.guildId, 'guild-a');
  assert.equal(payload.agentId, 'agent-sync');
  assert.equal(payload.eventCount, 1);
  assert.equal(Array.isArray(payload.events), true);
});
