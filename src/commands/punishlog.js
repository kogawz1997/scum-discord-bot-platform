const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { getPunishmentHistory } = require('../services/playerQueryService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('punishlog')
    .setDescription('ดูประวัติการลงโทษของผู้ใช้')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('ผู้ใช้ที่ต้องการดูประวัติ')
        .setRequired(true),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const list = getPunishmentHistory(target.id);

    if (list.length === 0) {
      return interaction.reply({
        content: `${target} ยังไม่มีประวัติการลงโทษ`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const lines = list.map((entry) => {
      const when = `<t:${Math.floor(new Date(entry.createdAt).getTime() / 1000)}:R>`;
      const base = `• [${String(entry.type || '').toUpperCase()}] โดย <@${entry.staffId}> | ${when} | เหตุผล: ${entry.reason}`;
      if (entry.durationMinutes) {
        return `${base} | เวลา: ${entry.durationMinutes} นาที`;
      }
      return base;
    });

    const embed = new EmbedBuilder()
      .setTitle(`ประวัติลงโทษของ ${target.tag}`)
      .setDescription(lines.join('\n'))
      .setColor(0xcd5c5c);

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
