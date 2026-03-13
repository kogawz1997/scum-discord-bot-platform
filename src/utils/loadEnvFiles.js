'use strict';

const fs = require('node:fs');
const dotenv = require('dotenv');

function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

function mergeEnvMaps(baseValues, overlayValues, options = {}) {
  const { ignoreEmptyOverlay = true } = options;
  const merged = { ...baseValues };
  for (const [key, value] of Object.entries(overlayValues || {})) {
    if (ignoreEmptyOverlay && String(value || '').trim() === '') {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function applyEnvMap(envMap, options = {}) {
  const { overrideExisting = false } = options;
  for (const [key, value] of Object.entries(envMap || {})) {
    if (!overrideExisting && Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }
    process.env[key] = value;
  }
}

function loadMergedEnvFiles(options = {}) {
  const {
    basePath,
    overlayPath,
    ignoreEmptyOverlay = true,
    overrideExisting = false,
  } = options;

  const baseValues = parseEnvFile(basePath);
  const overlayValues = parseEnvFile(overlayPath);
  const merged = mergeEnvMaps(baseValues, overlayValues, { ignoreEmptyOverlay });
  applyEnvMap(merged, { overrideExisting });
  return {
    merged,
    baseLoaded: Object.keys(baseValues).length > 0,
    overlayLoaded: Object.keys(overlayValues).length > 0,
  };
}

module.exports = {
  parseEnvFile,
  mergeEnvMaps,
  applyEnvMap,
  loadMergedEnvFiles,
};
