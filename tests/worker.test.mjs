import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../dist/worker.js';

// Synthetic test values. Production credentials are stored only in Cloudflare.
const env = { SECRET: '0123456789abcdef0123456789abcdef', BOOT: 'synthetic-test-bootstrap-only' };
const origin = 'https://worker.example.test';
const request = (path, options) => new Request(origin + path, options);
const invoke = (path, options, bindings = env) => worker.fetch(request(path, options), bindings);

test('health accepts valid configuration and rejects missing/invalid credentials', async () => {
  const good = await invoke('/health');
  assert.equal(good.status, 200);
  assert.deepEqual(await good.json(), { ok: true });
  for (const bindings of [{}, { SECRET: env.SECRET }, { SECRET: 'z'.repeat(32), BOOT: env.BOOT }, { SECRET: 'a'.repeat(48), BOOT: env.BOOT }]) {
    assert.equal((await invoke('/health', undefined, bindings)).status, 500);
  }
});

test('anonymous or incorrect-key visitors cannot obtain the proxy link or secret', async () => {
  for (const path of ['/', '/?access=wrong', '/?bridge=invalid']) {
    const response = await invoke(path);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes('Maple Notes'));
    assert.ok(!html.includes(env.SECRET));
    assert.ok(!html.includes('tg://webproxy'));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  }
});

test('only the correct dashboard key exposes the import link, without third-party contact links', async () => {
  const response = await invoke('/?access=' + env.SECRET);
  const html = await response.text();
  assert.ok(html.includes(`tg://webproxy?server=worker.example.test&secret=${env.SECRET}`));
  assert.ok(!html.includes('https://t.me/'));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
});

test('statistics require authentication and use a request-time start date', async () => {
  for (const path of ['/api/stats', '/api/stats?access=wrong']) {
    assert.equal((await invoke(path)).status, 404);
  }
  const response = await invoke('/api/stats?access=' + env.SECRET);
  assert.equal(response.status, 200);
  const stats = await response.json();
  assert.ok(!stats.machine_boot_time.startsWith('1970'));
  assert.equal(stats.uptime, '0分钟');
  assert.equal(typeof stats.total_sessions, 'number');
});

test('signed Telegram Android bridge retains its sandbox and correct origin', async () => {
  const signature = createHmac('sha256', Buffer.from(env.SECRET, 'hex'))
    .update('tdesktop-web-proxy-bridge-v1\nworker.example.test').digest('base64url');
  const response = await invoke('/?bridge=' + signature);
  assert.equal(response.status, 200);
  const policy = response.headers.get('Content-Security-Policy');
  assert.ok(policy.includes('sandbox allow-same-origin allow-scripts'));
  assert.ok(policy.includes('frame-ancestors http://127.0.0.1:*'));
  const html = await response.text();
  assert.ok(html.includes('TelegramWebProxy'));
  assert.ok(html.includes(origin));
  assert.ok(!html.includes(env.BOOT));
});

test('session creation validates authorization and handshake, then supports revocation', async () => {
  assert.equal((await invoke('/api/v1/session', { method: 'POST' })).status, 404);
  const headers = { Authorization: 'Bearer ' + env.BOOT, 'Content-Type': 'application/octet-stream' };
  assert.equal((await invoke('/api/v1/session', { method: 'POST', headers, body: new Uint8Array([1, 2, 3]) })).status, 404);
  const response = await invoke('/api/v1/session', { method: 'POST', headers, body: new Uint8Array([16, 0, 0, 0, 0, 0, 0, 1, 1]) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Carrier-Mode'), 'websocket-lanes');
  const token = response.headers.get('X-Session-Token');
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [17, 0, 0, 0, 0, 0, 0, 0]);
  const deletion = await invoke('/api/v1/session', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  assert.equal(deletion.status, 204);
});

test('unauthenticated WebSocket upgrades are rejected before allocating a lane', async () => {
  const response = await invoke('/api/v1/ws', { headers: { Upgrade: 'websocket' } });
  assert.equal(response.status, 404);
});
