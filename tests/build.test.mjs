import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('an incompatible upstream change stops the build instead of publishing an unprotected Worker', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'maple-notes-test-'));
  try {
    mkdirSync(join(fixture, 'scripts'));
    mkdirSync(join(fixture, 'patches'));
    copyFileSync(join(root, 'scripts/build.mjs'), join(fixture, 'scripts/build.mjs'));
    copyFileSync(join(root, 'patches/private-worker.patch'), join(fixture, 'patches/private-worker.patch'));
    const original = readFileSync(join(root, 'telegram_webproxy.js'), 'utf8');
    assert.ok(original.includes('globalThis.crypto'));
    writeFileSync(join(fixture, 'telegram_webproxy.js'), original.replace('globalThis.crypto', 'upstreamChangedCryptoApi'));
    const result = spawnSync(process.execPath, [join(fixture, 'scripts/build.mjs')], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /patch does not apply|patch failed/);
  } finally {
    assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith('maple-notes-test-'));
    rmSync(fixture, { recursive: true, force: true });
  }
});
