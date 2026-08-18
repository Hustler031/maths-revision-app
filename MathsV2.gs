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
  const id=validQuestionId_(questionId),cur=getStateMap_()[id]||{},next=!isMarked_(cur),st=upsertState_(id,{marked:next});
  logMathsV2Flag_(id,'IMPORTANT',next,sessionId);
  return {ok:true,questionId:id,important:!!st.marked,difficult:isDifficultV2_(mathsV2StateMap_()[id])};
}

function toggleDifficultV2(questionId,sessionId){
  const id=validQuestionId_(questionId);ensureMathsV2_();const sh=getSheet_(MATHS.SHEETS.STATE),headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(key_),col=headers.indexOf('difficult')+1;
  let rows=sheetObjects_(sh).filter(r=>String(r.question_id||'').trim()===id),current=rows.some(r=>isDifficultV2_(r)),next=!current;
  if(!rows.length){upsertState_(id,{});rows=sheetObjects_(sh).filter(r=>String(r.question_id||'').trim()===id);}
  rows.forEach(r=>sh.getRange(r.__row,col).setValue(next));
  logMathsV2Flag_(id,'DIFFICULT',next,sessionId);
  return {ok:true,questionId:id,important:isMarked_(getStateMap_()[id]),difficult:next};
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

function startMathsV2Quiz(request){
  ensureMathsV2_();request=request||{};const state=getStateMap_(),kind=String(request.kind||'random').toLowerCase(),count=Math.max(1,Math.min(100,Number(request.count||20)));let pool=scopePoolMathsV2_(request),label='Practice';
  if(kind==='new'){pool=pool.filter(q=>Number((state[q.question_id]||{}).attempts||0)===0);label='New';}
  else if(kind==='starred'||kind==='important'){pool=pool.filter(q=>isMarked_(state[q.question_id]));label='Starred';}
  else if(kind==='difficult'){pool=pool.filter(q=>isDifficultV2_(state[q.question_id]));label='Difficult';}
  else if(kind==='weak'){
    pool=pool.filter(q=>!isMastered_(state[q.question_id]));
    pool=pool.map(q=>{const s=state[q.question_id]||{},wrong=String(s.last_result||'').toLowerCase()==='wrong',slow=Number(s.last_response_sec||0)>=20,diff=isDifficultV2_(s),attempts=Number(s.attempts||0);return {q,score:(diff?50:0)+(wrong?30:0)+(slow?12:0)+Math.min(attempts,6)+(attempts===0?2:0)}}).sort((a,b)=>b.score-a.score).map(x=>x.q);label='Weak';
  }
  else if(kind==='all'){label='Practice All';}
  else {pool=pool.filter(q=>!isMastered_(state[q.question_id]));pool=shuffle_(pool);label='Random';}
  if(kind!=='all'&&kind!=='weak')pool=shuffle_(pool);
  if(kind!=='all')pool=pool.slice(0,Math.min(count,pool.length));
  if(!pool.length)return {ok:false,message:'No eligible '+label.toLowerCase()+' questions found for this selection.'};
  const titleBase=String(request.title||request.majorTopic||request.chapter||request.groupName||'Maths'),title=titleBase+' · '+label,sessionId=Utilities.getUuid(),mode='v2_'+kind,payload=sessionPayload_(sessionId,pool,state,title,mode,0,null);
  payload.questions.forEach(x=>{const s=state[x.questionId]||{};x.difficult=isDifficultV2_(s);x.important=isMarked_(s);});
  saveSession_({session_id:sessionId,mode,title,question_ids_json:JSON.stringify(pool.map(q=>q.question_id)),current_index:0,updated_at:new Date(),completed:false,params_json:JSON.stringify(request)});
  return payload;
}

function getSessionAttemptMapV2(sessionId){
  const out={};sheetObjects_(getSheet_(MATHS.SHEETS.ATTEMPTS)).filter(r=>String(r.session_id||'')===String(sessionId||'')).forEach(r=>{const id=String(r.question_id||'');if(!id)return;const v=String(r.result||'').toLowerCase();out[id]=v==='correct'?'correct':v==='wrong'?'wrong':'seen';});return out;
}

function mathsProgressMetricV2_(questions,state){
  const ids=questions.map(q=>q.question_id),total=ids.length;let attempted=0,correct=0,difficult=0,starred=0,weak=0;
  ids.forEach(id=>{const s=state[id]||{},a=Number(s.attempts||0);if(a>0)attempted++;if(String(s.last_result||'').toLowerCase()==='correct')correct++;if(isDifficultV2_(s))difficult++;if(isMarked_(s))starred++;if(isDifficultV2_(s)||String(s.last_result||'').toLowerCase()==='wrong'||Number(s.last_response_sec||0)>=20)weak++;});
  return {total,attempted,unseen:Math.max(0,total-attempted),coverage:total?Math.round(attempted*1000/total)/10:0,accuracy:attempted?Math.round(correct*1000/attempted)/10:0,difficult,starred,weak};
}

function getMathsProgressV2(){
  ensureMathsV2_();const qs=standardStudyQuestions_(getAllQuestions_()).filter(active_),state=getStateMap_(),byChapter={};qs.forEach(q=>{const c=String(q.chapter||'Other');(byChapter[c]||(byChapter[c]=[])).push(q)});
  const chapters=Object.keys(byChapter).sort().map(c=>({chapter:c,metric:mathsProgressMetricV2_(byChapter[c],state),concepts:mathsProgressMetricV2_(byChapter[c].filter(q=>normalizeLabel_(q.topic)==='concepts'),state),questions:mathsProgressMetricV2_(byChapter[c].filter(q=>normalizeLabel_(q.topic)==='questions'),state)}));
  const advanced=qs.filter(q=>!/percentage|profit|loss|discount|ratio|proportion|average|mixture|alligation|interest|time.*work|pipe|cistern|speed|distance|train|boat|stream|partnership|ages|work.*wage/i.test(String(q.chapter||''))),arithmetic=qs.filter(q=>!advanced.includes(q));
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
