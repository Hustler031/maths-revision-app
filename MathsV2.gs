const MATHS_V2_STAR_LOG='Starred_Revision_Log';

function ensureMathsV2_(){
  ensureMathsInfrastructure_();
  const state=getSheet_(MATHS.SHEETS.STATE);
  const headers=state.getRange(1,1,1,Math.max(1,state.getLastColumn())).getValues()[0].map(String);
  if(!headers.includes('Difficult')) state.getRange(1,state.getLastColumn()+1).setValue('Difficult');
  const ss=SpreadsheetApp.getActive();
  let log=ss.getSheetByName(MATHS_V2_STAR_LOG);
  if(!log){log=ss.insertSheet(MATHS_V2_STAR_LOG);log.getRange(1,1,1,7).setValues([['Question_ID','Event_At','Study_Day','Chapter','Type','Action','Session_ID']]);log.setFrozenRows(1);}
  return log;
}

function mathsV2StateMap_(){ensureMathsV2_();return getStateMap_();}
function isDifficultV2_(s){return !!(s&&bool_(s.difficult));}
function mathsV2Day_(){try{const x=getScheduledPlan_();if(x&&Number(x.day)>0)return Number(x.day)}catch(e){}return Math.max(1,Number(getSetting_('current_day',1)||1));}
function logMathsV2Flag_(id,type,on,sessionId){const q=getAllQuestions_().concat(getGeneratedQuestions_()).find(x=>String(x.question_id)===String(id))||{};ensureMathsV2_().appendRow([String(id),new Date(),mathsV2Day_(),q.chapter||'',String(type),on?'ON':'OFF',String(sessionId||'')]);}

function toggleImportantV2(questionId,sessionId){
  return toggleStarredV9(questionId,sessionId);
}

function toggleDifficultV2(questionId,sessionId){
  return toggleDifficultV9(questionId,sessionId);
}

function scopePoolMathsV2_(request){
  request=request||{};const all=standardStudyQuestions_(getAllQuestions_()).filter(active_),scope=String(request.scope||'chapter').toLowerCase(),chapter=String(request.chapter||''),topic=String(request.majorTopic||request.majorTopicKey||''),chapters=(request.chapters||[]).map(String);
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

function sameV2Scope_(a,b){
  a=a||{};b=b||{};
  const arr=x=>(x||[]).map(String).sort().join('|');
  return String(a.scope||'')===String(b.scope||'')&&String(a.chapter||'')===String(b.chapter||'')&&String(a.majorTopic||a.majorTopicKey||'')===String(b.majorTopic||b.majorTopicKey||'')&&arr(a.chapters)===arr(b.chapters)&&String(a.groupName||'')===String(b.groupName||'');
}
function enhanceV2Payload_(payload,state){if(payload&&Array.isArray(payload.questions))payload.questions.forEach(x=>{const s=state[x.questionId]||{};x.difficult=isDifficultV2_(s);x.important=isMarked_(s);});return payload;}
function resumeV2All_(request,state){
  const rows=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>String(r.mode||'')==='v2_all'&&!bool_(r.completed)).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
  const found=rows.find(r=>sameV2Scope_(json_(r.params_json,{}),request));if(!found)return null;
  return enhanceV2Payload_(resumeSession(String(found.session_id)),state);
}

function startMathsV2Quiz(request){
  return startMathsPracticeV14(request||{});
}

function getSessionAttemptMapV2(sessionId){
  return getSessionAttemptMapV3(sessionId);
}

function mathsProgressMetricV2_(questions,state){
  const ids=questions.map(q=>q.question_id),total=ids.length;let attempted=0,correct=0,difficult=0,starred=0,weak=0;
  ids.forEach(id=>{const s=state[id]||{},a=Number(s.attempts||0);if(a>0)attempted++;if(String(s.last_result||'').toLowerCase()==='correct')correct++;if(isDifficultV2_(s))difficult++;if(isMarked_(s))starred++;if(isDifficultV2_(s)||String(s.last_result||'').toLowerCase()==='wrong'||Number(s.last_response_sec||0)>=20)weak++;});
  return {total,attempted,unseen:Math.max(0,total-attempted),coverage:total?Math.round(attempted*1000/total)/10:0,accuracy:attempted?Math.round(correct*1000/attempted)/10:0,difficult,starred,weak};
}
function mathsV2Group_(chapter){const x=String(chapter||'').toLowerCase();if(/fraction pattern|triplet|calculation memory|square|cube/.test(x))return'misc';if(/percentage|profit|loss|discount|ratio|proportion|average|mixture|alligation|interest|time.*work|pipe|cistern|speed|distance|train|boat|stream|partnership|ages|work.*wage/.test(x))return'arithmetic';return'advanced';}

function getMathsProgressV2(){
  ensureMathsV2_();const qs=standardStudyQuestions_(getAllQuestions_()).filter(active_),state=getStateMap_(),byChapter={};qs.forEach(q=>{const c=String(q.chapter||'Other');(byChapter[c]||(byChapter[c]=[])).push(q)});
  const chapters=Object.keys(byChapter).sort().map(c=>({chapter:c,metric:mathsProgressMetricV2_(byChapter[c],state),concepts:mathsProgressMetricV2_(byChapter[c].filter(q=>normalizeLabel_(q.topic)==='concepts'),state),questions:mathsProgressMetricV2_(byChapter[c].filter(q=>normalizeLabel_(q.topic)==='questions'),state)}));
  const advanced=qs.filter(q=>mathsV2Group_(q.chapter)==='advanced'),arithmetic=qs.filter(q=>mathsV2Group_(q.chapter)==='arithmetic');
  return {generatedAt:new Date().toISOString(),overall:mathsProgressMetricV2_(qs,state),advanced:mathsProgressMetricV2_(advanced,state),arithmetic:mathsProgressMetricV2_(arithmetic,state),chapters};
}

function getMathsV2Bootstrap(){
  ensureMathsV2_();const qs=standardStudyQuestions_(getAllQuestions_()).filter(active_),state=getStateMap_(),metric=mathsProgressMetricV2_(qs,state),newCount=qs.filter(q=>Number((state[q.question_id]||{}).attempts||0)===0).length;
  let schedule=null;try{schedule=getScheduledPlan_()}catch(e){}
  return {generatedAt:new Date().toISOString(),dailyTarget:20,schedule:schedule||null,newCount,starred:metric.starred,difficult:metric.difficult,coverage:metric.coverage,accuracy:metric.accuracy,weak:metric.weak};
}

function getStarredRevisionV2(){
  ensureMathsV2_();const state=getStateMap_(),qmap={};standardStudyQuestions_(getAllQuestions_()).filter(active_).forEach(q=>qmap[q.question_id]=q);const latest={};
  const log=getSheet_(MATHS_V2_STAR_LOG);if(log.getLastRow()>1)sheetObjects_(log).forEach(r=>{const id=String(r.question_id||''),type=String(r.type||'').toUpperCase(),t=new Date(r.event_at||0).getTime();if(!id||!type)return;const k=id+'|'+type;if(!latest[k]||t>=latest[k].t)latest[k]={t,day:Number(r.study_day||1),action:String(r.action||'ON').toUpperCase()};});
  const items=[];Object.keys(qmap).forEach(id=>{const s=state[id]||{},important=isMarked_(s),difficult=isDifficultV2_(s);if(!important&&!difficult)return;const evI=latest[id+'|IMPORTANT'],evD=latest[id+'|DIFFICULT'],day=Math.max(evI&&evI.day||0,evD&&evD.day||0,1);items.push({id,chapter:qmap[id].chapter||'',topic:qmap[id].topic||'',question:qmap[id].prompt||'',important,difficult,day,weak:String(s.last_result||'').toLowerCase()==='wrong'||Number(s.last_response_sec||0)>=20});});
  const current=mathsV2Day_(),groups=[];for(let d=current;d>=Math.max(1,current-9);d--){const part=items.filter(x=>x.day===d);if(part.length)groups.push({label:'Day '+d,fromDay:d,toDay:d,count:part.length,important:part.filter(x=>x.important).length,difficult:part.filter(x=>x.difficult).length});}
  return {currentDay:current,stats:{total:items.length,important:items.filter(x=>x.important).length,difficult:items.filter(x=>x.difficult).length},groups,items:items.sort((a,b)=>b.day-a.day)};
}

// Deployment trigger marker: Maths V2 rollout.
