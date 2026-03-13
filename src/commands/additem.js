const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { addShopItemForAdmin } = require('../services/shopService');
const { economy } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('additem')
    .setDescription('เพิ่มสินค้าใหม่เข้าร้าน (แอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('ID สินค้า เช่น vip-90d หรือ item-ak47')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('ชื่อสินค้า')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('price')
        .setDescription('ราคาสินค้า')
        .setRequired(true)
        .setMinValue(1),
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('รายละเอียดสินค้า')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('kind')
        .setDescription('ประเภทสินค้า')
        .addChoices(
          { name: 'ไอเทมในเกม', value: 'item' },
          { name: 'VIP', value: 'vip' },
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('game_item_id')
        .setDescription('รหัสไอเทมในเกม เช่น Weapon_AK47')
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('quantity')
        .setDescription('จำนวนไอเทมต่อการส่ง 1 ครั้ง ค่าเริ่มต้นคือ 1')
        .setMinValue(1)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('icon_url')
        .setDescription('ลิงก์รูปสินค้า (ไม่บังคับ)')
        .setRequired(false),
    ),

  async execute(interaction) {
    const id = interaction.options.getString('id', true);
    const name = interaction.options.getString('name', true);
    const price = interaction.options.getInteger('price', true);
    const description = interaction.options.getString('description', true);
    const kind = interaction.options.getString('kind') || 'item';
    const gameItemId = interaction.options.getString('game_item_id');
    const quantity = interaction.options.getInteger('quantity') || 1;
    const iconUrl = interaction.options.getString('icon_url');

    const result = await addShopItemForAdmin({
      id,
      name,
      price,
      description,
      kind,
      gameItemId: kind === 'item' ? gameItemId : null,
      quantity: Math.max(1, Number(quantity || 1)),
      iconUrl,
    });

    if (!result.ok) {
      const errorText = result.reason === 'game-item-required'
        ? 'สินค้าแบบไอเทมต้องระบุ game_item_id'
        : result.error || result.reason || 'unknown-error';
      return interaction.reply({
        content: `เพิ่มสินค้าไม่สำเร็จ: ${errorText}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const item = result.item;
    await interaction.reply(
      [
        'เพิ่มสินค้าใหม่เรียบร้อย:',
        `ID: \`${item.id}\``,
        `ชื่อ: **${item.name}**`,
        `ประเภท: **${item.kind || kind}**`,
        `ราคา: ${economy.currencySymbol} **${item.price.toLocaleString()}**`,
        `จำนวน: **${item.quantity || 1}**`,
        `รหัสไอเทม: \`${item.gameItemId || '-'}\``,
        item.description || '-',
      ].join('\n'),
    );
  },
};
