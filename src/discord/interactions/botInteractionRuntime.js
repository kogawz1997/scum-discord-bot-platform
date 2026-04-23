/**
 * Discord interaction runtime for panel buttons, modals, and slash commands.
 * Keeps the bot entrypoint focused on bootstrap and service composition.
 */

const crypto = require('node:crypto');
const {
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');

function hasTicketCreatePermissions(guild, parent) {
  const me = guild.members.me;
  if (!me) return false;
  const required = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
  ];
  const perms = parent ? parent.permissionsFor(me) : me.permissions;
  return perms?.has(required);
}

function createOpenTicketHandler(deps) {
  const {
    channels,
    roles,
    createSupportTicket,
    findOpenTicketForUserInGuild,
  } = deps;

  return async function openTicketFromPanel(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({
        content: 'คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น',
        flags: MessageFlags.Ephemeral,
      });
    }

    const existing = findOpenTicketForUserInGuild({
      guildId: guild.id,
      userId: interaction.user.id,
    });

    if (existing) {
      return interaction.reply({
        content: `คุณมีทิคเก็ตที่ยังเปิดอยู่แล้ว: <#${existing.channelId}>`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const ticketsHubChannel = guild.channels.cache.find(
      (channel) => channel.name === channels.ticketsHub,
    );
    const parent =
      ticketsHubChannel && ticketsHubChannel.parent
        ? ticketsHubChannel.parent
        : null;

    if (!hasTicketCreatePermissions(guild, parent)) {
      return interaction.reply({
        content:
          'บอทไม่มีสิทธิ์พอสำหรับสร้างทิคเก็ต (ต้องมีสิทธิ์ ดูช่อง, ส่งข้อความ, จัดการช่อง, จัดการยศ)',
        flags: MessageFlags.Ephemeral,
      });
    }

    const channelName = `ticket-${interaction.user.username.toLowerCase()}-${
      crypto.randomInt(1, 10000)
    }`;

    const overwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    const staffRoleNames = Object.values(roles).filter((roleName) =>
      ['Owner', 'Admin', 'Moderator', 'Helper'].includes(roleName),
    );
    for (const roleName of staffRoleNames) {
      const role = guild.roles.cache.find((entry) => entry.name === roleName);
      if (role) {
        overwrites.push({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        });
      }
    }

    let newChannel;
    try {
      newChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parent ?? undefined,
        permissionOverwrites: overwrites,
        topic: `ทิคเก็ตของ ${interaction.user.tag} | หมวด: ช่วยเหลือ`,
      });
    } catch (error) {
      if (error && error.code === 50013) {
        return interaction.reply({
          content:
            'สร้างทิคเก็ตไม่สำเร็จ เพราะบอทยังไม่มีสิทธิ์ในเซิร์ฟเวอร์/หมวดนี้ กรุณาให้สิทธิ์จัดการช่องและจัดการยศ แล้วลองใหม่',
          flags: MessageFlags.Ephemeral,
        });
      }
      throw error;
    }

    const ticketResult = createSupportTicket({
      guildId: guild.id,
      userId: interaction.user.id,
      channelId: newChannel.id,
      category: 'ช่วยเหลือ',
      reason: 'เปิดจากแพเนลทิคเก็ต',
    });
    if (!ticketResult.ok) {
      return interaction.reply({
        content: 'บันทึกข้อมูลทิคเก็ตลงระบบไม่สำเร็จ',
        flags: MessageFlags.Ephemeral,
      });
    }

    await newChannel.send(
      `สวัสดี ${interaction.user}
ทีมงานจะเข้ามาดูแลโดยเร็วที่สุด กรุณาอธิบายปัญหา/คำถามของคุณ`,
    );

    return interaction.reply({
      content: `เปิดทิคเก็ตสำเร็จ: ${newChannel}`,
      flags: MessageFlags.Ephemeral,
    });
  };
}

function createInteractionHandler(deps) {
  const {
    config,
    channels,
    roles,
    economy,
    openTicketFromPanel,
    queueLeaderboardRefreshForGuild,
    claimWelcomePackForUser,
    getShopItemViewById,
    purchaseShopItemForUser,
    normalizeShopKind,
    buildBundleSummary,
    addItemToCartForUser,
    getResolvedCart,
    checkoutCart,
    normalizeSteamIdInput,
    bindSteamLinkForUser,
    upsertPlayerAccount,
    enterGiveawayForUser,
    getMemberCommandAccessRole,
    getRequiredCommandAccessRole,
    hasCommandAccessAtLeast,
  } = deps;

  return async function handleInteractionCreate(interaction) {
    try {
      if (interaction?.user?.id) {
        const avatarUrl =
          typeof interaction.user.displayAvatarURL === 'function'
            ? interaction.user.displayAvatarURL({
                extension: 'png',
                size: 128,
              })
            : null;
        void upsertPlayerAccount({
          discordId: interaction.user.id,
          username: interaction.user.username,
          displayName:
            interaction.user.globalName
            || interaction.member?.displayName
            || interaction.user.username,
          avatarUrl,
          isActive: true,
        }).catch(() => null);
      }

      if (interaction.isModalSubmit?.() && interaction.customId === 'panel-verify-modal') {
        const steamIdRaw = interaction.fields.getTextInputValue('steamid');
        const steamId = normalizeSteamIdInput(steamIdRaw);

        if (!steamId) {
          return interaction.reply({
            content: 'SteamID ไม่ถูกต้อง (ต้องเป็นตัวเลข SteamID64)',
            flags: MessageFlags.Ephemeral,
          });
        }

        const result = await bindSteamLinkForUser({
          steamId,
          userId: interaction.user.id,
          inGameName: null,
          allowReplace: false,
          allowSteamReuse: false,
          guildId: interaction.guildId || interaction.guild?.id || null,
        });

        if (!result.ok && result.reason === 'steam-already-linked') {
          return interaction.reply({
            content: 'SteamID นี้ถูกลิงก์กับบัญชีอื่นแล้ว กรุณาติดต่อแอดมิน',
            flags: MessageFlags.Ephemeral,
          });
        }
        if (!result.ok && result.reason === 'user-already-linked') {
          return interaction.reply({
            content: 'บัญชีนี้ผูก SteamID ไปแล้ว หากต้องการเปลี่ยนกรุณาติดต่อแอดมิน',
            flags: MessageFlags.Ephemeral,
          });
        }
        if (result.alreadyLinked) {
          return interaction.reply({
            content: `คุณผูก SteamID นี้ไว้แล้ว: \`${steamId}\``,
            flags: MessageFlags.Ephemeral,
          });
        }
        if (!result.ok) {
          return interaction.reply({
            content: 'ไม่สามารถยืนยัน SteamID ได้ในตอนนี้ กรุณาลองใหม่',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.guild && interaction.member) {
          const verifiedRole = interaction.guild.roles.cache.find(
            (role) => role.name === roles.verified,
          );
          if (verifiedRole && !interaction.member.roles.cache.has(verifiedRole.id)) {
            await interaction.member.roles
              .add(verifiedRole, 'ยืนยัน Steam ID แล้ว')
              .catch(() => null);
          }
        }

        return interaction.reply({
          content: `ยืนยันสำเร็จ! SteamID: \`${steamId}\``,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.isButton?.()) {
        if (interaction.customId === 'giveaway-join') {
          const result = enterGiveawayForUser({
            messageId: interaction.message.id,
            userId: interaction.user.id,
          });
          if (!result.ok && (result.reason === 'not-found' || result.reason === 'expired')) {
            return interaction.reply({
              content: 'กิจกรรมแจกของนี้หมดอายุหรือไม่พบในระบบ',
              flags: MessageFlags.Ephemeral,
            });
          }
          if (!result.ok) {
            return interaction.reply({
              content: 'ไม่สามารถเข้าร่วมกิจกรรมนี้ได้ในตอนนี้',
              flags: MessageFlags.Ephemeral,
            });
          }
          if (result.alreadyJoined) {
            return interaction.reply({
              content: 'คุณเข้าร่วมกิจกรรมนี้ไว้แล้ว',
              flags: MessageFlags.Ephemeral,
            });
          }
          return interaction.reply({
            content: 'เข้าร่วมกิจกรรมแจกของสำเร็จ!',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.customId === 'panel-ticket-open') {
          return openTicketFromPanel(interaction);
        }

        if (interaction.customId === 'panel-verify-open') {
          const modal = new ModalBuilder()
            .setCustomId('panel-verify-modal')
            .setTitle('ยืนยัน Steam ID');
          const steamInput = new TextInputBuilder()
            .setCustomId('steamid')
            .setLabel('SteamID64')
            .setPlaceholder('เช่น 7656119xxxxxxxxxx')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(15)
            .setMaxLength(25);
          const row = new ActionRowBuilder().addComponents(steamInput);
          modal.addComponents(row);
          return interaction.showModal(modal);
        }

        if (interaction.customId === 'panel-welcome-claim') {
          const claimResult = await claimWelcomePackForUser({
            userId: interaction.user.id,
            amount: 1500,
            actor: `discord:${interaction.user.id}`,
            source: 'panel-welcome-claim',
          });
          if (!claimResult.ok) {
            const content = claimResult.reason === 'already-claimed'
              ? 'คุณรับแพ็กต้อนรับไปแล้ว (รับได้ 1 ครั้งต่อบัญชี)'
              : 'ระบบรับแพ็กต้อนรับล้มเหลว กรุณาลองใหม่อีกครั้ง';
            return interaction.reply({ content, flags: MessageFlags.Ephemeral });
          }
          queueLeaderboardRefreshForGuild(interaction.client, interaction.guildId, 'welcome-claim');
          return interaction.reply({
            content: `รับแพ็กต้อนรับสำเร็จ! ได้รับ 1,500 เหรียญ\nยอดคงเหลือใหม่: ${claimResult.balance.toLocaleString()} เหรียญ`,
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.customId === 'panel-welcome-refer') {
          return interaction.reply({
            content: 'ชวนเพื่อนเข้าดิสคอร์ด ให้เพื่อนกดรับแพ็กต้อนรับ แล้วแจ้งแอดมินเพื่อรับโบนัสแนะนำเพื่อน',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.customId === 'panel-quick-daily') {
          return interaction.reply({
            content: 'ใช้ `/daily` เพื่อรับของรายวันได้เลย',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.customId === 'panel-quick-server') {
          return interaction.reply({
            content: 'ใช้ `/server` เพื่อดูข้อมูลเซิร์ฟเวอร์ทั้งหมด',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.customId === 'panel-quick-stats') {
          return interaction.reply({
            content: 'ใช้ `/stats` หรือ `/top type:kills` เพื่อดูอันดับผู้เล่น',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.customId.startsWith('panel-shop-buy:')) {
          const itemId = interaction.customId.split(':')[1];
          const item = await getShopItemViewById(itemId);
          if (!item) {
            return interaction.reply({
              content: `ไม่พบสินค้า: ${itemId}`,
              flags: MessageFlags.Ephemeral,
            });
          }

          const result = await purchaseShopItemForUser({
            userId: interaction.user.id,
            item,
            guildId: interaction.guildId || null,
            actor: `discord:${interaction.user.id}`,
            source: 'panel-shop-buy',
          });
          if (!result.ok) {
            if (result.reason === 'steam-link-required') {
              return interaction.reply({
                content: 'ต้องผูก SteamID ก่อนซื้อสินค้าไอเทมในเกม ใช้ `/linksteam set` ก่อนแล้วค่อยลองใหม่',
                flags: MessageFlags.Ephemeral,
              });
            }
            if (result.reason === 'insufficient-balance') {
              return interaction.reply({
                content: `ยอดเหรียญของคุณไม่พอ ต้องการ ${economy.currencySymbol} **${item.price.toLocaleString()}** แต่คุณมีเพียง ${economy.currencySymbol} **${Number(result.balance || 0).toLocaleString()}**`,
                flags: MessageFlags.Ephemeral,
              });
            }
            return interaction.reply({
              content: 'ไม่สามารถสร้างคำสั่งซื้อได้ในตอนนี้ ระบบยกเลิกและคืนเหรียญให้อัตโนมัติแล้ว กรุณาลองใหม่อีกครั้ง',
              flags: MessageFlags.Ephemeral,
            });
          }

          queueLeaderboardRefreshForGuild(interaction.client, interaction.guildId, 'panel-shop-buy');
          const { purchase, delivery } = result;
          const kind = normalizeShopKind(item.kind);
          const bundle = buildBundleSummary(item, 4);

          let deliveryText = '\nสถานะการส่งของ: รอทีมงานจัดการ (ทำด้วยแอดมิน)';
          if (delivery.queued) {
            deliveryText = '\nสถานะการส่งของ: ระบบอัตโนมัติกำลังดำเนินการ (คิว RCON)';
          } else if (delivery.reason === 'item-not-configured') {
            deliveryText = '\nสถานะการส่งของ: สินค้านี้ยังไม่ตั้งคำสั่ง RCON (ทำด้วยแอดมิน)';
          } else if (delivery.reason === 'delivery-disabled') {
            deliveryText = '\nสถานะการส่งของ: ปิดระบบส่งของอัตโนมัติอยู่ (ทำด้วยแอดมิน)';
          }

          try {
            const guild = interaction.guild;
            if (guild) {
              const logChannel = guild.channels.cache.find(
                (channel) => channel.name === channels.shopLog,
              );
              if (logChannel && logChannel.isTextBased()) {
                await logChannel.send(
                  `🛒 **การซื้อ** | ผู้ใช้: ${interaction.user} | สินค้า: **${item.name}** (รหัส: \`${item.id}\`) | ราคา: ${economy.currencySymbol} **${item.price.toLocaleString()}** | โค้ด: \`${purchase.code}\` | สถานะส่งอัตโนมัติ: ${
                    delivery.queued ? 'เข้าคิวแล้ว' : delivery.reason || 'ทำด้วยแอดมิน'
                  } | ประเภท: ${kind.toUpperCase()} | รายการ: ${kind === 'item' ? bundle.short : 'VIP'}`,
                );
              }
            }
          } catch (error) {
            console.error('ไม่สามารถส่งบันทึกไปยังช่อง shop-log ได้', error);
          }

          return interaction.reply({
            content: `คุณซื้อ **${item.name}** สำเร็จ!\nประเภท: **${kind.toUpperCase()}**\n${kind === 'item' ? `${bundle.long}\n` : ''}ราคาที่จ่าย: ${economy.currencySymbol} **${item.price.toLocaleString()}**\nโค้ดอ้างอิง: \`${purchase.code}\`${deliveryText}`,
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.customId.startsWith('panel-shop-cart:')) {
          const itemId = interaction.customId.split(':')[1];
          const item = await getShopItemViewById(itemId);
          if (!item) {
            return interaction.reply({
              content: `ไม่พบสินค้า: ${itemId}`,
              flags: MessageFlags.Ephemeral,
            });
          }

          addItemToCartForUser({ userId: interaction.user.id, itemId: item.id, quantity: 1 });
          const cart = await getResolvedCart(interaction.user.id);
          const preview = cart.rows
            .slice(0, 4)
            .map(
              (row) =>
                `- ${row.item.name} x${row.quantity} (${economy.currencySymbol}${row.lineTotal.toLocaleString()})`,
            )
            .join('\n');
          const moreText = cart.rows.length > 4
            ? `\n- และอีก ${cart.rows.length - 4} รายการ`
            : '';

          return interaction.reply({
            content:
              `เพิ่ม **${item.name}** ลงตะกร้าแล้ว\n\n` +
              `ตะกร้าปัจจุบัน (${cart.rows.length} รายการ / ${cart.totalUnits} ชิ้น)\n` +
              `${preview || '-'}${moreText}\n` +
              `ยอดรวม: ${economy.currencySymbol} **${cart.totalPrice.toLocaleString()}**\n\n` +
              'ใช้ `/cart view` เพื่อดูทั้งหมด หรือ `/cart checkout` เพื่อชำระ',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.customId === 'panel-shop-checkout') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const result = await checkoutCart(interaction.user.id, {
            guildId: interaction.guildId || null,
          });

          if (!result.ok && result.reason === 'empty') {
            return interaction.editReply({ content: 'ตะกร้าของคุณว่างอยู่' });
          }

          if (!result.ok && result.reason === 'insufficient-balance') {
            return interaction.editReply({
              content:
                `ยอดเหรียญไม่พอสำหรับชำระตะกร้า\n` +
                `ต้องใช้: ${economy.currencySymbol} **${result.totalPrice.toLocaleString()}**\n` +
                `ยอดคงเหลือ: ${economy.currencySymbol} **${Number(result.walletBalance || 0).toLocaleString()}**`,
            });
          }

          queueLeaderboardRefreshForGuild(
            interaction.client,
            interaction.guildId,
            'panel-shop-checkout',
          );

          try {
            const guild = interaction.guild;
            if (guild) {
              const logChannel = guild.channels.cache.find(
                (channel) => channel.name === channels.shopLog,
              );
              if (logChannel && logChannel.isTextBased()) {
                await logChannel.send(
                  `🛒 **ชำระตะกร้า** | ผู้ใช้: ${interaction.user} | รายการ: ${result.rows.length} | ชิ้นรวม: ${result.totalUnits} | ตัดเหรียญ: ${economy.currencySymbol} **${result.totalPrice.toLocaleString()}** | คำสั่งซื้อที่สร้าง: ${result.purchases.length} | fail: ${result.failures.length} | refund: ${Number(result.refundedAmount || 0).toLocaleString()}`,
                );
              }
            }
          } catch (error) {
            console.error('ไม่สามารถส่ง log ชำระตะกร้าไปยัง shop-log ได้', error);
          }

          const codePreview = result.purchases
            .slice(0, 10)
            .map((row) => `\`${row.purchase.code}\``)
            .join(', ');
          const moreCodeText = result.purchases.length > 10
            ? ` และอีก ${result.purchases.length - 10} รายการ`
            : '';
          const lines = [
            'ชำระตะกร้าสำเร็จ ✅',
            `รวม ${result.rows.length} รายการ (${result.totalUnits} ชิ้น)`,
            `ตัดเหรียญ: ${economy.currencySymbol} **${result.totalPrice.toLocaleString()}**`,
            `สร้างคำสั่งซื้อ: **${result.purchases.length}** รายการ`,
          ];
          if (Number(result.refundedAmount || 0) > 0) {
            lines.push(
              `คืนเหรียญอัตโนมัติแล้ว: ${economy.currencySymbol} **${Number(result.refundedAmount || 0).toLocaleString()}**`,
            );
          }
          if (codePreview) {
            lines.push(`โค้ดอ้างอิง: ${codePreview}${moreCodeText}`);
          }
          if (result.failures.length > 0) {
            lines.push(
              `มี ${result.failures.length} รายการที่ระบบส่งของมีปัญหา (ตรวจสอบใน /inventory และ shop-log)`,
            );
          }
          return interaction.editReply({ content: lines.join('\n') });
        }

        if (
          interaction.customId.startsWith('panel-')
          || interaction.customId.startsWith('giveaway-')
        ) {
          return interaction.reply({
            content: 'ปุ่มนี้หมดอายุหรือยังไม่รองรับแล้ว ลองกดจากข้อความใหม่ล่าสุดอีกครั้ง',
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      if (!interaction.isChatInputCommand()) return;

      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`ไม่พบคำสั่งที่ชื่อ ${interaction.commandName}`);
        return;
      }

      const disabledCommands = Array.isArray(config.commands?.disabled)
        ? config.commands.disabled.map((name) => String(name || '').trim()).filter(Boolean)
        : [];
      if (disabledCommands.includes(String(interaction.commandName || '').trim())) {
        return interaction.reply({
          content: 'คำสั่งนี้ถูกปิดใช้งานชั่วคราวโดยแอดมิน',
          flags: MessageFlags.Ephemeral,
        });
      }

      const requiredRole = getRequiredCommandAccessRole(
        interaction.commandName,
        config.commands,
      );
      const actorRole = getMemberCommandAccessRole(interaction, config.roles);
      if (!hasCommandAccessAtLeast(actorRole, requiredRole)) {
        return interaction.reply({
          content: `คำสั่งนี้ต้องใช้สิทธิ ${requiredRole} ขึ้นไป`,
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        await command.execute(interaction);
        queueLeaderboardRefreshForGuild(
          interaction.client,
          interaction.guildId,
          `slash:${interaction.commandName}`,
        );
      } catch (error) {
        console.error(`เกิดข้อผิดพลาดระหว่างรันคำสั่ง ${interaction.commandName}`, error);
        const code = Number(error?.code || 0);
        if (code === 10062 || code === 40060) return;
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: 'เกิดข้อผิดพลาดขณะรันคำสั่งนี้',
            flags: MessageFlags.Ephemeral,
          }).catch(() => null);
        } else {
          await interaction.reply({
            content: 'เกิดข้อผิดพลาดขณะรันคำสั่งนี้',
            flags: MessageFlags.Ephemeral,
          }).catch(() => null);
        }
      }
    } catch (error) {
      console.error('[interaction] unhandled error', error);
      const code = Number(error?.code || 0);
      if (code === 10062 || code === 40060) return;
      if (!interaction?.isRepliable || !interaction.isRepliable()) return;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return;
      }
      await interaction.reply({
        content: 'ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง',
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  };
}

module.exports = {
  createOpenTicketHandler,
  createInteractionHandler,
};
