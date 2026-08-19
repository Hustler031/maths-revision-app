const MATHS_PROGRESS_SNAPSHOT_SHEET='Progress_Snapshot';
const MATHS_PROGRESS_TRIGGER_HANDLER='refreshMathsProgressSnapshotV10';

function mathsLectureChapterNamesV10_(){
  const names={};
  try{
    sheetObjects_(getSheet_(MATHS.SHEETS.PLAN)).forEach(r=>{
      const c=String(r.chapter||r.chapter_name||'').trim();
      if(c)names[normalizeLabel_(c)]=c;
    });
  }catch(e){}
  ['Fraction Patterns','Triplets','Squares/Cubes','Calculation Memory'].forEach(c=>names[normalizeLabel_(c)]=c);
  return Object.keys(names).map(k=>names[k]);
}

function mathsProgressSheetV10_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sh=ss.getSheetByName(MATHS_PROGRESS_SNAPSHOT_SHEET);
  if(!sh)sh=ss.insertSheet(MATHS_PROGRESS_SNAPSHOT_SHEET);
  const headers=['Snapshot_Version','Generated_At','Scope','Chapter','Group','Total_Q','Encountered','Left','Coverage_Pct','Wrong','Wrong_Pct','Difficult','Difficult_Pct','Starred','Starred_Pct','Weak'];
  if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);
  else{
    const got=sh.getRange(1,1,1,Math.max(headers.length,sh.getLastColumn())).getDisplayValues()[0].slice(0,headers.length);
    if(headers.some((h,i)=>got[i]!==h))sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  return sh;
}

function mathsSnapshotRowsV10_(snap){
  function row(scope,chapter,group,m){m=m||{};return [String(snap.version||''),new Date(snap.generatedAt||new Date()),scope,chapter||'',group||'',Number(m.total||0),Number(m.attempted||0),Number(m.unseen||0),Number(m.coverage||0),Number(m.wrong||0),Number(m.wrongPct||0),Number(m.difficult||0),Number(m.difficultPct||0),Number(m.starred||0),Number(m.starredPct||0),Number(m.weak||0)]}
  const out=[row('OVERALL','','',snap.overall),row('GROUP','','advanced',snap.advanced),row('GROUP','','arithmetic',snap.arithmetic),row('GROUP','','misc',snap.misc)];
  (snap.chapters||[]).forEach(c=>out.push(row('CHAPTER',c.chapter,c.group,c.metric)));
  return out;
}

function persistMathsProgressSnapshotV10_(snap){
  const sh=mathsProgressSheetV10_(),rows=mathsSnapshotRowsV10_(snap),cols=16;
  if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,Math.max(cols,sh.getLastColumn())).clearContent();
  if(rows.length)sh.getRange(2,1,rows.length,cols).setValues(rows);
  return snap;
}

function warmMathsProgressCacheV10_(snap){
  try{mathsCacheV9_().put('maths:core:'+MATHS_CORE_VERSION+':progress:'+String(snap.version||mathsVersionV9_()),JSON.stringify(snap),MATHS_CORE_CACHE_SEC)}catch(e){}
  return snap;
}

function refreshMathsProgressSnapshotV10(){
  ensureMathsInfrastructure_();
  return mathsLockedV9_(()=>{
    const snap=buildMathsSnapshotV9_();
    persistMathsProgressSnapshotV10_(snap);
    warmMathsProgressCacheV10_(snap);
    PropertiesService.getScriptProperties().setProperty('MATHS_PROGRESS_SNAPSHOT_VERSION',String(snap.version||''));
    return {ok:true,version:String(snap.version||''),generatedAt:snap.generatedAt,rows:(snap.chapters||[]).length+4};
  });
}

function readMathsProgressSnapshotV10(){
  const sh=mathsProgressSheetV10_();
  if(sh.getLastRow()<2){refreshMathsProgressSnapshotV10();}
  const rows=sheetObjects_(sh);
  if(!rows.length)return buildMathsSnapshotV9_();
  const first=rows[0],version=String(first.snapshot_version||''),generatedAt=new Date(first.generated_at||new Date()).toISOString();
  function metric(r){return {total:Number(r.total_q||0),attempted:Number(r.encountered||0),unseen:Number(r.left||0),coverage:Number(r.coverage_pct||0),wrong:Number(r.wrong||0),wrongPct:Number(r.wrong_pct||0),difficult:Number(r.difficult||0),difficultPct:Number(r.difficult_pct||0),starred:Number(r.starred||0),starredPct:Number(r.starred_pct||0),weak:Number(r.weak||0)}}
  const overallRow=rows.find(r=>String(r.scope||'').toUpperCase()==='OVERALL')||{},groups={};
  rows.filter(r=>String(r.scope||'').toUpperCase()==='GROUP').forEach(r=>groups[String(r.group||'').toLowerCase()]=metric(r));
  const chapters=rows.filter(r=>String(r.scope||'').toUpperCase()==='CHAPTER').map(r=>({chapter:String(r.chapter||''),group:String(r.group||''),metric:metric(r)}));
  return {version,generatedAt,overall:metric(overallRow),advanced:groups.advanced||{},arithmetic:groups.arithmetic||{},misc:groups.misc||{},chapters};
}

function ensureMathsProgressSnapshotV10_(){
  const sh=mathsProgressSheetV10_(),props=PropertiesService.getScriptProperties();
  if(sh.getLastRow()<2){try{refreshMathsProgressSnapshotV10()}catch(e){}}
  if(props.getProperty('MATHS_PROGRESS_TRIGGER_READY')==='1')return;
  const exists=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()===MATHS_PROGRESS_TRIGGER_HANDLER);
  if(!exists)ScriptApp.newTrigger(MATHS_PROGRESS_TRIGGER_HANDLER).timeBased().everyMinutes(5).create();
  props.setProperty('MATHS_PROGRESS_TRIGGER_READY','1');
}
