const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { listStatsSnapshots } = require('../services/playerQueryService');

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text.slice(0, width);
  return `${text}${' '.repeat(width - text.length)}`;
}

function table(headers, rows) {
  const head = headers.map((entry) => pad(entry.label, entry.width)).join(' ');
  const sep = headers.map((entry) => '-'.repeat(entry.width)).join(' ');
  const body = rows
    .map((row) => headers.map((entry) => pad(row[entry.key] ?? '', entry.width)).join(' '))
    .join('\n');
  return ['```', head, sep, body || '(ไม่มีข้อมูล)', '```'].join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('ดูอันดับสถิติผู้เล่น')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('ประเภทอันดับ')
        .setRequired(true)
        .addChoices(
          { name: 'kills', value: 'kills' },
          { name: 'kd', value: 'kd' },
          { name: 'playtime', value: 'playtime' },
        ),
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type', true);
    const all = listStatsSnapshots();

    if (all.length === 0) {
      return interaction.reply('ยังไม่มีข้อมูลสถิติในระบบ');
    }

    if (type === 'kills') {
      all.sort((a, b) => Number(b.kills || 0) - Number(a.kills || 0));
    } else if (type === 'playtime') {
      all.sort((a, b) => Number(b.playtimeMinutes || 0) - Number(a.playtimeMinutes || 0));
    } else {
      all.sort((a, b) => {
        const kdA = Number(a.deaths || 0) === 0
          ? Number(a.kills || 0)
          : Number(a.kills || 0) / Number(a.deaths || 1);
        const kdB = Number(b.deaths || 0) === 0
          ? Number(b.kills || 0)
          : Number(b.kills || 0) / Number(b.deaths || 1);
        return kdB - kdA;
      });
    }

    const rows = await Promise.all(
      all.slice(0, 25).map(async (entry, index) => {
        const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
        const name = user ? user.username : entry.userId;
        const kd = Number(entry.deaths || 0) === 0
          ? Number(entry.kills || 0)
          : Number(entry.kills || 0) / Number(entry.deaths || 1);
        return {
          rank: `[${index + 1}]`,
          kills: Number(entry.kills || 0),
          deaths: Number(entry.deaths || 0),
          kd: kd.toFixed(2),
          playtime: `${Math.floor(Number(entry.playtimeMinutes || 0) / 60)}h`,
          name,
        };
      }),
    );

    const headers = type === 'playtime'
      ? [
          { key: 'rank', label: 'อันดับ', width: 6 },
          { key: 'playtime', label: 'เวลาเล่น', width: 9 },
          { key: 'kills', label: 'คิล', width: 7 },
          { key: 'deaths', label: 'ตาย', width: 7 },
          { key: 'name', label: 'ชื่อ', width: 18 },
        ]
      : [
          { key: 'rank', label: 'อันดับ', width: 6 },
          { key: 'kills', label: 'คิล', width: 7 },
          { key: 'deaths', label: 'ตาย', width: 7 },
          { key: 'kd', label: 'K/D', width: 6 },
          { key: 'name', label: 'ชื่อ', width: 18 },
        ];

    const embed = new EmbedBuilder()
      .setTitle(
        type === 'kills'
          ? 'อันดับคิล'
          : type === 'kd'
            ? 'อันดับคิลต่อเดธ'
            : 'อันดับเวลาเล่น',
      )
      .setDescription(table(headers, rows))
      .setColor(0xffb347);

    return interaction.reply({ embeds: [embed] });
  },
};
