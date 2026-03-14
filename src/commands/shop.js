const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { economy } = require('../config');
const { resolveItemIconUrl } = require('../services/itemIconService');
const { listShopItemViews } = require('../services/playerQueryService');
const {
  normalizeShopKind,
  isVipShopKind,
  isGameItemShopKind,
  buildBundleSummary,
} = require('../services/shopService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('ดูสินค้าทั้งหมดในร้าน'),

  async execute(interaction) {
    const items = await listShopItemViews();
    if (items.length === 0) {
      return interaction.reply('ยังไม่มีสินค้าในร้านตอนนี้');
    }

    const lines = items.map((item) => {
      const iconUrl = resolveItemIconUrl(item);
      const iconLink = iconUrl ? `[🖼️](${iconUrl}) ` : '';
      const kind = normalizeShopKind(item.kind);
      const isVip = isVipShopKind(kind);
      const isGameItem = isGameItemShopKind(kind);
      const bundle = buildBundleSummary(item, 2);
      const metaLine = isGameItem
        ? bundle.long
        : isVip
          ? 'แพ็กเกจ: **VIP**'
          : 'การส่งมอบ: **ทีมงานจัดการในเกม**';

      return [
        `${iconLink}**${item.name}**`,
        `รหัส: \`${item.id}\``,
        `ประเภท: **${kind.toUpperCase()}**`,
        `ราคา: ${economy.currencySymbol} **${Number(item.price || 0).toLocaleString()}**`,
        metaLine,
        item.description || '-',
      ].join('\n');
    });

    const embed = new EmbedBuilder()
      .setTitle('ร้านค้า')
      .setDescription(lines.join('\n\n').slice(0, 4096))
      .setColor(0xffa500);

    return interaction.reply({ embeds: [embed] });
  },
};
