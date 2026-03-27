'use strict';

function freezeDeep(value) {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const child of Object.values(value)) {
    freezeDeep(child);
  }
  return value;
}

const CONFIG_FILES = freezeDeep([
  {
    file: 'ServerSettings.ini',
    label: 'ไฟล์ตั้งค่าเซิร์ฟเวอร์หลัก',
    labelKey: 'config.files.serverSettings.label',
    description: 'ค่าหลักของเซิร์ฟเวอร์ SCUM เช่นชื่อเซิร์ฟเวอร์ เวลา โลก และตัวเลือกการเล่น',
    descriptionKey: 'config.files.serverSettings.description',
    parseMode: 'ini',
    advanced: true,
  },
  {
    file: 'AdminUsers.ini',
    label: 'รายชื่อผู้ดูแล',
    labelKey: 'config.files.adminUsers.label',
    description: 'รายชื่อ Steam ID หรือบัญชีที่ได้รับสิทธิ์ผู้ดูแลบนเซิร์ฟเวอร์',
    descriptionKey: 'config.files.adminUsers.description',
    parseMode: 'line-list',
    advanced: true,
  },
  {
    file: 'BannedUsers.ini',
    label: 'รายชื่อผู้ถูกแบน',
    labelKey: 'config.files.bannedUsers.label',
    description: 'รายชื่อผู้เล่นที่ถูกแบนออกจากเซิร์ฟเวอร์',
    descriptionKey: 'config.files.bannedUsers.description',
    parseMode: 'line-list',
    advanced: true,
  },
]);

const CATEGORY_DEFINITIONS = freezeDeep([
  {
    key: 'general',
    label: 'ทั่วไป',
    labelKey: 'config.categories.general.label',
    description: 'ชื่อเซิร์ฟเวอร์ คำอธิบาย และข้อมูลที่ผู้เล่นเห็นเป็นอย่างแรก',
    descriptionKey: 'config.categories.general.description',
  },
  {
    key: 'world',
    label: 'โลกและเวลา',
    labelKey: 'config.categories.world.label',
    description: 'ควบคุมความเร็วเวลาและบรรยากาศของโลกในเกม',
    descriptionKey: 'config.categories.world.description',
  },
  {
    key: 'respawn',
    label: 'การเกิดใหม่',
    labelKey: 'config.categories.respawn.label',
    description: 'เวลารอและต้นทุนการกลับเข้าเล่นของผู้เล่น',
    descriptionKey: 'config.categories.respawn.description',
  },
  {
    key: 'vehicles',
    label: 'ยานพาหนะ',
    labelKey: 'config.categories.vehicles.label',
    description: 'ความถี่และความพร้อมของยานพาหนะในโลก',
    descriptionKey: 'config.categories.vehicles.description',
  },
  {
    key: 'damage',
    label: 'ความเสียหาย',
    labelKey: 'config.categories.damage.label',
    description: 'ตัวคูณความเสียหายของผู้เล่น ซอมบี้ และสิ่งป้องกันต่าง ๆ',
    descriptionKey: 'config.categories.damage.description',
  },
  {
    key: 'features',
    label: 'ฟีเจอร์การเล่น',
    labelKey: 'config.categories.features.label',
    description: 'ตัวเลือกที่ผู้เล่นสัมผัสได้โดยตรง เช่นแผนที่ กล้อง และครอสแฮร์',
    descriptionKey: 'config.categories.features.description',
  },
  {
    key: 'security',
    label: 'ความปลอดภัยและผู้ดูแล',
    labelKey: 'config.categories.security.label',
    description: 'สิทธิ์ผู้ดูแล รายชื่อผู้ถูกแบน และการควบคุมที่กระทบความปลอดภัย',
    descriptionKey: 'config.categories.security.description',
  },
  {
    key: 'events',
    label: 'บังเกอร์และอีเวนต์',
    labelKey: 'config.categories.events.label',
    description: 'ตัวเลือกของเหตุการณ์พิเศษและจังหวะกิจกรรมในโลก',
    descriptionKey: 'config.categories.events.description',
  },
  {
    key: 'advanced',
    label: 'ขั้นสูง',
    labelKey: 'config.categories.advanced.label',
    description: 'มุมมองสำหรับค่าดิบและไฟล์ที่ยังไม่มีแบบฟอร์มใช้งานง่าย',
    descriptionKey: 'config.categories.advanced.description',
  },
]);

const SETTING_DEFINITIONS = freezeDeep([
  {
    id: 'general.serverName',
    file: 'ServerSettings.ini',
    category: 'general',
    group: 'identity',
    section: 'General',
    key: 'ServerName',
    label: 'ชื่อเซิร์ฟเวอร์',
    labelKey: 'config.general.serverName.label',
    description: 'ชื่อที่แสดงในรายชื่อเซิร์ฟเวอร์และในหน้าแรกของผู้เล่น',
    descriptionKey: 'config.general.serverName.description',
    type: 'string',
    defaultValue: '',
    requiresRestart: true,
    visibility: 'basic',
  },
  {
    id: 'general.serverDescription',
    file: 'ServerSettings.ini',
    category: 'general',
    group: 'identity',
    section: 'General',
    key: 'ServerDescription',
    label: 'คำอธิบายเซิร์ฟเวอร์',
    labelKey: 'config.general.serverDescription.label',
    description: 'ข้อความสั้นที่อธิบายแนวเซิร์ฟเวอร์หรือกติกาเบื้องต้น',
    descriptionKey: 'config.general.serverDescription.description',
    type: 'string',
    defaultValue: '',
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'general.welcomeMessage',
    file: 'ServerSettings.ini',
    category: 'general',
    group: 'identity',
    section: 'General',
    key: 'WelcomeMessage',
    label: 'ข้อความต้อนรับ',
    labelKey: 'config.general.welcomeMessage.label',
    description: 'ข้อความที่อยากให้ผู้เล่นเห็นเมื่อเข้าเซิร์ฟเวอร์',
    descriptionKey: 'config.general.welcomeMessage.description',
    type: 'string',
    defaultValue: '',
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'general.maxPlayers',
    file: 'ServerSettings.ini',
    category: 'general',
    group: 'identity',
    section: 'General',
    key: 'MaxPlayers',
    label: 'จำนวนผู้เล่นสูงสุด',
    labelKey: 'config.general.maxPlayers.label',
    description: 'จำนวนช่องสูงสุดที่เปิดให้ผู้เล่นเข้าได้พร้อมกัน',
    descriptionKey: 'config.general.maxPlayers.description',
    type: 'number',
    defaultValue: 64,
    min: 1,
    max: 128,
    requiresRestart: true,
    visibility: 'basic',
  },
  {
    id: 'general.maxPing',
    file: 'ServerSettings.ini',
    category: 'general',
    group: 'network',
    section: 'General',
    key: 'MaxPing',
    label: 'ค่า Ping สูงสุด',
    labelKey: 'config.general.maxPing.label',
    description: 'ช่วยลดผู้เล่นที่ ping สูงเกินไปจนกระทบประสบการณ์ของคนอื่น',
    descriptionKey: 'config.general.maxPing.description',
    type: 'number',
    defaultValue: 250,
    min: 0,
    max: 999,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'world.globalTimeMultiplier',
    file: 'ServerSettings.ini',
    category: 'world',
    group: 'time',
    section: 'World',
    key: 'GlobalTimeMultiplier',
    label: 'ความเร็วเวลารวม',
    labelKey: 'config.world.globalTimeMultiplier.label',
    description: 'กำหนดว่าเวลาในโลกเดินเร็วขึ้นหรือช้าลงเท่าไร',
    descriptionKey: 'config.world.globalTimeMultiplier.description',
    type: 'number',
    defaultValue: 1,
    min: 0.1,
    max: 10,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'world.dayCycleSpeed',
    file: 'ServerSettings.ini',
    category: 'world',
    group: 'time',
    section: 'World',
    key: 'DayCycleSpeed',
    label: 'ความเร็วช่วงกลางวัน',
    labelKey: 'config.world.dayCycleSpeed.label',
    description: 'กำหนดว่าช่วงกลางวันเดินเร็วแค่ไหน',
    descriptionKey: 'config.world.dayCycleSpeed.description',
    type: 'number',
    defaultValue: 1,
    min: 0.1,
    max: 10,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'world.nightCycleSpeed',
    file: 'ServerSettings.ini',
    category: 'world',
    group: 'time',
    section: 'World',
    key: 'NightCycleSpeed',
    label: 'ความเร็วช่วงกลางคืน',
    labelKey: 'config.world.nightCycleSpeed.label',
    description: 'กำหนดว่าช่วงกลางคืนเดินเร็วแค่ไหน',
    descriptionKey: 'config.world.nightCycleSpeed.description',
    type: 'number',
    defaultValue: 1,
    min: 0.1,
    max: 10,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'respawn.characterRespawnTime',
    file: 'ServerSettings.ini',
    category: 'respawn',
    group: 'players',
    section: 'Respawn',
    key: 'CharacterRespawnTime',
    label: 'เวลารอก่อนเกิดใหม่',
    labelKey: 'config.respawn.characterRespawnTime.label',
    description: 'เวลารอเป็นวินาทีก่อนผู้เล่นกดเกิดใหม่ได้อีกครั้ง',
    descriptionKey: 'config.respawn.characterRespawnTime.description',
    type: 'number',
    defaultValue: 60,
    min: 0,
    max: 7200,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'respawn.famePointRespawnCost',
    file: 'ServerSettings.ini',
    category: 'respawn',
    group: 'players',
    section: 'Respawn',
    key: 'FamePointRespawnCost',
    label: 'ค่า Fame ที่ใช้ตอนเกิดใหม่',
    labelKey: 'config.respawn.famePointRespawnCost.label',
    description: 'กำหนดค่า Fame Point ที่หักเมื่อผู้เล่นเลือกเกิดใหม่แบบพิเศษ',
    descriptionKey: 'config.respawn.famePointRespawnCost.description',
    type: 'number',
    defaultValue: 0,
    min: 0,
    max: 10000,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'vehicles.vehicleSpawnMultiplier',
    file: 'ServerSettings.ini',
    category: 'vehicles',
    group: 'spawn',
    section: 'Vehicles',
    key: 'VehicleSpawnMultiplier',
    label: 'ตัวคูณการเกิดของยานพาหนะ',
    labelKey: 'config.vehicles.vehicleSpawnMultiplier.label',
    description: 'เพิ่มหรือลดจำนวนยานพาหนะที่เกิดในโลก',
    descriptionKey: 'config.vehicles.vehicleSpawnMultiplier.description',
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 10,
    requiresRestart: true,
    visibility: 'basic',
  },
  {
    id: 'vehicles.vehicleFuelMultiplier',
    file: 'ServerSettings.ini',
    category: 'vehicles',
    group: 'spawn',
    section: 'Vehicles',
    key: 'VehicleFuelMultiplier',
    label: 'ตัวคูณเชื้อเพลิงยานพาหนะ',
    labelKey: 'config.vehicles.vehicleFuelMultiplier.label',
    description: 'กำหนดปริมาณเชื้อเพลิงเริ่มต้นของยานพาหนะในโลก',
    descriptionKey: 'config.vehicles.vehicleFuelMultiplier.description',
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 10,
    requiresRestart: true,
    visibility: 'basic',
  },
  {
    id: 'damage.damageMultiplier',
    file: 'ServerSettings.ini',
    category: 'damage',
    group: 'combat',
    section: 'Damage',
    key: 'DamageMultiplier',
    label: 'ตัวคูณความเสียหายรวม',
    labelKey: 'config.damage.damageMultiplier.label',
    description: 'ตัวคูณหลักของความเสียหายที่ผู้เล่นได้รับและสร้าง',
    descriptionKey: 'config.damage.damageMultiplier.description',
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 10,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'damage.zombieDamageMultiplier',
    file: 'ServerSettings.ini',
    category: 'damage',
    group: 'combat',
    section: 'Damage',
    key: 'ZombieDamageMultiplier',
    label: 'ตัวคูณความเสียหายจากซอมบี้',
    labelKey: 'config.damage.zombieDamageMultiplier.label',
    description: 'เพิ่มหรือลดความรุนแรงของการโจมตีจากซอมบี้',
    descriptionKey: 'config.damage.zombieDamageMultiplier.description',
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 10,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'features.allowMapScreen',
    file: 'ServerSettings.ini',
    category: 'features',
    group: 'player-access',
    section: 'Features',
    key: 'AllowMapScreen',
    label: 'เปิดใช้แผนที่',
    labelKey: 'config.features.allowMapScreen.label',
    description: 'ให้ผู้เล่นเปิดแผนที่ในเกมได้หรือไม่',
    descriptionKey: 'config.features.allowMapScreen.description',
    type: 'boolean',
    defaultValue: true,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'features.allowCrosshair',
    file: 'ServerSettings.ini',
    category: 'features',
    group: 'player-access',
    section: 'Features',
    key: 'AllowCrosshair',
    label: 'เปิดใช้ครอสแฮร์',
    labelKey: 'config.features.allowCrosshair.label',
    description: 'ให้ผู้เล่นเห็นจุดเล็งบนหน้าจอหรือไม่',
    descriptionKey: 'config.features.allowCrosshair.description',
    type: 'boolean',
    defaultValue: true,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'features.allowFirstPerson',
    file: 'ServerSettings.ini',
    category: 'features',
    group: 'player-access',
    section: 'Features',
    key: 'AllowFirstPerson',
    label: 'เปิดมุมมองบุคคลที่หนึ่ง',
    labelKey: 'config.features.allowFirstPerson.label',
    description: 'ให้ผู้เล่นสลับเป็นมุมมองบุคคลที่หนึ่งได้หรือไม่',
    descriptionKey: 'config.features.allowFirstPerson.description',
    type: 'boolean',
    defaultValue: true,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'features.allowThirdPerson',
    file: 'ServerSettings.ini',
    category: 'features',
    group: 'player-access',
    section: 'Features',
    key: 'AllowThirdPerson',
    label: 'เปิดมุมมองบุคคลที่สาม',
    labelKey: 'config.features.allowThirdPerson.label',
    description: 'ให้ผู้เล่นสลับเป็นมุมมองบุคคลที่สามได้หรือไม่',
    descriptionKey: 'config.features.allowThirdPerson.description',
    type: 'boolean',
    defaultValue: true,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'features.allowGlobalChat',
    file: 'ServerSettings.ini',
    category: 'features',
    group: 'player-access',
    section: 'Features',
    key: 'AllowGlobalChat',
    label: 'เปิดแชตโลก',
    labelKey: 'config.features.allowGlobalChat.label',
    description: 'อนุญาตให้ผู้เล่นใช้แชตสาธารณะทั่วเซิร์ฟเวอร์หรือไม่',
    descriptionKey: 'config.features.allowGlobalChat.description',
    type: 'boolean',
    defaultValue: true,
    requiresRestart: false,
    visibility: 'basic',
  },
  {
    id: 'events.enableBunkerEvents',
    file: 'ServerSettings.ini',
    category: 'events',
    group: 'bunker',
    section: 'Events',
    key: 'EnableBunkerEvents',
    label: 'เปิดอีเวนต์บังเกอร์',
    labelKey: 'config.events.enableBunkerEvents.label',
    description: 'กำหนดว่าจะเปิดระบบอีเวนต์บังเกอร์ในเซิร์ฟเวอร์หรือไม่',
    descriptionKey: 'config.events.enableBunkerEvents.description',
    type: 'boolean',
    defaultValue: true,
    requiresRestart: true,
    visibility: 'basic',
  },
  {
    id: 'events.eventFrequencyMultiplier',
    file: 'ServerSettings.ini',
    category: 'events',
    group: 'bunker',
    section: 'Events',
    key: 'EventFrequencyMultiplier',
    label: 'ตัวคูณความถี่อีเวนต์',
    labelKey: 'config.events.eventFrequencyMultiplier.label',
    description: 'เพิ่มหรือลดความถี่ของอีเวนต์พิเศษในโลก',
    descriptionKey: 'config.events.eventFrequencyMultiplier.description',
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 10,
    requiresRestart: true,
    visibility: 'basic',
  },
]);

function normalizeCategoryKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getConfigFileDefinitions() {
  return CONFIG_FILES.map((entry) => ({ ...entry }));
}

function getConfigCategoryDefinitions() {
  return CATEGORY_DEFINITIONS.map((entry) => ({ ...entry }));
}

function getConfigSettingDefinitions() {
  return SETTING_DEFINITIONS.map((entry) => ({ ...entry }));
}

function getConfigSettingsForCategory(categoryKey) {
  const normalized = normalizeCategoryKey(categoryKey);
  return SETTING_DEFINITIONS
    .filter((entry) => normalizeCategoryKey(entry.category) === normalized)
    .map((entry) => ({ ...entry }));
}

function findConfigSettingDefinition(match = {}) {
  const file = String(match.file || '').trim();
  const section = String(match.section || '').trim();
  const key = String(match.key || '').trim();
  const id = String(match.id || '').trim();
  return SETTING_DEFINITIONS.find((entry) => {
    if (id && entry.id === id) return true;
    return entry.file === file
      && String(entry.section || '').trim() === section
      && entry.key === key;
  }) || null;
}

function coerceBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized);
}

function clampNumber(value, min, max, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  let next = parsed;
  if (Number.isFinite(min)) next = Math.max(min, next);
  if (Number.isFinite(max)) next = Math.min(max, next);
  return next;
}

function normalizeSettingValue(definition, value, options = {}) {
  const def = definition && typeof definition === 'object' ? definition : {};
  const fallback = Object.prototype.hasOwnProperty.call(def, 'defaultValue')
    ? def.defaultValue
    : null;
  const raw = value == null || value === '' ? fallback : value;
  if (def.type === 'number') {
    return clampNumber(raw, def.min, def.max, Number(fallback || 0));
  }
  if (def.type === 'boolean') {
    return coerceBoolean(raw, Boolean(fallback));
  }
  if (def.type === 'select') {
    const optionsList = Array.isArray(def.options) ? def.options : [];
    const normalized = String(raw ?? fallback ?? '').trim();
    if (!normalized) return String(fallback ?? '').trim();
    if (options.enforceKnownOption === true && optionsList.length > 0) {
      const allowedValues = new Set(optionsList.map((entry) => String(entry?.value ?? '').trim()));
      return allowedValues.has(normalized) ? normalized : String(fallback ?? '').trim();
    }
    return normalized;
  }
  return String(raw ?? fallback ?? '').trim();
}

function serializeSettingValue(definition, value) {
  const normalized = normalizeSettingValue(definition, value, { enforceKnownOption: true });
  if (definition?.type === 'boolean') {
    return normalized ? 'true' : 'false';
  }
  if (definition?.type === 'number') {
    return String(normalized);
  }
  return String(normalized ?? '').trim();
}

module.exports = {
  findConfigSettingDefinition,
  getConfigCategoryDefinitions,
  getConfigFileDefinitions,
  getConfigSettingDefinitions,
  getConfigSettingsForCategory,
  normalizeSettingValue,
  serializeSettingValue,
};
