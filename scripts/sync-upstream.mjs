import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const files = ['telegram_webproxy.js', 'README.md', 'LICENSE'];
git('fetch', '--no-tags', '--depth=1', 'https://github.com/annpardo/CF-Workers-TGProxy.git', 'main');
const revision = git('rev-parse', 'FETCH_HEAD');
git('restore', '--source=FETCH_HEAD', '--worktree', '--', ...files);
writeFileSync(join(root, '.upstream-revision'), `${revision}\n`);
console.log(`Fetched upstream ${revision}. Only source, README and license were updated.`);
console.log('Run npm run verify before committing or deploying these changes.');
