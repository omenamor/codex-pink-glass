import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const html=`<!doctype html><html data-pink-mod-test><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;height:480px;font:16px 'Segoe UI',sans-serif}#root{height:100%;display:flex;flex-direction:column}.titlebar{height:36px;flex-shrink:0}.shell{display:flex;flex:1;min-height:0}aside{width:180px;position:relative}.footer{position:absolute;bottom:0;left:0;right:0;padding:16px;background:var(--color-background-surface-under)}.top{padding:14px}.clip{flex:1;overflow:hidden}main{width:100%;height:100%;padding:14px}.text{padding-top:130px;text-align:center;font-weight:500}</style><body><div id="root"><div class="titlebar"></div><div class="shell"><aside class="app-shell-left-panel"><div class="top">Панель</div><div class="footer">ⓘ</div></aside><div class="_MainContentClip_test clip"><main class="_MainContentSurface_test"><div>Задача</div><div class="text">Проверка углов и стыка панелей</div></main></div></div></div></body></html>`;

test('shell corners and divider match all five palettes without gaps',async()=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
 const source=await fs.readFile(new URL('../plugins/pink-glass/payload/renderer.js',import.meta.url),'utf8');
 const out=new URL('./assets/corners/',import.meta.url);await fs.mkdir(out,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];
 try{for(const theme of ['sakura','lavender','moonlight','peach','mint']){
  const page=await browser.newPage({viewport:{width:900,height:480}});await page.goto(`http://127.0.0.1:${server.address().port}`);
  const saved=JSON.stringify({version:1,active:theme,themes:{}});await page.evaluate(s=>localStorage.setItem('codex-pink-mod:profiles:v1',s),saved);await page.evaluate(source);
  const result=await page.evaluate(()=>{
   const main=document.querySelector('main'),side=document.querySelector('aside'),clip=document.querySelector('.clip');const m=getComputedStyle(main),s=getComputedStyle(side),c=getComputedStyle(clip);
   const palette=getComputedStyle(document.getElementById('codex-pink-mod'));const rgb=h=>'rgb('+[1,3,5].map(i=>parseInt(h.trim().slice(i,i+2),16)).join(', ')+')';
   return {mainBottom:[m.borderBottomLeftRadius,m.borderBottomRightRadius],mainTopRight:m.borderTopRightRadius,mainTopLeft:m.borderTopLeftRadius,sideRadius:s.borderRadius,clipRadius:c.borderRadius,bodyBg:getComputedStyle(document.body).backgroundColor,clipBg:c.backgroundColor,panel:rgb(palette.getPropertyValue('--editor-panel')),border:rgb(palette.getPropertyValue('--editor-border')),divider:m.borderLeftColor,dividerWidth:m.borderLeftWidth,sideDivider:s.borderRightWidth,mainShadow:m.boxShadow,sideShadow:s.boxShadow,bottomRight:!!document.elementFromPoint(898,478)?.closest('main'),bottomSeamMain:!!document.elementFromPoint(182,478)?.closest('main'),bottomSeamSide:!!document.elementFromPoint(178,478)?.closest('aside')};
  });
  assert.deepEqual(result.mainBottom,['0px','0px']);assert.equal(result.mainTopRight,'0px');assert.equal(result.sideRadius,'0px');assert.equal(result.mainTopLeft,'22px');assert.equal(result.clipRadius,'22px 0px 0px');
  assert.equal(result.bodyBg,result.panel);assert.equal(result.clipBg,result.panel);assert.equal(result.divider,result.border);assert.equal(result.dividerWidth,'1px');assert.equal(result.sideDivider,'0px');assert.equal(result.mainShadow,'none');
  assert.ok(result.bottomRight&&result.bottomSeamMain&&result.bottomSeamSide,`${theme}: all lower edge pixels belong to the intended pane`);
  assert.ok(!result.sideShadow.includes('255, 255, 255'),'No fixed white outline');assert.equal(await page.evaluate(()=>localStorage.getItem('codex-pink-mod:profiles:v1')),saved);
  await page.screenshot({path:fileURLToPath(new URL(`${theme}.png`,out))});report.push({theme,gaps:false,divider:result.divider});await page.close();
 }console.log(JSON.stringify(report))}finally{await browser.close();await new Promise(r=>server.close(r))}
});
