import {Connection, validateSocket, isAppPage, validId} from '../payload/connector.mjs';
const [action, browserId, theme] = process.argv.slice(2);
if (!['status','editor','theme'].includes(action) || !validId(browserId)) throw Error('Invalid command');
if (action === 'theme' && !['sakura','lavender','moonlight','peach','mint'].includes(theme)) throw Error('Unknown theme');
const version = await (await fetch('http://127.0.0.1:9337/json/version', {redirect:'error',signal:AbortSignal.timeout(5000)})).json();
const c = await new Connection().open(validateSocket(version.webSocketDebuggerUrl,9337,'browser',browserId));
try {
  const {targetInfos} = await c.send('Target.getTargets');
  const target = targetInfos.find(t => isAppPage(t) && t.url === 'app://-/index.html');
  if (!target) throw Error('Main Codex window not found');
  const {sessionId} = await c.send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  const expression = `(() => {
    const mod=window.__CODEX_PINK_MOD__, root=document.getElementById('codex-pink-mod')?.shadowRoot;
    if (${JSON.stringify(action)} === 'status') return {active:!!root,version:mod?.version,theme:root?.querySelector('.theme-select')?.value};
    if (!root) throw Error('Pink Glass is not enabled. Run Enable first.');
    if (${JSON.stringify(action)} === 'editor') { if(root.querySelector('.panel').hidden)root.querySelector('.toggle').click(); return {editorOpen:true}; }
    const select=root.querySelector('.theme-select'); select.value=${JSON.stringify(theme || '')}; select.dispatchEvent(new Event('change',{bubbles:true}));
    root.querySelector('[data-action="save"]').click();
    const status=root.querySelector('[role="status"]').textContent;
    return {theme:select.value,status};
  })()`;
  const result=await c.send('Runtime.evaluate',{expression,returnByValue:true},sessionId);
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  console.log(JSON.stringify(result.result.value));
  await c.send('Target.detachFromTarget',{sessionId});
} finally {c.close();}
