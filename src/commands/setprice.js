const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { setShopItemPriceForAdmin } = require('../services/shopService');
const { economy } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setprice')
    .setDescription('ปรับราคาสินค้าในร้าน (แอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('รหัสหรือชื่อสินค้า')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('price')
        .setDescription('ราคาที่ต้องการตั้งใหม่')
        .setRequired(true)
        .setMinValue(1),
    ),
  async execute(interaction) {
    const query = interaction.options.getString('item', true);
    const price = interaction.options.getInteger('price', true);

    const result = await setShopItemPriceForAdmin({
      idOrName: query,
      price,
      guildId: interaction.guildId || interaction.guild?.id || null,
    });
    if (!result.ok) {
      return interaction.reply({
        content: 'ไม่พบสินค้า กรุณาตรวจสอบชื่อ/รหัสอีกครั้ง',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply(
      `ตั้งราคาของ **${result.item.name}** (รหัส: \`${result.item.id}\`) เป็น ${economy.currencySymbol} **${result.item.price.toLocaleString()}** แล้ว`,
    );
  },
};
