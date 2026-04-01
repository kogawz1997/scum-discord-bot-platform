const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildPlayerHomeV4Html,
  createPlayerHomeV4Model,
} = require('../apps/web-portal-standalone/public/assets/player-home-v4.js');

test('player home v4 model maps current player state into trust-first workspace', () => {
  const model = createPlayerHomeV4Model({
    me: { user: 'Mira' },
    profile: { displayName: 'MiraTH', accountStatus: 'active' },
    dashboard: {
      wallet: { balance: 4200 },
      latestOrder: { purchaseCode: 'P-001', itemName: 'Starter Pack', status: 'delivering', createdAt: '2026-03-26T13:00:00+07:00' },
      missionsSummary: { dailyClaimable: true, weeklyClaimable: false },
      announcements: ['คืนนี้มีช่วง Raid Time'],
    },
    serverInfo: {
      serverInfo: { name: 'SCUM TH Frontier', maxPlayers: 64, description: 'Community server' },
      status: { onlinePlayers: 35 },
      raidTimes: ['21:00 - 23:00'],
    },
    walletLedger: { wallet: { balance: 4200 } },
    steamLink: { linked: true, steamId: '7656119', inGameName: 'MiraTH' },
    notifications: [{ severity: 'warning', title: 'Order delayed', detail: 'กำลังรอรอบส่งของ', createdAt: '2026-03-26T13:10:00+07:00' }],
    orders: [{ purchaseCode: 'P-001', status: 'delivering' }],
    lastRefreshedAt: '2026-03-26T13:18:00+07:00',
  });

  assert.equal(model.header.title, 'ภาพรวมผู้เล่น');
  assert.equal(model.summaryStrip.length, 5);
  assert.equal(model.taskGroups.length, 3);
  assert.ok(model.feedRows.some((item) => item.title.includes('Order delayed')));
  assert.ok(model.railCards.some((item) => item.title.includes('บัญชีพร้อมรับของ')));
});

test('player home v4 html includes player shell and core sections', () => {
  const html = buildPlayerHomeV4Html(createPlayerHomeV4Model({ me: { user: 'Demo' } }));

  assert.match(html, /plv4-topbar/);
  assert.match(html, /ภาพรวมผู้เล่น/);
  assert.match(html, /งานที่ผู้เล่นใช้บ่อยที่สุด/);
  assert.match(html, /อัปเดตที่ควรรู้ตอนนี้/);
});

test('player home v4 preview references shared and page assets', () => {
  const previewPath = path.join(__dirname, '..', 'apps', 'web-portal-standalone', 'public', 'v4', 'player-home-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/player-home-v4\.css/);
  assert.match(html, /\.\.\/assets\/player-v4-shared\.js/);
  assert.match(html, /\.\.\/assets\/player-home-v4\.js/);
  assert.match(html, /playerHomeV4PreviewRoot/);
  assert.match(html, /__PLAYER_HOME_V4_SAMPLE__/);
});
