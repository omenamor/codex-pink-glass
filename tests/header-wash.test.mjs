import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';

const html=`<!doctype html><html data-pink-mod-test><meta charset="utf-8"><style>
:root{--height-toolbar:46px;--inset-toolbar-sm:36px;--inset-toolbar:46px;--test-top:36px}*{box-sizing:border-box}body{margin:0;padding-top:var(--test-top);height:480px;display:flex;font:15px 'Segoe UI'}aside{width:180px}main{flex:1}header.fixed{position:fixed;left:180px;right:0;height:var(--height-toolbar);display:flex;align-items:center;justify-content:flex-end;border-bottom:1px solid var(--color-border-default);z-index:30}.top-toolbar-sm{top:var(--inset-toolbar-sm)}.top-toolbar{top:var(--inset-toolbar)}.top-0{top:0}button{font:inherit;border:0;background:transparent;margin-right:30px}.right-pane{position:absolute;right:0;top:0;width:130px;height:100%;background:var(--color-surface);z-index:1}.right-pane .tabs{height:var(--height-toolbar);background:var(--color-surface);border-bottom:1px solid var(--color-border-default)}
</style><body><aside class="app-shell-left-panel"></aside><main class="main-surface _MainContentSurface_fixture"><header class="fixed h-toolbar top-toolbar-sm"><button>Поделиться</button></header><div class="right-pane"><div class="tabs">Вкладки</div></div></main></body></html>`;

const pixelDelta=async(page,a,b)=>a.equals(b)?{max:0,rowMean:0}:page.evaluate(async images=>{
 const pixels=[];let width=0,height=0;for(const src of images){const im=new Image();im.src='data:image/png;base64,'+src;await im.decode();const canvas=document.createElement('canvas');canvas.width=width=im.width;canvas.height=height=im.height;const ctx=canvas.getContext('2d');ctx.drawImage(im,0,0);pixels.push(ctx.getImageData(0,0,im.width,im.height).data)}
 let max=0,rowMean=0;for(let y=0;y<height;y++)for(let channel=0;channel<3;channel++){let sum=0;for(let x=0;x<width;x++){const i=(y*width+x)*4+channel,d=pixels[0][i]-pixels[1][i];max=Math.max(max,Math.abs(d));sum+=d}rowMean=Math.max(rowMean,Math.abs(sum/width))}return {max,rowMean};
},[a.toString('base64'),b.toString('base64')]);

test('toolbar wash never paints below its border across five themes, menu layouts and no-image mode',async()=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
 const source=await fs.readFile(new URL('../plugins/pink-glass/payload/renderer.js',import.meta.url),'utf8');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const theme of ['sakura','lavender','moonlight','peach','mint'])for(const noImage of [false,true]){
  const page=await browser.newPage({viewport:{width:820,height:480}});await page.goto(`http://127.0.0.1:${server.address().port}`);
  const saved=JSON.stringify({version:1,active:theme,themes:noImage?{[theme]:{wallpaper:''}}:{}});await page.evaluate(s=>localStorage.setItem('codex-pink-mod:profiles:v1',s),saved);await page.evaluate(source);
  for(const [mode,inset,height] of [['top-toolbar-sm',36,46],['top-0',0,46],['top-toolbar',46,46],['top-toolbar-sm',36,52]]){
   await page.evaluate(({mode,inset,height})=>{document.querySelector('header').className='fixed h-toolbar '+mode;document.documentElement.style.setProperty('--test-top',inset+'px');document.documentElement.style.setProperty('--height-toolbar',height+'px')},{mode,inset,height});
   const header=await page.locator('header').boundingBox(),bottom=header.y+header.height;assert.equal(bottom,inset+height);
   const below={x:220,y:bottom+1,width:400,height:52},inside={x:220,y:header.y+3,width:400,height:height-6};
   const before=await page.screenshot({clip:below}),tinted=await page.screenshot({clip:inside});
   const off=await page.addStyleTag({content:'main{--pink-header-wash:linear-gradient(transparent,transparent)!important}'});
   // Layered glow can dither by up to three 8-bit levels in either direction.
   // A real wash creates a directional tint; each row must still average zero.
   const after=await page.screenshot({clip:below}),delta=await pixelDelta(page,after,before);
   assert.ok(delta.max<=3&&delta.rowMean<=.1,`${theme}/${noImage?'no image':'image'}/${mode}/${height}: wash must not tint pixels below header (${JSON.stringify(delta)})`);
   assert.ok((await pixelDelta(page,await page.screenshot({clip:inside}),tinted)).max>3,'Toolbar still has its readability wash');await off.evaluate(e=>e.remove());
   const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
   const reduced=await page.screenshot({clip:below}),offReduced=await page.addStyleTag({content:'main{--pink-header-wash:linear-gradient(transparent,transparent)!important}'}),reducedOff=await page.screenshot({clip:below});
   const reducedDelta=await pixelDelta(page,reducedOff,reduced);assert.ok(reducedDelta.max<=3&&reducedDelta.rowMean<=.1,`${theme}/${noImage}/${mode}/${height}: reduced transparency must not reintroduce the strip (${JSON.stringify(reducedDelta)})`);await offReduced.evaluate(e=>e.remove());await cdp.send('Emulation.setEmulatedMedia',{features:[]});await cdp.detach();
   assert.equal(await page.locator('header').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','No overlay over adjacent tabs');
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('codex-pink-mod:profiles:v1')),saved);await page.evaluate(()=>window.__CODEX_PINK_MOD__.cleanup());await page.close();console.log(theme+(noImage?'/no image':'/image')+': four toolbar layouts, reduced transparency and saved settings passed');
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
});
