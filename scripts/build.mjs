import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(join(tmpdir(), 'maple-notes-build-'));
try {
  const source = readFileSync(join(root, 'telegram_webproxy.js'), 'utf8').replaceAll('\r\n', '\n');
  writeFileSync(join(temporary, 'telegram_webproxy.js'), source);
  const patch = join(root, 'patches/private-worker.patch');
  const options = { cwd: temporary, stdio: 'inherit' };
  execFileSync('git', ['apply', '--no-index', '--check', patch], options);
  execFileSync('git', ['apply', '--no-index', patch], options);
  const output = join(root, 'dist');
  mkdirSync(output, { recursive: true });
  copyFileSync(join(temporary, 'telegram_webproxy.js'), join(output, 'worker.js'));
  execFileSync(process.execPath, ['--check', join(output, 'worker.js')], options);
  console.log('Private Worker built successfully from upstream source plus local patch.');
} finally {
  if (dirname(resolve(temporary)) !== resolve(tmpdir()) || !basename(temporary).startsWith('maple-notes-build-')) {
    throw new Error('Refusing to remove an unexpected temporary directory.');
  }
  rmSync(temporary, { recursive: true, force: true });
}
