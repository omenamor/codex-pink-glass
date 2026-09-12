import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL,fileURLToPath} from 'node:url';

// Reproduce the app's navigation-local token, including the native cascade layer.
const html=`<!doctype html><html data-pink-mod-test><meta charset="utf-8"><style>
@layer native{._Navigation_fixture_2{--color-text:var(--color-background-primary-solid)}
@supports (color:color-mix(in lab,red,red)){._Navigation_fixture_2{--color-text:color-mix(in oklab,var(--color-background-primary-solid) 85%,transparent)}}
.text-default{color:var(--color-text)}.text-secondary{color:var(--color-text-secondary)}.text-tertiary{color:var(--color-text-tertiary)}
.sidebar-item:hover{background:var(--color-background-primary-ghost-hover)}.sidebar-item[aria-current=page]{background:var(--color-background-primary-ghost-hover)}
.danger{color:#e02e2a}.success{color:#00a240}.warning{color:#e25507}.discovery{color:#a100f8}
}
*{box-sizing:border-box}body{margin:0;display:flex;height:600px;font:15px 'Segoe UI',sans-serif}aside{width:360px;padding:22px 16px}main{flex:1;padding:24px}.sidebar-item{display:block;width:100%;border:0;background:transparent;text-decoration:none;font:inherit;padding:8px 10px;border-radius:10px;text-align:left;cursor:pointer}.row{display:flex;gap:12px;align-items:center}h1{font-size:20px}.section{margin:24px 10px 8px}.nested{padding-left:20px}.update{margin:20px 10px;border:0;padding:6px 14px;border-radius:20px;background:var(--color-chart-blue);font:inherit}.disabled{opacity:.4}.status{display:flex;gap:14px;margin:16px 10px}
</style><body><aside class="app-shell-left-panel"><nav class="_Navigation_fixture_2">
<h1>Проверка темы</h1>
<button id="new" class="sidebar-item"><div class="text-default"><span class="row"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 13L13 2M2 6v7h7" fill="none" stroke="currentColor"/></svg><span class="label">Новый чат</span></span></div></button>
<button class="sidebar-item"><div class="text-default"><span class="label">Пулл-реквесты</span></div></button>
<button class="sidebar-item"><div class="text-default"><span class="label">Запланировано</span></div></button>
<div class="section text-secondary">Проекты</div>
<div role="button" class="sidebar-item"><div class="text-default"><span class="label">Дизайн приложения</span></div></div>
<div role="button" id="selected" aria-current="page" class="sidebar-item nested"><div class="text-default"><span><span class="label">Настроить оформление</span></span></div></div>
<a id="task" href="#preview" class="sidebar-item nested"><span class="text-default"><span class="label">Проверить цвета</span></span></a>
<button disabled class="sidebar-item disabled"><span class="text-default"><span class="label">Недоступная задача</span></span></button>
<div class="section text-tertiary">Недавние</div><button class="sidebar-item"><span class="text-default"><span class="label">Продолжить работу</span></span></button>
<div class="status"><span class="success">+6</span><span class="danger">−1</span><span class="warning">!</span><span class="discovery">Ultra</span></div>
<button class="update no-drag bg-chart-blue contain-layout contain-style" aria-label="Обновить" title="Обновить"><span>Обновить</span></button>
</nav></aside><main class="main-surface"><span id="outside" class="text-default">Основной текст</span></main></body></html>`;

test('navigation labels use theme ink in all themes; Moonlight stays white and accents stay semantic',async()=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
 const source=await fs.readFile(new URL('../plugins/pink-glass/payload/renderer.js',import.meta.url),'utf8'),out=new URL('./assets/sidebar-text/',import.meta.url);await fs.mkdir(out,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const theme of ['sakura','lavender','moonlight','peach','mint'])for(const custom of [false,true]){
  const page=await browser.newPage({viewport:{width:760,height:600}});await page.goto(`http://127.0.0.1:${server.address().port}`);
  const saved=JSON.stringify({version:1,active:theme,themes:custom?{[theme]:{ink:theme==='moonlight'?'#f0e0ed':'#263e47',accent:'#b64f7e'}}:{}});
  await page.evaluate(saved=>localStorage.setItem('codex-pink-mod:profiles:v1',saved),saved);await page.evaluate(source);
  const sample=()=>page.evaluate(()=>{const rgba=color=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data]};const style=e=>getComputedStyle(e);const editor=style(document.getElementById('codex-pink-mod'));return{ink:rgba(editor.getPropertyValue('--editor-ink')),labels:[...document.querySelectorAll('.label')].map(e=>rgba(style(e).color)),icon:rgba(style(document.querySelector('#new svg')).color),outside:rgba(style(document.querySelector('#outside')).color),sections:[...document.querySelectorAll('.section')].map(e=>rgba(style(e).color)),statuses:[...document.querySelector('.status').children].map(e=>rgba(style(e).color)),buttonInk:rgba(style(document.querySelector('.update span')).color),disabled:style(document.querySelector('.disabled')).opacity}});
  const base=await sample(),expected=theme==='moonlight'?[255,255,255,255]:base.ink;
  for(const color of base.labels)assert.deepEqual(color,expected,`${theme}/${custom?'custom':'preset'}: nested label must use ink, not button accent`);
  assert.deepEqual(base.icon,expected);assert.deepEqual(base.outside,base.ink,'Sidebar rule must not recolor main text');assert.equal(base.disabled,'0.4');
  assert.deepEqual(base.statuses,[[0,162,64,255],[224,46,42,255],[226,85,7,255],[161,0,248,255]]);
  assert.deepEqual(base.buttonInk,theme==='moonlight'?[33,27,50,255]:[255,255,255,255]);
  if(theme==='moonlight')for(const color of base.sections)assert.deepEqual(color,expected,'Moonlight section headings remain white');
  await page.locator('#new').hover();assert.deepEqual((await sample()).labels,base.labels,'Hover must not tint labels');await page.locator('#task').focus();assert.deepEqual((await sample()).labels,base.labels,'Keyboard focus must not tint labels');
  assert.equal(await page.evaluate(()=>localStorage.getItem('codex-pink-mod:profiles:v1')),saved);
  if(!custom){await page.mouse.move(740,580);await page.locator('aside').screenshot({path:fileURLToPath(new URL(theme+'.png',out))})}
  await page.evaluate(()=>window.__CODEX_PINK_MOD__.cleanup());assert.equal(await page.locator('nav').evaluate(e=>getComputedStyle(e).getPropertyValue('--color-text')),'');await page.close();
  console.log(`${theme}/${custom?'custom':'preset'}: labels, focus/hover, semantic colors, controls, cleanup and saved colors passed`);
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
});
