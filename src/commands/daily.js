const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { economy } = require('../config');
const { getWalletSnapshot } = require('../services/playerQueryService');
const { checkRewardClaimForUser, claimRewardForUser } = require('../services/rewardService');

function msToHoursMinutes(ms) {
  const totalMinutes = Math.ceil(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} นาที`;
  return `${hours} ชม. ${minutes} นาที`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('รับเหรียญรายวัน'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const check = await checkRewardClaimForUser({ userId, type: 'daily' });

    if (!check.ok) {
      const wallet = await getWalletSnapshot(userId);
      return interaction.reply({
        content: `คุณรับรายวันไปแล้ว วันนี้มียอด ${economy.currencySymbol} **${Number(wallet.balance || 0).toLocaleString()}**\nโปรดลองใหม่อีกครั้งในอีก **${msToHoursMinutes(check.remainingMs)}**`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const result = await claimRewardForUser({ userId, type: 'daily' });
    if (!result.ok) {
      return interaction.reply({
        content: 'ไม่สามารถรับรายวันได้ กรุณาลองใหม่อีกครั้ง',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply(
      `คุณได้รับรายวัน ${economy.currencySymbol} **${Number(result.reward || 0).toLocaleString()}**!\nยอดคงเหลือใหม่: ${economy.currencySymbol} **${Number(result.balance || 0).toLocaleString()}**`,
    );
  },
};
