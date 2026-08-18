const MATHS_SNAPSHOT_TTL_SEC = 3600;

function mathsSnapshotCache_(){ return CacheService.getScriptCache(); }
function mathsSnapshotKey_(name){ return 'maths:snapshot:v6:'+String(name||'default'); }
function mathsPct_(n,d){ return d ? Math.round(Number(n||0)*1000/Number(d))/10 : 0; }

function buildMathsSnapshotV6_(){
  ensureMathsV3_();
  const all=standardStudyQuestions_(getAllQuestions_()).filter(active_).filter(q=>normalizeLabel_(q.topic)!=='concepts');
  const state=getStateMap_(), by={};
  all.forEach(q=>{ const c=String(q.chapter||'Other'); (by[c]||(by[c]=[])).push(q); });
  function metric(pool){
    const m=mathsV4Metric_(pool,state), attempted=Math.max(0,Number(m.attempted||0));
    return Object.assign({},m,{
      wrongPct:mathsPct_(m.wrong,attempted),
      difficultPct:mathsPct_(m.difficult,attempted),
      starredPct:mathsPct_(m.starred,attempted)
    });
  }
  const chapters=Object.keys(by).sort().map(chapter=>({chapter,group:mathsV3Group_(chapter),metric:metric(by[chapter])}));
  return {
    generatedAt:new Date().toISOString(),
    overall:metric(all),
    advanced:metric(all.filter(q=>mathsV3Group_(q.chapter)==='advanced')),
    arithmetic:metric(all.filter(q=>mathsV3Group_(q.chapter)==='arithmetic')),
    chapters
  };
}

function getMathsSnapshotV6(force){
  const cache=mathsSnapshotCache_(), key=mathsSnapshotKey_('progress');
  if(!force){
    const raw=cache.get(key); if(raw){ try{return JSON.parse(raw);}catch(e){} }
  }
  const snap=buildMathsSnapshotV6_();
  try{ cache.put(key,JSON.stringify(snap),MATHS_SNAPSHOT_TTL_SEC); }catch(e){}
  return snap;
}
function invalidateMathsSnapshotsV6(){
  try{ mathsSnapshotCache_().remove(mathsSnapshotKey_('progress')); }catch(e){}
  return true;
}
function getMathsScopeMetricV6(request){
  ensureMathsV3_();
  const m=mathsV4Metric_(mathsV5Pool_(request||{}),getStateMap_()), attempted=Math.max(0,Number(m.attempted||0));
  return Object.assign({},m,{wrongPct:mathsPct_(m.wrong,attempted),difficultPct:mathsPct_(m.difficult,attempted),starredPct:mathsPct_(m.starred,attempted)});
}

function toggleConceptV6(questionId,sessionId){
  ensureMathsV3_(); const id=validQuestionId_(questionId), sh=ensureConceptsV4_(), rows=sheetObjects_(sh);
  const activeRows=rows.filter(r=>String(r.question_id||'').trim()===id&&(!Object.prototype.hasOwnProperty.call(r,'active')||bool_(r.active)));
  if(activeRows.length){ activeRows.forEach(r=>sh.getRange(r.__row,7).setValue(false)); return {ok:true,questionId:id,inConcept:false}; }
  const q=getAllQuestions_().concat(getGeneratedQuestions_()).find(x=>String(x.question_id)===id)||{};
  sh.appendRow([id,new Date(),mathsV3Day_(),q.chapter||'',q.topic||'',String(sessionId||''),true]);
  return {ok:true,questionId:id,inConcept:true};
}

function startMathsV6Quiz(request){
  ensureMathsV3_(); request=Object.assign({},request||{});
  const kind=String(request.kind||'random').toLowerCase();
  if(kind!=='all') return startMathsV5Quiz(request);
  const state=getStateMap_(); let pool=mathsV5Pool_(request).filter(q=>!isMastered_(state[String(q.question_id)]));
  pool=shuffle_(pool);
  if(!pool.length)return {ok:false,message:'No eligible practice all questions found for this selection.'};
  request.restart=true;
  return makeSessionV4_(pool,request,'Practice All');
}
