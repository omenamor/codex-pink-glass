import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(here, '.connector-session.json');
export function validId(value) { return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value); }
export function validateSocket(value, port, kind, id) {
  const url = new URL(value);
  if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      Number(url.port) !== port || url.username || url.password || url.search || url.hash ||
      !validId(id) || url.pathname !== `/devtools/${kind}/${id}`) throw new Error('Untrusted debugger URL');
  return url.href;
}
export function isAppPage(target) {
  if (target?.type !== 'page' || !validId(target.targetId ?? target.id)) return false;
  try {
    const u = new URL(target.url);
    return u.protocol === 'app:' && ['', '-'].includes(u.hostname) && !u.username && !u.password &&
      !/avatar|overlay|popup|dictation|capture|sandbox/i.test(u.pathname + u.search);
  } catch { return false; }
}
export function parseArgs(args) {
  const result = { port: 9335, remove: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port') result.port = Number(args[++i]);
    else if (args[i] === '--browser-id') result.browserId = args[++i];
    else if (args[i] === '--remove') result.remove = true;
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  if (!Number.isInteger(result.port) || result.port < 1024 || result.port > 65535 || !validId(result.browserId))
    throw new Error('Supply --browser-id ID and an optional valid --port');
  return result;
}
class Connection {
  pending = new Map(); listeners = new Map(); nextId = 0;
  async open(url) {
    this.socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.socket.close(); reject(new Error('Debugger connection timeout')); }, 5000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Debugger connection failed')); }, { once: true });
    });
    this.socket.addEventListener('message', e => {
      const data = JSON.parse(e.data);
      if (data.id) {
        const item = this.pending.get(data.id);
        if (item) { clearTimeout(item.timer); this.pending.delete(data.id); data.error ? item.reject(new Error(data.error.message)) : item.resolve(data.result); }
      } else for (const fn of this.listeners.get(data.method) || []) fn(data.params);
    });
    this.closed = new Promise(resolve => this.socket.addEventListener('close', () => {
      for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new Error('Codex disconnected')); }
      this.pending.clear(); resolve();
    }, { once: true }));
    return this;
  }
  on(event, fn) { const list = this.listeners.get(event) || []; list.push(fn); this.listeners.set(event, list); }
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Debugger timeout: ${method}`)); }, 7000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
      catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }
  close() { this.socket.close(); }
}
export async function run(options) {
  const response = await fetch(`http://127.0.0.1:${options.port}/json/version`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok) throw new Error('Cannot inspect local Codex debugger');
  const version = await response.json();
  const browser = await new Connection().open(validateSocket(version.webSocketDebuggerUrl, options.port, 'browser', options.browserId));
  const current = { browserId: options.browserId, port: options.port, scripts: [] };
  let queue = Promise.resolve();
  let stopping = false;
  const enqueue = fn => { queue = queue.then(fn).catch(e => { console.error(e.message); process.exitCode = 1; }); };
  const save = () => fs.writeFile(statePath, JSON.stringify(current, null, 2), 'utf8');
  try {
    let prior;
    try { prior = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (prior && (prior.browserId !== options.browserId || prior.port !== options.port)) prior = null;
    const attach = async target => (await browser.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
    if (options.remove) {
      const { targetInfos } = await browser.send('Target.getTargets');
      for (const target of targetInfos.filter(isAppPage)) {
        const sid = await attach(target);
        try {
          // CDP early scripts are session-scoped on some runtimes. Once the
          // original connector exits those scripts may already be gone.
          for (const item of prior?.scripts || []) if (item.targetId === target.targetId && typeof item.identifier === 'string') {
            try { await browser.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: item.identifier }, sid); }
            catch (error) { if (!/not found|no script|invalid.*identifier/i.test(error.message)) throw error; }
          }
          const result = await browser.send('Runtime.evaluate', { expression: 'window.__CODEX_PINK_MOD__?.cleanup?.();', returnByValue: true }, sid);
          if (result.exceptionDetails) throw new Error('Pink Mod cleanup failed');
        } finally { await browser.send('Target.detachFromTarget', { sessionId: sid }); }
      }
      if (prior) await fs.unlink(statePath).catch(e => { if (e.code !== 'ENOENT') throw e; });
      console.log('Pink Mod removed from current app pages. Stop its running connector before removal.');
      return;
    }
    if (prior?.scripts?.length) throw new Error('This browser already has a saved Pink Mod session. Stop its connector and run --remove before reconnecting.');
    const source = await fs.readFile(path.join(here, 'renderer.js'), 'utf8');
    const installed = new Set();
    const install = async target => {
      if (stopping || !isAppPage(target) || installed.has(target.targetId)) return;
      const sid = await attach(target);
      try {
        await browser.send('Page.enable', {}, sid);
        const { identifier } = await browser.send('Page.addScriptToEvaluateOnNewDocument', { source }, sid);
        current.scripts.push({ targetId: target.targetId, identifier }); await save();
        const result = await browser.send('Runtime.evaluate', { expression: source, awaitPromise: true, returnByValue: true }, sid);
        if (result.exceptionDetails) throw new Error(`Pink Mod renderer failed: ${result.exceptionDetails.text}`);
        if (result.result?.value?.reason === 'dream-skin-active') throw new Error('Dream Skin is still active. Open Codex without its launcher first.');
        installed.add(target.targetId);
        console.log('Pink Mod installed in a Codex page.');
      } catch (error) { await browser.send('Target.detachFromTarget', { sessionId: sid }).catch(() => {}); throw error; }
    };
    browser.on('Target.targetCreated', ({ targetInfo }) => enqueue(() => install(targetInfo)));
    browser.on('Target.targetInfoChanged', ({ targetInfo }) => enqueue(() => install(targetInfo)));
    await browser.send('Target.setDiscoverTargets', { discover: true });
    const { targetInfos } = await browser.send('Target.getTargets');
    for (const target of targetInfos) enqueue(() => install(target));
    await queue;
    const stop = () => { stopping = true; browser.close(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    try { await browser.closed; } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
    stopping = true;
  } finally { browser.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(parseArgs(process.argv.slice(2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
