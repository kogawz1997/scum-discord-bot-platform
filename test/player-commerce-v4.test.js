const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildPlayerCommerceV4Html,
  createPlayerCommerceV4Model,
} = require('../apps/web-portal-standalone/public/assets/player-commerce-v4.js');

test('player commerce v4 model turns shop wallet and orders into one workflow', () => {
  const model = createPlayerCommerceV4Model({
    me: { user: 'Mira' },
    walletLedger: {
      wallet: { balance: 5200 },
      items: [{ createdAt: '2026-03-26T13:00:00+07:00', delta: -500, balanceAfter: 5200, reasonLabel: 'ซื้อของ', reference: 'P-001' }],
    },
    cart: { totalUnits: 2, totalPrice: 1500, rows: [{ itemId: 'bundle-1', quantity: 1 }], missingItemIds: [] },
    orders: [{ purchaseCode: 'P-001', itemName: 'Starter Pack', status: 'delivering', totalPrice: 1500, createdAt: '2026-03-26T13:00:00+07:00' }],
    redeemHistory: [{ code: 'WELCOME' }],
    shopItems: [{ id: 'bundle-1', name: 'Starter Pack', description: 'เปิดตัวผู้เล่นใหม่', price: 1500, kind: 'vip' }],
    steamLink: { linked: true, inGameName: 'MiraTH' },
  });

  assert.equal(model.header.title, 'ร้านค้า กระเป๋าเงิน และคำสั่งซื้อ');
  assert.equal(model.summaryStrip.length, 5);
  assert.equal(model.workflowCards.length, 3);
  assert.equal(model.highlightedProducts.length, 1);
  assert.equal(model.ordersTable.length, 1);
  assert.ok(model.railCards.some((item) => item.title.includes('บัญชีพร้อมชำระและรับของ')));
});

test('player commerce v4 html includes commerce workflow sections', () => {
  const html = buildPlayerCommerceV4Html(createPlayerCommerceV4Model({ me: { user: 'Demo' } }));

  assert.match(html, /ร้านค้า กระเป๋าเงิน และคำสั่งซื้อ/);
  assert.match(html, /ไปต่อจากสถานะตอนนี้/);
  assert.match(html, /สินค้าแนะนำ/);
  assert.match(html, /ภาพรวมตะกร้าปัจจุบัน/);
  assert.match(html, /คำสั่งซื้อและการส่งของ/);
});

test('player commerce v4 preview references shared and page assets', () => {
  const previewPath = path.join(__dirname, '..', 'apps', 'web-portal-standalone', 'public', 'v4', 'player-commerce-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/player-commerce-v4\.css/);
  assert.match(html, /\.\.\/assets\/player-v4-shared\.js/);
  assert.match(html, /\.\.\/assets\/player-commerce-v4\.js/);
  assert.match(html, /playerCommerceV4PreviewRoot/);
  assert.match(html, /__PLAYER_COMMERCE_V4_SAMPLE__/);
});
