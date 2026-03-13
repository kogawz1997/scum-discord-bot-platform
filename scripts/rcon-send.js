#!/usr/bin/env node
'use strict';

const dgram = require('node:dgram');
const { Rcon } = require('rcon-client');

function readArg(argv, key, fallback = '') {
  const flag = `--${key}`;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== flag) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) return fallback;
    return next;
  }
  return fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function text(value) {
  return String(value || '').trim();
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  const out = Buffer.alloc(4);
  out.writeInt32BE((crc ^ 0xffffffff) | 0, 0);
  return out;
}

function encodeBattleyePacket(payload, checksumEndian = 'le') {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const packet = Buffer.allocUnsafe(2 + 4 + data.length);
  packet.write('BE', 0, 'ascii');
  const checksumBuffer = crc32(data);
  const checksumValue =
    checksumEndian === 'le'
      ? checksumBuffer.readInt32LE(0)
      : checksumBuffer.readInt32BE(0);
  packet.writeInt32BE(checksumValue, 2);
  data.copy(packet, 6);
  return packet;
}

function decodeBattleyePacket(message) {
  if (!Buffer.isBuffer(message) || message.length < 9) {
    return null;
  }
  if (message[0] !== 0x42 || message[1] !== 0x45) {
    return null;
  }

  const payload = message.subarray(6);
  if (payload[0] !== 0xff) {
    return null;
  }
  const expected = crc32(payload);
  const checksum = message.readInt32BE(2);
  const expectedLe = expected.readInt32LE(0);
  const expectedBe = expected.readInt32BE(0);
  if (checksum !== expectedLe && checksum !== expectedBe) {
    return null;
  }

  return {
    payload,
    checksumEndian: checksum === expectedLe ? 'le' : 'be',
  };
}

class BattleyeClient {
  constructor(options) {
    this.host = options.host;
    this.port = options.port;
    this.password = options.password;
    this.timeoutMs = options.timeoutMs;
    this.idleTimeoutMs = options.idleTimeoutMs;
    this.socket = dgram.createSocket('udp4');
    this.seq = 0;
    this.checksumEndian = 'le';
    this.closed = false;
    this.waiters = new Set();

    this.socket.on('message', (message) => {
      const decoded = decodeBattleyePacket(message);
      if (!decoded) return;
      for (const waiter of Array.from(this.waiters)) {
        waiter(decoded);
      }
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of Array.from(this.waiters)) {
      waiter(null);
    }
    this.waiters.clear();
    try {
      this.socket.close();
    } catch {
      // ignore
    }
  }

  async sendRaw(payload) {
    const packet = encodeBattleyePacket(payload, this.checksumEndian);
    await new Promise((resolve, reject) => {
      this.socket.send(packet, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  waitFor(predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.waiters.delete(onPacket);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('timeout'));
      }, timeoutMs);
      const onPacket = (decoded) => {
        if (!decoded) {
          cleanup();
          reject(new Error('socket-closed'));
          return;
        }
        try {
          if (!predicate(decoded)) return;
          cleanup();
          resolve(decoded);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      this.waiters.add(onPacket);
    });
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.once('error', reject);
      this.socket.connect(this.port, this.host, (error) => {
        this.socket.off('error', reject);
        if (error) reject(error);
        else resolve();
      });
    });

    const passwordBuffer = Buffer.from(this.password, 'utf8');
    const loginPayload = Buffer.concat([
      Buffer.from([0xff, 0x00]),
      passwordBuffer,
    ]);
    const attempts = ['le', 'be'];

    let lastError = null;
    for (const endian of attempts) {
      this.checksumEndian = endian;
      const waiter = this.waitFor(
        (decoded) => decoded.payload[1] === 0x00,
        this.timeoutMs,
      );
      try {
        await this.sendRaw(loginPayload);
        const response = await waiter;
        if (response.payload.length < 3 || response.payload[2] !== 0x01) {
          throw new Error('battleye login failed');
        }
        return;
      } catch (error) {
        waiter.catch(() => {});
        lastError = error;
      }
    }

    throw new Error(
      `battleye login failed: ${text(lastError?.message || lastError) || 'no response'}`,
    );
  }

  async acknowledgeServerMessage(payload) {
    if (!Buffer.isBuffer(payload) || payload.length < 3 || payload[1] !== 0x02) {
      return;
    }
    const ack = Buffer.from([0xff, 0x02, payload[2]]);
    try {
      await this.sendRaw(ack);
    } catch {
      // ignore best-effort ack failures
    }
  }

  async send(command) {
    const seq = this.seq;
    this.seq = (this.seq + 1) % 256;
    const payload = Buffer.concat([
      Buffer.from([0xff, 0x01, seq]),
      Buffer.from(String(command || ''), 'utf8'),
    ]);

    const parts = new Map();
    let singleText = '';
    let seenResponse = false;
    let expectedParts = null;
    let idleTimer = null;

    const waitPromise = new Promise((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        this.waiters.delete(onPacket);
        reject(
          new Error(
            seenResponse
              ? 'battleye command response incomplete'
              : 'battleye command response timeout',
          ),
        );
      }, this.timeoutMs);

      const finish = () => {
        clearTimeout(timeoutTimer);
        clearTimeout(idleTimer);
        this.waiters.delete(onPacket);
        if (parts.size > 0) {
          const ordered = Array.from(parts.entries())
            .sort((a, b) => a[0] - b[0])
            .map((entry) => entry[1]);
          resolve(ordered.join(''));
          return;
        }
        resolve(singleText);
      };

      const armIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(finish, this.idleTimeoutMs);
      };

      const onPacket = (decoded) => {
        if (!decoded) {
          clearTimeout(timeoutTimer);
          clearTimeout(idleTimer);
          this.waiters.delete(onPacket);
          reject(new Error('socket-closed'));
          return;
        }

        const responsePayload = decoded.payload;
        if (!responsePayload || responsePayload.length === 0) return;

        if (responsePayload[1] === 0x02) {
          void this.acknowledgeServerMessage(responsePayload);
          return;
        }

        if (
          responsePayload[1] !== 0x01
          || responsePayload.length < 3
          || responsePayload[2] !== seq
        ) {
          return;
        }

        seenResponse = true;
        const content = responsePayload.subarray(3);
        if (content.length >= 3 && content[0] === 0x00) {
          expectedParts = content[1];
          const index = content[2];
          const textChunk = content.subarray(3).toString('utf8');
          parts.set(index, textChunk);
          if (expectedParts > 0 && parts.size >= expectedParts) {
            finish();
            return;
          }
          armIdle();
          return;
        }

        singleText += content.toString('utf8');
        armIdle();
      };

      this.waiters.add(onPacket);
    });

    try {
      await this.sendRaw(payload);
    } catch (error) {
      waitPromise.catch(() => {});
      throw error;
    }
    return waitPromise;
  }
}

async function runSourceRcon(options) {
  let rcon = null;
  try {
    rcon = await Rcon.connect({
      host: options.host,
      port: options.port,
      password: options.password,
      timeout: options.timeoutMs,
      maxPending: 1,
    });
    return await rcon.send(options.command);
  } finally {
    if (rcon) {
      try {
        await rcon.end();
      } catch {
        // Ignore close errors.
      }
    }
  }
}

async function runBattleyeRcon(options) {
  const client = new BattleyeClient(options);
  try {
    await client.connect();
    return await client.send(options.command);
  } finally {
    client.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const host = text(readArg(argv, 'host', process.env.RCON_HOST || ''));
  const rawProtocol = text(
    readArg(argv, 'protocol', process.env.RCON_PROTOCOL || 'source'),
  ).toLowerCase();
  const protocol = rawProtocol === 'be' ? 'battleye' : rawProtocol;
  const portDefault = protocol === 'battleye' ? '8038' : '27015';
  const port = parseNumber(readArg(argv, 'port', process.env.RCON_PORT || portDefault), parseNumber(portDefault, 27015));
  const password = text(readArg(argv, 'password', process.env.RCON_PASSWORD || ''));
  const timeoutMs = Math.max(
    1000,
    parseNumber(readArg(argv, 'timeout', process.env.RCON_TIMEOUT_MS || '10000'), 10000),
  );
  const idleTimeoutMs = Math.max(
    150,
    parseNumber(readArg(argv, 'idle-timeout', process.env.RCON_IDLE_TIMEOUT_MS || '500'), 500),
  );

  let command = text(readArg(argv, 'command', ''));
  if (!command) {
    const positional = argv.filter((token, index) => {
      if (token.startsWith('--')) return false;
      const prev = argv[index - 1];
      if (prev && prev.startsWith('--')) return false;
      return true;
    });
    command = text(positional.join(' '));
  }

  if (!host) {
    console.error('rcon-send: missing --host');
    process.exit(2);
  }
  if (!password) {
    console.error('rcon-send: missing --password');
    process.exit(2);
  }
  if (!command) {
    console.error('rcon-send: missing --command');
    process.exit(2);
  }

  try {
    const response =
      protocol === 'battleye'
        ? await runBattleyeRcon({
            host,
            port,
            password,
            command,
            timeoutMs,
            idleTimeoutMs,
          })
        : await runSourceRcon({
            host,
            port,
            password,
            command,
            timeoutMs,
          });

    const output = text(response);
    if (output) {
      process.stdout.write(output);
      if (!output.endsWith('\n')) process.stdout.write('\n');
    }
  } catch (error) {
    const message = text(error?.message || error || 'unknown rcon error');
    process.stderr.write(`rcon-send: ${message}\n`);
    process.exitCode = 1;
  }
}

void main();
