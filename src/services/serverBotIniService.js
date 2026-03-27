'use strict';

const {
  serializeSettingValue,
} = require('./serverBotConfigSchemaService');

function trimText(value, maxLen = 2000) {
  const text = String(value || '');
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeSection(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return String(value || '').trim();
}

function createRootSectionKey() {
  return '__root__';
}

function parseIniContent(rawContent = '') {
  const text = String(rawContent || '');
  const normalizedText = text.replace(/\r\n/g, '\n');
  const sourceLines = normalizedText.split('\n');
  const lines = [];
  const sections = new Map();
  let currentSection = createRootSectionKey();

  function ensureSection(sectionName) {
    const normalized = sectionName || createRootSectionKey();
    if (!sections.has(normalized)) {
      sections.set(normalized, {
        name: normalized,
        lineIndex: -1,
        keys: new Map(),
      });
    }
    return sections.get(normalized);
  }

  ensureSection(currentSection);

  sourceLines.forEach((line, index) => {
    const rawLine = line;
    const trimmed = rawLine.trim();
    if (!trimmed) {
      lines.push({ type: 'blank', raw: rawLine, index, section: currentSection });
      return;
    }
    if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
      lines.push({ type: 'comment', raw: rawLine, index, section: currentSection });
      return;
    }
    const sectionMatch = trimmed.match(/^\[(.+)]$/);
    if (sectionMatch) {
      currentSection = normalizeSection(sectionMatch[1]) || createRootSectionKey();
      const sectionState = ensureSection(currentSection);
      sectionState.lineIndex = index;
      lines.push({ type: 'section', raw: rawLine, index, section: currentSection });
      return;
    }

    const equalsIndex = rawLine.indexOf('=');
    if (equalsIndex < 0) {
      lines.push({ type: 'other', raw: rawLine, index, section: currentSection });
      return;
    }

    const key = normalizeKey(rawLine.slice(0, equalsIndex));
    const value = rawLine.slice(equalsIndex + 1);
    const sectionState = ensureSection(currentSection);
    sectionState.keys.set(key, {
      key,
      value,
      lineIndex: index,
      section: currentSection,
    });
    lines.push({
      type: 'pair',
      raw: rawLine,
      index,
      section: currentSection,
      key,
      value,
    });
  });

  return {
    lines,
    sections,
    newline: rawContent.includes('\r\n') ? '\r\n' : '\n',
  };
}

function readIniValue(parsedDocument, section, key) {
  const parsed = parsedDocument && typeof parsedDocument === 'object'
    ? parsedDocument
    : parseIniContent(parsedDocument);
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return null;
  const normalizedSection = normalizeSection(section);
  if (normalizedSection) {
    const sectionState = parsed.sections.get(normalizedSection);
    if (sectionState?.keys?.has(normalizedKey)) {
      return sectionState.keys.get(normalizedKey).value;
    }
  }
  for (const sectionState of parsed.sections.values()) {
    if (sectionState?.keys?.has(normalizedKey)) {
      return sectionState.keys.get(normalizedKey).value;
    }
  }
  return null;
}

function updateRawLine(lineState, nextValue) {
  return `${lineState.key}=${nextValue}`;
}

function findSectionInsertionIndex(lines, sectionName) {
  const normalizedSection = normalizeSection(sectionName);
  if (!normalizedSection) {
    let rootLastPairIndex = -1;
    for (const line of lines) {
      if (line.section === createRootSectionKey() && line.type === 'pair') {
        rootLastPairIndex = line.index;
      }
      if (line.type === 'section') {
        return rootLastPairIndex >= 0 ? rootLastPairIndex + 1 : line.index;
      }
    }
    return rootLastPairIndex >= 0 ? rootLastPairIndex + 1 : lines.length;
  }

  let sectionLineIndex = -1;
  for (const line of lines) {
    if (line.type === 'section' && normalizeSection(line.section) === normalizedSection) {
      sectionLineIndex = line.index;
      continue;
    }
    if (sectionLineIndex >= 0 && line.type === 'section') {
      return line.index;
    }
  }
  return sectionLineIndex >= 0 ? lines.length : -1;
}

function patchIniContent(rawContent, changes = []) {
  const parsed = parseIniContent(rawContent);
  const nextLines = parsed.lines.map((line) => line.raw);
  const applied = [];

  for (const change of Array.isArray(changes) ? changes : []) {
    const section = normalizeSection(change.section);
    const key = normalizeKey(change.key);
    if (!key) continue;
    const definition = change.definition || null;
    const serializedValue = definition
      ? serializeSettingValue(definition, change.value)
      : trimText(change.value ?? '', 4000);

    let lineState = null;
    if (section) {
      const sectionState = parsed.sections.get(section);
      lineState = sectionState?.keys?.get(key) || null;
    }
    if (!lineState) {
      for (const sectionState of parsed.sections.values()) {
        if (sectionState?.keys?.has(key)) {
          lineState = sectionState.keys.get(key);
          break;
        }
      }
    }

    if (lineState) {
      nextLines[lineState.lineIndex] = updateRawLine(lineState, serializedValue);
      applied.push({
        file: change.file,
        section: normalizeSection(lineState.section) === createRootSectionKey() ? '' : lineState.section,
        key,
        value: serializedValue,
        mode: 'update',
      });
      continue;
    }

    const insertionIndex = findSectionInsertionIndex(parsed.lines, section);
    const newLines = [];
    if (insertionIndex < 0 && section) {
      newLines.push(`[${section}]`);
    }
    newLines.push(`${key}=${serializedValue}`);
    const index = insertionIndex < 0 ? nextLines.length : insertionIndex;
    nextLines.splice(index, 0, ...newLines);
    applied.push({
      file: change.file,
      section,
      key,
      value: serializedValue,
      mode: 'insert',
    });
  }

  return {
    content: nextLines.join(parsed.newline),
    applied,
  };
}

function parseLineListContent(rawContent = '') {
  return String(rawContent || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith(';'));
}

function serializeLineListContent(entries = []) {
  return Array.from(new Set(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean),
  )).join('\n');
}

module.exports = {
  parseIniContent,
  parseLineListContent,
  patchIniContent,
  readIniValue,
  serializeLineListContent,
};
