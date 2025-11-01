#!/usr/bin/env node
// Generate code_hash for event access codes using CODE_SALT.
// Usage examples:
//  CODE_SALT=... node scripts/generate-code-hash.mjs --code AB12CD
//  CODE_SALT=... node scripts/generate-code-hash.mjs --random 6 --event <uuid> --role checker --max-uses 20 --expires 2025-12-31T00:00:00Z

import crypto from 'node:crypto';

const envSalt = process.env.CODE_SALT || '';
if (!envSalt) {
  console.error('ERROR: CODE_SALT env var is required');
  process.exit(1);
}

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const key = a.replace(/^--/, '');
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      opts[key] = true;
    } else {
      opts[key] = next;
      i++;
    }
  }
}

function randCode(n = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars
  let out = '';
  for (let i = 0; i < n; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

let code = opts.code || '';
if (!code && opts.random) {
  const len = Number(opts.random) || 6;
  code = randCode(len);
}
if (!code) {
  console.error('ERROR: provide --code <value> or --random <len>');
  process.exit(1);
}

const normalized = code.toUpperCase().replace(/\s+/g, '');
const hash = crypto.createHash('sha256').update(`${envSalt}|${normalized}`).digest('hex');

const result = {
  code,
  normalized,
  code_hash: hash,
};

console.log(JSON.stringify(result, null, 2));

// Optional SQL helper
if (opts.event) {
  const role = (opts.role || 'checker').toLowerCase();
  const maxUses = opts['max-uses'] ? Number(opts['max-uses']) : null;
  const expires = opts.expires || null;
  const singleDevice = opts['single-device'] ? true : false;

  const cols = ['event_id', 'code_hash', 'role'];
  const vals = [`'${opts.event}'`, `'${hash}'`, `'${role}'`];
  if (maxUses !== null) { cols.push('max_uses'); vals.push(String(maxUses)); }
  if (expires) { cols.push('expires_at'); vals.push(`'${expires}'`); }
  if (singleDevice) { cols.push('single_device'); vals.push('true'); }

  const sql = `insert into public.event_access_codes (${cols.join(', ')}) values (${vals.join(', ')});`;
  console.log('\n-- SQL:');
  console.log(sql);
}

