import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const html=`<!doctype html><html data-pink-mod-test><meta charset="utf-8"><style>
:root{--color-background-control:rgba(255,247,248,.96);--color-background-primary-soft:rgba(255,247,248,.96);--color-background-primary-solid:#eee9fa;--color-text-button-primary:#fff5f7;--color-text-primary:#503d4b;--color-text-secondary:#76626e;--color-text-primary-solid:#fff5f7}
:root[data-native-scheme=dark]{--color-background-control:#232323;--color-background-primary-soft:#232323;--color-background-primary-solid:#eee;--color-text-primary:#eee;--color-text-secondary:#bbb}
*{box-sizing:border-box}body{margin:0;font:16px 'Segoe UI',sans-serif;background:#151427}main{height:100vh}.scrim{position:fixed;inset:0;background:#0004;display:grid;place-items:center}
[role=dialog]{width:520px;padding:20px;border:1px solid #555;background:#eee;color:var(--color-text-primary)}h1{font-size:22px;margin:0 0 14px}label{display:block;font-weight:600;font-size:14px;margin:15px 0 8px}
button,input{font:inherit}button{border:0;border-radius:9px;cursor:pointer}button:disabled{opacity:.45;cursor:default}input{background:transparent;border:0;outline:0;padding:10px;width:100%;color:var(--color-text-primary)}input::placeholder{color:var(--color-text-secondary);opacity:.6}
.bg-control{background:var(--color-background-control);border:1px solid #ddd;border-radius:10px;display:flex;align-items:center;padding:0 10px}.bg-primary-soft{background:var(--color-background-primary-soft)}.text-primary{color:var(--color-text-primary)}.text-secondary{color:var(--color-text-secondary)}.text-primary-solid{color:var(--color-text-primary-solid)}
.folder{width:100%;height:100px;display:grid;place-content:center;gap:7px;text-align:center}.folder svg{margin:auto}.bg-primary-solid{background:var(--color-background-primary-solid);color:var(--color-text-button-primary)}footer{display:flex;gap:16px;justify-content:flex-end;margin-top:22px}footer button{padding:7px 15px}.cancel{background:transparent;color:var(--color-text-secondary)}svg{width:18px;height:18px;stroke:currentColor;fill:none}
</style><body><main class="main-surface"></main><div class="scrim"><section role="dialog" aria-label="Создать проект"><h1 class="text-primary">Создать проект</h1><div class="bg-control"><svg class="text-secondary" viewBox="0 0 20 20"><path d="M2 5h6l2 2h8v10H2Z"/></svg><input aria-label="Название проекта" placeholder="Название проекта"></div><label class="text-secondary">Исходные папки</label><button class="folder bg-primary-soft text-secondary"><svg viewBox="0 0 20 20"><path d="M2 5h6l2 2h8v10H2Z M14 10v8 M10 14h8"/></svg><span>Добавьте папки, которые ChatGPT сможет читать и<br>редактировать</span></button><footer><button class="cancel">Отмена</button><button class="bg-primary-solid" disabled><span class="text-primary-solid">Создать проект</span></button></footer></section></div></body></html>`;

function luminance(rgb){return rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}

test('portaled project dialog stays readable in all presets and both native schemes',async()=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
 const source=await fs.readFile(new URL('../plugins/pink-glass/payload/renderer.js',import.meta.url),'utf8');
 const output=new URL('./assets/dialog-contrast/',import.meta.url);await fs.mkdir(output,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
 try{
  for(const native of ['light','dark'])for(const theme of ['sakura','lavender','moonlight','peach','mint']){
   const page=await browser.newPage({viewport:{width:700,height:460}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}`);
   await page.evaluate(({native,theme})=>{document.documentElement.dataset.nativeScheme=native;localStorage.setItem('codex-pink-mod:profiles:v1',JSON.stringify({version:1,active:theme,themes:{}}))},{native,theme});
   const original=await page.locator('.bg-control').evaluate(e=>getComputedStyle(e).backgroundColor);
   await page.evaluate(source);
   assert.equal(await page.locator('#codex-pink-mod .theme-select').inputValue(),theme);
   const samples=async()=>page.evaluate(()=>{
    const rgba=color=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d');c.fillStyle=color;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data]};
    const dialog=document.querySelector('[role=dialog]'),input=dialog.querySelector('input'),folder=dialog.querySelector('.folder'),primary=dialog.querySelector('.bg-primary-solid');
    const s=e=>getComputedStyle(e);return {input:{fg:rgba(s(input).color),bg:rgba(s(input.parentElement).backgroundColor)},placeholder:{fg:rgba(getComputedStyle(input,'::placeholder').color),bg:rgba(s(input.parentElement).backgroundColor)},folder:{fg:rgba(s(folder.querySelector('span')).color),bg:rgba(s(folder).backgroundColor)},primary:{fg:rgba(s(primary.querySelector('span')).color),bg:rgba(s(primary).backgroundColor)},cancel:{fg:rgba(s(dialog.querySelector('.cancel')).color),bg:rgba(s(dialog).backgroundColor)}};
   });
   const measure=await samples();
   for(const [name,pair]of Object.entries(measure)){assert.equal(pair.bg[3],255,`${native}/${theme}/${name}: background must be opaque`);assert.ok(contrast(pair.fg,pair.bg)>=4.5,`${native}/${theme}/${name}: ${contrast(pair.fg,pair.bg).toFixed(2)}`)}
   await page.getByRole('textbox',{name:'Название проекта'}).fill('Тестовый проект');
   assert.equal(await page.getByRole('textbox',{name:'Название проекта'}).inputValue(),'Тестовый проект');
   await page.screenshot({path:fileURLToPath(new URL(`${theme}-${native}.png`,output))});
   await page.locator('footer .bg-primary-solid').evaluate(e=>e.disabled=false);
   const enabled=(await samples()).primary;assert.ok(contrast(enabled.fg,enabled.bg)>=4.5,`${native}/${theme}/enabled primary`);
   await page.locator('footer .bg-primary-solid').hover();
   const hovered=(await samples()).primary;assert.ok(contrast(hovered.fg,hovered.bg)>=4.5,`${native}/${theme}/hovered primary`);
   await page.locator('footer .bg-primary-solid').evaluate(e=>e.setAttribute('aria-disabled','true'));
   const ariaDisabled=(await samples()).primary;
   assert.deepEqual(ariaDisabled.bg,measure.primary.bg,`${native}/${theme}/aria-disabled hover retains disabled background`);
   assert.ok(contrast(ariaDisabled.fg,ariaDisabled.bg)>=4.5,`${native}/${theme}/aria-disabled primary`);
   await page.getByRole('textbox',{name:'Название проекта'}).focus();
   assert.equal(await page.getByRole('textbox',{name:'Название проекта'}).evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
   await page.evaluate(()=>window.__CODEX_PINK_MOD__.cleanup());
   assert.equal(await page.locator('.bg-control').evaluate(e=>getComputedStyle(e).backgroundColor),original);
   assert.deepEqual(errors,[]);
   results.push({theme,native,minTextContrast:Math.min(...Object.values(measure).map(p=>contrast(p.fg,p.bg)),contrast(enabled.fg,enabled.bg),contrast(hovered.fg,hovered.bg)).toFixed(2)});
   await page.close();
  }
  await fs.writeFile(new URL('results.json',output),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
