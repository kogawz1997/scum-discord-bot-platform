const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { economy } = require('../config');
const { getWalletSnapshot } = require('../services/playerQueryService');
const { checkRewardClaimForUser, claimRewardForUser } = require('../services/rewardService');

function msToDaysHours(ms) {
  const totalHours = Math.ceil(ms / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days <= 0) return `${hours} ชม.`;
  return `${days} วัน ${hours} ชม.`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('รับเหรียญรายสัปดาห์'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const check = await checkRewardClaimForUser({ userId, type: 'weekly' });

    if (!check.ok) {
      const wallet = await getWalletSnapshot(userId);
      return interaction.reply({
        content: `คุณรับรายสัปดาห์ไปแล้ว ตอนนี้คุณมี ${economy.currencySymbol} **${Number(wallet.balance || 0).toLocaleString()}**\nโปรดลองใหม่อีกครั้งในอีก **${msToDaysHours(check.remainingMs)}**`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const result = await claimRewardForUser({ userId, type: 'weekly' });
    if (!result.ok) {
      return interaction.reply({
        content: 'ไม่สามารถรับรายสัปดาห์ได้ กรุณาลองใหม่อีกครั้ง',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply(
      `คุณได้รับรายสัปดาห์ ${economy.currencySymbol} **${Number(result.reward || 0).toLocaleString()}**!\nยอดคงเหลือใหม่: ${economy.currencySymbol} **${Number(result.balance || 0).toLocaleString()}**`,
    );
  },
};
