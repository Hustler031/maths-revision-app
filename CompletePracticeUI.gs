// Active served UI: one quiz layer + one application layer + isolated Mocks and finalization behavior.
// Finalization keeps the single App renderer and changes only authoritative assembly-time routes/orchestration.
// getMathsHomeV14 is the focused-practice-safe wrapper over the protected getMathsHomeV12 Daily home implementation.
function completePracticeUiPatch_(){
  ensureMathsProgressSnapshotV10_();
  const quizUi=HtmlService.createHtmlOutputFromFile('MathsQuizUI').getContent();
  const oldCheck="function checkVersion(){call('version').then(v=>{const nv=String(v&&v.version||'');if(!nv)return;if(knownVersion&&nv!==knownVersion){knownVersion=nv;Object.keys(mem).forEach(k=>{if(k!=='bootstrap')drop(k)});refreshBootstrap().then(()=>{if(app.view==='home')home()})}else knownVersion=nv}).catch(()=>{})}";
  const newCheck="function delayRefresh(ms){return new Promise(r=>setTimeout(r,ms))}function refreshHomeSilent(){return call('home').then(d=>{write('home',d);if(app.view==='home')renderHome(d);return d}).catch(()=>null)}function refreshBootstrapSilent(){return refreshBootstrap().catch(()=>null)}function reconcileCaches(nv){knownVersion=String(nv||knownVersion);return refreshHomeSilent().then(()=>refreshBootstrapSilent()).then(()=>delayRefresh(80)).then(()=>prefetch())}function checkVersion(){return call('version').then(v=>{const nv=String(v&&v.version||'');if(!nv)return;const changed=!!knownVersion&&nv!==knownVersion;if(changed)return reconcileCaches(nv);knownVersion=nv}).catch(()=>{})}";
  const oldPrefetch="function prefetch(){if(prefetching)return;prefetching=true;Promise.allSettled([call('snapshot').then(d=>write('snapshot',d)),call('new').then(d=>write('new',d)),call('starred').then(d=>write('starred',d)),call('concepts').then(d=>write('concepts',d))]).finally(()=>prefetching=false)}";
  const newPrefetch="function prefetch(){if(prefetching)return Promise.resolve();prefetching=true;const jobs=[['new','new'],['starred','starred'],['concepts','concepts'],['snapshot','snapshot']];return jobs.reduce((p,j)=>p.then(()=>{const c=cached(j[1]);if(c&&c.fresh&&(!knownVersion||c.version===knownVersion))return null;return call(j[0]).then(d=>write(j[1],d)).catch(()=>null)}).then(()=>delayRefresh(90)),Promise.resolve()).finally(()=>{prefetching=false})}";
  const oldStart="setTimeout(()=>{const bc=cached('bootstrap');if(bc&&bc.stale){app.bootstrap=bc.data;knownVersion=String(bc.version||bc.data.version||'')}const hc=cached('home');setView('home','home');if(hc&&hc.stale)renderHome(hc.data);else main('<div class=\"ma-loading-shell\"><div class=\"ma-loading-card\"></div></div>');refreshBootstrap().then(()=>home()).catch(()=>{if(!hc&&app.bootstrap)home()});setTimeout(checkVersion,450);setTimeout(prefetch,1200)},0);";
  const newStart="setTimeout(()=>{const bc=cached('bootstrap');if(bc&&bc.stale){app.bootstrap=bc.data;knownVersion=String(bc.version||bc.data.version||'')}const hc=cached('home');setView('home','home');if(hc&&hc.stale)renderHome(hc.data);else main('<div class=\"ma-loading-shell\"><div class=\"ma-loading-card\"></div></div>');const homeTask=hc&&hc.fresh?Promise.resolve(hc.data):refreshHomeSilent();homeTask.then(()=>{const b=cached('bootstrap');return b&&b.fresh?null:refreshBootstrapSilent()}).then(()=>delayRefresh(100)).then(()=>checkVersion()).then(()=>delayRefresh(160)).then(()=>prefetch()).catch(()=>{})},0);";
  let appUi=HtmlService.createHtmlOutputFromFile('MathsAppUI').getContent()
    .replace('r.getAppBootstrapV9()','r.getAppBootstrapV14()')
    .replace('r.getMathsHomeV9()','r.getMathsHomeV14()')
    .replace('r.getMathsSnapshotV9(false)','r.getMathsSnapshotV14(false)')
    .replace('r.getMathsNewHubV9()','r.getMathsNewHubV14()')
    .replace('r.getMathsScopeMetricV9(arg||{})','r.getMathsScopeMetricV14(arg||{})')
    .replace('r.startMathsPracticeV9(arg||{})','r.startMathsPracticeV14(arg||{})')
    .replace('r.getMathsViewItemsV9(arg||{})','r.getMathsViewItemsV14(arg||{})')
    .replace("Finish Day '+day+' first, then use focused practice.",'Mixed adaptive revision · whole question bank, Calculation excluded.')
    .replace("Fresh-first: '+target+' questions · reinforcement 0","Adaptive mix: '+target+' questions · Difficult, wrong, unseen and due first")
    .replace("'+(done?'Continue Day '+day+' · '+left+' left':'Start Day '+day+' · '+left+' left')+'","'+(daily.completed?'Practice More':done?'Continue Day '+day+' · '+left+' left':'Start Day '+day+' · '+left+' left')+'")
    .replace("qs('#maDaily').onclick=()=>beginQuiz('daily',{planDay:day});","qs('#maDaily').onclick=()=>daily.completed?beginQuiz('practice_more',{count:target}):beginQuiz('daily',{planDay:day});")
    .replace(oldCheck,newCheck)
    .replace(oldPrefetch,newPrefetch)
    .replace(oldStart,newStart);
  if(!appUi.includes('getAppBootstrapV14')||!appUi.includes('getMathsHomeV14')||!appUi.includes('getMathsSnapshotV14')||!appUi.includes('getMathsNewHubV14')||!appUi.includes('getMathsScopeMetricV14')||!appUi.includes('startMathsPracticeV14')||!appUi.includes('getMathsViewItemsV14'))throw new Error('Maths academic eligibility route replacement failed');
  if(!appUi.includes('refreshHomeSilent')||!appUi.includes('reconcileCaches')||appUi.includes('Promise.allSettled([call(\'snapshot\')'))throw new Error('Maths cache orchestration replacement failed');
  const mocksUi=HtmlService.createHtmlOutputFromFile('MathsMocksUI').getContent();
  const finalizationUi=HtmlService.createHtmlOutputFromFile('MathsFinalizationUIV12').getContent();
  return quizUi+appUi+mocksUi+finalizationUi;
}
