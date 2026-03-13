const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { economy } = require('../config');
const { getWalletSnapshot } = require('../services/playerQueryService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('ดูจำนวนเหรียญของคุณ')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('ดูยอดของผู้ใช้คนอื่น')
        .setRequired(false),
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') ?? interaction.user;

    if (
      targetUser.id !== interaction.user.id
      && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      return interaction.reply({
        content: 'คุณไม่มีสิทธิ์ดูยอดของผู้ใช้งานคนอื่น',
        flags: MessageFlags.Ephemeral,
      });
    }

    const wallet = await getWalletSnapshot(targetUser.id);
    return interaction.reply(
      `${targetUser} มี ${economy.currencySymbol} **${Number(wallet.balance || 0).toLocaleString()}** เหรียญ`,
    );
  },
};
