const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeItemIconKey,
  resolveItemIconUrl,
  resolveCanonicalItemId,
} = require('./itemIconService');

const DEFAULT_WIKI_PATH = path.resolve(
  process.cwd(),
  'scum_weapons_from_wiki.json',
);

let cached = null;
let warnedMissingFile = false;

function text(value) {
  return String(value || '').trim();
}

function withUnique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildLookupKeys(rawValue) {
  const normalized = normalizeItemIconKey(rawValue);
  if (!normalized) return [];

  const keys = [normalized];
  const withoutClassSuffix = normalized.replace(/_c\d*$/i, '');
  if (withoutClassSuffix && withoutClassSuffix !== normalized) {
    keys.push(withoutClassSuffix);
  }

  if (normalized.startsWith('bp_')) {
    keys.push(normalized.replace(/^bp_+/, ''));
  }
  if (normalized.startsWith('weapon_')) {
    keys.push(normalized.replace(/^weapon_+/, ''));
  } else {
    keys.push(`weapon_${normalized}`);
  }

  return withUnique(keys);
}

function parseSpawnCommandTemplate(example, spawnId) {
  const raw = text(example);
  const targetSpawnId = text(spawnId);
  if (!raw) return '#SpawnItem {gameItemId} {quantity}';

  const tokens = raw.split(/\s+/);
  if (tokens.length === 0) return '#SpawnItem {gameItemId} {quantity}';

  const normalizedTarget = normalizeItemIconKey(targetSpawnId);
  const spawnTokenIndex = tokens.findIndex(
    (token) => normalizeItemIconKey(token) === normalizedTarget,
  );

  if (spawnTokenIndex >= 0) {
    tokens[spawnTokenIndex] = '{gameItemId}';
    const quantityIndex = tokens.findIndex(
      (token, idx) => idx > spawnTokenIndex && /^-?\d+$/.test(String(token)),
    );
    if (quantityIndex >= 0) {
      tokens[quantityIndex] = '{quantity}';
    } else if (!tokens.some((token) => token.includes('{quantity}'))) {
      tokens.push('{quantity}');
    }

    if (
      /^#spawnitem$/i.test(tokens[0])
      && !tokens.some((token) => token.includes('{steamId}'))
    ) {
      tokens.splice(1, 0, '{steamId}');
    }

    return tokens.join(' ').trim();
  }

  if (/^#spawnitem$/i.test(tokens[0])) {
    if (!tokens.some((token) => token.includes('{steamId}'))) {
      tokens.push('{steamId}');
    }
    if (!tokens.some((token) => token.includes('{gameItemId}'))) {
      tokens.push('{gameItemId}');
    }
    if (!tokens.some((token) => token.includes('{quantity}'))) {
      tokens.push('{quantity}');
    }
    return tokens.join(' ').trim();
  }

  return raw;
}

function loadCatalog() {
  const sourcePath =
    text(process.env.SCUM_WEAPON_WIKI_PATH) || DEFAULT_WIKI_PATH;
  if (!fs.existsSync(sourcePath)) {
    if (!warnedMissingFile) {
      warnedMissingFile = true;
      console.warn(
        `[wiki-weapon] missing file: ${sourcePath} (set SCUM_WEAPON_WIKI_PATH if needed)`,
      );
    }
    return {
      source: sourcePath,
      total: 0,
      byKey: new Map(),
      items: [],
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (error) {
    console.error(
      `[wiki-weapon] failed to parse ${sourcePath}:`,
      error.message,
    );
    return {
      source: sourcePath,
      total: 0,
      byKey: new Map(),
      items: [],
    };
  }

  const rows = Array.isArray(parsed) ? parsed : [];
  const byKey = new Map();
  const items = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const spawnId = text(row.spawn_id);
    const name = text(row.name);
    if (!spawnId) continue;
    const gameItemId =
      resolveCanonicalItemId({
        gameItemId: spawnId,
        id: spawnId,
        name,
      }) || spawnId;

    const item = {
      category: text(row.category) || 'unknown',
      name: name || spawnId,
      spawnId,
      gameItemId,
      spawnCommandExample: text(row.spawn_command_example) || null,
      commandTemplate: parseSpawnCommandTemplate(row.spawn_command_example, spawnId),
      iconUrl:
        resolveItemIconUrl({
          gameItemId,
          id: gameItemId,
          name,
        }) || null,
      attachments: {
        magazine: row.magazine || null,
        ammobox: row.ammobox || null,
        sight: row.sight || null,
        flashlight: row.flashlight || null,
        suppressor: row.suppressor || null,
      },
    };
    items.push(item);

    const keyCandidates = withUnique([
      ...buildLookupKeys(spawnId),
      ...buildLookupKeys(gameItemId),
      ...buildLookupKeys(name),
    ]);
    for (const key of keyCandidates) {
      if (!byKey.has(key)) {
        byKey.set(key, item);
      }
    }
  }

  return {
    source: sourcePath,
    total: items.length,
    byKey,
    items,
  };
}

function ensureLoaded() {
  if (!cached) {
    cached = loadCatalog();
  }
  return cached;
}

function resolveWikiWeaponMeta(rawValue) {
  const state = ensureLoaded();
  const keys = buildLookupKeys(rawValue);
  for (const key of keys) {
    const found = state.byKey.get(key);
    if (found) return found;
  }
  return null;
}

function resolveWikiWeaponCommandTemplate(rawValue) {
  return resolveWikiWeaponMeta(rawValue)?.commandTemplate || null;
}

function listWikiWeaponCatalog(query = '', limit = 200) {
  const state = ensureLoaded();
  const q = text(query).toLowerCase();
  const max = Math.max(1, Math.min(2000, Number(limit || 200)));
  const rows = q
    ? state.items.filter((item) => {
        const hay =
          `${item.category} ${item.name} ${item.spawnId}`.toLowerCase();
        return hay.includes(q);
      })
    : state.items;
  return rows.slice(0, max).map((item) => ({ ...item }));
}

function getWikiWeaponCatalogMeta() {
  const state = ensureLoaded();
  return {
    source: state.source,
    total: state.total,
  };
}

module.exports = {
  resolveWikiWeaponMeta,
  resolveWikiWeaponCommandTemplate,
  listWikiWeaponCatalog,
  getWikiWeaponCatalogMeta,
};
