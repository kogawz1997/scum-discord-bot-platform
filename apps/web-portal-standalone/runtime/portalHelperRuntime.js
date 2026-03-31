'use strict';

const { URL } = require('node:url');

function asInt(raw, fallback, min, max) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function envBool(name, fallback = false) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function normalizeSameSite(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'strict') return 'Strict';
  if (raw === 'none') return 'None';
  return 'Lax';
}

function normalizeCookiePath(value, fallback = '/') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (!text.startsWith('/')) return fallback;
  return text;
}

function normalizeCookieDomain(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/[;\s]/.test(text)) return '';
  return text;
}

function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'player') return 'player';
  return 'player';
}

function parseCsvSet(value) {
  const out = new Set();
  for (const item of String(value || '').split(',')) {
    const text = item.trim();
    if (text) out.add(text);
  }
  return out;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeAmount(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeQuantity(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
}

function normalizeHttpUrl(value) {
  const text = normalizeText(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isDiscordId(value) {
  // Accept legacy 14-digit IDs that already exist in local/prototype datasets,
  // while still requiring a numeric snowflake-like shape.
  return /^\d{14,25}$/.test(String(value || '').trim());
}

function buildDiscordAvatarUrl(profile = {}) {
  const userId = normalizeText(profile.id);
  const avatarHash = normalizeText(profile.avatar);
  if (!isDiscordId(userId)) return null;
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(
    userId,
  )}/${encodeURIComponent(avatarHash)}.${ext}?size=256`;
}

function createPortalHelperRuntime(options = {}) {
  function getMapPortalConfig() {
    const serverInfo = options.config?.serverInfo || {};
    const externalUrl = normalizeHttpUrl(
      process.env.WEB_PORTAL_MAP_EXTERNAL_URL
        || process.env.WEB_PORTAL_MAP_URL
        || serverInfo.mapUrl
        || options.defaultMapPortalUrl,
    );
    const embedEnabled = envBool('WEB_PORTAL_MAP_EMBED_ENABLED', true);
    const embedUrl = embedEnabled
      ? normalizeHttpUrl(
          process.env.WEB_PORTAL_MAP_EMBED_URL
            || serverInfo.mapEmbedUrl
            || externalUrl
            || options.defaultMapPortalUrl,
        )
      : null;
    return {
      enabled: Boolean(externalUrl || embedUrl),
      embedEnabled: Boolean(embedEnabled && embedUrl),
      embedUrl: embedUrl || null,
      externalUrl: externalUrl || embedUrl || options.defaultMapPortalUrl,
    };
  }

  function getFrameSrcOrigins() {
    const origins = new Set();
    const mapConfig = getMapPortalConfig();
    if (mapConfig.embedUrl) {
      try {
        origins.add(new URL(mapConfig.embedUrl).origin);
      } catch {
        // ignore invalid map URL
      }
    }
    return Array.from(origins);
  }

  function getEconomyConfig() {
    const economy = options.config?.economy || {};
    return {
      currencySymbol: String(economy.currencySymbol || 'Coins'),
      dailyReward: normalizeAmount(economy.dailyReward, 0),
      weeklyReward: normalizeAmount(economy.weeklyReward, 0),
    };
  }

  async function readRawBody(req, maxBytes) {
    const limit = Math.max(1024, Number(maxBytes || 1024 * 1024));
    return new Promise((resolve, reject) => {
      const chunks = [];
      let bytes = 0;
      let tooLarge = false;

      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > limit) {
          tooLarge = true;
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (tooLarge) {
          const err = new Error('Payload too large');
          err.statusCode = 413;
          reject(err);
          return;
        }
        resolve(Buffer.concat(chunks));
      });

      req.on('error', reject);
      req.on('aborted', () => reject(new Error('Request aborted')));
    });
  }

  async function readJsonBody(req) {
    const buf = await readRawBody(req, 1024 * 1024);
    if (!buf || buf.length === 0) return {};
    try {
      return JSON.parse(buf.toString('utf8'));
    } catch {
      const error = new Error('Invalid JSON body');
      error.statusCode = 400;
      throw error;
    }
  }

  function filterShopItems(rows, runtimeOptions = {}) {
    const kindFilter = normalizeText(runtimeOptions.kind).toLowerCase();
    const query = normalizeText(runtimeOptions.q).toLowerCase();
    const limit = Math.max(1, Math.min(1000, Number(runtimeOptions.limit || 120)));
    const out = [];

    for (const row of Array.isArray(rows) ? rows : []) {
      const kind = normalizeText(row?.kind).toLowerCase() === 'vip' ? 'vip' : 'item';
      if (kindFilter && kindFilter !== 'all' && kind !== kindFilter) continue;

      const haystack = [
        row?.id,
        row?.name,
        row?.description,
        row?.gameItemId,
      ]
        .map((value) => normalizeText(value).toLowerCase())
        .join(' ');
      if (query && !haystack.includes(query)) continue;

      const requiresSteamLink = options.isGameItemShopKind(kind);
      out.push({
        ...row,
        kind,
        iconUrl: normalizeText(row?.iconUrl) || options.resolveItemIconUrl(row),
        stock: row?.stock == null ? null : normalizeAmount(row.stock, 0),
        requiresSteamLink,
      });
      if (out.length >= limit) break;
    }

    return out;
  }

  function serializeCartResolved(resolved) {
    const rows = Array.isArray(resolved?.rows) ? resolved.rows : [];
    return {
      rows: rows.map((row) => ({
        itemId: row.itemId,
        quantity: normalizeQuantity(row.quantity, 1),
        lineTotal: normalizeAmount(row.lineTotal, 0),
        item: row.item
          ? {
              id: row.item.id,
              name: row.item.name,
              price: normalizeAmount(row.item.price, 0),
              kind: options.normalizeShopKind(row.item.kind),
              description: normalizeText(row.item.description),
              iconUrl: normalizeText(row.item.iconUrl) || options.resolveItemIconUrl(row.item),
              bundle: options.buildBundleSummary(row.item),
              stock: row.item.stock == null ? null : normalizeAmount(row.item.stock, 0),
              requiresSteamLink: options.isGameItemShopKind(row.item.kind),
            }
          : null,
      })),
      missingItemIds: Array.isArray(resolved?.missingItemIds) ? resolved.missingItemIds : [],
      totalPrice: normalizeAmount(resolved?.totalPrice, 0),
      totalUnits: normalizeAmount(resolved?.totalUnits, 0),
    };
  }

  async function buildPlayerNameLookup(runtimeOptions = {}) {
    const rows = await options.listPlayerAccounts(2000, runtimeOptions).catch(() => []);
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const discordId = normalizeText(row?.discordId);
      if (!isDiscordId(discordId)) continue;
      const display = [
        normalizeText(row?.displayName),
        normalizeText(row?.username),
        discordId,
      ].find(Boolean) || discordId;
      map.set(discordId, display);
    }
    return map;
  }

  function normalizeSquadName(value) {
    const name = normalizeText(value);
    return name || null;
  }

  async function resolvePartyContext(discordId, runtimeOptions = {}) {
    const userId = normalizeText(discordId);
    const statsRows = options.listAllStats(runtimeOptions);
    const rows = Array.isArray(statsRows) ? statsRows : [];
    const statsByUser = new Map();
    for (const row of rows) {
      const id = normalizeText(row?.userId);
      if (!id) continue;
      statsByUser.set(id, row);
    }
    const selfStat = statsByUser.get(userId) || null;
    const selfSquad = normalizeSquadName(selfStat?.squad);

    const nameMap = await buildPlayerNameLookup(runtimeOptions);
    const memberIds = new Set([userId]);
    let partyKey = null;
    let source = 'none';
    let title = 'ยังไม่เข้าปาร์ตี้';
    let chatEnabled = false;

    if (selfSquad) {
      const squadKey = selfSquad.toLowerCase();
      partyKey =
        options.normalizePartyKey(`squad:${squadKey}`)
        || options.normalizePartyKey(`squad:${squadKey.replace(/[^a-z0-9_-]/g, '')}`);
      source = 'stats.squad';
      title = `ปาร์ตี้ ${selfSquad}`;
      chatEnabled = Boolean(partyKey);
      for (const row of rows) {
        const rowUserId = normalizeText(row?.userId);
        if (!rowUserId) continue;
        const rowSquad = normalizeSquadName(row?.squad);
        if (!rowSquad) continue;
        if (rowSquad.toLowerCase() !== squadKey) continue;
        memberIds.add(rowUserId);
      }
    }

    const members = Array.from(memberIds)
      .map((id) => {
        const stat = statsByUser.get(id);
        const link = options.getLinkByUserId(id, runtimeOptions);
        return {
          discordId: id,
          displayName: nameMap.get(id) || id,
          steamId: normalizeText(link?.steamId) || null,
          inGameName: normalizeText(link?.inGameName) || null,
          squad: normalizeSquadName(stat?.squad),
          isSelf: id === userId,
        };
      })
      .sort((left, right) => {
        if (left.isSelf && !right.isSelf) return -1;
        if (!left.isSelf && right.isSelf) return 1;
        return String(left.displayName).localeCompare(String(right.displayName), 'th');
      });

    return {
      partyKey,
      squad: selfSquad,
      title,
      source,
      chatEnabled,
      memberCount: members.length,
      members,
    };
  }

  function sortLeaderboardRows(rows, type) {
    if (type === 'playtime') {
      rows.sort((left, right) => right.playtimeMinutes - left.playtimeMinutes);
      return;
    }
    if (type === 'kd') {
      rows.sort((left, right) => right.kd - left.kd);
      return;
    }
    rows.sort((left, right) => right.kills - left.kills);
  }

  function getPortalRuntimeSettings() {
    return options.buildPortalRuntimeSettings(options.getRuntimeSettingsInput());
  }

  function buildHealthPayload() {
    return options.buildPortalHealthPayload(getPortalRuntimeSettings());
  }

  function printStartupHints() {
    return options.printPortalStartupHints(getPortalRuntimeSettings(), options.logger || console);
  }

  return {
    buildHealthPayload,
    buildPlayerNameLookup,
    filterShopItems,
    getEconomyConfig,
    getFrameSrcOrigins,
    getMapPortalConfig,
    getPortalRuntimeSettings,
    printStartupHints,
    readJsonBody,
    readRawBody,
    resolvePartyContext,
    serializeCartResolved,
    sortLeaderboardRows,
  };
}

module.exports = {
  asInt,
  buildDiscordAvatarUrl,
  createPortalHelperRuntime,
  envBool,
  escapeHtml,
  isDiscordId,
  normalizeAmount,
  normalizeCookieDomain,
  normalizeCookiePath,
  normalizeHttpUrl,
  normalizeMode,
  normalizeQuantity,
  normalizeSameSite,
  normalizeText,
  parseCsvSet,
};
