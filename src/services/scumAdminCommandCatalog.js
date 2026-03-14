const crypto = require('node:crypto');

const DEFAULT_PRESET_KEYS = Object.freeze([
  'announceText',
  'steamId',
  'gameItemId',
  'quantity',
  'teleportTarget',
  'returnTarget',
  'inGameName',
  'itemName',
]);

function text(value, maxLen = 260) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen);
}

function normalizeCommandTemplates(rawValue) {
  if (!rawValue) return [];
  if (typeof rawValue === 'string') {
    return rawValue
      .split(/\r?\n/)
      .map((line) => text(line, 500))
      .filter(Boolean);
  }
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((line) => text(line, 500))
      .filter(Boolean);
  }
  return [];
}

function normalizeDefaults(defaults = {}) {
  const next = {};
  for (const key of DEFAULT_PRESET_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(defaults || {}, key)) continue;
    if (key === 'quantity') {
      const quantity = Math.max(1, Math.trunc(Number(defaults[key] || 1)));
      next.quantity = quantity;
      continue;
    }
    const value = text(defaults[key], 260);
    if (value) {
      next[key] = value;
    }
  }
  return next;
}

function normalizeCapabilityEntry(entry = {}, options = {}) {
  const commandTemplates = normalizeCommandTemplates(
    entry.commandTemplates || entry.commands || entry.command,
  );
  const name = text(entry.name || entry.id || '', 120);
  if (!name) {
    throw new Error('capability name is required');
  }
  if (commandTemplates.length === 0) {
    throw new Error('capability commands are required');
  }
  const id = text(
    entry.id
      || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'capability'}-${
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(16).slice(2, 10)
      }`,
    120,
  );
  const now = new Date().toISOString();
  return {
    id,
    name,
    description: text(entry.description || '', 300) || null,
    commandTemplates,
    defaults: normalizeDefaults(entry.defaults),
    tags: Array.isArray(entry.tags)
      ? entry.tags.map((tag) => text(tag, 40).toLowerCase()).filter(Boolean).slice(0, 12)
      : [],
    builtin: options.builtin === true,
    createdAt: text(entry.createdAt || now, 60) || now,
    updatedAt: text(entry.updatedAt || now, 60) || now,
    createdBy: text(entry.createdBy || '', 180) || null,
    updatedBy: text(entry.updatedBy || '', 180) || null,
  };
}

const BUILTIN_SCUM_ADMIN_COMMAND_CAPABILITIES = Object.freeze([
  normalizeCapabilityEntry({
    id: 'announce-smoke',
    name: 'Announce Smoke Test',
    description: 'เช็กว่า admin channel และ command bridge รับ #Announce ได้จริง',
    commandTemplates: ['#Announce {announceText}'],
    defaults: {
      announceText: 'HELLO DELIVERY',
    },
    tags: ['announce', 'smoke'],
  }, { builtin: true }),
  normalizeCapabilityEntry({
    id: 'teleport-player',
    name: 'Teleport To Player',
    description: 'เช็กว่า #TeleportTo ไปหาผู้เล่น/ตัวละครได้จริง',
    commandTemplates: ['#TeleportTo {teleportTargetQuoted}'],
    defaults: {
      teleportTarget: 'Coke TAMTHAI',
    },
    tags: ['teleport', 'player'],
  }, { builtin: true }),
  normalizeCapabilityEntry({
    id: 'teleport-vehicle',
    name: 'Teleport To Vehicle',
    description: 'เช็กว่า #TeleportToVehicle ไปยังรถ/target ที่กำหนดได้จริง',
    commandTemplates: ['#TeleportToVehicle {teleportTargetRaw}'],
    defaults: {
      teleportTarget: 'AdminBike',
    },
    tags: ['teleport', 'vehicle'],
  }, { builtin: true }),
  normalizeCapabilityEntry({
    id: 'spawn-item',
    name: 'Spawn Item',
    description: 'เช็กว่า #SpawnItem ทำงานได้จริงกับไอเทมทั่วไป',
    commandTemplates: ['#SpawnItem {steamId} {gameItemId} {quantity}'],
    defaults: {
      steamId: '76561198000000000',
      gameItemId: 'Weapon_M1911',
      quantity: 1,
    },
    tags: ['spawn', 'item'],
  }, { builtin: true }),
  normalizeCapabilityEntry({
    id: 'spawn-magazine',
    name: 'Spawn Magazine',
    description: 'เช็กว่า magazine ได้ StackCount auto modifier ถูกต้อง',
    commandTemplates: ['#SpawnItem {steamId} {gameItemId} {quantity}'],
    defaults: {
      steamId: '76561198000000000',
      gameItemId: 'Magazine_M1911',
      quantity: 1,
    },
    tags: ['spawn', 'magazine'],
  }, { builtin: true }),
  normalizeCapabilityEntry({
    id: 'announce-teleport-spawn',
    name: 'Announce + Teleport + Spawn',
    description: 'ทดสอบ flow หลักของ delivery แบบครบชุด',
    commandTemplates: [
      '#Announce {announceText}',
      '#TeleportTo {teleportTargetQuoted}',
      '#SpawnItem {steamId} {gameItemId} {quantity}',
      '#TeleportTo {returnTargetQuoted}',
    ],
    defaults: {
      announceText: 'DELIVERY TEST',
      teleportTarget: 'Coke TAMTHAI',
      returnTarget: 'Admin Anchor',
      steamId: '76561198000000000',
      gameItemId: 'Weapon_M1911',
      quantity: 1,
    },
    tags: ['announce', 'teleport', 'spawn', 'delivery'],
  }, { builtin: true }),
  normalizeCapabilityEntry({
    id: 'vehicle-teleport-spawn',
    name: 'Vehicle Teleport + Spawn',
    description: 'ทดสอบ delivery profile แบบ teleport ไป vehicle แล้ว spawn item',
    commandTemplates: [
      '#TeleportToVehicle {teleportTargetRaw}',
      '#SpawnItem {steamId} {gameItemId} {quantity}',
      '#TeleportTo {returnTargetQuoted}',
    ],
    defaults: {
      teleportTarget: 'AdminBike',
      returnTarget: 'Admin Anchor',
      steamId: '76561198000000000',
      gameItemId: 'Weapon_M1911',
      quantity: 1,
    },
    tags: ['teleport', 'vehicle', 'spawn'],
  }, { builtin: true }),
]);

function listBuiltInScumAdminCommandCapabilities() {
  return BUILTIN_SCUM_ADMIN_COMMAND_CAPABILITIES.map((entry) => ({
    ...entry,
    commandTemplates: entry.commandTemplates.slice(),
    defaults: { ...(entry.defaults || {}) },
    tags: Array.isArray(entry.tags) ? entry.tags.slice() : [],
  }));
}

function getBuiltInScumAdminCommandCapability(capabilityId) {
  const id = text(capabilityId, 120).toLowerCase();
  if (!id) return null;
  const found = BUILTIN_SCUM_ADMIN_COMMAND_CAPABILITIES.find(
    (entry) => String(entry.id || '').trim().toLowerCase() === id,
  );
  return found
    ? {
        ...found,
        commandTemplates: found.commandTemplates.slice(),
        defaults: { ...(found.defaults || {}) },
        tags: Array.isArray(found.tags) ? found.tags.slice() : [],
      }
    : null;
}

module.exports = {
  DEFAULT_PRESET_KEYS,
  getBuiltInScumAdminCommandCapability,
  listBuiltInScumAdminCommandCapabilities,
  normalizeCapabilityEntry,
  normalizeCommandTemplates,
  normalizeDefaults,
};
