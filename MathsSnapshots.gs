const MATHS_SNAPSHOT_TTL_SEC = 3600;
const MATHS_HUB_CACHE_SEC = 300;

function mathsSnapshotCache_(){ return CacheService.getScriptCache(); }
function mathsSnapshotKey_(name){ return 'maths:snapshot:v8:'+String(name||'default'); }
function mathsPct_(n,d){ return d ? Math.round(Number(n||0)*1000/Number(d))/10 : 0; }

/*
 * Lightweight data version used to keep a one-hour server snapshot fast while
 * still detecting question/state changes immediately on the next background
 * refresh. Only structural/performance columns are hashed; quiz questions are
 * always loaded from the authoritative sheets when a session is created.
 */
function mathsVersionRowsV8_(sheet, wanted){
  if(!sheet)return [];
  const lr=sheet.getLastRow(), lc=sheet.getLastColumn();
  if(lr<2||lc<1)return [[lr,lc]];
  const headers=sheet.getRange(1,1,1,lc).getDisplayValues()[0].map(h=>normalizeLabel_(h));
  const indexes=(wanted||[]).map(h=>headers.indexOf(normalizeLabel_(h))).filter(i=>i>=0);
  if(!indexes.length)return [[lr,lc]];
  const rows=sheet.getRange(2,1,lr-1,lc).getDisplayValues();
  return rows.map(r=>indexes.map(i=>r[i]));
}
function mathsBankVersionV8_(){
  ensureMathsV3_();
  const parts=[];
  const q=getSheet_(MATHS.SHEETS.QUESTIONS);
  const s=getSheet_(MATHS.SHEETS.STATE);
  const g=getSheet_(MATHS.SHEETS.GENERATED);
  const d=getSheet_(MATHS.SHEETS.DEMAND_SETS);
  const c=ensureConceptsV4_();
  parts.push(mathsVersionRowsV8_(q,['question_id','chapter','topic','subtopic','card_type','active','created_at','date_added']));
  parts.push(mathsVersionRowsV8_(s,['question_id','attempts','last_result','marked','important','difficult','mastered']));
  parts.push(mathsVersionRowsV8_(g,['question_id','chapter','topic','subtopic','active','created_at','date_added']));
  parts.push(mathsVersionRowsV8_(d,['set_id','question_ids_json','status']));
  parts.push(mathsVersionRowsV8_(c,['question_id','added_at','study_day','chapter','topic','session_id','active']));
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,JSON.stringify(parts));
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'').slice(0,18);
}
function getMathsCacheVersionV8(){ return {version:mathsBankVersionV8_(),generatedAt:new Date().toISOString()}; }

function buildMathsSnapshotV6_(version){
  ensureMathsV3_();
  const all=standardStudyQuestions_(getAllQuestions_()).filter(active_).filter(q=>normalizeLabel_(q.topic)!=='concepts');
  const state=getStateMap_(), by={};
  all.forEach(q=>{ const c=String(q.chapter||'Other'); (by[c]||(by[c]=[])).push(q); });
  function metric(pool){
    const m=mathsV4Metric_(pool,state), attempted=Math.max(0,Number(m.attempted||0));
    return Object.assign({},m,{wrongPct:mathsPct_(m.wrong,attempted),difficultPct:mathsPct_(m.difficult,attempted),starredPct:mathsPct_(m.starred,attempted)});
  }
  const chapters=Object.keys(by).sort().map(chapter=>({chapter,group:mathsV3Group_(chapter),metric:metric(by[chapter])}));
  return {version:version||mathsBankVersionV8_(),generatedAt:new Date().toISOString(),overall:metric(all),advanced:metric(all.filter(q=>mathsV3Group_(q.chapter)==='advanced')),arithmetic:metric(all.filter(q=>mathsV3Group_(q.chapter)==='arithmetic')),misc:metric(all.filter(q=>mathsV3Group_(q.chapter)==='misc')),chapters};
}

function getMathsSnapshotV8(force){
  const cache=mathsSnapshotCache_(), version=mathsBankVersionV8_(), key=mathsSnapshotKey_('progress:'+version);
  if(!force){ const raw=cache.get(key); if(raw){ try{return JSON.parse(raw);}catch(e){} } }
  const snap=buildMathsSnapshotV6_(version);
  try{ cache.put(key,JSON.stringify(snap),MATHS_SNAPSHOT_TTL_SEC); }catch(e){}
  return snap;
}
/* Backward-compatible endpoint now gets the version-aware snapshot. */
function getMathsSnapshotV6(force){ return getMathsSnapshotV8(!!force); }

function getMathsNewHubV8(){const snap=getMathsSnapshotV8(false);return {version:snap.version,generatedAt:snap.generatedAt,overall:snap.overall,chapters:(snap.chapters||[]).filter(x=>Number(x.metric&&x.metric.unseen||0)>0)};}
function getMathsNewHubV6(){return getMathsNewHubV8();}

function cachedHubV8_(name,builder,ttl,version){
  const c=mathsSnapshotCache_(),v=version||mathsBankVersionV8_(),k=mathsSnapshotKey_(name+':'+v),raw=c.get(k);
  if(raw){try{return JSON.parse(raw)}catch(e){}}
  const value=builder(); const out=(value&&typeof value==='object')?Object.assign({version:v},value):value;
  try{c.put(k,JSON.stringify(out),ttl||MATHS_HUB_CACHE_SEC)}catch(e){}
  return out;
}
function getStarredRevisionV6(){const v=mathsBankVersionV8_();return cachedHubV8_('starred',()=>getStarredRevisionV4(),MATHS_HUB_CACHE_SEC,v);}
function getConceptsHubV6(){const v=mathsBankVersionV8_();return cachedHubV8_('concepts',()=>getConceptsHubV4(),MATHS_HUB_CACHE_SEC,v);}

function getMathsHomeV8(){
  ensureMathsV3_();
  const snap=getMathsSnapshotV8(false), schedule=getScheduledPlan_(), dash=getDashboard_();
  const target=Math.max(1,Number((getPlanEntry_(schedule.day)||{}).targetPerDay||getSetting_('daily_chapter_size',20)||20));
  const sessions=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>normalizeLabel_(r.mode)==='daily').sort((a,b)=>dateMs_(b.updated_at)-dateMs_(a.updated_at));
  let dailySession=null;
  for(const row of sessions){
    const p=json_(row.params_json,{});
    if(Number(p.planDay||0)===Number(schedule.day||0)){dailySession=row;break;}
  }
  let done=0;
  if(dailySession){
    done=bool_(dailySession.completed)?target:Math.max(0,Math.min(target,Number(dailySession.current_index||0)));
  }
  const resume=getSafeResumeSession_(), concepts=getConceptsHubV6(), conceptCount=Number(concepts&&concepts.metric&&concepts.metric.total||0);
  return {
    version:snap.version,generatedAt:new Date().toISOString(),schedule:schedule,
    daily:{target:target,done:done,left:Math.max(0,target-done),completed:done>=target,sessionId:dailySession?String(dailySession.session_id||''):''},
    resume:resume,resumeIsDaily:!!(resume&&dailySession&&String(resume.sessionId)===String(dailySession.session_id)),
    newCount:Number(snap.overall&&snap.overall.unseen||0),starred:Number(snap.overall&&snap.overall.starred||0),difficult:Number(snap.overall&&snap.overall.difficult||0),concepts:conceptCount,
    pending:(dash.pending||[]).slice(0,2),overall:snap.overall
  };
}

function invalidateMathsSnapshotsV6(){
  /* Versioned keys expire naturally; remove legacy keys so old clients do not keep them. */
  const c=mathsSnapshotCache_();['progress','starred','concepts'].forEach(k=>{try{c.remove('maths:snapshot:v6:'+k);c.remove(mathsSnapshotKey_(k))}catch(e){}});return true;
}
function getMathsScopeMetricV6(request){ensureMathsV3_();const m=mathsV4Metric_(mathsV5Pool_(request||{}),getStateMap_()),attempted=Math.max(0,Number(m.attempted||0));return Object.assign({version:mathsBankVersionV8_()},m,{wrongPct:mathsPct_(m.wrong,attempted),difficultPct:mathsPct_(m.difficult,attempted),starredPct:mathsPct_(m.starred,attempted)});}

function toggleConceptV6(questionId,sessionId){
  ensureMathsV3_(); const id=validQuestionId_(questionId), sh=ensureConceptsV4_(), rows=sheetObjects_(sh);
  const activeRows=rows.filter(r=>String(r.question_id||'').trim()===id&&(!Object.prototype.hasOwnProperty.call(r,'active')||bool_(r.active)));
  let result;
  if(activeRows.length){activeRows.forEach(r=>sh.getRange(r.__row,7).setValue(false));result={ok:true,questionId:id,inConcept:false};}
  else{const q=getAllQuestions_().concat(getGeneratedQuestions_()).find(x=>String(x.question_id)===id)||{};sh.appendRow([id,new Date(),mathsV3Day_(),q.chapter||'',q.topic||'',String(sessionId||''),true]);result={ok:true,questionId:id,inConcept:true};}
  invalidateMathsSnapshotsV6(); return result;
}
function toggleStarredV6(questionId,sessionId){const r=toggleImportantV3(questionId,sessionId);invalidateMathsSnapshotsV6();return r;}
function toggleDifficultV6(questionId,sessionId){const r=toggleDifficultV3(questionId,sessionId);invalidateMathsSnapshotsV6();return r;}

function startMathsV6Quiz(request){
  ensureMathsV3_();request=Object.assign({},request||{});const kind=String(request.kind||'random').toLowerCase();
  if(kind!=='all')return startMathsV5Quiz(request);
  /* Practice All always starts a fresh, reshuffled authoritative session. */
  let pool=mathsV5Pool_(request);pool=shuffle_(pool);
  if(!pool.length)return {ok:false,message:'No eligible practice all questions found for this selection.'};
  request.restart=true;return makeSessionV4_(pool,request,'Practice All');
}
