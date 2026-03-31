const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantEventsV4Model,
  buildTenantEventsV4Html,
} = require('../src/admin/assets/tenant-events-v4.js');

test('tenant events v4 model summarizes event operations', () => {
  const model = createTenantEventsV4Model({
    tenantConfig: { name: 'Tenant Demo' },
    events: [
      { id: 1, name: 'Weekend Arena', time: '2026-04-02 20:00 ICT', reward: '5000 coins', status: 'scheduled', participants: ['u1', 'u2'] },
      { id: 2, name: 'Duo Hunt', time: '2026-04-03 21:00 ICT', reward: 'VIP crate', status: 'active', participants: [] },
    ],
  });

  assert.equal(model.header.title, 'Events');
  assert.equal(model.events.length, 2);
  assert.equal(model.summaryStrip[0].value, '1');
});

test('tenant events v4 html includes update, activate, and deactivate actions', () => {
  const html = buildTenantEventsV4Html(createTenantEventsV4Model({
    events: [{ id: 1, name: 'Weekend Arena', time: 'soon', reward: 'crate', status: 'scheduled', participants: [] }],
  }));

  assert.match(html, /Create event/);
  assert.match(html, /Save details/);
  assert.match(html, /Activate event/);
  assert.match(html, /data-event-name/);
});
