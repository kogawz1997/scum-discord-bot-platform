const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { serverInfo } = require('../config');
const { getScumStatusSnapshot } = require('../services/playerQueryService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('online')
    .setDescription('ดูจำนวนผู้เล่นออนไลน์บนเซิร์ฟเวอร์ SCUM'),

  async execute(interaction) {
    const status = getScumStatusSnapshot();

    const embed = new EmbedBuilder()
      .setTitle(`สถานะเซิร์ฟเวอร์ ${serverInfo.name}`)
      .setDescription(
        [
          `ผู้เล่นออนไลน์: **${Number(status.onlinePlayers || 0)}/${Number(status.maxPlayers || 0)}**`,
          status.pingMs != null ? `ping: **${Number(status.pingMs)} ms**` : null,
          status.uptimeMinutes != null
            ? `uptime: **${Math.floor(Number(status.uptimeMinutes || 0))} นาที**`
            : null,
          status.lastUpdated
            ? `อัปเดตล่าสุด: <t:${Math.floor(new Date(status.lastUpdated).getTime() / 1000)}:R>`
            : 'ยังไม่เคยได้รับสถานะจากเซิร์ฟเวอร์ภายนอก',
        ].filter(Boolean).join('\n'),
      )
      .setColor(0x00ff7f);

    return interaction.reply({ embeds: [embed] });
  },
};
