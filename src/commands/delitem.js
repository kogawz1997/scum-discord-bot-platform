const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { deleteShopItemForAdmin } = require('../services/shopService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delitem')
    .setDescription('ลบสินค้าออกจากร้าน (แอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('ID หรือชื่อสินค้า')
        .setRequired(true),
    ),
  async execute(interaction) {
    const query = interaction.options.getString('item', true);
    const result = await deleteShopItemForAdmin({
      idOrName: query,
      guildId: interaction.guildId || interaction.guild?.id || null,
    });

    if (!result.ok) {
      return interaction.reply({
        content: 'ไม่พบสินค้า กรุณาตรวจสอบ ID/ชื่อ อีกครั้ง',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply(
      `ลบ **${result.item.name}** (ID: \`${result.item.id}\`) ออกจากร้านเรียบร้อยแล้ว`,
    );
  },
};
