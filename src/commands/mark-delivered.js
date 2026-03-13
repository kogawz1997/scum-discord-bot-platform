const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { updatePurchaseStatusForActor } = require('../services/purchaseService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mark-delivered')
    .setDescription('ตั้งสถานะรายการซื้อว่าแจกแล้ว (แอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('code')
        .setDescription('โค้ดอ้างอิงรายการซื้อ')
        .setRequired(true),
    ),
  async execute(interaction) {
    const code = interaction.options.getString('code', true);
    const result = await updatePurchaseStatusForActor({
      code,
      status: 'delivered',
      actor: `discord:${interaction.user.id}`,
      reason: 'mark-delivered-command',
      meta: {
        command: 'mark-delivered',
      },
      historyLimit: 10,
    });

    if (!result.ok && result.reason === 'not-found') {
      return interaction.reply({
        content: 'ไม่พบรายการซื้อที่มีโค้ดนี้',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!result.ok && result.reason === 'transition-not-allowed') {
      return interaction.reply({
        content: 'ไม่สามารถเปลี่ยนสถานะรายการนี้เป็น delivered ได้จากสถานะปัจจุบัน',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!result.ok) {
      return interaction.reply({
        content: `ตั้งสถานะไม่สำเร็จ: ${result.error || result.reason || 'unknown-error'}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply(
      `ตั้งสถานะรายการ \`${result.purchase.code}\` เป็น **แจกแล้ว (delivered)** เรียบร้อย`,
    );
  },
};
