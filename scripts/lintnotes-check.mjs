#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const argv = new Set(process.argv.slice(2));
const CWD = process.cwd();

const BLOCK_DIRS = [
  'node_modules/',
  'android/',
  'ios/',
  'supabase/',
  'docs/',
  '.git/',
  '.expo/'
];

const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.sql']);

const isBlocked = (p) => BLOCK_DIRS.some((bd) => p.startsWith(bd));

const listTrackedFiles = () => {
  const raw = execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'));
  return raw.filter((p) => !isBlocked(p) && ALLOWED_EXT.has(path.extname(p)));
};

const hasLintnotes = (file) => {
  const content = readFileSync(file, 'utf8');
  const head = content.split(/\r?\n/, 40).join('\n');
  const ext = path.extname(file);
  if (ext === '.sql') {
    return /(^|\n)\s*--\s*Lintnotes/i.test(head);
  }
  // ts/js/tsx/jsx: accept /** */ or // style
  return /Lintnotes/i.test(head) && (/\*\*|\/\//.test(head));
};

// Simple import resolver and cross-ref mapper
const IMPORT_RE = /from\s+['\"]([^'\"]+)['\"];?|require\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
const EXT_TRY = ['.ts', '.tsx', '.js', '.jsx'];

const resolveImport = (fromFile, spec) => {
  if (!spec.startsWith('.') ) return null; // only resolve relative
  const fromDir = path.posix.dirname(fromFile);
  const base = path.posix.normalize(path.posix.join(fromDir, spec));

  const tries = [];
  const ext = path.extname(base);
  if (ext) {
    tries.push(base);
  } else {
    EXT_TRY.forEach((e) => tries.push(base + e));
    EXT_TRY.forEach((e) => tries.push(path.posix.join(base, 'index' + e)));
  }

  for (const t of tries) {
    const fsPath = path.join(CWD, t);
    if (existsSync(fsPath)) return t;
  }
  return null;
};

const buildCrossRefs = (files) => {
  const importers = new Map(files.map((f) => [f, new Set()]));
  for (const f of files) {
    const ext = path.extname(f);
    if (ext === '.sql') continue;
    const src = readFileSync(f, 'utf8');
    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(src))) {
      const spec = (m[1] || m[2] || '').trim();
      const target = resolveImport(f, spec);
      if (target && importers.has(target)) {
        importers.get(target).add(f);
      }
    }
  }
  return importers;
};

const main = () => {
  const files = listTrackedFiles();
  const missing = files.filter((f) => !hasLintnotes(f));

  const importers = buildCrossRefs(files);

  // Heuristics for entrypoints we shouldn't flag as orphans
  const isEntrypoint = (f) =>
    f.startsWith('app/') ||
    /(^|\/)app\.config\.(js|ts)$/.test(f) ||
    /(^|\/)babel\.config\.js$/.test(f) ||
    /(^|\/)config\//.test(f) ||
    path.extname(f) === '.sql';

  const orphans = files
    .filter((f) => !isEntrypoint(f))
    .filter((f) => (importers.get(f)?.size ?? 0) === 0);

  const report = {
    checked: files.length,
    missing,
    orphans,
    // serialize importers to arrays for readability
    usedBy: Object.fromEntries(
      [...importers.entries()].map(([k, v]) => [k, [...v].sort()])
    ),
  };

  const showCrossRef = argv.has('--report') || argv.has('-r');
  if (showCrossRef) {
    console.log('Lintnotes report:\n');
    if (missing.length === 0) console.log('✓ All files have Lintnotes');
    else console.log('Missing Lintnotes in:\n - ' + missing.join('\n - '));

    if (orphans.length) {
      console.log('\nPotential orphans (no importers):');
      orphans.forEach((f) => console.log(' - ' + f));
    }
    console.log('\nUsed by (reverse imports):');
    for (const [file, imps] of Object.entries(report.usedBy)) {
      if (imps.length) console.log(` - ${file}:\n    -> ${imps.join('\n    -> ')}`);
    }
  }

  const strict = true; // enforce by default
  if (strict && missing.length > 0) {
    console.error(`\n✖ Lintnotes check failed: ${missing.length} file(s) missing Lintnotes.`);
    process.exit(1);
  }
};

try {
  main();
} catch (err) {
  console.error('lintnotes-check error:', err?.message || err);
  process.exit(2);
}
