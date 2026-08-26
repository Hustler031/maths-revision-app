// Active served UI: one quiz layer + one application layer + isolated Mocks and finalization behavior.
// Finalization keeps the single App renderer and changes only authoritative assembly-time routes/orchestration.
// getMathsHomeV14 is the focused-practice-safe wrapper over the protected getMathsHomeV12 Daily home implementation.
function completePracticeUiPatch_(){
  ensureMathsProgressSnapshotV10_();
  const quizUi=HtmlService.createHtmlOutputFromFile('MathsQuizUI').getContent();

  // Academic cache compatibility: old/pre-V14 cache entries are never rendered.
  const oldCacheDecl="const PREFIX='maths-app-v9:',FRESH=5*60*1000,MAX_STALE=24*60*60*1000;const mem={};let knownVersion='',prefetching=false;";
  const newCacheDecl="const PREFIX='maths-app-v9:',FRESH=5*60*1000,MAX_STALE=24*60*60*1000,CACHE_SCHEMA='academic-v20-cache1',ACADEMIC_COMPAT='v14';const mem={};let knownVersion='',prefetching=false,bootstrapGuarded=false,bootstrapValue=null;";

  const oldCacheFns="function read(k){if(mem[k])return mem[k];try{const x=JSON.parse(localStorage.getItem(PREFIX+k)||'null');if(!x)return null;mem[k]=x;return x}catch(e){return null}}function write(k,d){const x={ts:Date.now(),version:d&&d.version||knownVersion||'',data:d};mem[k]=x;try{localStorage.setItem(PREFIX+k,JSON.stringify(x))}catch(e){}return d}function drop(k){delete mem[k];try{localStorage.removeItem(PREFIX+k)}catch(e){}}\nfunction cached(k){const x=read(k);if(!x)return null;const age=Date.now()-Number(x.ts||0);return {data:x.data,fresh:age<=FRESH,stale:age<=MAX_STALE,version:x.version||''}}";
  const newCacheFns="function academicCacheKey(k){return k==='home'||k==='bootstrap'||k==='new'||k==='snapshot'||String(k).indexOf('metric:')===0}function cacheCompat(d,k){if(!academicCacheKey(k))return'';if(k==='bootstrap')return String(d&&d.chapterVisibilityVersion||'');return String(d&&d.eligibilityVersion||'')}function read(k){if(mem[k])return mem[k];try{const x=JSON.parse(localStorage.getItem(PREFIX+k)||'null');if(!x)return null;mem[k]=x;return x}catch(e){return null}}function write(k,d){const x={ts:Date.now(),version:d&&d.version||knownVersion||'',schema:CACHE_SCHEMA,compat:cacheCompat(d,k),data:d};mem[k]=x;try{localStorage.setItem(PREFIX+k,JSON.stringify(x))}catch(e){}return d}function drop(k){delete mem[k];try{localStorage.removeItem(PREFIX+k)}catch(e){}}\nfunction cached(k){const x=read(k);if(!x)return null;if(String(x.schema||'')!==CACHE_SCHEMA){drop(k);return null}if(academicCacheKey(k)&&String(x.compat||'')!==ACADEMIC_COMPAT){drop(k);return null}const age=Date.now()-Number(x.ts||0);return {data:x.data,fresh:age<=FRESH,stale:age<=MAX_STALE,version:x.version||'',compat:x.compat||''}}";

  const oldRefresh="function refreshBootstrap(){return call('bootstrap').then(b=>{app.bootstrap=b;knownVersion=String(b.version||knownVersion);write('bootstrap',b);return b})}";
  const newRefresh="function bootstrapCompatible(b){return !!b&&String(b.chapterVisibilityVersion||'')===ACADEMIC_COMPAT}function installBootstrapGuard(){if(bootstrapGuarded)return;bootstrapValue=app.bootstrap;try{Object.defineProperty(app,'bootstrap',{configurable:true,get:()=>bootstrapValue,set:v=>{if(v==null||bootstrapCompatible(v))bootstrapValue=v}});bootstrapGuarded=true}catch(e){bootstrapGuarded=false}}function refreshBootstrap(){return call('bootstrap').then(b=>{if(!bootstrapCompatible(b))throw new Error('Incompatible Maths bootstrap');app.bootstrap=b;installBootstrapGuard();knownVersion=String(b.version||knownVersion);write('bootstrap',b);return b})}";

  const oldCheck="function checkVersion(){call('version').then(v=>{const nv=String(v&&v.version||'');if(!nv)return;if(knownVersion&&nv!==knownVersion){knownVersion=nv;Object.keys(mem).forEach(k=>{if(k!=='bootstrap')drop(k)});refreshBootstrap().then(()=>{if(app.view==='home')home()})}else knownVersion=nv}).catch(()=>{})}";
  const newCheck="function delayRefresh(ms){return new Promise(r=>setTimeout(r,ms))}function refreshHomeSilent(){return call('home').then(d=>{if(String(d&&d.eligibilityVersion||'')!==ACADEMIC_COMPAT)throw new Error('Incompatible Maths home');write('home',d);return d}).catch(()=>null)}function refreshBootstrapSilent(){return refreshBootstrap().catch(()=>null)}function refreshMathsHomeCacheSilent(){return refreshHomeSilent().then(()=>refreshBootstrapSilent())}window.refreshMathsHomeCacheSilent=refreshMathsHomeCacheSilent;function reconcileCaches(nv){knownVersion=String(nv||knownVersion);return refreshHomeSilent().then(()=>refreshBootstrapSilent()).then(()=>delayRefresh(80)).then(()=>prefetch())}function checkVersion(){return call('version').then(v=>{const nv=String(v&&v.version||'');if(!nv)return;const changed=!!knownVersion&&nv!==knownVersion;if(changed)return reconcileCaches(nv);knownVersion=nv}).catch(()=>{})}";

  const oldPrefetch="function prefetch(){if(prefetching)return;prefetching=true;Promise.allSettled([call('snapshot').then(d=>write('snapshot',d)),call('new').then(d=>write('new',d)),call('starred').then(d=>write('starred',d)),call('concepts').then(d=>write('concepts',d))]).finally(()=>prefetching=false)}";
  const newPrefetch="function prefetch(){if(prefetching)return Promise.resolve();prefetching=true;const jobs=[['new','new'],['starred','starred'],['concepts','concepts'],['snapshot','snapshot']];return jobs.reduce((p,j)=>p.then(()=>{const c=cached(j[1]);if(c&&c.fresh&&(!knownVersion||c.version===knownVersion))return null;return call(j[0]).then(d=>write(j[1],d)).catch(()=>null)}).then(()=>delayRefresh(90)),Promise.resolve()).then(()=>delayRefresh(140)).then(()=>typeof window.prefetchMathsMocksV10==='function'?window.prefetchMathsMocksV10():null).finally(()=>{prefetching=false})}";

  const oldStart="setTimeout(()=>{const bc=cached('bootstrap');if(bc&&bc.stale){app.bootstrap=bc.data;knownVersion=String(bc.version||bc.data.version||'')}const hc=cached('home');setView('home','home');if(hc&&hc.stale)renderHome(hc.data);else main('<div class=\"ma-loading-shell\"><div class=\"ma-loading-card\"></div></div>');refreshBootstrap().then(()=>home()).catch(()=>{if(!hc&&app.bootstrap)home()});setTimeout(checkVersion,450);setTimeout(prefetch,1200)},0);";
  const newStart="setTimeout(()=>{const bc=cached('bootstrap'),hc=cached('home'),instant=!!(bc&&bc.stale&&hc&&hc.stale);if(instant){app.bootstrap=bc.data;installBootstrapGuard();knownVersion=String(bc.version||bc.data.version||'')}setView('home','home');if(instant){if(typeof loading==='function')loading(false);renderHome(hc.data)}else main('<div class=\"ma-loading-shell\"><div class=\"ma-loading-card\"></div></div>');const homeTask=hc&&hc.fresh?Promise.resolve(hc.data):refreshHomeSilent();homeTask.then(()=>{const b=cached('bootstrap');return b&&b.fresh?null:refreshBootstrapSilent()}).then(()=>{if(!instant&&typeof loading==='function'&&cached('home')&&cached('bootstrap'))loading(false)}).then(()=>delayRefresh(100)).then(()=>checkVersion()).then(()=>delayRefresh(160)).then(()=>prefetch()).catch(()=>{})},0);";

  let appUi=HtmlService.createHtmlOutputFromFile('MathsAppUI').getContent()
    .replace('r.getAppBootstrapV9()','r.getAppBootstrapV14()')
    .replace('r.getMathsHomeV9()','r.getMathsHomeV14()')
    .replace('r.getMathsSnapshotV9(false)','r.getMathsSnapshotV14(false)')
    .replace('r.getMathsNewHubV9()','r.getMathsNewHubV14()')
    .replace('r.getMathsScopeMetricV9(arg||{})','r.getMathsScopeMetricV14(arg||{})')
    .replace('r.startMathsPracticeV9(arg||{})','r.startMathsPracticeV14(arg||{})')
    .replace('r.getMathsViewItemsV9(arg||{})','r.getMathsViewItemsV14(arg||{})')
    .replace("Finish Day '+day+' first, then use focused practice.",'Mixed adaptive revision · whole question bank, Calculation excluded.')
    .replace("Fresh-first: '+target+' questions · reinforcement 0","7 New guaranteed · Difficult every 3 days · Weak, Hard and due revision")
    .replace("'+(done?'Continue Day '+day+' · '+left+' left':'Start Day '+day+' · '+left+' left')+'","'+(daily.completed?'Practice More':done?'Continue Day '+day+' · '+left+' left':'Start Day '+day+' · '+left+' left')+'")
    .replace("qs('#maDaily').onclick=()=>beginQuiz('daily',{planDay:day});","qs('#maDaily').onclick=()=>daily.completed?beginQuiz('practice_more',{count:target}):beginQuiz('daily',{planDay:day});")
    .replace(oldCacheDecl,newCacheDecl)
    .replace(oldCacheFns,newCacheFns)
    .replace(oldRefresh,newRefresh)
    .replace(oldCheck,newCheck)
    .replace(oldPrefetch,newPrefetch)
    .replace(oldStart,newStart);

  if(!appUi.includes('getAppBootstrapV14')||!appUi.includes('getMathsHomeV14')||!appUi.includes('getMathsSnapshotV14')||!appUi.includes('getMathsNewHubV14')||!appUi.includes('getMathsScopeMetricV14')||!appUi.includes('startMathsPracticeV14')||!appUi.includes('getMathsViewItemsV14'))throw new Error('Maths academic eligibility route replacement failed');
  if(!appUi.includes('refreshHomeSilent')||!appUi.includes('reconcileCaches')||appUi.includes("Promise.allSettled([call('snapshot')"))throw new Error('Maths cache orchestration replacement failed');
  if(!appUi.includes("CACHE_SCHEMA='academic-v20-cache1'")||!appUi.includes('academicCacheKey')||!appUi.includes('installBootstrapGuard'))throw new Error('Maths cache compatibility replacement failed');

  // Keep Mocks isolated, but make its lightweight hub and chapter reads cache-aware.
  const oldMockDecl="var KEY='maths-mocks-v10:hub',FRESH=5*60*1000,hub=null,currentChapter='',questions=[];";
  const newMockDecl="var KEY='maths-mocks-v10:hub',CHAPTER_PREFIX='maths-mocks-v10:chapter:',FRESH=5*60*1000,MAX_STALE=24*60*60*1000,SCHEMA='mocks-v10-cache1',MOCK_SCHEMA='mocks-v10',hub=null,currentChapter='',questions=[];";
  const oldMockCache="function saveCache(d){hub=d;try{localStorage.setItem(KEY,JSON.stringify({ts:Date.now(),version:d.version||'',data:d}))}catch(x){}}\nfunction readCache(){try{var x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&Date.now()-Number(x.ts||0)<=24*60*60*1000)return x}catch(y){}return null}";
  const newMockCache="function validHubData(d){return !!d&&String(d.mockSchema||'')===MOCK_SCHEMA&&String(d.setId||'')==='MOCK_QUESTIONS'}function saveCache(d){if(!validHubData(d))return null;hub=d;try{localStorage.setItem(KEY,JSON.stringify({ts:Date.now(),schema:SCHEMA,version:d.version||'',data:d}))}catch(x){}return d}\nfunction readCache(){try{var x=JSON.parse(localStorage.getItem(KEY)||'null');if(!x||String(x.schema||'')!==SCHEMA||!validHubData(x.data)||Date.now()-Number(x.ts||0)>MAX_STALE){localStorage.removeItem(KEY);return null}return x}catch(y){return null}}function chapterKey(name){return CHAPTER_PREFIX+encodeURIComponent(String(name||''))}function readChapterCache(name){try{var x=JSON.parse(localStorage.getItem(chapterKey(name))||'null');if(!x||String(x.schema||'')!==SCHEMA||Date.now()-Number(x.ts||0)>MAX_STALE||!hub||String(x.version||'')!==String(hub.version||'')){localStorage.removeItem(chapterKey(name));return null}return x}catch(y){return null}}function saveChapterCache(name,list){try{localStorage.setItem(chapterKey(name),JSON.stringify({ts:Date.now(),schema:SCHEMA,version:hub&&hub.version||'',data:list||[]}))}catch(x){}return list||[]}function clearChapterCaches(){try{for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(k&&k.indexOf(CHAPTER_PREFIX)===0)localStorage.removeItem(k)}}catch(x){}}";
  const oldOpenMocks="function openMocks(){setView();var c=readCache();if(c){renderHub(c.data);if(Date.now()-Number(c.ts||0)<=FRESH)return gas('hub').then(function(d){if(String(d.version||'')!==String(c.version||'')){saveCache(d);if(app.view==='mocks'&&!currentChapter)renderHub(d)}}).catch(function(){})}main('<div class=\"ma-loading-shell\"><div class=\"ma-loading-card\"></div></div>');gas('hub').then(function(d){saveCache(d);if(app.view==='mocks')renderHub(d)}).catch(function(x){toastM(x.message)})}";
  const newOpenMocks="function refreshMockHub(silent){return gas('hub').then(function(d){if(!validHubData(d))throw new Error('Incompatible mock cache');var changed=hub&&String(hub.version||'')!==String(d.version||'');saveCache(d);if(changed)clearChapterCaches();if(app.view==='mocks'&&!currentChapter)renderHub(d);return d}).catch(function(x){if(!silent)toastM(x.message);return null})}function openMocks(){setView();var c=readCache();if(c){renderHub(c.data);if(Date.now()-Number(c.ts||0)<=FRESH)return Promise.resolve(c.data);return refreshMockHub(true)}main('<div class=\"ma-loading-shell\"><div class=\"ma-loading-card\"></div></div>');return refreshMockHub(false)}";
  const oldOpenChapter="function openChapter(name){currentChapter=String(name||'');setView();var row=(hub&&hub.chapters||[]).find(function(x){return String(x.chapter)===currentChapter}),metric=row&&row.metric||{};strip(metric);main('<div class=\"ma-page\"><button class=\"btn ghost ma-back\" id=\"mmChapterBack\">← Mocks</button><div class=\"ma-kicker\">Mocks</div><div class=\"ma-title\">'+e(currentChapter)+'</div><div class=\"ma-sub\">'+Number(metric.total||0)+' mock questions · inspect the exact questions or start focused practice.</div>'+summary(metric)+'<div class=\"mm-actions-shell\">'+actions()+'</div><div class=\"ma-section\">Questions</div><div id=\"mmQuestions\" class=\"mm-q-list\"><div class=\"ma-row-sub\">Loading questions…</div></div></div>');q('#mmChapterBack').onclick=function(){currentChapter='';renderHub(hub)};bind(q('#main'),currentChapter);gas('questions',currentChapter).then(function(list){questions=list||[];var host=q('#mmQuestions');if(!host)return;host.innerHTML=questions.map(function(x,i){return '<div class=\"mm-q\" data-mm-q=\"'+i+'\"><div class=\"mm-q-title\">'+(i+1)+'. '+e(x.prompt)+'</div><div class=\"mm-q-tags\">'+qStatus(x)+'</div></div>'}).join('')||'<div class=\"ma-row-sub\">No questions found.</div>';qa('[data-mm-q]',host).forEach(function(r){r.onclick=function(){detail(Number(r.dataset.mmQ))}})}).catch(function(x){var host=q('#mmQuestions');if(host)host.innerHTML='<div class=\"ma-row-sub\">'+e(x.message)+'</div>'})}";
  const newOpenChapter="function renderQuestions(list){questions=list||[];var host=q('#mmQuestions');if(!host)return;host.innerHTML=questions.map(function(x,i){return '<div class=\"mm-q\" data-mm-q=\"'+i+'\"><div class=\"mm-q-title\">'+(i+1)+'. '+e(x.prompt)+'</div><div class=\"mm-q-tags\">'+qStatus(x)+'</div></div>'}).join('')||'<div class=\"ma-row-sub\">No questions found.</div>';qa('[data-mm-q]',host).forEach(function(r){r.onclick=function(){detail(Number(r.dataset.mmQ))}})}function openChapter(name){currentChapter=String(name||'');setView();var row=(hub&&hub.chapters||[]).find(function(x){return String(x.chapter)===currentChapter}),metric=row&&row.metric||{};strip(metric);main('<div class=\"ma-page\"><button class=\"btn ghost ma-back\" id=\"mmChapterBack\">← Mocks</button><div class=\"ma-kicker\">Mocks</div><div class=\"ma-title\">'+e(currentChapter)+'</div><div class=\"ma-sub\">'+Number(metric.total||0)+' mock questions · inspect the exact questions or start focused practice.</div>'+summary(metric)+'<div class=\"mm-actions-shell\">'+actions()+'</div><div class=\"ma-section\">Questions</div><div id=\"mmQuestions\" class=\"mm-q-list\"><div class=\"ma-row-sub\">Loading questions…</div></div></div>');q('#mmChapterBack').onclick=function(){currentChapter='';renderHub(hub)};bind(q('#main'),currentChapter);var cc=readChapterCache(currentChapter);if(cc){renderQuestions(cc.data);if(Date.now()-Number(cc.ts||0)<=FRESH)return}gas('questions',currentChapter).then(function(list){saveChapterCache(currentChapter,list||[]);if(app.view==='mocks'&&currentChapter===String(name||''))renderQuestions(list||[])}).catch(function(x){var host=q('#mmQuestions');if(host&&!cc)host.innerHTML='<div class=\"ma-row-sub\">'+e(x.message)+'</div>'})}";
  const oldMockTail="window.addEventListener('maths:data-changed',function(){try{localStorage.removeItem(KEY)}catch(x){};hub=null});\nwindow.openMathsMocksV10=openMocks;";
  const newMockTail="window.addEventListener('maths:data-changed',function(){try{localStorage.removeItem(KEY)}catch(x){};clearChapterCaches();hub=null});\nwindow.prefetchMathsMocksV10=function(){var c=readCache();if(c&&Date.now()-Number(c.ts||0)<=FRESH)return Promise.resolve(c.data);return refreshMockHub(true)};window.openMathsMocksV10=openMocks;";

  let mocksUi=HtmlService.createHtmlOutputFromFile('MathsMocksUI').getContent()
    .replace(oldMockDecl,newMockDecl)
    .replace(oldMockCache,newMockCache)
    .replace(oldOpenMocks,newOpenMocks)
    .replace(oldOpenChapter,newOpenChapter)
    .replace(oldMockTail,newMockTail);
  if(!mocksUi.includes("SCHEMA='mocks-v10-cache1'")||!mocksUi.includes('validHubData')||!mocksUi.includes('readChapterCache')||!mocksUi.includes('prefetchMathsMocksV10'))throw new Error('Maths Mocks cache compatibility replacement failed');

  // Route/session persistence only: preserve the user's current screen across document/webview reloads.
  const routePersistenceUi=`<script>
(function(){
'use strict';
var ROUTE_KEY='maths-ui-route-v1',ROUTE_MAX=24*60*60*1000,started=Date.now(),explicitHome=false;
function saveRoute(r){try{r=r||{type:'home'};r.ts=Date.now();localStorage.setItem(ROUTE_KEY,JSON.stringify(r))}catch(e){}}
function readRoute(){try{var r=JSON.parse(localStorage.getItem(ROUTE_KEY)||'null');if(!r||Date.now()-Number(r.ts||0)>ROUTE_MAX){localStorage.removeItem(ROUTE_KEY);return null}return r}catch(e){return null}}
function clearRoute(){try{localStorage.removeItem(ROUTE_KEY)}catch(e){}}
function sameData(el,attr,value){return el&&String(el.getAttribute(attr)||'')===String(value||'')}
function clickWhen(selector,attr,value,tries){tries=tries||24;var el=document.querySelector(selector);if(attr&&el&&!sameData(el,attr,value))el=null;if(!el&&attr){var all=document.querySelectorAll(selector);for(var i=0;i<all.length;i++){if(sameData(all[i],attr,value)){el=all[i];break}}}if(el){el.click();return}if(tries>0)setTimeout(function(){clickWhen(selector,attr,value,tries-1)},100)}
function restoreRoute(r){if(!r||r.type==='home')return;
  try{
    if(r.type==='quiz'&&r.sessionId&&typeof server==='function')return server('resumeSession',r.sessionId).then(function(x){if(x&&x.ok!==false&&typeof window.openQuiz==='function')window.openQuiz(x);else clearRoute()}).catch(function(){clearRoute()});
    if(r.type==='view'){if(r.view==='chapters'&&window.chapters)return window.chapters();if(r.view==='library'&&window.library)return window.library();if(r.view==='ondemand'&&window.ondemand)return window.ondemand();if(r.view==='progress'&&window.progress)return window.progress();}
    if(r.type==='group'&&window.openStudyGroup)return window.openStudyGroup(r.key);
    if(r.type==='chapter'&&window.openChapterHub)return window.openChapterHub(r.chapter);
    if(r.type==='topic'&&window.openTopicHub)return window.openTopicHub(r.chapter,r.key);
    if(r.type==='new'&&window.openGlobalNewV3)return window.openGlobalNewV3();
    if(r.type==='newChapter'&&window.openGlobalNewV3){window.openGlobalNewV3();return clickWhen('[data-ma-newch]','data-ma-newch',r.chapter)}
    if(r.type==='starred'&&window.openStarredRevisionV3)return window.openStarredRevisionV3();
    if(r.type==='concepts'&&window.openConceptsV4)return window.openConceptsV4();
    if(r.type==='conceptChapter'&&window.openConceptsV4){window.openConceptsV4();return clickWhen('[data-ma-conch]','data-ma-conch',r.chapter)}
    if(r.type==='mocks'&&window.openMathsMocksV10)return window.openMathsMocksV10();
    if(r.type==='mockChapter'&&window.openMathsMocksV10){window.openMathsMocksV10();return clickWhen('[data-mm-ch]','data-mm-ch',r.chapter)}
  }catch(e){}
}
var saved=readRoute();
var originalOpenQuiz=window.openQuiz;if(originalOpenQuiz)window.openQuiz=function(x){if(x&&x.sessionId)saveRoute({type:'quiz',sessionId:String(x.sessionId)});if(typeof app!=='undefined')app.view='quiz';return originalOpenQuiz.apply(this,arguments)};
var originalHome=window.home;if(originalHome)window.home=function(){explicitHome=true;saveRoute({type:'home'});return originalHome.apply(this,arguments)};
var originalShowView=window.showView;if(originalShowView)window.showView=function(v){if(v==='home'&&!explicitHome&&saved&&saved.type!=='home'&&Date.now()-started<5000)return;return originalShowView.apply(this,arguments)};
document.addEventListener('click',function(ev){var x=ev.target&&ev.target.closest?ev.target.closest('button,[data-ma-group],[data-ma-ch],[data-ma-topic],[data-ma-newch],[data-ma-conch],[data-mm-ch]'):null;if(!x)return;
  if(x.matches('#nav button[data-view]')){var v=x.dataset.view;if(v==='home'){explicitHome=true;saveRoute({type:'home'})}else saveRoute({type:'view',view:v});return}
  if(x.id==='maNew'){saveRoute({type:'new'});return}if(x.id==='maStar'){saveRoute({type:'starred'});return}if(x.id==='maConcept'){saveRoute({type:'concepts'});return}
  if(x.hasAttribute('data-ma-group')){var g=x.dataset.maGroup;saveRoute(g==='mocks'?{type:'mocks'}:{type:'group',key:g});return}
  if(x.hasAttribute('data-ma-ch')){saveRoute({type:'chapter',chapter:x.dataset.maCh});return}
  if(x.hasAttribute('data-ma-topic')){var rr=readRoute();saveRoute({type:'topic',chapter:rr&&rr.chapter||'',key:x.dataset.maTopic});return}
  if(x.hasAttribute('data-ma-newch')){saveRoute({type:'newChapter',chapter:x.dataset.maNewch});return}
  if(x.hasAttribute('data-ma-conch')){saveRoute({type:'conceptChapter',chapter:x.dataset.maConch});return}
  if(x.hasAttribute('data-mm-ch')){saveRoute({type:'mockChapter',chapter:x.dataset.mmCh});return}
  if(x.id==='maGroupBack'){saveRoute({type:'view',view:'chapters'});return}if(x.id==='maChapterBack'){saveRoute({type:'view',view:'chapters'});return}
  if(x.id==='maTopicBack'){var tr=readRoute();saveRoute({type:'chapter',chapter:tr&&tr.chapter||''});return}
  if(x.id==='maNewBack'||x.id==='maStarBack'||x.id==='maConceptBack'||x.id==='mqSaveHome'){explicitHome=true;saveRoute({type:'home'});return}
  if(x.id==='maNewChBack'){saveRoute({type:'new'});return}if(x.id==='maConChBack'){saveRoute({type:'concepts'});return}
  if(x.id==='mmBack'){saveRoute({type:'view',view:'chapters'});return}if(x.id==='mmChapterBack'){saveRoute({type:'mocks'});return}
},true);
function ready(){return typeof app!=='undefined'&&app.bootstrap&&String(app.bootstrap.chapterVisibilityVersion||'')==='v14'}
(function wait(n){if(!saved||saved.type==='home')return;if(ready())return setTimeout(function(){restoreRoute(saved)},650);if(n>0)setTimeout(function(){wait(n-1)},100)})(50);
})();
</script>`;
  const finalizationUi=HtmlService.createHtmlOutputFromFile('MathsFinalizationUIV12').getContent();
  return quizUi+appUi+mocksUi+finalizationUi+routePersistenceUi;
}
