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
  assert.ok(model.railCards.length >= 3);
});

test('tenant players v4 html includes player table and team access handoff', () => {
  const html = buildTenantPlayersV4Html(createTenantPlayersV4Model({
    me: { role: 'owner' },
    tenantConfig: { name: 'Tenant Demo' },
    players: [],
  }));

  assert.match(html, /Steam \/ In-game/);
  assert.match(html, /Manage team access from the dedicated team pages/);
  assert.match(html, /Open staff/);
  assert.doesNotMatch(html, /data-tenant-staff-card/);
  assert.match(html, /tdv4-players-main-grid/);
});

test('tenant players preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-players-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-players-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-players-v4\.js/);
  assert.match(html, /tenantPlayersV4PreviewRoot/);
});
