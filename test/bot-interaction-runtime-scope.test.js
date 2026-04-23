const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInteractionHandler,
} = require('../src/discord/interactions/botInteractionRuntime');

function createDeps(overrides = {}) {
  return {
    config: { commands: { disabled: [] }, roles: {} },
    channels: {},
    roles: { verified: 'Verified' },
    economy: {},
    openTicketFromPanel: async () => {},
    queueLeaderboardRefreshForGuild: () => {},
    claimWelcomePackForUser: async () => ({ ok: true }),
    getShopItemViewById: async () => null,
    purchaseShopItemForUser: async () => ({ ok: false }),
    normalizeShopKind: (value) => value,
    buildBundleSummary: () => ({ short: '', long: '' }),
    addItemToCartForUser: async () => ({ ok: false }),
    getResolvedCart: async () => ({ items: [] }),
    checkoutCart: async () => ({ ok: false }),
    normalizeSteamIdInput: (value) => String(value || '').trim(),
    bindSteamLinkForUser: async () => ({ ok: true }),
    upsertPlayerAccount: async () => {},
    enterGiveawayForUser: async () => ({ ok: false }),
    getMemberCommandAccessRole: () => 'owner',
    getRequiredCommandAccessRole: () => 'viewer',
    hasCommandAccessAtLeast: () => true,
    ...overrides,
  };
}

test('bot interaction runtime forwards guildId when verifying steam link from modal', async () => {
  let seenInput = null;
  const handleInteractionCreate = createInteractionHandler(createDeps({
    bindSteamLinkForUser: async (input) => {
      seenInput = input;
      return { ok: true, steamId: input.steamId };
    },
  }));

  const replies = [];
  const interaction = {
    replied: false,
    deferred: false,
    guildId: 'guild-1',
    guild: {
      id: 'guild-1',
      roles: {
        cache: {
          find: () => null,
        },
      },
    },
    member: {
      displayName: 'Tester',
      roles: {
        cache: { has: () => false },
      },
    },
    user: {
      id: 'user-1',
      username: 'tester',
      globalName: 'Tester',
      displayAvatarURL: () => null,
    },
    fields: {
      getTextInputValue: () => '76561199012345678',
    },
    isModalSubmit: () => true,
    isButton: () => false,
    isChatInputCommand: () => false,
    customId: 'panel-verify-modal',
    reply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    isRepliable: () => true,
  };

  await handleInteractionCreate(interaction);

  assert.equal(String(seenInput?.guildId || ''), 'guild-1');
  assert.equal(replies.length, 1);
});
