#!/usr/bin/env node
'use strict';

require('dotenv').config();

const { previewDeliveryCommands } = require('../src/services/rconDelivery');

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

function hasFlag(argv, key) {
  return argv.includes(`--${key}`);
}

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node scripts/preview-spawn-command.js --item-id <shopItemId>',
      '  node scripts/preview-spawn-command.js --game-item-id <SCUM_Item_ID>',
      '',
      'Options:',
      '  --item-id <id>         Shop item id or known item key',
      '  --game-item-id <id>    SCUM game item id/spawn id',
      '  --quantity <n>         Quantity for preview (default: 1)',
      '  --steam-id <id>        SteamID used for dedicated-server preview',
      '  --json                 Print raw JSON',
      '',
      'Example:',
      '  node scripts/preview-spawn-command.js --game-item-id Weapon_M1911 --quantity 1',
    ].join('\n'),
  );
}

async function main() {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printUsage();
    return;
  }

  const itemId = String(readArg(argv, 'item-id', '')).trim();
  const gameItemId = String(readArg(argv, 'game-item-id', '')).trim();
  const quantityRaw = readArg(argv, 'quantity', '1');
  const quantity = Math.max(1, Math.trunc(Number(quantityRaw || 1)));
  const steamId = String(readArg(argv, 'steam-id', '76561198000000000')).trim();
  const asJson = hasFlag(argv, 'json');

  if (!itemId && !gameItemId) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const preview = await previewDeliveryCommands({
    itemId,
    gameItemId,
    quantity,
    steamId,
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
    return;
  }

  const lines = [];
  lines.push(`Item ID: ${preview.itemId || '-'}`);
  lines.push(`Name: ${preview.itemName || '-'}`);
  lines.push(`Game Item ID: ${preview.gameItemId || '-'}`);
  lines.push(`Quantity: ${preview.quantity}`);
  lines.push(`Icon: ${preview.iconUrl || '-'}`);
  lines.push('');

  if (!Array.isArray(preview.commandTemplates) || preview.commandTemplates.length === 0) {
    lines.push('No delivery command template matched this item.');
    lines.push('Check config.delivery.auto.itemCommands or wiki/manifest fallback data.');
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('Dedicated server / RCON preview:');
  for (const command of preview.serverCommands) {
    lines.push(`  ${command}`);
  }
  lines.push('');
  lines.push('Single-player console preview:');
  for (const command of preview.singlePlayerCommands) {
    lines.push(`  ${command}`);
  }
  lines.push('');
  lines.push('Note: single-player preview only validates the spawn command shape.');
  lines.push('RCON transport still requires a dedicated server.');
  process.stdout.write(`${lines.join('\n')}\n`);
}

void main().catch((error) => {
  process.stderr.write(`preview-spawn-command: ${String(error?.message || error)}\n`);
  process.exitCode = 1;
});
