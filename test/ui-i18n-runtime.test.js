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

function loadI18nRuntime(assetPath, globalName) {
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
  vm.runInContext(fs.readFileSync(assetPath, 'utf8'), context, { filename: assetPath });
  return {
    api: window[globalName],
    select,
    document,
  };
}

test('admin i18n repairs mojibake in runtime translations and language labels', async () => {
  const runtime = loadI18nRuntime(
    'C:/new/src/admin/assets/admin-i18n.js',
    'AdminUiI18n',
  );

  runtime.api.init(['lang']);
  await runtime.api.setLocale('th', { persist: false });

  assert.equal(runtime.api.t('common.language'), 'ภาษา');
  assert.equal(runtime.api.t('owner.nav.runtime'), 'สถานะบริการ');
  await runtime.api.setLocale('en', { persist: false });
  assert.equal(runtime.api.t('common.roleOwner'), 'Owner');
  assert.match(runtime.select.innerHTML, /ไทย/);
  assert.match(runtime.select.innerHTML, /Español/);
});

test('portal i18n repairs mojibake in runtime translations and language labels', async () => {
  const runtime = loadI18nRuntime(
    'C:/new/apps/web-portal-standalone/public/assets/portal-i18n.js',
    'PortalUiI18n',
  );

  runtime.api.init(['lang']);
  await runtime.api.setLocale('th', { persist: false });

  assert.equal(runtime.api.t('common.language'), 'ภาษา');
  assert.equal(runtime.api.t('player.badge'), 'พอร์ทัลผู้เล่น');
  assert.match(runtime.select.innerHTML, /ไทย/);
  assert.match(runtime.select.innerHTML, /Español/);
});
