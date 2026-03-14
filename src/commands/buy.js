const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { economy, channels } = require('../config');
const { resolveItemIconUrl } = require('../services/itemIconService');
const { findShopItemView } = require('../services/playerQueryService');
const {
  purchaseShopItemForUser,
  normalizeShopKind,
  isVipShopKind,
  isGameItemShopKind,
  buildBundleSummary,
} = require('../services/shopService');

function getDeliveryText(result) {
  if (result?.queued) {
    return '\nสถานะการส่งของ: ระบบอัตโนมัติกำลังดำเนินการ';
  }
  if (result?.reason === 'item-not-configured') {
    return '\nสถานะการส่งของ: สินค้านี้ยังไม่ได้ตั้งค่าคำสั่งส่งของอัตโนมัติ';
  }
  if (result?.reason === 'delivery-disabled') {
    return '\nสถานะการส่งของ: ปิดระบบส่งของอัตโนมัติอยู่';
  }
  return '\nสถานะการส่งของ: รอทีมงานจัดการ';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('ซื้อสินค้าจากร้านบอท')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('ชื่อสินค้า หรือรหัสสินค้า')
        .setRequired(true),
    ),

  async execute(interaction) {
    const query = interaction.options.getString('item', true);
    const item = await findShopItemView(query);

    if (!item) {
      return interaction.reply({
        content: 'ไม่พบสินค้าที่ต้องการ กรุณาตรวจสอบชื่อหรือรหัสอีกครั้ง (`/shop` เพื่อดูรายการทั้งหมด)',
        flags: MessageFlags.Ephemeral,
      });
    }

    const result = await purchaseShopItemForUser({
      userId: interaction.user.id,
      item,
      guildId: interaction.guildId || null,
      actor: `discord:${interaction.user.id}`,
      source: 'slash-buy',
    });

    if (!result.ok) {
      if (result.reason === 'steam-link-required') {
        return interaction.reply({
          content: 'ต้องผูก SteamID ก่อนซื้อสินค้าไอเทมในเกม ใช้ `/linksteam set` แล้วลองใหม่',
          flags: MessageFlags.Ephemeral,
        });
      }
      if (result.reason === 'insufficient-balance') {
        return interaction.reply({
          content: `ยอดเหรียญของคุณไม่พอ ต้องการ ${economy.currencySymbol} **${Number(item.price || 0).toLocaleString()}** แต่คุณมี ${economy.currencySymbol} **${Number(result.balance || 0).toLocaleString()}**`,
          flags: MessageFlags.Ephemeral,
        });
      }
      return interaction.reply({
        content: 'ไม่สามารถสร้างคำสั่งซื้อได้ในตอนนี้ ระบบยกเลิกและคืนเหรียญให้อัตโนมัติแล้ว กรุณาลองใหม่อีกครั้ง',
        flags: MessageFlags.Ephemeral,
      });
    }

    const { purchase, delivery } = result;
    const deliveryText = getDeliveryText(delivery);
    const kind = normalizeShopKind(item.kind);
    const isVip = isVipShopKind(kind);
    const isGameItem = isGameItemShopKind(kind);
    const bundle = buildBundleSummary(item, 5);
    const iconUrl = resolveItemIconUrl(item);

    const replyPayload = {
      content:
        `ซื้อ **${item.name}** สำเร็จ\n`
        + `ประเภท: **${kind.toUpperCase()}**\n`
        + `ราคา: ${economy.currencySymbol} **${Number(item.price || 0).toLocaleString()}**\n`
        + `${isGameItem ? `${bundle.long}\n` : isVip ? '' : 'การส่งมอบ: **ทีมงานจัดการในเกม**\n'}`
        + `โค้ดอ้างอิง: \`${purchase.code}\`${deliveryText}`,
    };

    if (iconUrl) {
      replyPayload.embeds = [
        new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle(`สินค้า: ${item.name}`)
          .setDescription(
            [
              `รหัส: \`${item.id}\``,
              `ประเภท: **${kind.toUpperCase()}**`,
              ...(isGameItem
                ? [bundle.long]
                : isVip
                  ? []
                  : ['การส่งมอบ: **ทีมงานจัดการในเกม**']),
            ].join('\n'),
          )
          .setThumbnail(iconUrl),
      ];
    }

    await interaction.reply(replyPayload);

    try {
      const guild = interaction.guild;
      if (guild) {
        const logChannel = guild.channels.cache.find(
          (channel) => channel.name === channels.shopLog,
        );
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send(
            `การซื้อ | ผู้ใช้: ${interaction.user} | สินค้า: **${item.name}** (\`${item.id}\`) | ประเภท: ${kind.toUpperCase()} | รายการ: ${isGameItem ? bundle.short : isVip ? 'VIP' : 'MANUAL'} | ราคา: ${economy.currencySymbol} **${Number(item.price || 0).toLocaleString()}** | โค้ด: \`${purchase.code}\` | ส่งอัตโนมัติ: ${delivery.queued ? 'เข้าคิวแล้ว' : delivery.reason || 'แอดมินจัดการ'}`,
          );
        }
      }
    } catch (error) {
      console.error('ส่ง log ไปช่อง shop-log ไม่สำเร็จ:', error.message);
    }
  },
};
