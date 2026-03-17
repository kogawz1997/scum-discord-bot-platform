const { EmbedBuilder } = require('discord.js');

const { listAllStats } = require('../store/statsStore');
const { listWeaponStats } = require('../store/weaponStatsStore');
const { listTopWallets } = require('../store/memoryStore');
const { economy } = require('../config');
const {
  setTopPanelMessage,
  getTopPanelsForGuild,
  removeTopPanelMessage,
  normalizePanelType,
} = require('../store/topPanelStore');
const { publishAdminLiveUpdate } = require('./adminLiveBus');

const REFRESH_DEBOUNCE_MS = Math.max(
  300,
  Number(process.env.LEADERBOARD_PANEL_REFRESH_MS || 1200),
);

const refreshTimers = new Map(); // guildId -> timeout
const runningGuilds = new Set(); // guildId

function normalizeScopeOptions(options = {}) {
  return {
    tenantId: String(options.tenantId || '').trim() || null,
    defaultTenantId: String(options.defaultTenantId || '').trim() || null,
    env: options.env,
  };
}

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

function table(headers, rows) {
  const head = headers.map((h) => pad(h.label, h.width)).join(' ');
  const sep = headers.map((h) => '-'.repeat(h.width)).join(' ');
  const body = rows
    .map((r) => headers.map((h) => pad(r[h.key] ?? '', h.width)).join(' '))
    .join('\n');
  return ['```', head, sep, body || '(ไม่มีข้อมูล)', '```'].join('\n');
}

function resolveDisplayName(client, guild, userId) {
  const uid = String(userId || '').trim();
  if (!uid) return '-';
  const member = guild?.members?.cache?.get(uid);
  if (member?.displayName) return member.displayName;
  const user = client?.users?.cache?.get(uid);
  if (user?.username) return user.username;
  return uid;
}

function buildTopKillerEmbed(client, guildId, options = {}) {
  const guild = guildId ? client.guilds.cache.get(guildId) : null;
  const all = listAllStats(normalizeScopeOptions(options)).slice();
  all.sort((a, b) => b.kills - a.kills);

  const rows = all.slice(0, 25).map((s, i) => {
    const kd = s.deaths === 0 ? s.kills : s.kills / s.deaths;
    return {
      rank: `[${i + 1}]`,
      kills: String(s.kills),
      deaths: String(s.deaths),
      kd: kd.toFixed(2),
      name: resolveDisplayName(client, guild, s.userId),
    };
  });

  const ascii = table(
    [
      { key: 'rank', label: 'อันดับ', width: 6 },
      { key: 'kills', label: 'คิล', width: 7 },
      { key: 'deaths', label: 'ตาย', width: 7 },
      { key: 'kd', label: 'ค/ต', width: 6 },
      { key: 'name', label: 'ชื่อ', width: 20 },
    ],
    rows,
  );

  return new EmbedBuilder()
    .setTitle('🏆 อันดับการสังหาร')
    .setColor(0xff8c00)
    .setDescription(ascii)
    .setTimestamp();
}

function buildTopGunKillEmbed(options = {}) {
  const all = listWeaponStats(normalizeScopeOptions(options)).slice();
  all.sort((a, b) => b.kills - a.kills);

  const rows = all.slice(0, 20).map((w, i) => ({
    rank: `[${i + 1}]`,
    kills: String(w.kills),
    dist: `${Math.floor(w.longestDistance || 0)}m`,
    weapon: w.weapon,
    holder: w.recordHolder || '-',
  }));

  const ascii = table(
    [
      { key: 'rank', label: 'อันดับ', width: 6 },
      { key: 'kills', label: 'คิล', width: 7 },
      { key: 'dist', label: 'ระยะ', width: 7 },
      { key: 'weapon', label: 'อาวุธ', width: 16 },
      { key: 'holder', label: 'ผู้ถือสถิติ', width: 20 },
    ],
    rows,
  );

  return new EmbedBuilder()
    .setTitle('🔫 อันดับฆ่าด้วยอาวุธ')
    .setColor(0x4aa3ff)
    .setDescription(ascii)
    .setTimestamp();
}

function buildTopKdEmbed(client, guildId, options = {}) {
  const guild = guildId ? client.guilds.cache.get(guildId) : null;
  const all = listAllStats(normalizeScopeOptions(options)).slice();
  all.sort((a, b) => {
    const kdA = a.deaths === 0 ? a.kills : a.kills / a.deaths;
    const kdB = b.deaths === 0 ? b.kills : b.kills / b.deaths;
    return kdB - kdA;
  });

  const rows = all.slice(0, 25).map((s, i) => {
    const kd = s.deaths === 0 ? s.kills : s.kills / s.deaths;
    return {
      rank: `[${i + 1}]`,
      kd: kd.toFixed(2),
      kills: String(s.kills),
      deaths: String(s.deaths),
      name: resolveDisplayName(client, guild, s.userId),
    };
  });

  const ascii = table(
    [
      { key: 'rank', label: 'อันดับ', width: 6 },
      { key: 'kd', label: 'ค/ต', width: 6 },
      { key: 'kills', label: 'คิล', width: 7 },
      { key: 'deaths', label: 'ตาย', width: 7 },
      { key: 'name', label: 'ชื่อ', width: 20 },
    ],
    rows,
  );

  return new EmbedBuilder()
    .setTitle('🎯 อันดับ K/D')
    .setColor(0xf0abfc)
    .setDescription(ascii)
    .setTimestamp();
}

function buildTopPlaytimeEmbed(client, guildId, options = {}) {
  const guild = guildId ? client.guilds.cache.get(guildId) : null;
  const all = listAllStats(normalizeScopeOptions(options)).slice();
  all.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);

  const rows = all.slice(0, 25).map((s, i) => ({
    rank: `[${i + 1}]`,
    playtime: `${Math.floor((s.playtimeMinutes || 0) / 60)}ชม`,
    kills: String(s.kills),
    deaths: String(s.deaths),
    name: resolveDisplayName(client, guild, s.userId),
  }));

  const ascii = table(
    [
      { key: 'rank', label: 'อันดับ', width: 6 },
      { key: 'playtime', label: 'เวลาเล่น', width: 9 },
      { key: 'kills', label: 'คิล', width: 7 },
      { key: 'deaths', label: 'ตาย', width: 7 },
      { key: 'name', label: 'ชื่อ', width: 20 },
    ],
    rows,
  );

  return new EmbedBuilder()
    .setTitle('🕒 อันดับเวลาเล่น')
    .setColor(0x38bdf8)
    .setDescription(ascii)
    .setTimestamp();
}

async function buildTopEconomyEmbed(client, guildId, options = {}) {
  const guild = guildId ? client.guilds.cache.get(guildId) : null;
  const wallets = await listTopWallets(25, normalizeScopeOptions(options));

  const rows = wallets.map((wallet, i) => ({
    rank: `[${i + 1}]`,
    coins: Number(wallet.balance || 0).toLocaleString(),
    user: resolveDisplayName(client, guild, wallet.userId),
  }));

  const ascii = table(
    [
      { key: 'rank', label: 'อันดับ', width: 6 },
      { key: 'coins', label: 'เหรียญ', width: 12 },
      { key: 'user', label: 'ผู้ใช้', width: 22 },
    ],
    rows,
  );

  return new EmbedBuilder()
    .setTitle('💰 อันดับเศรษฐกิจ')
    .setColor(0x22c55e)
    .setDescription(
      [
        `สกุลเงิน: ${economy.currencySymbol || 'เหรียญ'}`,
        ascii,
      ].join('\n'),
    )
    .setTimestamp();
}

function registerLeaderboardPanelMessage(panelType, message, options = {}) {
  const key = normalizePanelType(panelType);
  if (!key) return null;
  if (!message?.guildId || !message?.channelId || !message?.id) return null;
  const saved = setTopPanelMessage(
    message.guildId,
    key,
    message.channelId,
    message.id,
    normalizeScopeOptions(options),
  );
  publishAdminLiveUpdate('leaderboard-register', {
    guildId: message.guildId,
    panelType: key,
    channelId: message.channelId,
    messageId: message.id,
  });
  return saved;
}

async function loadMessageByRef(client, ref) {
  if (!ref?.channelId || !ref?.messageId) return null;
  const channel =
    client.channels.cache.get(ref.channelId) ||
    (await client.channels.fetch(ref.channelId).catch(() => null));
  if (!channel || !channel.isTextBased || !channel.isTextBased()) return null;
  if (!channel.messages?.fetch) return null;
  const message = await channel.messages.fetch(ref.messageId).catch(() => null);
  return message || null;
}

async function refreshLeaderboardPanelsNow(client, guildId, reason = 'update', options = {}) {
  const gid = String(guildId || '').trim();
  if (!gid) return { ok: false, reason: 'invalid-guild-id', updated: 0 };
  if (runningGuilds.has(gid)) {
    return { ok: false, reason: 'already-running', updated: 0 };
  }
  const scopeOptions = normalizeScopeOptions(options);

  runningGuilds.add(gid);
  let updated = 0;
  try {
    const refs = getTopPanelsForGuild(gid, scopeOptions);
    const tasks = [
      { type: 'topKiller', ref: refs.topKiller },
      { type: 'topGunKill', ref: refs.topGunKill },
      { type: 'topKd', ref: refs.topKd },
      { type: 'topPlaytime', ref: refs.topPlaytime },
      { type: 'topEconomy', ref: refs.topEconomy },
    ];

    for (const task of tasks) {
      if (!task.ref) continue;
      const message = await loadMessageByRef(client, task.ref);
      if (!message) {
        removeTopPanelMessage(gid, task.type, scopeOptions);
        continue;
      }

      let embed = null;
      if (task.type === 'topKiller') {
        embed = buildTopKillerEmbed(client, gid, scopeOptions);
      } else if (task.type === 'topGunKill') {
        embed = buildTopGunKillEmbed(scopeOptions);
      } else if (task.type === 'topKd') {
        embed = buildTopKdEmbed(client, gid, scopeOptions);
      } else if (task.type === 'topPlaytime') {
        embed = buildTopPlaytimeEmbed(client, gid, scopeOptions);
      } else if (task.type === 'topEconomy') {
        embed = await buildTopEconomyEmbed(client, gid, scopeOptions);
      } else {
        continue;
      }

      try {
        await message.edit({ embeds: [embed] });
        updated += 1;
      } catch (error) {
        const code = Number(error?.code || 0);
        // Unknown Message / Missing Access / Missing Permissions
        if (code === 10008 || code === 50001 || code === 50013) {
          removeTopPanelMessage(gid, task.type, scopeOptions);
          continue;
        }
        console.error(
          `[leaderboard] แก้ไข ${task.type} ของกิลด์ ${gid} ไม่สำเร็จ:`,
          error.message || error,
        );
      }
    }

    if (updated > 0) {
      publishAdminLiveUpdate('leaderboard-refresh', {
        guildId: gid,
        reason,
        updated,
      });
    }

    return { ok: true, updated };
  } finally {
    runningGuilds.delete(gid);
  }
}

function queueLeaderboardRefreshForGuild(client, guildId, reason = 'update', options = {}) {
  const gid = String(guildId || '').trim();
  if (!gid || !client) return;
  const scopeOptions = normalizeScopeOptions(options);
  const prev = refreshTimers.get(gid);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    refreshTimers.delete(gid);
    void refreshLeaderboardPanelsNow(client, gid, reason, scopeOptions);
  }, REFRESH_DEBOUNCE_MS);
  refreshTimers.set(gid, timer);
}

function queueLeaderboardRefreshForAllGuilds(client, reason = 'update', options = {}) {
  if (!client?.guilds?.cache) return;
  for (const guildId of client.guilds.cache.keys()) {
    queueLeaderboardRefreshForGuild(client, guildId, reason, options);
  }
}

module.exports = {
  buildTopKillerEmbed,
  buildTopGunKillEmbed,
  buildTopKdEmbed,
  buildTopPlaytimeEmbed,
  buildTopEconomyEmbed,
  registerLeaderboardPanelMessage,
  refreshLeaderboardPanelsNow,
  queueLeaderboardRefreshForGuild,
  queueLeaderboardRefreshForAllGuilds,
};
