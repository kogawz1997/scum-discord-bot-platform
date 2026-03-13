const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { economy } = require('../config');
const {
  createServerEvent,
  listServerEvents,
  joinServerEvent,
  startServerEvent,
  finishServerEvent,
} = require('../services/eventService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('ระบบอีเวนต์ในเซิร์ฟเวอร์')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('สร้างอีเวนต์ใหม่')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('ชื่ออีเวนต์')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('time')
            .setDescription('วันเวลาเริ่ม (ข้อความ)')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('reward')
            .setDescription('ของรางวัลหรือเหรียญ (ข้อความ)')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('ดูรายการอีเวนต์'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('join')
        .setDescription('เข้าร่วมอีเวนต์')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID อีเวนต์')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('ประกาศเริ่มอีเวนต์')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID อีเวนต์')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('สรุปผลอีเวนต์')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID อีเวนต์')
            .setRequired(true),
        )
        .addUserOption((option) =>
          option
            .setName('winner')
            .setDescription('ผู้ชนะ (ถ้ามีคนเดียว)')
            .setRequired(false),
        )
        .addIntegerOption((option) =>
          option
            .setName('coins')
            .setDescription('จำนวนเหรียญที่จะมอบให้ผู้ชนะ')
            .setRequired(false)
            .setMinValue(1),
        ),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: 'คำสั่งนี้สำหรับแอดมินเท่านั้น',
          flags: MessageFlags.Ephemeral,
        });
      }
      return handleCreate(interaction);
    }

    if (sub === 'list') return handleList(interaction);
    if (sub === 'join') return handleJoin(interaction);

    if (sub === 'start') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: 'คำสั่งนี้สำหรับแอดมินเท่านั้น',
          flags: MessageFlags.Ephemeral,
        });
      }
      return handleStart(interaction);
    }

    if (sub === 'end') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: 'คำสั่งนี้สำหรับแอดมินเท่านั้น',
          flags: MessageFlags.Ephemeral,
        });
      }
      return handleEnd(interaction);
    }

    return interaction.reply({
      content: 'ไม่พบคำสั่งย่อย',
      flags: MessageFlags.Ephemeral,
    });
  },
};

async function handleCreate(interaction) {
  const name = interaction.options.getString('name', true);
  const time = interaction.options.getString('time', true);
  const reward = interaction.options.getString('reward', true);

  const result = await createServerEvent({ name, time, reward });
  if (!result.ok) {
    return interaction.reply({
      content: 'ข้อมูลอีเวนต์ไม่ถูกต้อง',
      flags: MessageFlags.Ephemeral,
    });
  }

  const { event } = result;
  await interaction.reply(
    `สร้างอีเวนต์ใหม่แล้ว (ID: **${event.id}**)\nชื่อ: **${event.name}**\nเวลา: ${event.time}\nของรางวัล: ${event.reward}`,
  );
}

async function handleList(interaction) {
  const list = listServerEvents();
  if (list.length === 0) {
    return interaction.reply('ยังไม่มีอีเวนต์ในระบบ');
  }

  const lines = list.map(
    (event) =>
      `ID: **${event.id}** | **${event.name}** | เวลา: ${event.time} | สถานะ: ${event.status}`,
  );

  const embed = new EmbedBuilder()
    .setTitle('รายการอีเวนต์ทั้งหมด')
    .setDescription(lines.join('\n'))
    .setColor(0x8a2be2);

  await interaction.reply({ embeds: [embed] });
}

async function handleJoin(interaction) {
  const id = interaction.options.getInteger('id', true);
  const result = await joinServerEvent({ id, userId: interaction.user.id });
  if (!result.ok) {
    return interaction.reply({
      content: result.reason === 'not-found' ? 'ไม่พบอีเวนต์ที่ต้องการ' : 'ไม่สามารถเข้าร่วมอีเวนต์ได้',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.reply(
    `${interaction.user} เข้าร่วมอีเวนต์ **${result.event.name}** แล้ว`,
  );
}

async function handleStart(interaction) {
  const id = interaction.options.getInteger('id', true);
  const result = await startServerEvent({ id });
  if (!result.ok) {
    return interaction.reply({
      content: result.reason === 'not-found' ? 'ไม่พบอีเวนต์ที่ต้องการ' : 'ไม่สามารถเริ่มอีเวนต์ได้',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.reply(
    `อีเวนต์ **${result.event.name}** เริ่มแล้ว ใครจะเข้าร่วมใช้คำสั่ง \`/event join id:${result.event.id}\``,
  );
}

async function handleEnd(interaction) {
  const id = interaction.options.getInteger('id', true);
  const winner = interaction.options.getUser('winner');
  const coins = interaction.options.getInteger('coins');

  const result = await finishServerEvent({
    id,
    winnerUserId: winner?.id || null,
    coins,
    actor: `discord:${interaction.user.id}`,
  });

  if (!result.ok) {
    return interaction.reply({
      content: result.reason === 'not-found' ? 'ไม่พบอีเวนต์ที่ต้องการ' : 'ไม่สามารถปิดอีเวนต์ได้',
      flags: MessageFlags.Ephemeral,
    });
  }

  const lines = [
    `อีเวนต์ **${result.event.name}** สิ้นสุดแล้ว`,
    `ผู้เข้าร่วมทั้งหมด: **${result.participants.length}** คน`,
  ];

  if (winner) {
    if (result.rewardGranted) {
      lines.push(
        `ผู้ชนะ: ${winner} ได้รับ ${economy.currencySymbol} **${Number(result.coins || 0).toLocaleString()}**`,
      );
    } else if (Number(result.coins || 0) > 0) {
      lines.push(
        `ผู้ชนะ: ${winner} แต่แจกเหรียญไม่สำเร็จ (${result.rewardError || 'unknown-error'})`,
      );
    } else {
      lines.push(`ผู้ชนะ: ${winner}`);
    }
  }

  await interaction.reply(lines.join('\n'));
}
