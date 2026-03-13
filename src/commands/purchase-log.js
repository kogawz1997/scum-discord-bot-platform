const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
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
    .setName('purchase-log')
    .setDescription('ดูประวัติการซื้อของผู้ใช้งาน (แอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('ผู้ใช้งานเป้าหมาย')
        .setRequired(true),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const rows = await listResolvedPurchasesForUser(target.id);

    if (rows.length === 0) {
      return interaction.reply({
        content: `${target} ไม่มีประวัติการซื้อ`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const lines = rows.map(({ purchase, item, iconUrl }) => {
      const name = item ? item.name : purchase.itemId;
      const iconLink = iconUrl ? `[🖼️](${iconUrl}) ` : '';
      return `${statusEmoji(purchase.status)} ${iconLink}**${name}** | ราคา ${economy.currencySymbol} **${Number(purchase.price || 0).toLocaleString()}** | โค้ด: \`${purchase.code}\``;
    });

    const embed = new EmbedBuilder()
      .setTitle(`ประวัติการซื้อ | ${target.tag}`)
      .setDescription(lines.join('\n').slice(0, 4096))
      .setColor(0x708090);

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
