const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getStatsSnapshot } = require('../services/playerQueryService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('ดูสถิติของคุณ (คิล/ตาย/KD/เวลาเล่น)')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('ดูสถิติของคนอื่น')
        .setRequired(false),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    if (
      target.id !== interaction.user.id
      && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      return interaction.reply({
        content: 'คุณไม่มีสิทธิ์ดูสถิติของผู้ใช้งานคนอื่น',
        flags: MessageFlags.Ephemeral,
      });
    }

    const stats = getStatsSnapshot(target.id);
    const kills = Number(stats.kills || 0);
    const deaths = Number(stats.deaths || 0);
    const playtimeMinutes = Number(stats.playtimeMinutes || 0);
    const kd = deaths === 0 ? kills : kills / deaths;

    const embed = new EmbedBuilder()
      .setTitle(`สถิติของ ${target.tag}`)
      .addFields(
        { name: 'คิล', value: `${kills}`, inline: true },
        { name: 'ตาย', value: `${deaths}`, inline: true },
        { name: 'K/D', value: kd.toFixed(2), inline: true },
        {
          name: 'เวลาเล่น',
          value: `${Math.floor(playtimeMinutes / 60)} ชม. ${playtimeMinutes % 60} นาที`,
        },
      )
      .setColor(0x00ced1);

    return interaction.reply({ embeds: [embed] });
  },
};
