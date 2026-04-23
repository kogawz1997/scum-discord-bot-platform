const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const commandPath = path.resolve(__dirname, '../src/commands/linksteam.js');
const linkServicePath = path.resolve(__dirname, '../src/services/linkService.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function loadCommand(mocks) {
  clearModule(commandPath);
  installMock(linkServicePath, mocks.linkService);
  return require(commandPath);
}

function createInteraction(overrides = {}) {
  const replies = [];
  return {
    guildId: 'guild-1',
    guild: { id: 'guild-1' },
    user: { id: 'user-1', username: 'tester', toString: () => '<@user-1>' },
    memberPermissions: { has: () => true },
    options: {
      getSubcommand: () => 'set',
      getString: () => null,
      getUser: () => ({ id: 'user-2', toString: () => '<@user-2>' }),
    },
    reply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    __replies: replies,
    ...overrides,
  };
}

test.afterEach(() => {
  clearModule(commandPath);
  clearModule(linkServicePath);
});

test('linksteam set command forwards guildId to bind service', async () => {
  let seenInput = null;
  const command = loadCommand({
    linkService: {
      normalizeSteamIdInput: (value) => String(value || '').trim(),
      bindSteamLinkForUser: async (input) => {
        seenInput = input;
        return { ok: true, steamId: input.steamId };
      },
      getSteamLinkByUserId: () => null,
      getSteamLinkBySteamId: () => null,
    },
  });

  const interaction = createInteraction({
    options: {
      getSubcommand: () => 'set',
      getString: (name) => (name === 'steamid' ? '76561199012345678' : null),
      getUser: () => null,
    },
  });

  await command.execute(interaction);

  assert.equal(String(seenInput?.guildId || ''), 'guild-1');
});

test('linksteam me and lookup commands forward guildId to read helpers', async () => {
  const calls = [];
  const command = loadCommand({
    linkService: {
      normalizeSteamIdInput: (value) => String(value || '').trim(),
      bindSteamLinkForUser: async () => ({ ok: true }),
      getSteamLinkByUserId: (_userId, options = {}) => {
        calls.push(['me', options.guildId || null]);
        return { steamId: '76561199012345678', inGameName: null };
      },
      getSteamLinkBySteamId: (_steamId, options = {}) => {
        calls.push(['lookup', options.guildId || null]);
        return { userId: 'user-2' };
      },
    },
  });

  const meInteraction = createInteraction({
    options: {
      getSubcommand: () => 'me',
      getString: () => null,
      getUser: () => null,
    },
  });
  await command.execute(meInteraction);

  const lookupInteraction = createInteraction({
    options: {
      getSubcommand: () => 'lookup',
      getString: () => '76561199012345678',
      getUser: () => null,
    },
  });
  await command.execute(lookupInteraction);

  assert.deepEqual(calls, [
    ['me', 'guild-1'],
    ['lookup', 'guild-1'],
  ]);
});
