const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../src');
const FILE_PATTERN = /\.(ts|tsx)$/;
const LEGACY_IMPORT_PATTERN = /from\s+['"](\\.\\.\/|\\.\\.\/\\.\\.\/)theme\/(colors|spacing|typography)['"]/;

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const offenders = [];
const files = walk(SRC_DIR);

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (LEGACY_IMPORT_PATTERN.test(content)) {
    offenders.push(file);
  }
}

if (offenders.length > 0) {
  console.error('Legacy static theme imports found. Migrate to useTheme/useThemedStyles:');
  for (const file of offenders) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('No legacy static theme imports found.');
