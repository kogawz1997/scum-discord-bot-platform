const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { roles, channels } = require('../config');
const { createPunishmentEntry } = require('../services/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('ปิดแชตผู้ใช้ชั่วคราว')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('ผู้ใช้ที่ต้องการปิดแชต')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('minutes')
        .setDescription('เวลาที่จะปิดแชต (นาที)')
        .setRequired(true)
        .setMinValue(1),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('เหตุผล')
        .setRequired(true),
    ),
  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason', true);
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: 'คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์',
        flags: MessageFlags.Ephemeral,
      });
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: 'ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์',
        flags: MessageFlags.Ephemeral,
      });
    }

    const mutedRole = guild.roles.cache.find((role) => role.name === roles.muted);
    if (!mutedRole) {
      return interaction.reply({
        content: `ไม่พบยศ "${roles.muted}" กรุณาสร้างยศก่อน`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await member.roles.add(mutedRole, `ปิดแชตโดย ${interaction.user.tag}: ${reason}`);
    createPunishmentEntry({
      userId: member.id,
      type: 'mute',
      reason,
      staffId: interaction.user.id,
      durationMinutes: minutes,
    });

    await interaction.reply(
      `🔇 ${member} ถูกปิดแชตเป็นเวลา ${minutes} นาที | เหตุผล: ${reason}`,
    );

    const logChannel = guild.channels.cache.find((channel) => channel.name === channels.adminLog);
    if (logChannel && logChannel.isTextBased && logChannel.isTextBased()) {
      await logChannel.send(
        `🔇 **ปิดแชต** | ผู้ใช้: ${member} | โดย: ${interaction.user} | ${minutes} นาที | เหตุผล: ${reason}`,
      );
    }
  },
};
