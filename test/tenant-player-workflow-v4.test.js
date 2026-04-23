const test = require('node:test');
const assert = require('node:assert/strict');

const { createTenantPlayerWorkflowV4 } = require('../src/admin/assets/tenant-player-workflow-v4.js');

test('tenant player workflow reads URL state and writes identity workflow state', () => {
  const writes = [];
  const workflow = createTenantPlayerWorkflowV4({
    getCurrentUrl: () => new URL('https://example.test/tenant/players?userId=u-1&identityAction=relink&supportReason=steam%20mismatch&supportSource=owner&supportOutcome=pending-verification'),
    writeTenantUrlState: (payload) => writes.push(payload),
  });

  assert.equal(workflow.readUserIdFromUrl(), 'u-1');
  assert.equal(workflow.readIdentityActionFromUrl(), 'relink');
  assert.equal(workflow.readSupportReasonFromUrl(), 'steam mismatch');
  assert.equal(workflow.readSupportSourceFromUrl(), 'owner');
  assert.equal(workflow.readSupportOutcomeFromUrl(), 'pending-verification');

  workflow.writeUserIdToUrl('u-2');
  workflow.writePlayerIdentityWorkflowToUrl('u-3', 'conflict', 'needs review', 'tenant', 'reviewing');

  assert.deepEqual(writes[0], {
    userId: 'u-2',
    identityAction: '',
    supportReason: '',
    supportSource: '',
    supportOutcome: '',
    code: '',
  });
  assert.deepEqual(writes[1], {
    userId: 'u-3',
    identityAction: 'conflict',
    supportReason: 'needs review',
    supportSource: 'tenant',
    supportOutcome: 'reviewing',
    code: '',
  });
});

test('tenant player workflow normalizes support semantics and messages', () => {
  const workflow = createTenantPlayerWorkflowV4({});

  assert.equal(workflow.normalizeIdentitySupportIntent('set'), 'bind');
  assert.equal(workflow.normalizeIdentitySupportIntent('remove'), 'unlink');
  assert.equal(workflow.resolveIdentitySupportFormAction('conflict'), 'review');
  assert.equal(workflow.resolveIdentitySupportFormAction('unlink'), 'remove');
  assert.equal(workflow.resolveIdentitySupportFormAction('bind'), 'set');
  assert.equal(workflow.resolveIdentityFollowupAction('relink', 'remove'), 'bind');
  assert.equal(workflow.resolveIdentityFollowupAction('conflict', 'review'), 'conflict');
  assert.equal(workflow.normalizeIdentitySupportOutcome('pending verification'), 'pending-verification');
  assert.match(workflow.buildIdentitySupportSuccessMessage('relink', 'remove', 'u-1'), /เตรียมผูก Steam ใหม่ต่อ/);
  assert.match(workflow.buildIdentitySupportSuccessMessage('conflict', 'review', 'u-2'), /conflict handoff/);
});
