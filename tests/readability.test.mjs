import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL,fileURLToPath} from 'node:url';

const html=`<!doctype html><html data-pink-mod-test><meta charset="utf-8"><style>
:root{--color-text-default:#282828;--color-token-text-secondary:#666}html[data-native-scheme=dark]{--color-text-default:#eee;--color-token-text-secondary:#aaa}*{box-sizing:border-box}body{margin:0;display:flex;height:100vh;font:16px 'Segoe UI',sans-serif}aside{width:250px;flex-shrink:0;padding:28px 22px}main{position:relative;flex:1;min-width:0;padding-top:60px}.brand{font-size:23px;font-weight:600;margin:4px 0 36px}.nav{display:block;padding:11px 8px;width:100%;text-align:left}.section{font-size:13px;margin:27px 8px 8px}.text-default{color:var(--color-text-default)}.secondary{color:var(--color-token-text-secondary)}header.fixed{position:fixed;top:8px;left:268px;right:14px;height:40px;display:flex;align-items:center;justify-content:space-between;z-index:2;background:transparent}.actions{display:flex;gap:7px}button{font:inherit;border:0;background:transparent;cursor:pointer;color:inherit;padding:7px 11px}button:focus-visible{outline:2px solid blue}header button{font-size:14px;height:34px;display:flex;align-items:center;gap:6px}svg{width:16px;height:16px;fill:none;stroke:currentColor}.thread-scroll-container{height:100%;overflow:auto;padding:34px 48px 24px}.reading-column{max-width:750px;margin:auto}h1{font-size:27px;margin:0 0 14px;line-height:1.3}h2{font-size:20px;margin:26px 0 10px}p{line-height:1.65;margin:14px 0}.bg-user-message{padding:13px 18px;border-radius:18px;margin:26px 0 30px auto;max-width:80%;width:fit-content}.composer-surface-chrome{padding:20px;margin-top:30px}textarea{width:100%;min-height:40px;resize:none;background:transparent;border:0;font:inherit;color:inherit}.toolbar{display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-top:15px}a{color:blue}.danger{color:#cc2222!important}code{background:#242338;color:#f7e9cc;padding:5px 8px;border-radius:5px}.fixture{font-size:11px;opacity:.8;letter-spacing:.08em;margin-top:25px}
</style><body><aside class="app-shell-left-panel"><div class="brand">Pink Glass ♡</div><button class="nav">＋ Новая задача</button><button class="nav">◇ Плагины</button><div class="section secondary">Проекты</div><button class="nav" aria-current="page">Дизайн и идеи</button><button class="nav">Заметки</button><div class="section secondary">Недавние задачи</div><button class="nav">Настроить оформление</button></aside><main class="main-surface _MainContentSurface_test"><header class="fixed"><button class="text-default title">Дизайн и идеи</button><div class="actions" data-app-shell-header-obstacle><button class="share"><svg viewBox="0 0 20 20"><path d="M10 12V2M6 6l4-4 4 4M3 11v6h14v-6"/></svg><span>Поделиться</span></button><button aria-label="Терминал">⌘</button><button aria-label="Ещё">•••</button></div></header><div class="thread-scroll-container"><div class="reading-column"><h1 class="text-default">Красивый фон, читаемый текст</h1><p class="secondary">Мягкие поверхности сохраняют цвета темы и помогают сосредоточиться на содержимом.</p><div data-local-conversation-user-anchor><div class="bg-user-message">Хочу оставить рисунок и лучше видеть надписи.</div></div><article class="_MarkdownRoot_test" data-markdown-text-style="assistant-message"><h2>Немного спокойствия в интерфейсе</h2><p class="body-copy">У верхних кнопок появилась стеклянная подложка. Под текстом — мягкая заливка, а рисунок остаётся частью оформления.</p><p class="secondary">Ссылки, подписи и элементы навигации сохраняют ясный контраст.</p><p><a href="#details">Подробнее о настройках темы</a></p><p><code>theme = "pink-glass"</code></p></article><div data-codex-composer-root class="composer-surface-chrome"><textarea aria-label="Сообщение" placeholder="Опиши свою идею…"></textarea><div class="toolbar"><span class="secondary">＋ Добавить</span><button aria-label="Отправить">↑</button></div></div><div class="fixture secondary">ДЕМОНСТРАЦИОННЫЙ МАКЕТ · БЕЗ ЛИЧНОЙ ПЕРЕПИСКИ</div></div></div></main></body></html>`;
const luminance=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const composite=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]/255+bg[i]*(1-fg[3]/255));

test('wallpaper readability surfaces protect every preset without changing saved preferences',async()=>{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PATH||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')));
 const source=await fs.readFile(new URL('../plugins/pink-glass/payload/renderer.js',import.meta.url),'utf8');
 const out=new URL('./assets/readability/',import.meta.url);await fs.mkdir(out,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];
 try{
  for(const native of ['light','dark'])for(const theme of ['sakura','lavender','moonlight','peach','mint']){
   const page=await browser.newPage({viewport:{width:1280,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}`);
   const saved=JSON.stringify({version:1,active:theme,themes:{}});
   await page.evaluate(({native,saved})=>{document.documentElement.dataset.nativeScheme=native;localStorage.setItem('codex-pink-mod:profiles:v1',saved)},{native,saved});
   const headerSize=await page.locator('header').boundingBox();
   await page.evaluate(source);
   // Markdown is also used in compact activity/status labels. It must not
   // acquire the full assistant-message card's paint or padding.
   const activity=await page.evaluate(()=>{
    const root=document.createElement('section');root.hidden=true;document.querySelector('main').append(root);
    const values=[];for(const tag of ['span','div']){const e=document.createElement(tag);e.className='_MarkdownRoot_activity';e.textContent='Tool status';root.append(e);const s=getComputedStyle(e);values.push({bg:s.backgroundColor,padding:s.padding,shadow:s.boxShadow})}root.remove();return values;
   });
   for(const item of activity){assert.equal(item.bg,'rgba(0, 0, 0, 0)');assert.equal(item.padding,'0px');assert.equal(item.shadow,'none')}
   const sample=()=>page.evaluate(()=>{
    const rgba=color=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data]};
    const s=e=>getComputedStyle(e),q=s=>document.querySelector(s);const pair=(el,bg)=>({fg:rgba(s(q(el)).color),bg:rgba(s(q(bg)).backgroundColor)});
    return {header:pair('.share span','.share'),title:pair('header .title','header .title'),body:pair('.body-copy','article'),secondary:pair('article .secondary','article'),link:pair('article a','article'),composer:{fg:rgba(getComputedStyle(q('textarea'),'::placeholder').color),bg:rgba(s(q('.composer-surface-chrome')).backgroundColor)},sidebar:{fg:rgba(s(q('.nav:not([aria-current])')).color),bg:rgba(s(q('aside')).getPropertyValue('--pink-wallpaper-scrim')||s(q('aside')).backgroundColor)},sidebarSecondary:{fg:rgba(s(q('.section')).color),bg:rgba(s(q('aside')).getPropertyValue('--pink-wallpaper-scrim')||s(q('aside')).backgroundColor)},headerBackground:s(q('header')).backgroundColor,readerBackground:s(q('.thread-scroll-container')).backgroundColor};
   });
   const before=await sample();assert.equal(before.headerBackground,'rgba(0, 0, 0, 0)');
   assert.equal(before.header.bg[3],0,'Share has no individual capsule');
   assert.equal(before.title.bg[3],0,'Title has no individual capsule');
   assert.equal(await page.locator('.share').evaluate(e=>getComputedStyle(e).boxShadow),'none');
   const panel=await page.locator('#codex-pink-mod').evaluate(e=>getComputedStyle(e).getPropertyValue('--editor-panel').trim());
   const wash=[1,3,5].map(i=>parseInt(panel.slice(i,i+2),16));wash.push(245);
   assert.ok(headerSize.y+headerSize.height<=80,'Toolbar fits the protected gradient band');
   const backdrop=await page.locator('main').evaluate(e=>getComputedStyle(e).backgroundImage);
   assert.ok(backdrop.includes('80px')&&backdrop.includes('128px'),'Wallpaper has a shared toolbar wash');
   before.header.bg=wash;before.title.bg=wash;
   const values=[];
   for(const name of theme==='moonlight'?['header','title','composer']:['header','title','body','secondary','link','composer']){
    const p=before[name];for(const backdrop of [[0,0,0],[255,255,255]]){const ratio=contrast(p.fg,composite(p.bg,backdrop));assert.ok(ratio>=4.5,`${native}/${theme}/${name} on ${backdrop[0]}: ${ratio.toFixed(2)}`);values.push(ratio)}
   }
   await page.locator('.share').hover();const hover=(await sample()).header;assert.ok(contrast(hover.fg,composite(hover.bg,composite(wash,[0,0,0])))>=4.5);
   await page.locator('.share').focus();assert.equal(await page.locator('.share').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
   await page.mouse.move(0,0);await page.locator('.share').blur();
   const afterSize=await page.locator('header').boundingBox();assert.equal(afterSize.width,headerSize.width);assert.equal(afterSize.height,headerSize.height);
   assert.equal(before.readerBackground,'rgba(0, 0, 0, 0)','Wallpaper remains visible between messages in every theme');
   assert.equal(await page.evaluate(()=>localStorage.getItem('codex-pink-mod:profiles:v1')),saved);
   if(native==='light')await page.screenshot({path:fileURLToPath(new URL(`${theme}.png`,out))});
   // Honor the OS accessibility preference without requiring a native setting change.
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
   const reduced=await sample();for(const name of ['body','composer','sidebar'])assert.equal(reduced[name].bg[3],255,`${theme}/${name}/reduced transparency`);
   assert.equal(reduced.header.bg[3],0,'Reduced transparency also avoids individual capsules');
   await cdp.detach();
   await page.evaluate(()=>window.__CODEX_PINK_MOD__.cleanup());assert.equal(await page.locator('.share').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
   assert.deepEqual(errors,[]);report.push({native,theme,minContrast:Math.min(...values).toFixed(2)});await page.close();
  }
  await fs.writeFile(new URL('results.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
