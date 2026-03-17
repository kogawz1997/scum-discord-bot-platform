const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');

const webhookModulePath = path.resolve(__dirname, '../src/scumWebhookServer.js');
const scumEventsModulePath = path.resolve(__dirname, '../src/services/scumEvents.js');

function randomPort(base = 39000, span = 1000) {
  return base + Math.floor(Math.random() * span);
}

function freshWebhookModule(eventStubs) {
  delete require.cache[webhookModulePath];
  delete require.cache[scumEventsModulePath];
  require.cache[scumEventsModulePath] = {
    id: scumEventsModulePath,
    filename: scumEventsModulePath,
    loaded: true,
    exports: eventStubs,
  };
  return require(webhookModulePath);
}

test('SCUM webhook server validates auth and dispatches events', async (t) => {
  const originalPort = process.env.SCUM_WEBHOOK_PORT;
  const originalSecret = process.env.SCUM_WEBHOOK_SECRET;
  const originalMaxBody = process.env.SCUM_WEBHOOK_MAX_BODY_BYTES;
  const port = randomPort();
  process.env.SCUM_WEBHOOK_PORT = String(port);
  process.env.SCUM_WEBHOOK_SECRET = 'test-secret';

  const calls = {
    status: [],
    joinLeave: [],
    kill: [],
    restart: [],
  };

  const stubs = {
    sendStatusOnline: async (...args) => calls.status.push(args),
    sendPlayerJoinLeave: async (...args) => calls.joinLeave.push(args),
    sendKillFeed: async (...args) => calls.kill.push(args),
    sendRestartAlert: async (...args) => calls.restart.push(args),
  };

  const { startScumServer } = freshWebhookModule(stubs);
  const fakeGuild = { id: 'G1', name: 'Guild One' };
  const client = {
    guilds: {
      cache: new Map([[fakeGuild.id, fakeGuild]]),
    },
  };

  const server = startScumServer(client);
  if (!server.listening) {
    await once(server, 'listening');
  }

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[webhookModulePath];
    delete require.cache[scumEventsModulePath];
    if (originalPort == null) {
      delete process.env.SCUM_WEBHOOK_PORT;
    } else {
      process.env.SCUM_WEBHOOK_PORT = originalPort;
    }
    if (originalSecret == null) {
      delete process.env.SCUM_WEBHOOK_SECRET;
    } else {
      process.env.SCUM_WEBHOOK_SECRET = originalSecret;
    }
    if (originalMaxBody == null) {
      delete process.env.SCUM_WEBHOOK_MAX_BODY_BYTES;
    } else {
      process.env.SCUM_WEBHOOK_MAX_BODY_BYTES = originalMaxBody;
    }
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  async function post(pathname, payload) {
    return fetch(`${baseUrl}${pathname}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  const notFound = await post('/wrong-path', {});
  assert.equal(notFound.status, 404);

  const forbidden = await post('/scum-event', {
    secret: 'bad-secret',
    guildId: fakeGuild.id,
    type: 'status',
  });
  assert.equal(forbidden.status, 403);

  const unknownGuild = await post('/scum-event', {
    secret: 'test-secret',
    guildId: 'UNKNOWN',
    type: 'status',
  });
  assert.equal(unknownGuild.status, 400);

  const invalidType = await post('/scum-event', {
    secret: 'test-secret',
    guildId: fakeGuild.id,
    type: 'invalid-type',
  });
  assert.equal(invalidType.status, 400);

  const tenantIdRejected = await post('/scum-event', {
    secret: 'test-secret',
    guildId: fakeGuild.id,
    type: 'status',
    tenantId: 'tenant-a',
  });
  assert.equal(tenantIdRejected.status, 400);

  const badContentType = await fetch(`${baseUrl}/scum-event`, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain',
    },
    body: JSON.stringify({
      secret: 'test-secret',
      guildId: fakeGuild.id,
      type: 'status',
    }),
  });
  assert.equal(badContentType.status, 415);

  const statusOk = await post('/scum-event', {
    secret: 'test-secret',
    guildId: fakeGuild.id,
    type: 'status',
    onlinePlayers: 22,
    maxPlayers: 70,
    pingMs: 18,
    uptimeMinutes: 55,
  });
  assert.equal(statusOk.status, 200);

  const killOk = await post('/scum-event', {
    secret: 'test-secret',
    guildId: fakeGuild.id,
    type: 'kill',
    killer: 'A',
    killerSteamId: '111',
    victim: 'B',
    victimSteamId: '222',
    weapon: 'AK-47',
    distance: 120,
    hitZone: 'head',
    sector: 'B2',
    mapImageUrl: 'https://cdn.example.com/maps/b2.jpg',
  });
  assert.equal(killOk.status, 200);

  const restartOk = await post('/scum-event', {
    secret: 'test-secret',
    guildId: fakeGuild.id,
    type: 'restart',
    message: 'Restart soon',
  });
  assert.equal(restartOk.status, 200);

  assert.equal(calls.status.length, 1);
  assert.equal(calls.kill.length, 1);
  assert.equal(calls.joinLeave.length, 0);
  assert.equal(calls.restart.length, 1);

  const [statusGuild, statusPayload, statusOptions] = calls.status[0];
  assert.equal(statusGuild.id, fakeGuild.id);
  assert.deepEqual(statusPayload, {
    onlinePlayers: 22,
    maxPlayers: 70,
    pingMs: 18,
    uptimeMinutes: 55,
  });
  assert.deepEqual(statusOptions, {});

  const [killGuild, killPayload, killOptions] = calls.kill[0];
  assert.equal(killGuild.id, fakeGuild.id);
  assert.deepEqual(killPayload, {
    killer: 'A',
    killerSteamId: '111',
    victim: 'B',
    victimSteamId: '222',
    weapon: 'AK-47',
    distance: 120,
    hitZone: 'head',
    sector: 'B2',
    mapImageUrl: 'https://cdn.example.com/maps/b2.jpg',
  });
  assert.deepEqual(killOptions, {});

  const [restartGuild, restartMessage, restartOptions] = calls.restart[0];
  assert.equal(restartGuild.id, fakeGuild.id);
  assert.equal(restartMessage, 'Restart soon');
  assert.deepEqual(restartOptions, {});
});

test('SCUM webhook server rejects invalid JSON and oversized UTF-8 payloads', async (t) => {
  const originalPort = process.env.SCUM_WEBHOOK_PORT;
  const originalSecret = process.env.SCUM_WEBHOOK_SECRET;
  const originalMaxBody = process.env.SCUM_WEBHOOK_MAX_BODY_BYTES;

  const port = randomPort(40100, 800);
  process.env.SCUM_WEBHOOK_PORT = String(port);
  process.env.SCUM_WEBHOOK_SECRET = 'test-secret-2';
  process.env.SCUM_WEBHOOK_MAX_BODY_BYTES = '120';

  const stubs = {
    sendStatusOnline: async () => {},
    sendPlayerJoinLeave: async () => {},
    sendKillFeed: async () => {},
    sendRestartAlert: async () => {},
  };

  const { startScumServer } = freshWebhookModule(stubs);
  const fakeGuild = { id: 'G2', name: 'Guild Two' };
  const client = {
    guilds: {
      cache: new Map([[fakeGuild.id, fakeGuild]]),
    },
  };

  const server = startScumServer(client);
  if (!server.listening) {
    await once(server, 'listening');
  }

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[webhookModulePath];
    delete require.cache[scumEventsModulePath];
    if (originalPort == null) delete process.env.SCUM_WEBHOOK_PORT;
    else process.env.SCUM_WEBHOOK_PORT = originalPort;
    if (originalSecret == null) delete process.env.SCUM_WEBHOOK_SECRET;
    else process.env.SCUM_WEBHOOK_SECRET = originalSecret;
    if (originalMaxBody == null) delete process.env.SCUM_WEBHOOK_MAX_BODY_BYTES;
    else process.env.SCUM_WEBHOOK_MAX_BODY_BYTES = originalMaxBody;
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  const invalidJson = await fetch(`${baseUrl}/scum-event`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: '{"type":"status"',
  });
  assert.equal(invalidJson.status, 400);

  const oversized = await fetch(`${baseUrl}/scum-event`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      secret: 'test-secret-2',
      guildId: fakeGuild.id,
      type: 'status',
      message: 'ก'.repeat(3000),
    }),
  });
  assert.equal(oversized.status, 413);
});
