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

test('wiki weapon catalog exposes canonical gameItemId from local icon index', () =>
  withEnv({}, () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-weapons-canonical-'));
    const wikiPath = path.join(tempRoot, 'weapons.json');
    const indexPath = path.join(tempRoot, 'index.json');

    fs.writeFileSync(
      wikiPath,
      JSON.stringify(
        [
          {
            category: 'handguns',
            name: 'M1911',
            spawn_id: 'BPC_Weapon_M1911',
            spawn_command_example: '#SpawnItem BPC_Weapon_M1911 1',
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    fs.writeFileSync(
      indexPath,
      JSON.stringify(
        {
          repository: {
            base_url: 'https://icons.example/scum-items/',
          },
          items: [
            {
              filename: 'Weapon_M1911.webp',
              name: 'Weapon_M1911',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    process.env.SCUM_WEAPON_WIKI_PATH = wikiPath;
    process.env.SCUM_ITEMS_INDEX_PATH = indexPath;
    process.env.SCUM_ITEMS_DIR_PATH = tempRoot;
    process.env.SCUM_ITEMS_BASE_URL = 'https://icons.example/scum-items/';

    const service = freshWikiService();
    const meta = service.resolveWikiWeaponMeta('BPC_Weapon_M1911');

    assert.ok(meta);
    assert.equal(meta.spawnId, 'BPC_Weapon_M1911');
    assert.equal(meta.gameItemId, 'Weapon_M1911');
    assert.equal(
      meta.iconUrl,
      'https://icons.example/scum-items/Weapon_M1911.webp',
    );

    const byCanonical = service.resolveWikiWeaponMeta('Weapon_M1911');
    assert.ok(byCanonical);
    assert.equal(byCanonical.gameItemId, 'Weapon_M1911');
  }));
