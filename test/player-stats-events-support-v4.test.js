const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildPlayerStatsEventsSupportV4Html,
  createPlayerStatsEventsSupportV4Model,
} = require('../apps/web-portal-standalone/public/assets/player-stats-events-support-v4.js');

test('player stats events support v4 model maps stats community and support state', () => {
  const model = createPlayerStatsEventsSupportV4Model({
    me: { user: 'Mira' },
    stats: { kills: 128, deaths: 54, kd: 2.37, playtimeMinutes: 4820 },
    leaderboard: { type: 'kills', items: [{ rank: 1, name: 'Mira', kills: 128, kd: 2.37, isSelf: true }] },
    missions: { missions: [{ title: 'Daily Claim', category: 'daily', claimable: true }] },
    bounties: { items: [{ id: 'b1' }, { id: 'b2' }] },
    party: { title: 'ทีม RED', memberCount: 4 },
    notifications: [{ severity: 'warning', title: 'มีออเดอร์ที่ควรตรวจต่อ', detail: 'เตรียม purchase code', createdAt: '2026-03-26T13:00:00+07:00' }],
    serverInfo: { serverInfo: { name: 'SCUM TH Frontier' } },
    wheelState: { enabled: true },
    orders: [{ status: 'delivery_failed', purchaseCode: 'P-001' }],
    steamLink: { linked: true },
  });

  assert.equal(model.header.title, 'สถิติ กิจกรรม และการช่วยเหลือ');
  assert.equal(model.summaryStrip.length, 5);
  assert.equal(model.personalFacts.length, 6);
  assert.equal(model.communityActionCards.length, 3);
  assert.equal(model.leaderboardRows.length, 1);
  assert.ok(model.railCards.some((item) => item.title.includes('ลำดับ')));
});

test('player stats events support v4 html includes community sections', () => {
  const html = buildPlayerStatsEventsSupportV4Html(createPlayerStatsEventsSupportV4Model({ me: { user: 'Demo' } }));

  assert.match(html, /สถิติ กิจกรรม และการช่วยเหลือ/);
  assert.match(html, /เริ่มจากสิ่งที่พาคุณกลับมาเล่นต่อได้ทันที/);
  assert.match(html, /สรุปสถิติของฉัน/);
  assert.match(html, /อันดับผู้เล่น/);
  assert.match(html, /ฟีดของชุมชนและบัญชี/);
});

test('player stats events support preview references shared and page assets', () => {
  const previewPath = path.join(__dirname, '..', 'apps', 'web-portal-standalone', 'public', 'v4', 'player-stats-events-support-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/player-stats-events-support-v4\.css/);
  assert.match(html, /\.\.\/assets\/player-v4-shared\.js/);
  assert.match(html, /\.\.\/assets\/player-stats-events-support-v4\.js/);
  assert.match(html, /playerStatsEventsSupportV4PreviewRoot/);
  assert.match(html, /__PLAYER_STATS_EVENTS_SUPPORT_V4_SAMPLE__/);
});
