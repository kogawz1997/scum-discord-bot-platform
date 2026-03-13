const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { economy } = require('../config');
const { refundPurchaseForActor } = require('../services/purchaseService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('refund')
    .setDescription('คืนเงินหรือยกเลิกรายการซื้อ (แอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('code')
        .setDescription('โค้ดอ้างอิงการซื้อ')
        .setRequired(true),
    ),
  async execute(interaction) {
    const code = interaction.options.getString('code', true);
    const result = await refundPurchaseForActor({
      code,
      actor: `discord:${interaction.user.id}`,
      reason: 'refund-command',
      source: 'refund-command',
      meta: {
        command: 'refund',
      },
      historyLimit: 20,
    });

    if (!result.ok && result.reason === 'not-found') {
      return interaction.reply({
        content: 'ไม่พบรายการซื้อที่มีโค้ดนี้',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!result.ok && result.reason === 'already-refunded') {
      return interaction.reply({
        content: 'รายการนี้ถูกคืนเงินไปแล้วก่อนหน้านี้',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!result.ok && result.reason === 'already-delivered') {
      return interaction.reply({
        content: 'รายการนี้ถูกระบุว่าแจกของแล้ว หากจะคืนเงิน กรุณาจัดการด้วยวิธีแอดมิน',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!result.ok && result.reason === 'refund-credit-failed') {
      return interaction.reply({
        content: 'คืนเหรียญไม่สำเร็จ แม้เปลี่ยนสถานะเป็น refunded แล้ว กรุณาตรวจสอบ ledger และเติมเหรียญด้วยมือ',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!result.ok) {
      return interaction.reply({
        content: `คืนเงินไม่สำเร็จ: ${result.error || result.reason || 'unknown-error'}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply(
      `คืนเงินรายการ \`${result.purchase.code}\` เรียบร้อยแล้ว เป็นจำนวน ${economy.currencySymbol} **${Number(result.amount || 0).toLocaleString()}**`,
    );
  },
};
