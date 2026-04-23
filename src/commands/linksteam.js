const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const {
  normalizeSteamIdInput,
  bindSteamLinkForUser,
  getSteamLinkByUserId,
  getSteamLinkBySteamId,
} = require('../services/linkService');

function isStaff(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linksteam')
    .setDescription('ผูก SteamID (SCUM) กับ Discord เพื่อใช้ระบบส่งของและข้อมูลผู้เล่น')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('ผูก SteamID ของคุณ (ผูกได้ครั้งเดียว)')
        .addStringOption((opt) =>
          opt
            .setName('steamid')
            .setDescription('SteamID64 ตัวเลข 15-25 หลัก')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('ชื่อในเกม (ไม่บังคับ)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('me').setDescription('ดู SteamID ที่ลิงก์กับบัญชีของคุณ'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('unset')
        .setDescription('ยกเลิกลิงก์ SteamID (ต้องให้แอดมินดำเนินการ)'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('lookup')
        .setDescription('เช็กว่า SteamID นี้ลิงก์กับใคร (ทีมงาน)')
        .addStringOption((opt) =>
          opt.setName('steamid').setDescription('SteamID64').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('setuser')
        .setDescription('ลิงก์ SteamID ให้ผู้ใช้คนอื่น (ทีมงาน)')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('ผู้ใช้ Discord').setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('steamid').setDescription('SteamID64').setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('ชื่อในเกม (ไม่บังคับ)')
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const steamIdRaw = interaction.options.getString('steamid', true);
      const steamId = normalizeSteamIdInput(steamIdRaw);
      const name = interaction.options.getString('name');

      if (!steamId) {
        return interaction.reply({
          content: 'SteamID ไม่ถูกต้อง ต้องเป็นตัวเลข 15-25 หลัก เช่น SteamID64',
          flags: MessageFlags.Ephemeral,
        });
      }

      const result = await bindSteamLinkForUser({
        userId: interaction.user.id,
        steamId,
        inGameName: name || null,
        allowReplace: false,
        allowSteamReuse: false,
        guildId: interaction.guildId || interaction.guild?.id || null,
      });

      if (!result.ok && result.reason === 'user-already-linked') {
        return interaction.reply({
          content: 'บัญชีนี้ผูก SteamID ไปแล้ว หากต้องการเปลี่ยน กรุณาติดต่อแอดมินเท่านั้น',
          flags: MessageFlags.Ephemeral,
        });
      }
      if (!result.ok && result.reason === 'steam-already-linked') {
        return interaction.reply({
          content: 'SteamID นี้ถูกลิงก์กับบัญชีอื่นแล้ว กรุณาติดต่อแอดมิน',
          flags: MessageFlags.Ephemeral,
        });
      }
      if (!result.ok) {
        return interaction.reply({
          content: 'ไม่สามารถบันทึกลิงก์ SteamID ได้ในตอนนี้ กรุณาลองใหม่',
          flags: MessageFlags.Ephemeral,
        });
      }
      if (result.alreadyLinked) {
        return interaction.reply({
          content: `คุณผูก SteamID นี้ไว้แล้ว: \`${steamId}\``,
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content:
          `ลิงก์สำเร็จ ✅\nSteamID: \`${steamId}\`\n` +
          'หมายเหตุ: ถ้าต้องการเปลี่ยน SteamID ต้องให้แอดมินดำเนินการ',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'me') {
      const link = getSteamLinkByUserId(interaction.user.id, {
        guildId: interaction.guildId || interaction.guild?.id || null,
      });
      if (!link) {
        return interaction.reply({
          content: 'คุณยังไม่ได้ลิงก์ SteamID ใช้ `/linksteam set` ก่อน',
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content:
          `SteamID ของคุณคือ: \`${link.steamId}\`` +
          (link.inGameName ? `\nชื่อในเกม: **${link.inGameName}**` : ''),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'unset') {
      return interaction.reply({
        content: 'ไม่สามารถยกเลิกหรือเปลี่ยน SteamID ด้วยตัวเองได้ กรุณาติดต่อแอดมิน',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'lookup') {
      if (!isStaff(interaction)) {
        return interaction.reply({
          content: 'คำสั่งนี้สำหรับทีมงานเท่านั้น',
          flags: MessageFlags.Ephemeral,
        });
      }

      const steamIdRaw = interaction.options.getString('steamid', true);
      const steamId = normalizeSteamIdInput(steamIdRaw);
      if (!steamId) {
        return interaction.reply({
          content: 'SteamID ไม่ถูกต้อง',
          flags: MessageFlags.Ephemeral,
        });
      }

      const link = getSteamLinkBySteamId(steamId, {
        guildId: interaction.guildId || interaction.guild?.id || null,
      });
      if (!link) {
        return interaction.reply({
          content: 'ไม่พบลิงก์นี้ในระบบ',
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: `SteamID \`${steamId}\` ลิงก์กับ: <@${link.userId}>`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'setuser') {
      if (!isStaff(interaction)) {
        return interaction.reply({
          content: 'คำสั่งนี้สำหรับทีมงานเท่านั้น',
          flags: MessageFlags.Ephemeral,
        });
      }

      const user = interaction.options.getUser('user', true);
      const steamIdRaw = interaction.options.getString('steamid', true);
      const steamId = normalizeSteamIdInput(steamIdRaw);
      const name = interaction.options.getString('name');

      if (!steamId) {
        return interaction.reply({
          content: 'SteamID ไม่ถูกต้อง ต้องเป็นตัวเลข 15-25 หลัก เช่น SteamID64',
          flags: MessageFlags.Ephemeral,
        });
      }

      const result = await bindSteamLinkForUser({
        userId: user.id,
        steamId,
        inGameName: name || null,
        allowReplace: true,
        allowSteamReuse: true,
        guildId: interaction.guildId || interaction.guild?.id || null,
      });
      if (!result.ok) {
        return interaction.reply({
          content: 'ไม่สามารถบันทึกลิงก์ SteamID ได้ในตอนนี้',
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: `ลิงก์สำเร็จ ✅\nSteamID: \`${steamId}\`\nผู้ใช้: ${user}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
