const fs = require('node:fs');

const { getFilePath } = require('./_persist');
const {
  normalizeCapabilityEntry,
} = require('../services/scumAdminCommandCatalog');

const FILE_PATH = getFilePath('admin-command-capability-presets.json');
const MAX_PRESETS = 200;

const presets = [];
let initPromise = null;
let writeQueue = Promise.resolve();

function queueWrite(work, label) {
  writeQueue = writeQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[adminCommandCapabilityPresetStore] ${label} failed:`, error.message);
    });
  return writeQueue;
}

function writeSnapshotToDisk() {
  const tmpPath = `${FILE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(presets, null, 2), 'utf8');
  fs.renameSync(tmpPath, FILE_PATH);
}

async function hydrateFromDisk() {
  try {
    if (!fs.existsSync(FILE_PATH)) return;
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    presets.length = 0;
    for (const row of Array.isArray(parsed) ? parsed : []) {
      try {
        presets.push(normalizeCapabilityEntry(row));
      } catch {}
    }
    presets.sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
    if (presets.length > MAX_PRESETS) {
      presets.splice(MAX_PRESETS);
    }
  } catch (error) {
    console.error('[adminCommandCapabilityPresetStore] failed to hydrate:', error.message);
  }
}

function initAdminCommandCapabilityPresetStore() {
  if (!initPromise) {
    initPromise = hydrateFromDisk();
  }
  return initPromise;
}

function listAdminCommandCapabilityPresets(limit = 200) {
  const max = Math.max(1, Math.min(MAX_PRESETS, Number(limit || 200)));
  return presets
    .slice()
    .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
    .slice(0, max)
    .map((entry) => ({
      ...entry,
      commandTemplates: entry.commandTemplates.slice(),
      defaults: { ...(entry.defaults || {}) },
      tags: Array.isArray(entry.tags) ? entry.tags.slice() : [],
    }));
}

function getAdminCommandCapabilityPresetById(presetId) {
  const id = String(presetId || '').trim();
  if (!id) return null;
  const found = presets.find((entry) => String(entry.id || '').trim() === id);
  return found
    ? {
        ...found,
        commandTemplates: found.commandTemplates.slice(),
        defaults: { ...(found.defaults || {}) },
        tags: Array.isArray(found.tags) ? found.tags.slice() : [],
      }
    : null;
}

function saveAdminCommandCapabilityPreset(entry = {}, actor = 'admin-web') {
  const now = new Date().toISOString();
  const normalized = normalizeCapabilityEntry({
    ...entry,
    createdAt: entry.createdAt || now,
    updatedAt: now,
    createdBy: entry.createdBy || actor,
    updatedBy: actor,
  });
  const existingIndex = presets.findIndex((row) => String(row.id || '').trim() === normalized.id);
  if (existingIndex >= 0) {
    normalized.createdAt = presets[existingIndex].createdAt || normalized.createdAt;
    normalized.createdBy = presets[existingIndex].createdBy || normalized.createdBy;
    presets[existingIndex] = normalized;
  } else {
    presets.unshift(normalized);
  }
  presets.sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
  if (presets.length > MAX_PRESETS) {
    presets.splice(MAX_PRESETS);
  }
  queueWrite(writeSnapshotToDisk, 'save');
  return getAdminCommandCapabilityPresetById(normalized.id);
}

function deleteAdminCommandCapabilityPreset(presetId) {
  const id = String(presetId || '').trim();
  if (!id) return null;
  const index = presets.findIndex((entry) => String(entry.id || '').trim() === id);
  if (index < 0) return null;
  const [removed] = presets.splice(index, 1);
  queueWrite(writeSnapshotToDisk, 'delete');
  return removed
    ? {
        ...removed,
        commandTemplates: removed.commandTemplates.slice(),
        defaults: { ...(removed.defaults || {}) },
        tags: Array.isArray(removed.tags) ? removed.tags.slice() : [],
      }
    : null;
}

function replaceAdminCommandCapabilityPresets(nextRows = []) {
  presets.length = 0;
  for (const row of Array.isArray(nextRows) ? nextRows : []) {
    try {
      presets.push(normalizeCapabilityEntry(row));
    } catch {}
  }
  presets.sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
  if (presets.length > MAX_PRESETS) {
    presets.splice(MAX_PRESETS);
  }
  queueWrite(writeSnapshotToDisk, 'replace');
  return presets.length;
}

initAdminCommandCapabilityPresetStore();

module.exports = {
  deleteAdminCommandCapabilityPreset,
  getAdminCommandCapabilityPresetById,
  initAdminCommandCapabilityPresetStore,
  listAdminCommandCapabilityPresets,
  replaceAdminCommandCapabilityPresets,
  saveAdminCommandCapabilityPreset,
};
