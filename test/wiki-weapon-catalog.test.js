const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const wikiModulePath = path.resolve(
  __dirname,
  '../src/services/wikiWeaponCatalog.js',
);
const iconModulePath = path.resolve(
  __dirname,
  '../src/services/itemIconService.js',
);

function freshWikiService() {
  delete require.cache[wikiModulePath];
  delete require.cache[iconModulePath];
  return require(wikiModulePath);
}

function withEnv(overrides, fn) {
  const keys = [
    'SCUM_WEAPON_WIKI_PATH',
    'SCUM_ITEMS_BASE_URL',
    'SCUM_ITEMS_INDEX_PATH',
    'SCUM_ITEMS_DIR_PATH',
  ];
  const backup = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const [key, value] of Object.entries(overrides)) {
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(backup)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    delete require.cache[wikiModulePath];
    delete require.cache[iconModulePath];
  }
}

test('wiki weapon catalog resolves command template + icon from local icon set', () =>
  withEnv({}, () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-weapons-'));
    const wikiPath = path.join(tempRoot, 'weapons.json');

    fs.writeFileSync(
      wikiPath,
      JSON.stringify(
        [
          {
            category: 'rifles',
            name: 'AK-47',
            spawn_id: 'BP_Weapon_AK47',
            spawn_command_example: '#SpawnItem BP_Weapon_AK47 1',
          },
          {
            category: 'handguns',
            name: 'SF19',
            spawn_id: 'BP_Weapon_SF19',
            spawn_command_example: '#SpawnItem BP_Weapon_SF19 1',
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    fs.writeFileSync(path.join(tempRoot, 'Weapon_AK47.webp'), 'x', 'utf8');
    fs.writeFileSync(path.join(tempRoot, 'Weapon_SF19.webp'), 'x', 'utf8');

    process.env.SCUM_WEAPON_WIKI_PATH = wikiPath;
    process.env.SCUM_ITEMS_INDEX_PATH = path.join(tempRoot, 'missing-index.json');
    process.env.SCUM_ITEMS_DIR_PATH = tempRoot;
    process.env.SCUM_ITEMS_BASE_URL = 'https://icons.example/scum-items';

    const service = freshWikiService();
    const akMeta = service.resolveWikiWeaponMeta('BP_WEAPON_AK47_C');
    assert.ok(akMeta);
    assert.equal(akMeta.spawnId, 'BP_Weapon_AK47');
    assert.equal(
      akMeta.commandTemplate,
      '#SpawnItem {steamId} {gameItemId} {quantity}',
    );
    assert.equal(
      akMeta.iconUrl,
      'https://icons.example/scum-items/Weapon_AK47.webp',
    );

    const cmd = service.resolveWikiWeaponCommandTemplate('BP_Weapon_SF19');
    assert.equal(cmd, '#SpawnItem {steamId} {gameItemId} {quantity}');

    const list = service.listWikiWeaponCatalog('sf19', 20);
    assert.equal(list.length, 1);
    assert.equal(list[0].spawnId, 'BP_Weapon_SF19');
    assert.equal(
      list[0].iconUrl,
      'https://icons.example/scum-items/Weapon_SF19.webp',
    );

    const meta = service.getWikiWeaponCatalogMeta();
    assert.equal(meta.source, wikiPath);
    assert.equal(meta.total, 2);
  }));
