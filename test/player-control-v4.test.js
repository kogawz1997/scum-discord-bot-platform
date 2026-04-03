const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PLAYER_PAGE_KEYS,
  buildCanonicalPlayerPath,
  buildPlayerControlV4Html,
  createPlayerControlV4Model,
  createPlayerPortalNavGroups,
  resolvePlayerPageKey,
} = require('../apps/web-portal-standalone/public/assets/player-control-v4.js');

function buildSampleState() {
  return {
    me: { user: 'Mira' },
    profile: {
      displayName: 'MiraTH',
      accountStatus: 'active',
      primaryEmail: 'mira@example.com',
      platformUserId: 'platform-user-1',
      identitySummary: {
        verificationState: 'fully_verified',
        activeMembership: {
          tenantId: 'tenant-prod-001',
          membershipType: 'tenant',
          role: 'player',
          status: 'active',
        },
        linkedAccounts: {
          email: {
            linked: true,
            verified: true,
            value: 'mira@example.com',
          },
          discord: {
            linked: true,
            verified: true,
            value: '123456789012345678',
          },
          steam: {
            linked: true,
            verified: true,
            value: '7656119',
          },
          inGame: {
            linked: true,
            verified: true,
            value: 'MiraTH',
          },
        },
      },
    },
    featureAccess: {
      sections: {
        home: { enabled: true },
        stats: { enabled: true },
        leaderboard: { enabled: true },
        shop: { enabled: true },
        orders: { enabled: true },
        delivery: { enabled: true },
        events: { enabled: true },
        donations: { enabled: false },
        profile: { enabled: true },
        support: { enabled: true },
      },
    },
    serverInfo: {
      serverInfo: {
        name: 'SCUM TH Frontier',
        description: 'Community server',
      },
      status: {
        onlinePlayers: 44,
      },
      raidTimes: ['21:00 - 23:00'],
      economy: {
        dailyReward: 250,
        weeklyReward: 1400,
      },
    },
    dashboard: {
      missionsSummary: {
        dailyClaimable: true,
        weeklyClaimable: false,
        weeklyRemainingText: '12 hr remaining',
      },
    },
    walletLedger: {
      wallet: { balance: 4200 },
      items: [{ createdAt: '2026-03-26T13:00:00+07:00', delta: -500, balanceAfter: 4200, reasonLabel: 'Order' }],
    },
    cart: {
      totalUnits: 2,
      totalPrice: 1500,
      rows: [{ itemId: 'bundle-1', quantity: 1 }],
    },
    shopItems: [
      { id: 'bundle-1', name: 'Starter Pack', description: 'Good first purchase', price: 1500, kind: 'item' },
      { id: 'vip-1', name: 'Supporter VIP', description: 'Support the server', price: 3000, kind: 'vip' },
    ],
    orders: [
      {
        purchaseCode: 'P-001',
        itemName: 'Starter Pack',
        status: 'delivery_failed',
        totalPrice: 1500,
        createdAt: '2026-03-26T13:00:00+07:00',
      },
      {
        purchaseCode: 'P-002',
        itemName: 'Ammo Box',
        status: 'delivering',
        totalPrice: 500,
        createdAt: '2026-03-27T13:00:00+07:00',
      },
    ],
    redeemHistory: [
      { code: 'WELCOME', status: 'used', createdAt: '2026-03-26T12:00:00+07:00' },
    ],
    steamLink: {
      linked: true,
      steamId: '7656119',
      inGameName: 'MiraTH',
    },
    notifications: [
      {
        severity: 'warning',
        title: 'Delivery needs review',
        detail: 'Check P-001',
        createdAt: '2026-03-27T13:10:00+07:00',
      },
    ],
    stats: {
      kills: 128,
      deaths: 54,
      kd: 2.37,
      playtimeMinutes: 4820,
    },
    leaderboard: {
      items: [{ rank: 3, name: 'MiraTH', kills: 128, kd: 2.37, isSelf: true }],
    },
    missions: {
      missions: [{ title: 'Daily Claim', category: 'daily', claimable: true }],
    },
    bounties: {
      items: [{ title: 'Hunter bounty', rewardLabel: '500 coins' }],
    },
    killfeed: [
      {
        id: 91,
        killerName: 'MiraTH',
        victimName: 'BanditX',
        weapon: 'AK-47',
        distance: 122,
        sector: 'B2',
        occurredAt: '2026-03-27T13:20:00+07:00',
        involvesPlayer: true,
        playerRole: 'killer',
      },
    ],
    linkHistory: {
      items: [{ provider: 'steam', status: 'linked', steamId: '7656119', createdAt: '2026-03-20T12:00:00+07:00' }],
    },
    lastRefreshedAt: '2026-03-27T13:18:00+07:00',
  };
}

test('player control v4 resolves legacy player routes into canonical page keys', () => {
  assert.deepEqual(PLAYER_PAGE_KEYS, [
    'home',
    'stats',
    'leaderboard',
    'shop',
    'orders',
    'delivery',
    'events',
    'donations',
    'profile',
    'support',
  ]);
  assert.equal(resolvePlayerPageKey('wallet'), 'shop');
  assert.equal(resolvePlayerPageKey('activity'), 'support');
  assert.equal(buildCanonicalPlayerPath('orders'), '/player/orders');
  assert.equal(buildCanonicalPlayerPath('profile'), '/player/profile');
});

test('player control v4 nav groups expose player-facing routes instead of macro commerce/stats screens', () => {
  const navGroups = createPlayerPortalNavGroups('orders', buildSampleState().featureAccess);

  assert.equal(navGroups.length, 4);
  assert.equal(navGroups[0].items[0].href, '/player/home');
  assert.equal(navGroups[1].items[1].href, '/player/leaderboard');
  assert.equal(navGroups[2].items[1].href, '/player/orders');
  assert.equal(navGroups[2].items[3].href, '/player/donations');
  assert.equal(navGroups[3].items[1].href, '/player/support');
});

test('player control v4 builds route-specific player pages', () => {
  const ordersModel = createPlayerControlV4Model(buildSampleState(), 'orders');
  const profileModel = createPlayerControlV4Model(buildSampleState(), 'profile');

  assert.ok(ordersModel.header.title);
  assert.ok(profileModel.header.title);
  assert.equal(ordersModel.notice, null);
  assert.match(ordersModel.mainHtml, /data-player-redeem-form/);
  assert.match(profileModel.mainHtml, /data-player-steam-link-form|Steam/);
});

test('player control v4 uses tenant branding when the player payload includes it', () => {
  const state = buildSampleState();
  state.branding = {
    siteName: 'Prime SCUM Network',
    siteDetail: 'Official player community',
    logoUrl: 'https://cdn.example.com/prime-logo.png',
    bannerUrl: '/branding/prime-banner.jpg',
    brandMark: 'PS',
    theme: 'midnight-ops',
    themeTokens: {
      primary: '#3366ff',
      accent: '#99ddaa',
      surface: '#0d1722',
      text: '#e7f2ff',
    },
  };

  const model = createPlayerControlV4Model(state, 'home');
  const html = buildPlayerControlV4Html(model);

  assert.equal(model.shell.surfaceLabel, 'Prime SCUM Network');
  assert.equal(model.shell.logoUrl, 'https://cdn.example.com/prime-logo.png');
  assert.match(html, /Prime SCUM Network/);
  assert.match(html, /prime-logo\.png/);
});

test('player control v4 shop page exposes add-to-cart and checkout actions', () => {
  const shopModel = createPlayerControlV4Model(buildSampleState(), 'shop');

  assert.match(shopModel.mainHtml, /data-player-cart-add="bundle-1"/);
  assert.match(shopModel.mainHtml, /data-player-cart-checkout/);
});

test('player control v4 orders and events pages expose real player actions', () => {
  const ordersModel = createPlayerControlV4Model(buildSampleState(), 'orders');
  const eventsModel = createPlayerControlV4Model(buildSampleState(), 'events');

  assert.match(ordersModel.mainHtml, /data-player-redeem-form/);
  assert.match(eventsModel.mainHtml, /data-player-reward-claim="daily"/);
  assert.match(eventsModel.mainHtml, /data-player-raid-request-form/);
  assert.match(eventsModel.mainHtml, /ส่งคำขอเรด/);
  assert.match(eventsModel.mainHtml, /data-player-killfeed/);
  assert.match(eventsModel.mainHtml, /การต่อสู้ล่าสุด/);
  assert.match(eventsModel.mainHtml, /MiraTH จัดการ BanditX/);
});

test('player control v4 profile page shows Steam link form before linking', () => {
  const state = buildSampleState();
  state.steamLink = {
    linked: false,
    steamId: '',
    inGameName: '',
  };

  const profileModel = createPlayerControlV4Model(state, 'profile');

  assert.match(profileModel.mainHtml, /data-player-steam-link-form/);
});

test('player control v4 profile page shows linked account readiness and membership summary', () => {
  const profileModel = createPlayerControlV4Model(buildSampleState(), 'profile');

  assert.match(profileModel.mainHtml, /data-player-identity-summary/);
  assert.match(profileModel.mainHtml, /บัญชีที่เชื่อมและความพร้อม/);
  assert.match(profileModel.mainHtml, /สถานะการยืนยันตัวตน/);
  assert.match(profileModel.mainHtml, /สิทธิ์ที่ใช้งานอยู่/);
  assert.match(profileModel.mainHtml, /mira@example\.com/);
  assert.match(profileModel.mainHtml, /123456789012345678/);
  assert.match(profileModel.mainHtml, /ผู้เล่น \(ใช้งานอยู่\)/);
});

test('player control v4 donations page exposes supporter summary, readiness, and history', () => {
  const state = buildSampleState();
  state.featureAccess.sections.donations.enabled = true;
  state.orders.unshift({
    purchaseCode: 'SUP-001',
    itemId: 'vip-1',
    itemName: 'Supporter VIP',
    status: 'delivered',
    totalPrice: 3000,
    createdAt: '2026-03-27T15:00:00+07:00',
  });

  const donationsModel = createPlayerControlV4Model(state, 'donations');

  assert.match(donationsModel.mainHtml, /data-player-supporter-summary/);
  assert.match(donationsModel.mainHtml, /data-player-supporter-readiness/);
  assert.match(donationsModel.mainHtml, /data-player-supporter-history/);
  assert.match(donationsModel.mainHtml, /ความพร้อมและสถานะล่าสุด/);
  assert.match(donationsModel.mainHtml, /การซื้อผู้สนับสนุนล่าสุด/);
  assert.match(donationsModel.mainHtml, /SUP-001/);
  assert.match(donationsModel.mainHtml, /Supporter VIP/);
});

test('player control v4 donations page highlights Steam readiness before supporter delivery', () => {
  const state = buildSampleState();
  state.featureAccess.sections.donations.enabled = true;
  state.steamLink = {
    linked: false,
    steamId: '',
    inGameName: '',
  };

  const donationsModel = createPlayerControlV4Model(state, 'donations');

  assert.match(donationsModel.mainHtml, /เชื่อม Steam ก่อนรับของผู้สนับสนุน/);
  assert.match(donationsModel.mainHtml, /เปิดโปรไฟล์/);
});

test('player control v4 html keeps locked pages visible with a clear notice', () => {
  const html = buildPlayerControlV4Html(createPlayerControlV4Model(buildSampleState(), 'donations'));

  assert.match(html, /\/player\/shop/);
  assert.match(html, /support the server|supporter vip/i);
});
