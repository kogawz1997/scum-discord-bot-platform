const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const includeDirs = ['src', 'scripts', 'apps', 'test'];
const jsFiles = [];
const ignoredDirNames = new Set(['node_modules', 'dist', 'build', 'coverage', 'output', '.vite']);

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirNames.has(entry.name)) {
        continue;
      }
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      jsFiles.push(fullPath);
    }
  }
}

for (const dir of includeDirs) {
  walk(path.join(root, dir));
}
let hasError = false;
for (const file of jsFiles.sort()) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log(`OK: ${path.relative(root, file)}`);
  } catch (error) {
    hasError = true;
    console.error(`ERROR: ${path.relative(root, file)}`);
    if (error.stderr) {
      process.stderr.write(error.stderr.toString());
    }
  }
}

if (hasError) {
  process.exit(1);
}
