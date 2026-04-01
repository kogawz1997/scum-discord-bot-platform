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
    raids: {
      requests: [
        { id: 11, requesterName: 'Mira', requestText: 'Open west compound', preferredWindow: 'Friday 21:00', status: 'pending' },
      ],
      windows: [
        { id: 21, title: 'Friday window', startsAt: '2026-04-05 21:00 ICT', status: 'scheduled' },
      ],
      summaries: [
        { id: 31, outcome: 'Raid completed', notes: '2 squads joined' },
      ],
    },
    killfeed: [
      { id: 91, killerName: 'MiraTH', victimName: 'BanditX', weapon: 'AK-47', sector: 'B2', occurredAt: '2026-04-01T12:00:00.000Z' },
    ],
  });

  assert.equal(model.header.title, 'กิจกรรมและเรด');
  assert.equal(model.events.length, 2);
  assert.equal(model.summaryStrip[0].value, '1');
  assert.equal(model.raidRequests.length, 1);
  assert.equal(model.raidWindows.length, 1);
  assert.equal(model.raidSummaries.length, 1);
  assert.equal(model.killfeed.length, 1);
});

test('tenant events v4 html includes event and raid actions', () => {
  const html = buildTenantEventsV4Html(createTenantEventsV4Model({
    events: [{ id: 1, name: 'Weekend Arena', time: 'soon', reward: 'crate', status: 'scheduled', participants: [] }],
    raids: {
      requests: [{ id: 11, requesterName: 'Mira', requestText: 'Open west compound', preferredWindow: 'Friday 21:00', status: 'pending' }],
      windows: [],
      summaries: [],
    },
    killfeed: [{ id: 91, killerName: 'MiraTH', victimName: 'BanditX', weapon: 'AK-47', sector: 'B2', occurredAt: '2026-04-01T12:00:00.000Z' }],
  }));

  assert.match(html, /สร้างกิจกรรม/);
  assert.match(html, /บันทึกรายละเอียด/);
  assert.match(html, /เริ่มกิจกรรม/);
  assert.match(html, /data-event-name/);
  assert.match(html, /data-tenant-raid-review="approved"/);
  assert.match(html, /data-tenant-raid-window-form/);
  assert.match(html, /data-tenant-raid-summary-form/);
  assert.match(html, /การต่อสู้ล่าสุด/);
  assert.match(html, /MiraTH/);
  assert.match(html, /BanditX/);
});
