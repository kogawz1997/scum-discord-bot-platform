'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GENERATED_CLIENT_METADATA_PATH = path.join(
  PROJECT_ROOT,
  'artifacts',
  'prisma',
  'generated',
  'current.json',
);
const GENERATED_CLIENT_ROOT = path.join(
  PROJECT_ROOT,
  'artifacts',
  'prisma',
  'generated',
);

function trimText(value, maxLen = 4000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function resolveClientModulePath() {
  const directPath = trimText(process.env.PRISMA_CLIENT_MODULE_PATH, 4000);
  if (directPath) {
    return path.isAbsolute(directPath)
      ? directPath
      : path.resolve(PROJECT_ROOT, directPath);
  }
  const requestedProvider = resolveRequestedProvider();
  const generatedMetadata = getGeneratedClientMetadata();
  if (requestedProvider) {
    const metadataProvider = trimText(generatedMetadata?.provider, 80).toLowerCase();
    if (metadataProvider === requestedProvider) {
      const metadataOutputPath = trimText(generatedMetadata?.outputPath, 4000);
      if (metadataOutputPath) {
        return path.isAbsolute(metadataOutputPath)
          ? metadataOutputPath
          : path.resolve(PROJECT_ROOT, metadataOutputPath);
      }
    }
    const providerClientPath = findLatestGeneratedClientForProvider(requestedProvider);
    if (providerClientPath) {
      return providerClientPath;
    }
  }
  if (!generatedMetadata) return null;
  const outputPath = trimText(generatedMetadata?.outputPath, 4000);
  if (!outputPath) return null;
  return path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(PROJECT_ROOT, outputPath);
}

function normalizeProvider(value) {
  const provider = trimText(value, 120).toLowerCase();
  if (provider === 'postgres') return 'postgresql';
  if (provider === 'postgresql' || provider === 'sqlite' || provider === 'mysql') {
    return provider;
  }
  return '';
}

function resolveRequestedProvider() {
  return normalizeProvider(process.env.PRISMA_SCHEMA_PROVIDER || process.env.DATABASE_PROVIDER);
}

function findLatestGeneratedClientForProvider(provider) {
  const normalizedProvider = normalizeProvider(provider);
  if (!normalizedProvider) return null;
  const providerRoot = path.join(GENERATED_CLIENT_ROOT, normalizedProvider);
  if (!fs.existsSync(providerRoot)) return null;
  const directories = fs.readdirSync(providerRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(providerRoot, entry.name, 'client');
      return {
        fullPath,
        mtimeMs: fs.existsSync(fullPath) ? fs.statSync(fullPath).mtimeMs : 0,
      };
    })
    .filter((entry) => entry.mtimeMs > 0)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
  return directories[0]?.fullPath || null;
}

function tryRequire(modulePath) {
  if (!modulePath) return null;
  try {
    return require(modulePath);
  } catch {
    return null;
  }
}

function getPrismaClientModule() {
  const generatedModulePath = resolveClientModulePath();
  const generatedModule = tryRequire(generatedModulePath);
  if (generatedModule?.PrismaClient) {
    return generatedModule;
  }
  return require('@prisma/client');
}

function getGeneratedClientMetadata() {
  if (!fs.existsSync(GENERATED_CLIENT_METADATA_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(GENERATED_CLIENT_METADATA_PATH, 'utf8'));
  } catch {
    return null;
  }
}

const prismaClientModule = getPrismaClientModule();

module.exports = {
  GENERATED_CLIENT_METADATA_PATH,
  GENERATED_CLIENT_ROOT,
  Prisma: prismaClientModule.Prisma,
  PrismaClient: prismaClientModule.PrismaClient,
  findLatestGeneratedClientForProvider,
  getGeneratedClientMetadata,
  getPrismaClientModule,
  normalizeProvider,
  resolveRequestedProvider,
  resolveClientModulePath,
};
