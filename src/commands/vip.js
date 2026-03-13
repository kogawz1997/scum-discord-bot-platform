const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { roles } = require('../config');
const {
  buyVipForUser,
  getVipPlan,
  getMembership,
} = require('../services/vipService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vip')
    .setDescription('ระบบ VIP')
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('ดูแพ็กเกจ VIP ทั้งหมด'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('buy')
        .setDescription('ซื้อ VIP ด้วยเหรียญ')
        .addStringOption((option) =>
          option
            .setName('plan')
            .setDescription('รหัสแพ็กเกจ VIP')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('perks').setDescription('ดูสิทธิ์ของ VIP'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('ดูสถานะ VIP ของตัวเอง'),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') return handleList(interaction);
    if (sub === 'buy') return handleBuy(interaction);
    if (sub === 'perks') return handlePerks(interaction);
    if (sub === 'status') return handleStatus(interaction);
    return interaction.reply({
      content: 'ไม่พบคำสั่งย่อย',
      flags: MessageFlags.Ephemeral,
    });
  },
};

async function handleList(interaction) {
  const plans = require('../config').vip.plans;
  const lines = plans.map(
    (plan) =>
      `รหัส: \`${plan.id}\` | **${plan.name}** | ${plan.durationDays} วัน | ราคา: ${plan.priceCoins.toLocaleString()} เหรียญ\n${plan.description}`,
  );

  const embed = new EmbedBuilder()
    .setTitle('แพ็กเกจ VIP')
    .setDescription(lines.join('\n\n'))
    .setColor(0xffd700);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleBuy(interaction) {
  const planId = interaction.options.getString('plan', true);
  const plan = getVipPlan(planId);
  if (!plan) {
    return interaction.reply({
      content: 'ไม่พบแพ็กเกจ VIP นี้ กรุณาดูรายการด้วย `/vip list` ก่อน',
      flags: MessageFlags.Ephemeral,
    });
  }

  const result = await buyVipForUser({
    userId: interaction.user.id,
    plan,
    actor: `discord:${interaction.user.id}`,
    source: '/vip buy',
  });
  if (!result.ok) {
    if (result.reason === 'insufficient-balance') {
      return interaction.reply({
        content: `เหรียญไม่พอ ต้องการ ${plan.priceCoins.toLocaleString()} เหรียญ แต่คุณมีเพียง ${Number(result.balance || 0).toLocaleString()} เหรียญ`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply({
      content: 'ไม่สามารถเปิดใช้งาน VIP ได้ในตอนนี้ ระบบคืนเหรียญให้อัตโนมัติแล้ว กรุณาลองใหม่อีกครั้ง',
      flags: MessageFlags.Ephemeral,
    });
  }

  const guild = interaction.guild;
  if (guild) {
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (member) {
      const vipRole = guild.roles.cache.find((role) => role.name === roles.vip);
      if (vipRole) {
        await member.roles.add(vipRole, `ซื้อ VIP แพ็กเกจ ${plan.name} ผ่านบอท`).catch(() => null);
      }
    }
  }

  await interaction.reply(
    `เปิดใช้งาน **${plan.name}** สำเร็จแล้ว\nหมดอายุ: <t:${Math.floor(
      result.membership.expiresAt.getTime() / 1000,
    )}:F>\nยอดคงเหลือ: **${Number(result.balance || 0).toLocaleString()}** เหรียญ`,
  );
}

async function handlePerks(interaction) {
  const lines = [
    '- คิวเข้าเซิร์ฟไวขึ้น (ตามที่เซิร์ฟเวอร์ตั้งค่า)',
    '- ยศ VIP พร้อมสีชื่อพิเศษ',
    '- ห้องคุยเฉพาะ VIP',
    '- โบนัสเหรียญรายวัน/รายสัปดาห์ตามนโยบายเซิร์ฟเวอร์',
    '- สิทธิ์หรือของตกแต่งพิเศษอื่น ๆ ตามที่ทีมงานประกาศ',
  ];

  const embed = new EmbedBuilder()
    .setTitle('สิทธิ์ของ VIP')
    .setDescription(lines.join('\n'))
    .setColor(0xffa500);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleStatus(interaction) {
  const membership = getMembership(interaction.user.id);
  if (!membership) {
    return interaction.reply({
      content: 'คุณยังไม่มี VIP ที่ใช้งานอยู่',
      flags: MessageFlags.Ephemeral,
    });
  }

  const plan = getVipPlan(membership.planId);
  const name = plan ? plan.name : membership.planId;
  await interaction.reply({
    content: `คุณมี VIP: **${name}**\nหมดอายุ: <t:${Math.floor(
      membership.expiresAt.getTime() / 1000,
    )}:F>`,
    flags: MessageFlags.Ephemeral,
  });
}
