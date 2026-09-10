import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const html=`<!doctype html><html data-pink-mod-test><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;display:flex;height:500px;font:16px 'Segoe UI',sans-serif}aside{width:280px;padding:26px}main{flex:1;padding:26px}button{background:none;border:0;color:inherit;font:inherit}h1{font-size:22px}.label{margin:24px 0}</style><body><aside class="app-shell-left-panel"><h1>Pink Glass</h1><div class="label">Проекты</div><button>Мои задачи</button><div class="label">Изображение на фоне</div></aside><main class="main-surface">Главная область</main></body></html>`;
test('sidebar dim slider controls 0, 50 and 100 percent in every theme',async()=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
 const source=await fs.readFile(new URL('../plugins/pink-glass/payload/renderer.js',import.meta.url),'utf8');const out=new URL('./assets/sidebar-dim/',import.meta.url);await fs.mkdir(out,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const theme of ['sakura','lavender','moonlight','peach','mint']){
  const page=await browser.newPage({viewport:{width:900,height:500}});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.evaluate(theme=>localStorage.setItem('codex-pink-mod:profiles:v1',JSON.stringify({version:1,active:theme,themes:{}})),theme);await page.evaluate(source);await page.getByRole('button',{name:'Открыть редактор темы',exact:true}).click();
  const initial=await page.locator('aside').evaluate(e=>({color:getComputedStyle(e).color,image:getComputedStyle(e).backgroundImage}));const main=await page.locator('main').evaluate(e=>getComputedStyle(e).backgroundImage);
  const slider=page.getByRole('slider',{name:'Приглушить фон слева',exact:true});
  for(const value of [0,50,100]){
   await slider.fill(String(value));
   await page.waitForFunction(value=>{const s=getComputedStyle(document.querySelector('aside'));const match=s.boxShadow.match(/rgba?\(([^)]+)\)/);const parts=match?.[1].split(',').map(Number);const alpha=s.boxShadow==='none'?0:parts?.length===4?parts[3]:1;return Math.abs(alpha-value/100)<.01},value);
   const state=await page.locator('aside').evaluate(e=>{const s=getComputedStyle(e);return{veil:s.getPropertyValue('--pink-wallpaper-scrim'),color:s.color,image:s.backgroundImage}});assert.equal(state.veil,'','No permanent veil may override the slider');assert.equal(state.color,initial.color);assert.equal(state.image,initial.image);assert.equal(await page.locator('main').evaluate(e=>getComputedStyle(e).backgroundImage),main);
   await page.screenshot({path:fileURLToPath(new URL(`${theme}-${value}.png`,out)),clip:{x:0,y:0,width:280,height:500}});
  }
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();assert.equal(await page.evaluate(theme=>JSON.parse(localStorage.getItem('codex-pink-mod:profiles:v1')).themes[theme].sidebarDim,theme),100);
  await page.reload();await page.evaluate(source);await page.getByRole('button',{name:'Открыть редактор темы',exact:true}).click();assert.equal(await slider.inputValue(),'100');
  // Reduced transparency changes the glass material, not the user's wallpaper setting.
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});await slider.fill('0');await page.waitForFunction(()=>!getComputedStyle(document.querySelector('aside')).getPropertyValue('--pink-wallpaper-scrim'));await cdp.detach();
  console.log(theme+': 0/50/100, text, main wallpaper and saved value passed');await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
});
