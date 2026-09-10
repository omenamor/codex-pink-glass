import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSocket, isAppPage, parseArgs } from '../plugins/pink-glass/payload/connector.mjs';
test('debugger URLs must match exact loopback browser identity', () => {
  assert.equal(validateSocket('ws://127.0.0.1:9335/devtools/browser/abc-123', 9335, 'browser', 'abc-123'), 'ws://127.0.0.1:9335/devtools/browser/abc-123');
  for (const url of ['ws://example.com:9335/devtools/browser/abc-123', 'ws://127.0.0.1:9336/devtools/browser/abc-123', 'ws://127.0.0.1:9335/devtools/browser/other', 'ws://user@127.0.0.1:9335/devtools/browser/abc-123', 'ws://127.0.0.1:9335/devtools/browser/abc-123?q=1'])
    assert.throws(() => validateSocket(url, 9335, 'browser', 'abc-123'));
});
test('only Codex app pages are eligible, overlays and web browsing excluded', () => {
  const page = url => ({ type: 'page', targetId: 'ABC123', url });
  assert.equal(isAppPage(page('app://-/index.html')), true);
  for (const url of ['https://chatgpt.com/', 'app://evil/index.html', 'app://-/index.html?initialRoute=/avatar-overlay', 'app://-/sandbox/index.html']) assert.equal(isAppPage(page(url)), false);
  assert.equal(isAppPage({ ...page('app://-/index.html'), type: 'worker' }), false);
});
test('CLI requires explicit identity and rejects malformed port', () => {
  assert.deepEqual(parseArgs(['--browser-id', 'abc', '--remove']), { port: 9335, browserId: 'abc', remove: true });
  assert.throws(() => parseArgs([]));
  assert.throws(() => parseArgs(['--browser-id', 'abc', '--port', '80']));
  assert.throws(() => parseArgs(['--browser-id', '../bad']));
});
