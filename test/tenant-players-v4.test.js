const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantPlayersV4Html,
  createTenantPlayersV4Model,
} = require('../src/admin/assets/tenant-players-v4.js');

test('tenant players v4 model builds support-focused workspace', () => {
  const model = createTenantPlayersV4Model({
    me: { tenantId: 'tenant-prod-001', role: 'admin' },
    tenantConfig: { name: 'SCUM TH Production' },
    players: [
      {
        displayName: 'John Walker',
        discordId: '123',
        steamId: '76561198000000001',
        inGameName: 'RW-John',
        isActive: true,
        updatedAt: '2026-03-26T08:00:00+07:00',
      },
    ],
    purchaseLookup: {
      items: [{ code: 'PUR-1', status: 'queued', userId: '123' }],
    },
    deliveryCase: {
      purchase: { userId: '123' },
      deadLetter: { reason: 'waiting for agent' },
    },
  });

  assert.equal(model.header.title, 'Players');
  assert.equal(model.summaryStrip.length, 4);
  assert.equal(model.players.length, 1);
  assert.equal(model.selected.discordId, '123');
  assert.equal(model.selected.ordersHref, '/tenant/orders?userId=123');
  assert.equal(model.selected.deliveryHref, '/tenant/orders?userId=123&code=PUR-1');
  assert.ok(model.railCards.length >= 3);
});

test('tenant players v4 html includes player actions and team access handoff', () => {
  const html = buildTenantPlayersV4Html(createTenantPlayersV4Model({
    me: { role: 'owner' },
    tenantConfig: { name: 'Tenant Demo' },
    players: [{ displayName: 'Scout', discordId: '321', steamId: 'steam-321', isActive: true }],
    purchaseLookup: { items: [{ code: 'ORD-321', status: 'queued', userId: '321' }] },
  }));

  assert.match(html, /Steam \/ In-game/);
  assert.match(html, /Open context/);
  assert.match(html, /Open order history/);
  assert.match(html, /data-tenant-player-select="321"/);
  assert.match(html, /Manage team access from the dedicated team pages/);
  assert.match(html, /Open staff/);
  assert.doesNotMatch(html, /data-tenant-staff-card/);
  assert.match(html, /tdv4-players-main-grid/);
  assert.match(html, /Record review only/);
  assert.match(html, /name="supportSource" value="tenant"/);
  assert.match(html, /name="supportOutcome"/);
  assert.match(html, /name="followupAction"/);
  assert.match(html, /Pending verification/);
});

test('tenant players v4 preserves tenant scope in owner-scoped links', () => {
  const model = createTenantPlayersV4Model({
    me: { role: 'owner' },
    tenantId: 'tenant-owner-scope',
    tenantConfig: { name: 'Tenant Demo' },
    players: [{ displayName: 'Scout', discordId: '321', steamId: 'steam-321', isActive: true }],
    purchaseLookup: { items: [{ code: 'ORD-321', status: 'queued', userId: '321' }] },
  });

  assert.equal(model.players[0].ordersHref, '/tenant/orders?userId=321&tenantId=tenant-owner-scope');
  assert.equal(model.selected.ordersHref, '/tenant/orders?userId=321&tenantId=tenant-owner-scope');
  assert.equal(model.selected.deliveryHref, '/tenant/orders?userId=321&code=ORD-321&tenantId=tenant-owner-scope');
  assert.equal(model.links.staffHref, '/tenant/staff?tenantId=tenant-owner-scope');
  assert.equal(model.links.rolesHref, '/tenant/roles?tenantId=tenant-owner-scope');
});

test('tenant players v4 maps steam mismatch into relink workflow context', () => {
  const model = createTenantPlayersV4Model({
    me: { tenantId: 'tenant-prod-001', role: 'admin' },
    selectedIdentityAction: 'relink',
    selectedSupportReason: 'Identity conflict: the linked Steam identity and the player profile are pointing at different Steam IDs.',
    selectedSupportSource: 'owner',
    players: [
      {
        displayName: 'Relink Target',
        discordId: '456',
        steamId: '76561198000000002',
        inGameName: 'Relink-Me',
        isActive: true,
      },
    ],
    selectedPlayerIdentity: {
      identitySummary: {
        linkedAccounts: {
          steam: { linked: true, value: '76561198000000002' },
        },
        conflicts: [
          {
            key: 'steam-mismatch',
            tone: 'warning',
            title: 'Steam identity does not match the player profile',
            detail: 'The linked Steam identity and the player profile are pointing at different Steam IDs.',
          },
        ],
      },
    },
  });

  assert.equal(model.identityWorkflow.intent, 'relink');
  assert.equal(model.identityWorkflow.actionValue, 'set');
  assert.equal(model.identityWorkflow.submitLabel, 'Save replacement Steam');
  assert.equal(model.identityWorkflow.issues[0].recommendedAction, 'relink');

  const html = buildTenantPlayersV4Html(model);
  assert.match(html, /Prepare Steam relink/);
  assert.match(html, /name="supportIntent" value="relink"/);
  assert.match(html, /Save replacement Steam/);
});

test('tenant players v4 maps conflict workflow into review-only handoff state', () => {
  const model = createTenantPlayersV4Model({
    me: { tenantId: 'tenant-prod-001', role: 'admin' },
    selectedIdentityAction: 'conflict',
    selectedSupportReason: 'Discord identity does not match the current player profile.',
    selectedSupportSource: 'owner',
    players: [
      {
        displayName: 'Conflict Target',
        discordId: '654',
        steamId: '76561198000000064',
        inGameName: 'Conflict-Me',
        isActive: true,
      },
    ],
    selectedPlayerIdentity: {
      identitySummary: {
        linkedAccounts: {
          steam: { linked: true, value: '76561198000000064' },
        },
        conflicts: [
          {
            key: 'discord-mismatch',
            tone: 'warning',
            title: 'Discord identity does not match the player profile',
            detail: 'Discord identity does not match the current player profile.',
          },
        ],
      },
    },
  });

  assert.equal(model.identityWorkflow.intent, 'conflict');
  assert.equal(model.identityWorkflow.actionValue, 'review');
  assert.equal(model.identityWorkflow.followupAction, 'conflict');
  assert.equal(model.identityWorkflow.submitLabel, 'Record conflict handoff');

  const html = buildTenantPlayersV4Html(model);
  assert.match(html, /Record review only/);
  assert.match(html, /Record conflict handoff/);
  assert.match(html, /value="conflict" selected>Review conflict handoff/);
});

test('tenant players v4 renders recent support trail from identity support notifications', () => {
  const model = createTenantPlayersV4Model({
    me: { tenantId: 'tenant-prod-001', role: 'admin' },
    selectedUserId: '777',
    players: [
      {
        displayName: 'Trail Target',
        discordId: '777',
        steamId: '76561198000000777',
        isActive: true,
      },
    ],
    notifications: [
      {
        kind: 'platform.player.identity.support',
        createdAt: '2026-04-06T10:00:00.000Z',
        data: {
          eventType: 'platform.player.identity.support',
          userId: '777',
          supportIntent: 'relink',
          supportOutcome: 'pending-player-reply',
          supportReason: 'Waiting for the player to confirm the replacement Steam ID.',
          supportSource: 'owner',
          followupAction: 'bind',
          actor: 'owner-user',
        },
      },
    ],
  });

  assert.equal(model.identityWorkflow.intent, 'relink');
  assert.equal(model.identityWorkflow.reason, 'Waiting for the player to confirm the replacement Steam ID.');
  assert.equal(model.identityWorkflow.source, 'owner');
  assert.equal(model.identityWorkflow.outcome, 'pending-player-reply');
  assert.equal(model.identityWorkflow.outcomeLabel, 'Pending player reply');
  assert.equal(model.identityWorkflow.trail.length, 1);
  assert.equal(model.identityWorkflow.trail[0].actionLabel, 'Prepare Steam relink');

  const html = buildTenantPlayersV4Html(model);
  assert.match(html, /Recent support trail/);
  assert.match(html, /Pending player reply/);
  assert.match(html, /Waiting for the player to confirm the replacement Steam ID\./);
  assert.match(html, /owner/);
  assert.match(html, /Next Prepare Steam bind/);
  assert.match(html, /data-tenant-player-support-outcome="pending-player-reply"/);
  assert.match(html, /name="supportSource" value="owner"/);
  assert.match(html, /Save replacement Steam/);
});

test('tenant players preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-players-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-players-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-players-v4\.js/);
  assert.match(html, /tenantPlayersV4PreviewRoot/);
});
