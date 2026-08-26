const MATHS_V3_STAR_LOG='Starred_Revision_Log';

function ensureMathsV3_(){
  ensureMathsInfrastructure_();
  const state=getSheet_(MATHS.SHEETS.STATE);
  const headers=state.getRange(1,1,1,Math.max(1,state.getLastColumn())).getValues()[0].map(String);
  if(!headers.some(h=>key_(h)==='difficult')) state.getRange(1,state.getLastColumn()+1).setValue('Difficult');
  const ss=SpreadsheetApp.getActive();
  let log=ss.getSheetByName(MATHS_V3_STAR_LOG);
  if(!log){log=ss.insertSheet(MATHS_V3_STAR_LOG);log.getRange(1,1,1,7).setValues([['Question_ID','Event_At','Study_Day','Chapter','Type','Action','Session_ID']]);log.setFrozenRows(1);}
  return log;
}
function isDifficultV3_(s){return !!(s&&bool_(s.difficult));}
function mathsV3Day_(){try{const x=getScheduledPlan_();if(x&&Number(x.day)>0)return Number(x.day)}catch(e){}return Math.max(1,Number(getSetting_('current_day',1)||1));}
function logMathsV3Flag_(id,type,on,sessionId){const q=getAllQuestions_().concat(getGeneratedQuestions_()).find(x=>String(x.question_id)===String(id))||{};ensureMathsV3_().appendRow([String(id),new Date(),mathsV3Day_(),q.chapter||'',String(type),on?'ON':'OFF',String(sessionId||'')]);}

function toggleImportantV3(questionId,sessionId){return toggleStarredV9(questionId,sessionId);}
function toggleDifficultV3(questionId,sessionId){
  return toggleDifficultV9(questionId,sessionId);
}

function mathsV3Group_(chapter){const x=String(chapter||'').toLowerCase();if(/fraction pattern|triplet|calculation memory|square|cube/.test(x))return'misc';if(/percentage|profit|loss|discount|ratio|proportion|average|mixture|alligation|interest|time.*work|pipe|cistern|speed|distance|train|boat|stream|partnership|ages|work.*wage/.test(x))return'arithmetic';return'advanced';}
function demandPoolV3_(setId){const set=getDemandSetById_(String(setId||''));if(!set)return[];const ids=json_(set.question_ids_json,[]).map(String),map={};getAllQuestions_().concat(getGeneratedQuestions_()).forEach(q=>map[String(q.question_id)]=q);return ids.map(id=>map[id]).filter(q=>q&&active_(q));}
function scopePoolMathsV3_(request){
  request=request||{};const scope=String(request.scope||'all').toLowerCase(),chapter=String(request.chapter||''),topic=String(request.majorTopic||request.majorTopicKey||''),chapters=(request.chapters||[]).map(String);
  let all=scope==='demand_set'?demandPoolV3_(request.setId):standardStudyQuestions_(getAllQuestions_()).filter(active_);
  return all.filter(q=>{
    if(scope==='chapter'&&chapter&&!chapterMatchesPlan_(q.chapter,chapter))return false;
    if(scope==='topic'){
      if(chapter&&!chapterMatchesPlan_(q.chapter,chapter))return false;
      const key=typeof majorTopicForQuestion_==='function'?majorTopicForQuestion_(q):String(q.topic||'');
      if(topic&&normalizeLabel_(key)!==normalizeLabel_(topic)&&normalizeLabel_(q.topic)!==normalizeLabel_(topic))return false;
    }
    if(scope==='group'&&chapters.length&&!chapters.some(c=>chapterMatchesPlan_(q.chapter,c)))return false;
    return true;
  });
}
function sameV3Scope_(a,b){a=a||{};b=b||{};const arr=x=>(x||[]).map(String).sort().join('|');return String(a.scope||'')===String(b.scope||'')&&String(a.chapter||'')===String(b.chapter||'')&&String(a.majorTopic||a.majorTopicKey||'')===String(b.majorTopic||b.majorTopicKey||'')&&String(a.setId||'')===String(b.setId||'')&&arr(a.chapters)===arr(b.chapters)&&String(a.groupName||'')===String(b.groupName||'');}
function enhanceV3Payload_(payload,state){if(payload&&Array.isArray(payload.questions))payload.questions.forEach(x=>{const s=state[x.questionId]||{};x.difficult=isDifficultV3_(s);x.important=isMarked_(s);});return payload;}
function findV3AllSession_(request){return sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>String(r.mode||'')==='v3_all'&&!bool_(r.completed)).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).find(r=>sameV3Scope_(json_(r.params_json,{}),request))||null;}
function getMathsV3ResumeInfo(request){ensureMathsV3_();const s=findV3AllSession_(request||{});if(!s)return {hasProgress:false};const ids=json_(s.question_ids_json,[]);return {hasProgress:true,sessionId:String(s.session_id),title:String(s.title||'Practice All'),currentIndex:Number(s.current_index||0),resumeQuestion:Math.min(ids.length,Number(s.current_index||0)+1),total:ids.length};}
function resumeMathsV3Session(sessionId){ensureMathsV3_();return enhanceV3Payload_(resumeSession(String(sessionId||'')),getStateMap_());}

function startMathsV3Quiz(request){
  return startMathsPracticeV14(request||{});
}

function getSessionAttemptMapV3(sessionId){const ctx=mathsRequireSessionV20_(sessionId),out={};mathsSessionAttemptsV20_(ctx.id).forEach(r=>{const id=String(r.question_id||'');if(!id)return;const v=normalizeLabel_(r.result||'seen');out[id]={result:v==='correct'?'correct':v==='wrong'?'wrong':'seen',selectedOption:String(r.selected_option||''),questionIndex:Number(r.question_index||0),saved:true};});return out;}
function mathsProgressMetricV3_(questions,state){const ids=questions.map(q=>q.question_id),total=ids.length;let attempted=0,correct=0,difficult=0,starred=0,weak=0;ids.forEach(id=>{const s=state[id]||{},a=Number(s.attempts||0);if(a>0)attempted++;if(String(s.last_result||'').toLowerCase()==='correct')correct++;if(isDifficultV3_(s))difficult++;if(isMarked_(s))starred++;if(isDifficultV3_(s)||String(s.last_result||'').toLowerCase()==='wrong'||Number(s.last_response_sec||0)>=20)weak++;});return {total,attempted,unseen:Math.max(0,total-attempted),coverage:total?Math.round(attempted*1000/total)/10:0,accuracy:attempted?Math.round(correct*1000/attempted)/10:0,difficult,starred,weak};}
function getMathsProgressV3(){ensureMathsV3_();const qs=standardStudyQuestions_(getAllQuestions_()).filter(active_),state=getStateMap_(),byChapter={};qs.forEach(q=>{const c=String(q.chapter||'Other');(byChapter[c]||(byChapter[c]=[])).push(q)});const chapters=Object.keys(byChapter).sort().map(c=>({chapter:c,group:mathsV3Group_(c),metric:mathsProgressMetricV3_(byChapter[c],state),concepts:mathsProgressMetricV3_(byChapter[c].filter(q=>normalizeLabel_(q.topic)==='concepts'),state),questions:mathsProgressMetricV3_(byChapter[c].filter(q=>normalizeLabel_(q.topic)==='questions'),state)}));const advanced=qs.filter(q=>mathsV3Group_(q.chapter)==='advanced'),arithmetic=qs.filter(q=>mathsV3Group_(q.chapter)==='arithmetic');return {generatedAt:new Date().toISOString(),overall:mathsProgressMetricV3_(qs,state),advanced:mathsProgressMetricV3_(advanced,state),arithmetic:mathsProgressMetricV3_(arithmetic,state),chapters};}
function getMathsV3Bootstrap(){ensureMathsV3_();const qs=standardStudyQuestions_(getAllQuestions_()).filter(active_),state=getStateMap_(),metric=mathsProgressMetricV3_(qs,state);let schedule=null;try{schedule=getScheduledPlan_()}catch(e){}return {generatedAt:new Date().toISOString(),dailyTarget:20,schedule:schedule||null,newCount:metric.unseen,starred:metric.starred,difficult:metric.difficult,coverage:metric.coverage,accuracy:metric.accuracy,weak:metric.weak,chapters:qs.map(q=>String(q.chapter||'')).filter((v,i,a)=>v&&a.indexOf(v)===i)};}
function getStarredRevisionV3(){ensureMathsV3_();const state=getStateMap_(),qmap={};standardStudyQuestions_(getAllQuestions_()).filter(active_).forEach(q=>qmap[q.question_id]=q);const items=[];Object.keys(qmap).forEach(id=>{const s=state[id]||{},important=isMarked_(s),difficult=isDifficultV3_(s);if(!important&&!difficult)return;items.push({id,chapter:qmap[id].chapter||'',topic:qmap[id].topic||'',question:qmap[id].prompt||'',important,difficult,weak:String(s.last_result||'').toLowerCase()==='wrong'||Number(s.last_response_sec||0)>=20,lastAttempt:s.last_attempt_at||''});});return {stats:{total:items.length,important:items.filter(x=>x.important).length,difficult:items.filter(x=>x.difficult).length},items};}
