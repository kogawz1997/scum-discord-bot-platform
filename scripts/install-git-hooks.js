'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  console.log('[hooks] core.hooksPath=.githooks');
} catch (error) {
  console.error('[hooks] failed to configure git hooks:', error.message);
  process.exit(1);
}
