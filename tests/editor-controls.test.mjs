import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL,fileURLToPath} from 'node:url';

// A wholly synthetic shell. No user app, account, chat, or saved profile is opened.
const html=`<!doctype html><html data-pink-mod-test><meta charset="utf-8"><style>
:root{--height-toolbar:46px;--inset-toolbar-sm:0px;--color-text:#333}*{box-sizing:border-box}body{margin:0;display:flex;height:100vh;font:16px 'Segoe UI',sans-serif;color:#333;background:#fff}aside{width:240px;padding:20px;flex-shrink:0}main{flex:1;min-width:0;padding:90px 34px 30px}header.fixed{position:fixed;left:240px;right:0;top:0;height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 24px}.nav{display:block;padding:12px;border:0;background:transparent;font:inherit;color:inherit}.font-openai-sans{font:20px sans-serif}.composer-surface-chrome{max-width:600px;padding:22px;margin-top:30px}.toolbar{display:flex;gap:16px;align-items:center;margin-top:18px}.toolbar button{width:38px;height:38px;border:0;border-radius:12px}.toolbar svg{width:20px;height:20px;fill:currentColor}.body-copy{max-width:550px;margin:26px 0;line-height:1.6}.bg-user-message{padding:14px 18px;border-radius:18px;max-width:400px;margin-top:26px}.project-dialog{padding:20px;margin-top:22px}.fixture-label{font-size:12px;letter-spacing:.06em;opacity:.7}textarea{background:transparent;color:inherit;border:0;resize:none;font:inherit;max-width:100%;width:100%;height:54px}.text-default{color:var(--color-text)}.swatch{height:90px}.settings-sample{padding:14px;margin-top:22px;border-radius:10px}
</style><body><aside class="app-shell-left-panel"><nav class="_Navigation_fixture"><button aria-haspopup="menu" aria-label="Переключить режим: Codex" class="nav"><span class="font-openai-sans">Codex</span></button><button class="nav"><span class="text-default">Новая задача</span></button><button class="nav" aria-current="page">Пример проекта</button><div class="settings-sample">Настройки оформления</div></nav></aside><main class="main-surface _MainContentSurface_fixture"><header class="fixed top-0"><span>Демонстрационный экран</span><button>Поделиться</button></header><div class="fixture-label">ПРОВЕРКА РЕДАКТОРА · БЕЗ ЛИЧНЫХ ДАННЫХ</div><h1>Настройте оформление</h1><div class="swatch"></div><article class="_MarkdownRoot_fixture" data-markdown-text-style="assistant-message"><p class="body-copy">Тестовый текст помогает проверить читаемость цветов, фон и настройки стекла.</p></article><div class="bg-user-message">Пример сообщения</div><div data-codex-composer-root class="composer-surface-chrome"><textarea placeholder="Введите пример задачи"></textarea><div class="toolbar"><button id="send" aria-label="Отправить"><svg viewBox="0 0 20 20"><path d="M3 9L10 2L17 9L14 12L12 10V18H8V10L6 12Z"/></svg></button><button id="stop" aria-label="Остановить"><svg viewBox="0 0 20 20"><path d="M4 4H16V16H4Z"/></svg></button></div></div></main></body></html>`;
const THEMES=['sakura','lavender','moonlight','peach','mint'];
const PROFILE_KEY='codex-pink-mod:profiles:v1';
const COLORS=['bg','panel','card','ink','accent','buttonInk','border','messageBg','messageInk'];
const RANGES={radius:[0,16,32],buttonRadius:[0,16,32],shadow:[0,10,20],wallpaperOpacity:[0,50,100],wallpaperDarkness:[0,20,40],sidebarDim:[0,50,100],wallpaperTintStrength:[0,50,100],iconSize:[16,26,36],glassTransparency:[0,32,65],glassBlur:[0,8,16],sidebarTransparency:[0,47,95]};
const sections=['Стекло и прозрачность','Цвета','Фон','Размеры и тени','Свои изображения'];
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const lum=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const near=(a,b,epsilon=.01)=>assert.ok(Math.abs(a-b)<=epsilon,`Expected ${a} to be within ${epsilon} of ${b}`);
const flush=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const editor=page=>page.locator('#codex-pink-mod');
const action=(page,key)=>editor(page).locator(`[data-action="${key}"]`);
async function openSection(page,name){const details=editor(page).locator('details').filter({has:page.getByText(name,{exact:true})});if(!await details.evaluate(e=>e.open))await details.locator('summary').click();}
async function expand(page){for(const name of sections)await openSection(page,name);}
async function setRange(page,key,value){const control=editor(page).locator(`input[type="range"][data-key="${key}"]`);await control.fill(String(value));await flush(page);}
async function configInputs(page){return editor(page).evaluate(e=>Object.fromEntries([...e.shadowRoot.querySelectorAll('[data-key]')].map(x=>[x.dataset.key,x.type==='checkbox'?x.checked:x.type==='range'?Number(x.value):x.value])));}
async function save(page){await action(page,'save').click();await flush(page);return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE_KEY);}
async function rawSaved(page){return page.evaluate(key=>localStorage.getItem(key),PROFILE_KEY);}
async function importJson(page,object,name='settings.json'){
 const text=typeof object==='string'?object:JSON.stringify(object);
 await editor(page).locator('input.file-import').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
 await page.waitForFunction(()=>document.getElementById('codex-pink-mod').shadowRoot.querySelector('.file-import').value==='');await flush(page);
}
async function exportJson(page){const waiting=page.waitForEvent('download');await action(page,'export').click();const download=await waiting;assert.ok(download.suggestedFilename().endsWith('.json'));const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
async function png(page,width=96,height=48,color='#2090a0'){
 return Buffer.from(await page.evaluate(({width,height,color})=>{const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,width,height);x.fillStyle='#e8b730';for(let i=0;i<width;i+=32)x.fillRect(i,0,16,height);return c.toDataURL('image/png').split(',')[1]},{width,height,color}),'base64');
}
async function preview(page,key){return editor(page).locator(`[data-preview="${key}"]`).getAttribute('src');}
async function upload(page,key,buffer,name='sample.png',mimeType='image/png'){
 const field=editor(page).locator(`input[data-asset="${key}"]`);assert.equal(await field.count(),1,`${key}: file control must be available`);await field.setInputFiles({name,mimeType,buffer});
 await page.waitForFunction(key=>document.getElementById('codex-pink-mod').shadowRoot.querySelector(`[data-asset="${key}"]`).value==='',key);await flush(page);
}
async function visual(page){return page.evaluate(()=>{
 const css=(q,pseudo)=>getComputedStyle(document.querySelector(q),pseudo),rgba=color=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data]},hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0};
 const main=css('main'),side=css('aside'),composer=css('.composer-surface-chrome'),user=css('.bg-user-message'),send=css('#send'),icon=css('#send','::after');
 return {bg:rgba(main.backgroundColor),panel:rgba(side.backgroundColor),card:rgba(composer.backgroundColor),ink:rgba(main.color),accent:rgba(send.backgroundColor),buttonInk:rgba(send.color),border:rgba(main.borderLeftColor),messageBg:rgba(user.backgroundColor),messageInk:rgba(user.color),radius:composer.borderTopLeftRadius,buttonRadius:css('aside .nav').borderTopLeftRadius,shadow:composer.boxShadow,glassBlur:composer.backdropFilter,sidebarBlur:side.backdropFilter,sideShadow:side.boxShadow,wallpaper:hash(main.backgroundImage),logo:hash(css('.font-openai-sans').backgroundImage),sendImage:hash(icon.backgroundImage),stopImage:hash(css('#stop','::after').backgroundImage),sendSize:icon.backgroundSize,sendOpacity:css('#send svg').opacity,readingAlpha:rgba(css('.body-copy').backgroundColor)[3],scheme:getComputedStyle(document.documentElement).colorScheme};
 });}
async function check(errors,label,fn){try{await fn();}catch(error){errors.push(label+': '+error.message.slice(0,450));}}

test('complete isolated editor audit across every theme and setting',{timeout:420000},async t=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
 const source=await fs.readFile(new URL('../plugins/pink-glass/payload/renderer.js',import.meta.url),'utf8');const out=new URL('./assets/editor-controls/',import.meta.url);await fs.mkdir(out,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({channel:'msedge',headless:true});
 const fresh=async theme=>{const context=await browser.newContext({viewport:{width:1380,height:1050},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(6000);await page.goto(url);await page.evaluate(({key,theme})=>localStorage.setItem(key,JSON.stringify({version:1,active:theme,themes:{}})),{key:PROFILE_KEY,theme});await page.evaluate(source);await editor(page).locator('.toggle').click();await flush(page);return {page,context};};
 const reload=async page=>{await page.reload();await page.evaluate(source);await editor(page).locator('.toggle').click();await flush(page);};
 try{
 for(const theme of THEMES){
  await t.test(theme+' / all ranges affect actual rendering',async()=>{
   const {page,context}=await fresh(theme);const errors=[];
   try{await expand(page);const initial=await exportJson(page),image=await png(page,256,128),imageUrl='data:image/png;base64,'+image.toString('base64');await importJson(page,{...initial,wallpaper:imageUrl,sendIcon:imageUrl,stopIcon:imageUrl,sidebarDim:0});
    const beforeSaved=await rawSaved(page),baseline=await configInputs(page);
    for(const [key,points] of Object.entries(RANGES)){
     const samples=[];
     for(const value of points){await setRange(page,key,value);const actual=await visual(page);samples.push(actual);await check(errors,key+'='+value,async()=>{
      assert.equal((await configInputs(page))[key],value);assert.match(await editor(page).locator(`[data-output="${key}"]`).textContent(),new RegExp('^'+value+'(?:%| px)?$'));
      if(key==='radius')assert.equal(actual.radius,value+'px');
      if(key==='buttonRadius')assert.equal(actual.buttonRadius,value+'px');
      if(key==='glassTransparency')near(actual.card[3]/255,1-value/100,.006);
      if(key==='sidebarTransparency')near(actual.panel[3]/255,1-value/100,.006);
      if(key==='glassBlur'){assert.equal(actual.glassBlur,value?'blur('+value+'px)':'none');assert.equal(actual.sidebarBlur,actual.glassBlur);}
      if(key==='iconSize')assert.equal(actual.sendSize,`${value}px ${value}px`);
      if(key==='sidebarDim'){assert.equal(actual.wallpaper,samples[0].wallpaper,'Sidebar dim must not affect main wallpaper');if(value===100)assert.ok(actual.sideShadow.includes('inset')&&!actual.sideShadow.includes('rgba('),'100% sidebar dim must be opaque');}
     });}
     await check(errors,key+' observable effect',async()=>{
      const a=samples[0],b=samples.at(-1);
      const property={shadow:'shadow',wallpaperOpacity:'wallpaper',wallpaperDarkness:'wallpaper',wallpaperTintStrength:'wallpaper',sidebarDim:'sideShadow'}[key];if(property)assert.notEqual(a[property],b[property],`${key} must visibly affect its target`);
     });
     await setRange(page,key,baseline[key]);
    }
    assert.equal(await rawSaved(page),beforeSaved,'Previewing ranges must not save implicitly');
    const tinted=await visual(page);await editor(page).locator('[data-key="wallpaperTint"]').uncheck();await flush(page);const plain=await visual(page);assert.notEqual(tinted.wallpaper,plain.wallpaper);await editor(page).locator('[data-key="wallpaperTint"]').check();await flush(page);assert.equal((await visual(page)).wallpaper,tinted.wallpaper);
    await save(page);await reload(page);assert.equal((await configInputs(page)).wallpaperTint,true);assert.equal((await visual(page)).wallpaper,tinted.wallpaper,'Saved tint and ranges must survive reload');
   }finally{await context.close();}
   assert.deepEqual(errors,[]);
  });
  await t.test(theme+' / every color editor, save, undo, reset and enable',async()=>{
   const {page,context}=await fresh(theme);const errors=[];
   try{await expand(page);const initial=await exportJson(page),original=await visual(page);
    for(const key of COLORS){
     for(const [type,value] of [['color','#245678'],['text','#365a79']]){
      const field=editor(page).locator(type==='color'?`input[type="color"][data-key="${key}"]`:`input.hex[data-key="${key}"]`);await field.fill(value);await flush(page);
      await check(errors,key+'/'+type,async()=>{const actual=await visual(page);for(const [i,v] of rgb(value).entries())near(actual[key][i],v,key==='panel'?2:1);assert.equal(await editor(page).locator(type==='color'?`input.hex[data-key="${key}"]`:`input[type="color"][data-key="${key}"]`).inputValue(),value,'Picker and HEX must agree');});
     }
     await editor(page).locator(`input.hex[data-key="${key}"]`).fill(initial[key]);await flush(page);
    }
    await editor(page).locator('input.hex[data-key="bg"]').fill('#263b4a');await setRange(page,'radius',13);const saved=await save(page);assert.equal(saved.themes[theme].bg,'#263b4a');assert.equal(saved.themes[theme].radius,13);
    await reload(page);assert.deepEqual((await visual(page)).bg.slice(0,3),rgb('#263b4a'));assert.equal((await visual(page)).radius,'13px');await expand(page);
    await editor(page).locator('input.hex[data-key="bg"]').fill('#728496');await setRange(page,'radius',29);await action(page,'undo').click();await flush(page);assert.deepEqual((await visual(page)).bg.slice(0,3),rgb('#263b4a'));assert.equal((await visual(page)).radius,'13px');
    await action(page,'reset-colors').click();await flush(page);for(const key of COLORS)assert.equal((await configInputs(page))[key],initial[key]);assert.equal((await visual(page)).radius,'13px','Color reset must retain sizes');
    await action(page,'undo').click();await action(page,'reset-theme').click();await flush(page);assert.equal((await visual(page)).radius,original.radius);for(const key of COLORS)assert.equal((await configInputs(page))[key],initial[key]);
    await editor(page).locator('[data-key="enabled"]').uncheck();await flush(page);assert.equal(await page.locator('#codex-pink-mod-style').textContent(),'');assert.equal(await editor(page).locator('.panel').isVisible(),true);await save(page);await reload(page);assert.equal(await page.locator('#codex-pink-mod-style').textContent(),'');
    await editor(page).locator('[data-key="enabled"]').check();await flush(page);assert.ok((await page.locator('#codex-pink-mod-style').textContent()).length>1000);await save(page);await reload(page);assert.deepEqual((await visual(page)).bg,original.bg);
   }finally{await context.close();}
   assert.deepEqual(errors,[]);
  });
  await t.test(theme+' / all custom images and JSON round trip',async()=>{
   const {page,context}=await fresh(theme);const errors=[];
   try{await openSection(page,'Свои изображения');const before=await visual(page);const images={};
    for(const [index,key] of ['wallpaper','logo','sendIcon','stopIcon'].entries())await check(errors,key+' upload/remove',async()=>{
     const buffer=await png(page,key==='wallpaper'?2400:600,key==='wallpaper'?1200:300,['#168ba3','#a37024','#30a364','#854aae'][index]);await upload(page,key,buffer);const src=await preview(page,key);assert.ok(src?.startsWith('data:image/webp;base64,'),key+' must decode and render as a preview');images[key]=src;
     const size=await editor(page).locator(`[data-preview="${key}"]`).evaluate(async e=>{await e.decode();return [e.naturalWidth,e.naturalHeight]});assert.equal(size[0],key==='wallpaper'?2048:256);assert.equal(size[1],key==='wallpaper'?1024:128);
     const current=await visual(page);assert.notEqual(current[{wallpaper:'wallpaper',logo:'logo',sendIcon:'sendImage',stopIcon:'stopImage'}[key]],before[{wallpaper:'wallpaper',logo:'logo',sendIcon:'sendImage',stopIcon:'stopImage'}[key]],key+' must update actual visible target');if(key==='sendIcon')assert.equal(current.sendOpacity,'0');
    });
    const exported=await exportJson(page);for(const [key,value] of Object.entries(images))assert.equal(exported[key],value);await save(page);await reload(page);for(const [key,value] of Object.entries(images))assert.equal(await preview(page,key),value,'Saved image survives reload');await openSection(page,'Свои изображения');
    for(const key of Object.keys(images)){await editor(page).locator(`[data-clear="${key}"]`).click();await flush(page);assert.equal(await preview(page,key),null,key+' must clear preview');}
    assert.equal((await visual(page)).sendOpacity,'1','Native send icon must return after clearing');
    await importJson(page,exported);for(const [key,value] of Object.entries(images))assert.equal(await preview(page,key),value,'JSON restores each asset');assert.equal(JSON.stringify(await exportJson(page)),JSON.stringify(exported),'Full configuration survives export/import');
    // The JSON button must open a native chooser, not an inaccessible hidden label.
    const waiting=page.waitForEvent('filechooser');await action(page,'import').click();const chooser=await waiting;await chooser.setFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await flush(page);
   }finally{await context.close();}
   assert.deepEqual(errors,[]);
  });
  await t.test(theme+' / editor palette, readable labels and QA screenshots',async()=>{
   const {page,context}=await fresh(theme);const errors=[];
   try{const config=await configInputs(page);await expand(page);
    const styles=await editor(page).evaluate(e=>{const s=e.shadowRoot,rgba=color=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data]};return {texts:['.heading small','.intro','.footer','.warning','.range output','.asset label'].map(q=>({q,color:rgba(getComputedStyle(s.querySelector(q)).color)})),saveColor:rgba(getComputedStyle(s.querySelector('[data-action="save"]')).color),saveBg:rgba(getComputedStyle(s.querySelector('[data-action="save"]')).backgroundColor),resetBg:rgba(getComputedStyle(s.querySelector('[data-action="reset-colors"]')).backgroundColor),borders:['details','.color','.asset'].map(q=>({q,color:rgba(getComputedStyle(s.querySelector(q)).borderTopColor)})),uploadBg:rgba(getComputedStyle(s.querySelector('.asset-upload')).backgroundColor)};});
    for(const item of styles.texts)await check(errors,item.q+' contrast',()=>assert.ok(Math.min(contrast(item.color,rgb(config.card)),contrast(item.color,rgb(config.panel)))>=4.5,item.q+' must stay readable in editor'));
    await check(errors,'Save text contrast',()=>assert.ok(contrast(styles.saveColor,styles.saveBg)>=4.5,'Save button text must have 4.5:1 preset contrast'));
    for(const item of styles.borders)await check(errors,item.q+' palette',()=>assert.deepEqual(item.color.slice(0,3),rgb(config.border)));
    await check(errors,'upload palette',()=>assert.ok([config.card,config.panel].some(value=>JSON.stringify(rgb(value))===JSON.stringify(styles.uploadBg.slice(0,3))),'Upload control must use selected palette'));
    await check(errors,'color reset palette',()=>assert.ok([config.card,config.panel].some(value=>JSON.stringify(rgb(value))===JSON.stringify(styles.resetBg.slice(0,3))),'Color reset control must use selected palette'));
    for(const [index,name] of sections.entries()){
     for(const other of sections){const details=editor(page).locator('details').filter({has:page.getByText(other,{exact:true})});if(await details.evaluate(e=>e.open)!==(other===name))await details.locator('summary').click();}
     await editor(page).locator('.panel').evaluate(e=>{e.scrollTop=0});await page.mouse.move(270,20);await page.screenshot({path:fileURLToPath(new URL(`${theme}-${index+1}.png`,out))});
    }
    await page.setViewportSize({width:1380,height:2600});await expand(page);await editor(page).locator('.panel').evaluate(e=>{e.scrollTop=0});await editor(page).locator('.panel').screenshot({path:fileURLToPath(new URL(`${theme}-full.png`,out))});
   }finally{await context.close();}
   assert.deepEqual(errors,[]);
  });
 }
 await t.test('profiles autosave separately through all five switches and reload',async()=>{
  const {page,context}=await fresh('sakura');try{
   const colors=['#304a60','#705440','#204838','#4c3260','#415461'];
   for(const [index,theme] of THEMES.entries()){
    await editor(page).locator('.theme-select').selectOption(theme);await openSection(page,'Цвета');await editor(page).locator('input.hex[data-key="bg"]').fill(colors[index]);await openSection(page,'Размеры и тени');await setRange(page,'radius',10+index);await flush(page);
   }
   await editor(page).locator('.theme-select').selectOption('sakura');
   for(const [index,theme] of THEMES.entries()){await editor(page).locator('.theme-select').selectOption(theme);assert.deepEqual((await visual(page)).bg.slice(0,3),rgb(colors[index]));assert.equal((await visual(page)).radius,(10+index)+'px');}
   await reload(page);assert.equal(await editor(page).locator('.theme-select').inputValue(),'mint');assert.deepEqual((await visual(page)).bg.slice(0,3),rgb(colors[4]));
  }finally{await context.close();}
 });
 await t.test('invalid fields/files never corrupt saved settings and errors recover',async()=>{
  const {page,context}=await fresh('mint');const errors=[];try{
   await expand(page);await save(page);const saved=await rawSaved(page),initial=await visual(page);
   const hex=editor(page).locator('input.hex[data-key="ink"]');await hex.fill('#xyz');await action(page,'save').click();assert.equal(await hex.getAttribute('aria-invalid'),'true');assert.equal(await rawSaved(page),saved);assert.deepEqual((await visual(page)).ink,initial.ink);await hex.fill('#324e43');await flush(page);assert.notEqual(await hex.getAttribute('aria-invalid'),'true');
   for(const recovery of ['reset-colors','reset-theme','undo','import'])await check(errors,'invalid HEX recovery '+recovery,async()=>{
    await hex.fill('#oops');if(recovery==='import')await importJson(page,{ink:'#324e43'});else await action(page,recovery).click();await flush(page);assert.notEqual(await hex.getAttribute('aria-invalid'),'true',recovery+' must clear stale invalid flag when it restores a valid value');
   });
   await hex.fill('#324e43');await flush(page);
   for(const object of ['not JSON','[]','null',JSON.stringify({radius:'bad'}),JSON.stringify({ink:'#gggggg'}),JSON.stringify({wallpaper:'https://invalid.example/private.png'})])await check(errors,'invalid JSON '+object.slice(0,45),async()=>{await importJson(page,object);assert.equal(await rawSaved(page),saved);assert.deepEqual((await visual(page)).bg,initial.bg);assert.ok((await editor(page).locator('.status').textContent()).length>8);});
   await importJson(page,{radius:-100,buttonRadius:100,glassTransparency:200,glassBlur:-1});let values=await configInputs(page);assert.equal(values.radius,0);assert.equal(values.buttonRadius,32);assert.equal(values.glassTransparency,65);assert.equal(values.glassBlur,0);
   await action(page,'undo').click();await openSection(page,'Свои изображения');const prior=await preview(page,'wallpaper');
   for(const file of [{name:'invalid.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')},{name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')},{name:'huge.png',mimeType:'image/png',buffer:Buffer.alloc(25*1024*1024+1)}])await check(errors,file.name,async()=>{await upload(page,'wallpaper',file.buffer,file.name,file.mimeType);assert.equal(await preview(page,'wallpaper'),prior);assert.equal(await rawSaved(page),saved);});
   await importJson(page,' '.repeat(8*1024*1024+1),'too-large.json');assert.equal(await rawSaved(page),saved);assert.equal(await preview(page,'wallpaper'),prior);
   await upload(page,'wallpaper',await png(page), 'broken.png');assert.notEqual(await preview(page,'wallpaper'),prior,'Failed filename can be selected again with valid data');
   await action(page,'undo').click();await page.evaluate(key=>{window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Quota exceeded','QuotaExceededError');return window.__originalSetItem.call(this,k,v)}},PROFILE_KEY);
   await editor(page).locator('input.hex[data-key="bg"]').fill('#556677');await action(page,'save').click();assert.equal(await rawSaved(page),saved);await editor(page).locator('.theme-select').selectOption('peach');assert.equal(await editor(page).locator('.theme-select').inputValue(),'mint','Failed save must not silently switch profile');await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem;delete window.__originalSetItem});await save(page);assert.notEqual(await rawSaved(page),saved);
  }finally{await context.close();}assert.deepEqual(errors,[]);
 });
 await t.test('pending image upload cannot spill into another profile',async()=>{
  const {page,context}=await fresh('sakura');try{
   await openSection(page,'Свои изображения');const buffer=await png(page);await page.evaluate(()=>{window.__imageDecoder=createImageBitmap;window.createImageBitmap=async(...args)=>{await new Promise(resolve=>{window.__releaseImage=resolve});return window.__imageDecoder(...args)};});
   await editor(page).locator('[data-asset="wallpaper"]').setInputFiles({name:'delayed.png',mimeType:'image/png',buffer});await page.waitForFunction(()=>typeof window.__releaseImage==='function');await editor(page).locator('.theme-select').selectOption('mint');const expected=await preview(page,'wallpaper');await page.evaluate(()=>window.__releaseImage());await page.waitForFunction(()=>document.getElementById('codex-pink-mod').shadowRoot.querySelector('[data-asset="wallpaper"]').value==='');await flush(page);assert.equal(await preview(page,'wallpaper'),expected,'Selecting an image for Sakura must not replace Mint wallpaper after a profile switch');
  }finally{await context.close();}
 });
 await t.test('editor keyboard focus stays inside and returns to opener',async()=>{
  const {page,context}=await fresh('sakura');try{
   assert.equal(await editor(page).evaluate(e=>e.shadowRoot.activeElement?.matches('.close')),true);
   await page.keyboard.press('Shift+Tab');assert.equal(await editor(page).evaluate(e=>e.shadowRoot.activeElement?.dataset.action),'import','Back-tab wraps to last visible action');
   await page.keyboard.press('Tab');assert.equal(await editor(page).evaluate(e=>e.shadowRoot.activeElement?.matches('.close')),true,'Tab wraps to first focusable control');
   await page.keyboard.press('Escape');assert.equal(await editor(page).locator('.panel').isVisible(),false);assert.equal(await editor(page).evaluate(e=>e.shadowRoot.activeElement?.matches('.toggle')),true,'Escape must return focus to the actual opener inside shadow DOM');
  }finally{await context.close();}
 });
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
