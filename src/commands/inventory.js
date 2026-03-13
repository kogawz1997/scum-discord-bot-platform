const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { economy } = require('../config');
const { listResolvedPurchasesForUser } = require('../services/playerQueryService');

function statusEmoji(status) {
  if (status === 'delivered') return '✅';
  if (status === 'refunded') return '↩️';
  if (status === 'delivery_failed') return '❌';
  if (status === 'delivering') return '🚚';
  return '⏳';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('ดูประวัติการซื้อของคุณ'),

  async execute(interaction) {
    const rows = await listResolvedPurchasesForUser(interaction.user.id);
    if (rows.length === 0) {
      return interaction.reply({
        content: 'ไม่พบประวัติการซื้อสำหรับบัญชีของคุณ',
        flags: MessageFlags.Ephemeral,
      });
    }

    const lines = rows.map(({ purchase, item, iconUrl }) => {
      const name = item ? item.name : purchase.itemId;
      const iconLink = iconUrl ? `[🖼️](${iconUrl}) ` : '';
      return `${statusEmoji(purchase.status)} ${iconLink}**${name}** | ราคา ${economy.currencySymbol} **${Number(purchase.price || 0).toLocaleString()}** | โค้ด: \`${purchase.code}\``;
    });

    const embed = new EmbedBuilder()
      .setTitle('ประวัติการซื้อของคุณ')
      .setDescription(lines.join('\n').slice(0, 4096))
      .setColor(0x00bfff);

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
