const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createSelectElement() {
  return {
    attrs: {},
    innerHTML: '',
    value: '',
    listeners: new Map(),
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name);
    },
    addEventListener(name, handler) {
      this.listeners.set(name, handler);
    },
  };
}

function loadPortalI18nRuntime() {
  const select = createSelectElement();
  const document = {
    documentElement: { lang: 'en' },
    getElementById(id) {
      return id === 'lang' ? select : null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-language-select]') {
        return select.hasAttribute('data-language-select') ? [select] : [];
      }
      return [];
    },
  };
  const window = {
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    navigator: {
      language: 'en',
      languages: ['en'],
    },
    dispatchEvent() {},
  };
  const context = vm.createContext({
    window,
    document,
    console,
    TextDecoder,
    Uint8Array,
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init?.detail || null;
    },
  });
  const assetPath = 'C:/new/apps/web-portal-standalone/public/assets/portal-i18n.js';
  vm.runInContext(fs.readFileSync(assetPath, 'utf8'), context, { filename: assetPath });
  return window.PortalUiI18n;
}

test('portal i18n resolves player server and raid workflow copy in both locales', async () => {
  const runtime = loadPortalI18nRuntime();
  runtime.init(['lang']);

  await runtime.setLocale('en', { persist: false });
  assert.equal(runtime.t('player.app.server.noneOption'), 'No server');
  assert.equal(
    runtime.t('player.app.status.switchSuccess', null, { name: 'Prime' }),
    'Now viewing Prime',
  );
  assert.equal(
    runtime.t('player.notice.lockedDetail'),
    'You can still open this page, but the current server package has not enabled the live features behind it yet.',
  );
  assert.equal(runtime.t('player.app.action.adding'), 'Adding...');
  assert.equal(
    runtime.t('player.app.error.requestFailed', null, { status: 429 }),
    'Request failed (429)',
  );

  await runtime.setLocale('th', { persist: false });
  assert.notEqual(runtime.t('player.app.server.noneOption'), 'No server');
  assert.match(runtime.t('player.app.status.switchSuccess', null, { name: 'Prime' }), /Prime/);
  assert.notEqual(runtime.t('player.app.raid.submitted'), 'Raid request submitted');
  assert.notEqual(runtime.t('player.app.action.adding'), 'Adding...');
});
