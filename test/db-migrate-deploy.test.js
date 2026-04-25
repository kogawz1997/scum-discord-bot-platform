const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseCliArgs,
  resolveMigrateDeployPlan,
} = require('../scripts/db-migrate-deploy');

test('parseCliArgs extracts provider flag and leaves passthrough args', () => {
  assert.deepEqual(
    parseCliArgs(['--provider', 'postgresql', '--schema', 'custom.prisma']),
    {
      provider: 'postgresql',
      passthroughArgs: ['--schema', 'custom.prisma'],
    },
  );
  assert.deepEqual(
    parseCliArgs(['--provider=sqlite']),
    {
      provider: 'sqlite',
      passthroughArgs: [],
    },
  );
});

test('resolveMigrateDeployPlan routes PostgreSQL through platform schema upgrade', () => {
  const plan = resolveMigrateDeployPlan({
    provider: 'postgresql',
    env: {
      DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/scum',
    },
  });

  assert.equal(plan.provider, 'postgresql');
  assert.equal(plan.mode, 'postgres-platform-schema-upgrade');
});

test('resolveMigrateDeployPlan keeps SQLite and MySQL on Prisma migrate deploy', () => {
  const sqlitePlan = resolveMigrateDeployPlan({
    provider: 'sqlite',
    env: {
      DATABASE_URL: 'file:./prisma/dev.db',
    },
  });
  const mysqlPlan = resolveMigrateDeployPlan({
    provider: 'mysql',
    env: {
      DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/scum',
    },
  });

  assert.equal(sqlitePlan.mode, 'prisma-migrate-deploy');
  assert.equal(mysqlPlan.mode, 'prisma-migrate-deploy');
});

test('package migration deploy scripts use provider-aware wrapper', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'),
  );

  assert.equal(packageJson.scripts['db:migrate:deploy'], 'node scripts/db-migrate-deploy.js');
  assert.equal(
    packageJson.scripts['db:migrate:deploy:postgresql'],
    'node scripts/db-migrate-deploy.js --provider postgresql',
  );
});
