const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { channels } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('รายงานผู้เล่นหรือผู้ใช้ที่ทำผิดกติกา')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('คนที่ต้องการรายงาน')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('เหตุผลหรือรายละเอียด')
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option
        .setName('evidence')
        .setDescription('แนบรูปหรือคลิปหลักฐาน (ถ้ามี)')
        .setRequired(false),
    ),
  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const evidence = interaction.options.getAttachment('evidence');
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: 'คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์',
        flags: MessageFlags.Ephemeral,
      });
    }

    const evidenceChannel = guild.channels.cache.find(
      (channel) => channel.name === channels.evidence,
    );

    const embed = new EmbedBuilder()
      .setTitle('🚨 รายงานผู้เล่น / ผู้ใช้')
      .addFields(
        { name: 'ผู้รายงาน', value: `${interaction.user} (\`${interaction.user.tag}\`)` },
        { name: 'ผู้ถูกกล่าวหา', value: `${target} (\`${target.tag}\`)` },
        { name: 'เหตุผล', value: reason },
      )
      .setColor(0xff0000)
      .setTimestamp(new Date());

    if (evidence?.url) {
      embed.addFields({
        name: 'หลักฐาน',
        value: evidence.url,
      });
    }

    if (evidenceChannel && evidenceChannel.isTextBased && evidenceChannel.isTextBased()) {
      await evidenceChannel.send({ embeds: [embed] });
    }

    await interaction.reply({
      content: 'ส่งรายงานให้ทีมงานแล้ว ขอบคุณที่ช่วยดูแลคอมมูนิตี้',
      flags: MessageFlags.Ephemeral,
    });
  },
};
