'use strict';

const path = require('node:path');

const { runSqlitePlatformSchemaUpgrade } = require('./platform-schema-upgrade');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const LOCAL_SQLITE_ARTIFACT_DATABASE_URLS = Object.freeze([
  `file:${path.join(PROJECT_ROOT, 'prisma', 'prisma', 'dev.db').replace(/\\/g, '/')}`,
  `file:${path.join(PROJECT_ROOT, 'prisma', 'prisma', 'test.db').replace(/\\/g, '/')}`,
]);

function refreshLocalSqliteArtifacts(databaseUrls = LOCAL_SQLITE_ARTIFACT_DATABASE_URLS) {
  for (const databaseUrl of databaseUrls) {
    console.log(`[local-sqlite-artifacts] refreshing ${databaseUrl}`);
    runSqlitePlatformSchemaUpgrade({ databaseUrl });
  }
}

if (require.main === module) {
  refreshLocalSqliteArtifacts();
}

module.exports = {
  LOCAL_SQLITE_ARTIFACT_DATABASE_URLS,
  refreshLocalSqliteArtifacts,
};
