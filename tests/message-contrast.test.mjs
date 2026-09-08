import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const html=`<!doctype html><html data-pink-mod-test><meta charset="utf-8"><style>
:root{--color-background-user-message:color-mix(in oklab,#503d4b 5%,transparent);--color-text-user-message:#503d4b}*{box-sizing:border-box}body{margin:0;font:16px 'Segoe UI',sans-serif}main{min-height:460px;padding:38px}.examples{margin:auto;max-width:700px;display:grid;gap:40px}article{display:flex;flex-direction:column;align-items:flex-end}.bg-user-message{background-color:var(--color-background-user-message);color:var(--color-text-user-message);padding:14px 18px;border-radius:20px;max-width:90%}.caption{font-size:12px;margin:10px;padding:4px 8px;background:#fff;color:#222}.compact{--color-background-user-message:#ffffff12}.footer{margin-top:10px;padding:4px 8px;background:#fff;color:#222;border-radius:6px;font-size:12px}
</style><body><main class="main-surface"><div class="examples"><article data-content-search-unit-key="test-chatgpt"><div data-user-message-bubble class="bg-user-message text-user-message"><span data-markdown-text-tone="user-message">Расскажи мне про контекстное окно, пожалуйста.</span></div><div class="footer">ChatGPT · без локального контейнера Codex</div></article><article data-local-conversation-user-anchor><div data-user-message-bubble class="bg-user-message text-user-message"><span>В этом сообщении тоже хорошо виден текст.</span></div><div class="footer">Codex · локальная задача</div></article><article><div data-user-message-bubble class="bg-user-message text-user-message compact"><span>Короткое сообщение</span></div><div class="footer">Компактный вариант сообщения</div></article></div></main></body></html>`;
function lum(rgb){return rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
test('both ChatGPT and Codex user bubbles have opaque readable backgrounds in every preset',async()=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
 const source=await fs.readFile(new URL('../plugins/pink-glass/payload/renderer.js',import.meta.url),'utf8');
 const out=new URL('./assets/message-contrast/',import.meta.url);await fs.mkdir(out,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];
 try{for(const theme of ['sakura','lavender','moonlight','peach','mint']){
  const page=await browser.newPage({viewport:{width:850,height:460}});await page.goto(`http://127.0.0.1:${server.address().port}`);
  const saved=JSON.stringify({version:1,active:theme,themes:{}});await page.evaluate(s=>localStorage.setItem('codex-pink-mod:profiles:v1',s),saved);
  await page.evaluate(source);
  const samples=await page.locator('[data-user-message-bubble]').evaluateAll(nodes=>nodes.map(e=>{const s=getComputedStyle(e);const rgba=color=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data]};return{bg:rgba(s.backgroundColor),fg:rgba(getComputedStyle(e.querySelector('span')).color)}}));
  for(const sample of samples){assert.equal(sample.bg[3],255,`${theme}: wallpaper must not show through a user bubble`);const a=lum(sample.fg.slice(0,3)),b=lum(sample.bg.slice(0,3));const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,`${theme}: text contrast ${ratio}`)}
  assert.deepEqual(samples[0],samples[1],`${theme}: ChatGPT and Codex share the palette`);assert.deepEqual(samples[0],samples[2],`${theme}: compact bubble native overrides must not leak`);
  assert.equal(await page.evaluate(()=>localStorage.getItem('codex-pink-mod:profiles:v1')),saved);
  await page.screenshot({path:fileURLToPath(new URL(`${theme}.png`,out))});
  await page.evaluate(()=>window.__CODEX_PINK_MOD__.cleanup());assert.notEqual(await page.locator('[data-content-search-unit-key] .bg-user-message').evaluate(e=>getComputedStyle(e).backgroundColor),`rgb(${samples[0].bg.slice(0,3).join(', ')})`);
  report.push({theme,variants:3,opaque:true});await page.close();
 }console.log(JSON.stringify(report))}finally{await browser.close();await new Promise(r=>server.close(r))}
});
