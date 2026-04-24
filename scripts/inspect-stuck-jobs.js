#!/usr/bin/env node
'use strict';

/**
 * Stuck-job inspector for the delivery queue.
 *
 * Usage:
 *   node scripts/inspect-stuck-jobs.js                  # list stuck jobs (default: queue jobs older than 30m)
 *   node scripts/inspect-stuck-jobs.js --threshold-min=60
 *   node scripts/inspect-stuck-jobs.js --tenant=<id>
 *   node scripts/inspect-stuck-jobs.js --dead-letters   # list dead-letter rows instead
 *   node scripts/inspect-stuck-jobs.js --retry=<purchaseCode>
 *   node scripts/inspect-stuck-jobs.js --json
 */

require('dotenv').config();

const { prisma } = require('../src/prisma');

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, value] = raw.slice(2).split('=');
    args[key] = value === undefined ? true : value;
  }
  return args;
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${m % 60}m`;
  return `${Math.floor(h / 24)}d${h % 24}h`;
}

async function listStuckJobs({ thresholdMin = 30, tenantId = null, json = false } = {}) {
  const cutoff = new Date(Date.now() - thresholdMin * 60_000);
  const where = { nextAttemptAt: { lt: cutoff } };
  if (tenantId) where.tenantId = tenantId;
  const rows = await prisma.deliveryQueueJob.findMany({
    where,
    orderBy: { nextAttemptAt: 'asc' },
    take: 100,
  });
  if (json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return rows;
  }
  if (!rows.length) {
    process.stdout.write(`No stuck queue jobs older than ${thresholdMin}m.\n`);
    return rows;
  }
  process.stdout.write(`Stuck queue jobs (>${thresholdMin}m old):\n`);
  for (const r of rows) {
    const age = fmtDuration(Date.now() - new Date(r.nextAttemptAt).getTime());
    process.stdout.write(
      `  ${r.purchaseCode}  tenant=${r.tenantId || '-'}  user=${r.userId}  item=${r.itemId}  attempts=${r.attempts}  stuck=${age}  err=${(r.lastError || '').slice(0, 80)}\n`,
    );
  }
  return rows;
}

async function listDeadLetters({ tenantId = null, json = false } = {}) {
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  const rows = await prisma.deliveryDeadLetter.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  if (json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return rows;
  }
  if (!rows.length) {
    process.stdout.write('No dead-letter entries.\n');
    return rows;
  }
  process.stdout.write('Dead-letter entries:\n');
  for (const r of rows) {
    process.stdout.write(
      `  ${r.purchaseCode}  tenant=${r.tenantId || '-'}  user=${r.userId || '-'}  attempts=${r.attempts}  reason=${r.reason}  err=${(r.lastError || '').slice(0, 80)}\n`,
    );
  }
  return rows;
}

async function retryJob(purchaseCode) {
  const dead = await prisma.deliveryDeadLetter.findUnique({ where: { purchaseCode } });
  if (dead) {
    await prisma.$transaction(async (tx) => {
      await tx.deliveryQueueJob.upsert({
        where: { purchaseCode },
        update: {
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: null,
        },
        create: {
          purchaseCode,
          tenantId: dead.tenantId,
          userId: dead.userId || '',
          itemId: dead.itemId || '',
          itemName: dead.itemName,
          guildId: dead.guildId,
          deliveryItemsJson: dead.deliveryItemsJson,
          attempts: 0,
          nextAttemptAt: new Date(),
        },
      });
      await tx.deliveryDeadLetter.delete({ where: { purchaseCode } });
    });
    process.stdout.write(`Requeued ${purchaseCode} from dead-letter to queue.\n`);
    return;
  }
  const updated = await prisma.deliveryQueueJob.update({
    where: { purchaseCode },
    data: { nextAttemptAt: new Date(), attempts: 0, lastError: null },
  });
  process.stdout.write(`Reset ${updated.purchaseCode} for immediate retry.\n`);
}

async function main() {
  const args = parseArgs(process.argv);
  const json = Boolean(args.json);
  const tenantId = typeof args.tenant === 'string' ? args.tenant : null;
  if (typeof args.retry === 'string') {
    await retryJob(args.retry);
    return;
  }
  if (args['dead-letters']) {
    await listDeadLetters({ tenantId, json });
    return;
  }
  const thresholdMin = args['threshold-min']
    ? Number.parseInt(args['threshold-min'], 10)
    : 30;
  await listStuckJobs({ thresholdMin, tenantId, json });
}

main()
  .catch((err) => {
    process.stderr.write(`inspect-stuck-jobs failed: ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
