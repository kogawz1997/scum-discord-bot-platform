const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPlayerHomeV4Html,
  createPlayerHomeV4Model,
} = require('../apps/web-portal-standalone/public/assets/player-home-v4.js');
const {
  createPlayerCommerceV4Model,
} = require('../apps/web-portal-standalone/public/assets/player-commerce-v4.js');

test('player home v4 accepts injected nav groups and notice banner', () => {
  const model = createPlayerHomeV4Model({
    me: { user: 'Mira' },
    __surfaceShell: {
      navGroups: [
        {
          label: 'Start',
          items: [{ label: 'Home', href: '#home', current: true }],
        },
      ],
    },
    __surfaceNotice: {
      tone: 'warning',
      title: 'Workspace locked',
      detail: 'The current tenant package does not enable this player workspace yet.',
    },
  });

  assert.equal(model.shell.navGroups[0].label, 'Start');
  assert.equal(model.notice.title, 'Workspace locked');

  const html = buildPlayerHomeV4Html(model);
  assert.match(html, /Workspace locked/);
});

test('player commerce v4 accepts injected nav groups', () => {
  const model = createPlayerCommerceV4Model({
    me: { user: 'Mira' },
    __surfaceShell: {
      navGroups: [
        {
          label: 'Commerce',
          items: [{ label: 'Shop, Wallet & Orders', href: '#shop', current: true }],
        },
      ],
    },
  });

  assert.equal(model.shell.navGroups[0].label, 'Commerce');
});
