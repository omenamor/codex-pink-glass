import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL,fileURLToPath} from 'node:url';

const html=`<!doctype html><html data-pink-mod-test><meta charset="utf-8"><style>
@layer native { .native-composer { border:0!important; } }
*{box-sizing:border-box}body{margin:0;font:15px 'Segoe UI',sans-serif}main{min-height:630px;padding:24px 40px;border-left:1px solid transparent}.stack{max-width:780px;margin:auto;display:grid;gap:22px}.label{font-size:12px;margin-bottom:8px}.native-composer{width:100%;padding:14px;height:112px;border-radius:22px;corner-shape:superellipse(1.5);background:#fff}.home .native-composer{height:128px}.rail{margin:0 12px;padding:10px 14px;background:#fff;border-radius:14px 14px 0 0}.body{height:100%}textarea{border:0;outline:0;resize:none;font:inherit;background:transparent;width:100%;height:58px;color:inherit}.inner{height:12px;padding:0}
</style><body><main class="main-surface"><div class="stack"><div><div class="label">Поле в задаче</div><div id="regular" class="_ComposerLayoutRoot_test native-composer" data-composer-radius-variant="default" data-composer-surface-variant="default"><div class="_ComposerLayoutBody_test body"><textarea aria-label="Обычное поле" placeholder="Что нужно сделать?"></textarea></div></div></div><div class="home" data-codex-composer-root data-composer-placement="home"><div class="label">Главная — отдельный контейнер</div><div class="rail" data-composer-rail-variant="controls">▢ New folder　　Локальный　　main</div><div id="home-descendant" class="_ComposerLayoutRoot_test native-composer" data-composer-radius-variant="default" data-composer-surface-variant="default" data-composer-utility-bar-variant="home"><div class="_ComposerLayoutBody_test body"><textarea aria-label="Поле на главной" placeholder="Опиши задачу…"></textarea></div></div></div><div><div class="label">Главная — единый контейнер</div><div id="home-self" class="_ComposerLayoutRoot_test native-composer" data-codex-composer-root data-composer-placement="home" data-composer-radius-variant="default" data-composer-surface-variant="default" data-composer-utility-bar-variant="home"><div class="_ComposerLayoutBody_test body"><textarea aria-label="Единое поле" placeholder="Опиши задачу…"></textarea><div class="_ComposerLayoutRoot_test native-composer inner"></div></div></div></div></div></main></body></html>`;

test('full inset contour survives native layered border reset in all composer layouts',async()=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
 const source=await fs.readFile(new URL('../plugins/pink-glass/payload/renderer.js',import.meta.url),'utf8');const out=new URL('./assets/composer-outline/',import.meta.url);await fs.mkdir(out,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const theme of ['sakura','lavender','moonlight','peach','mint']){
  const page=await browser.newPage({viewport:{width:900,height:630}});await page.goto(`http://127.0.0.1:${server.address().port}`);const original=await page.locator('#regular').boundingBox();await page.evaluate(theme=>localStorage.setItem('codex-pink-mod:profiles:v1',JSON.stringify({version:1,active:theme,themes:{}})),theme);await page.evaluate(source);
  for(const id of ['regular','home-descendant','home-self']){
   const value=await page.locator('#'+id).evaluate(e=>{const s=getComputedStyle(e);return{border:s.borderWidth,shadow:s.boxShadow,radii:[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius]}});
   assert.equal(value.border,'0px','Fixture must reproduce the native layered reset');
   assert.match(value.shadow,/0px 0px 0px 1px inset/,`${theme}/${id}: contour must cover every edge, not just the top`);
   assert.ok(value.radii.every(r=>r===value.radii[0]),`${theme}/${id}: symmetric corners`);
  }
  assert.equal(await page.locator('.inner').evaluate(e=>getComputedStyle(e).boxShadow),'none','No double outline on nested chrome');
  assert.equal((await page.locator('#regular').boundingBox()).width,original.width,'Inset outline does not change layout width');
  await page.getByRole('textbox',{name:'Поле на главной',exact:true}).focus();assert.match(await page.locator('#home-descendant').evaluate(e=>getComputedStyle(e).boxShadow),/0px 0px 0px 1px inset/);
  await page.getByRole('textbox',{name:'Поле на главной',exact:true}).blur();await page.screenshot({path:fileURLToPath(new URL(theme+'.png',out))});
  await page.evaluate(()=>window.__CODEX_PINK_MOD__.cleanup());assert.equal(await page.locator('#regular').evaluate(e=>getComputedStyle(e).boxShadow),'none');await page.close();console.log(theme+': regular, home descendant, home self, focus and nested chrome passed');
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
});
