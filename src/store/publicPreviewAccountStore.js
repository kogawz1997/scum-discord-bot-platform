'use strict';

/**
 * File-backed preview account registry for the public SaaS signup flow.
 * Keep this isolated from admin/player auth while the broader identity model
 * is staged in gradually.
 */

const crypto = require('node:crypto');
const {
  atomicWriteJson,
  getFilePath,
  loadJson,
} = require('./_persist');

const FILE_PATH = getFilePath('public-preview-accounts.json');

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'preview') {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeEmail(value) {
  return trimText(value, 200).toLowerCase();
}

function createInitialState() {
  return {
    accounts: [],
    updatedAt: nowIso(),
  };
}

let state = null;

function loadState() {
  if (state) return state;
  const loaded = loadJson('public-preview-accounts.json', null);
  state = loaded && typeof loaded === 'object'
    ? {
        accounts: Array.isArray(loaded.accounts) ? loaded.accounts : [],
        updatedAt: trimText(loaded.updatedAt, 80) || nowIso(),
      }
    : createInitialState();
  return state;
}

function saveState() {
  const current = loadState();
  current.updatedAt = nowIso();
  atomicWriteJson(FILE_PATH, current);
}

function sanitizeAccount(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: trimText(row.id, 120) || null,
    email: normalizeEmail(row.email),
    displayName: trimText(row.displayName, 180) || null,
    communityName: trimText(row.communityName, 180) || null,
    locale: trimText(row.locale, 12) || 'en',
    packageId: trimText(row.packageId, 120) || null,
    accountState: trimText(row.accountState, 80) || 'preview',
    verificationState: trimText(row.verificationState, 80) || 'registered',
    tenantId: trimText(row.tenantId, 120) || null,
    subscriptionId: trimText(row.subscriptionId, 120) || null,
    linkedIdentities: {
      discordLinked: row?.linkedIdentities?.discordLinked === true,
      discordVerified: row?.linkedIdentities?.discordVerified === true,
      steamLinked: row?.linkedIdentities?.steamLinked === true,
      playerMatched: row?.linkedIdentities?.playerMatched === true,
      fullyVerified: row?.linkedIdentities?.fullyVerified === true,
    },
    createdAt: trimText(row.createdAt, 80) || null,
    updatedAt: trimText(row.updatedAt, 80) || null,
    lastLoginAt: trimText(row.lastLoginAt, 80) || null,
  };
}

function listPreviewAccounts() {
  return loadState().accounts.map(sanitizeAccount).filter(Boolean);
}

function getPreviewAccountById(accountId) {
  const id = trimText(accountId, 120);
  if (!id) return null;
  const row = loadState().accounts.find((entry) => trimText(entry.id, 120) === id);
  return row ? { ...row } : null;
}

function getPreviewAccountByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const row = loadState().accounts.find((entry) => normalizeEmail(entry.email) === normalizedEmail);
  return row ? { ...row } : null;
}

function createPreviewAccount(input = {}) {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) {
    throw new Error('email-required');
  }
  if (getPreviewAccountByEmail(normalizedEmail)) {
    throw new Error('email-conflict');
  }

  const timestamp = nowIso();
  const record = {
    id: trimText(input.id, 120) || createId('preview-account'),
    email: normalizedEmail,
    passwordHash: trimText(input.passwordHash, 512),
    displayName: trimText(input.displayName, 180) || null,
    communityName: trimText(input.communityName, 180) || null,
    locale: trimText(input.locale, 12) || 'en',
    packageId: trimText(input.packageId, 120) || 'BOT_LOG_DELIVERY',
    accountState: trimText(input.accountState, 80) || 'preview',
    verificationState: trimText(input.verificationState, 80) || 'registered',
    tenantId: trimText(input.tenantId, 120) || null,
    subscriptionId: trimText(input.subscriptionId, 120) || null,
    linkedIdentities: {
      discordLinked: input?.linkedIdentities?.discordLinked === true,
      discordVerified: input?.linkedIdentities?.discordVerified === true,
      steamLinked: input?.linkedIdentities?.steamLinked === true,
      playerMatched: input?.linkedIdentities?.playerMatched === true,
      fullyVerified: input?.linkedIdentities?.fullyVerified === true,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: null,
  };
  loadState().accounts.unshift(record);
  saveState();
  return sanitizeAccount(record);
}

function updatePreviewAccount(accountId, patch = {}) {
  const id = trimText(accountId, 120);
  if (!id) return null;
  const current = loadState();
  const index = current.accounts.findIndex((entry) => trimText(entry.id, 120) === id);
  if (index < 0) return null;
  const existing = current.accounts[index];
  const nextEmail = patch.email == null ? existing.email : normalizeEmail(patch.email);
  if (!nextEmail) {
    throw new Error('email-required');
  }
  const duplicate = current.accounts.find(
    (entry, entryIndex) => entryIndex !== index && normalizeEmail(entry.email) === nextEmail,
  );
  if (duplicate) {
    throw new Error('email-conflict');
  }
  const next = {
    ...existing,
    ...patch,
    email: nextEmail,
    displayName:
      patch.displayName == null ? existing.displayName : trimText(patch.displayName, 180) || null,
    communityName:
      patch.communityName == null ? existing.communityName : trimText(patch.communityName, 180) || null,
    locale: patch.locale == null ? existing.locale : trimText(patch.locale, 12) || 'en',
    packageId:
      patch.packageId == null ? existing.packageId : trimText(patch.packageId, 120) || existing.packageId,
    accountState:
      patch.accountState == null ? existing.accountState : trimText(patch.accountState, 80) || existing.accountState,
    verificationState:
      patch.verificationState == null
        ? existing.verificationState
        : trimText(patch.verificationState, 80) || existing.verificationState,
    tenantId:
      patch.tenantId == null ? existing.tenantId : trimText(patch.tenantId, 120) || null,
    subscriptionId:
      patch.subscriptionId == null ? existing.subscriptionId : trimText(patch.subscriptionId, 120) || null,
    passwordHash:
      patch.passwordHash == null ? existing.passwordHash : trimText(patch.passwordHash, 512),
    linkedIdentities: {
      discordLinked:
        patch?.linkedIdentities?.discordLinked == null
          ? existing?.linkedIdentities?.discordLinked === true
          : patch.linkedIdentities.discordLinked === true,
      discordVerified:
        patch?.linkedIdentities?.discordVerified == null
          ? existing?.linkedIdentities?.discordVerified === true
          : patch.linkedIdentities.discordVerified === true,
      steamLinked:
        patch?.linkedIdentities?.steamLinked == null
          ? existing?.linkedIdentities?.steamLinked === true
          : patch.linkedIdentities.steamLinked === true,
      playerMatched:
        patch?.linkedIdentities?.playerMatched == null
          ? existing?.linkedIdentities?.playerMatched === true
          : patch.linkedIdentities.playerMatched === true,
      fullyVerified:
        patch?.linkedIdentities?.fullyVerified == null
          ? existing?.linkedIdentities?.fullyVerified === true
          : patch.linkedIdentities.fullyVerified === true,
    },
    updatedAt: nowIso(),
  };
  current.accounts[index] = next;
  saveState();
  return sanitizeAccount(next);
}

module.exports = {
  createPreviewAccount,
  getPreviewAccountByEmail,
  getPreviewAccountById,
  listPreviewAccounts,
  sanitizeAccount,
  updatePreviewAccount,
};
