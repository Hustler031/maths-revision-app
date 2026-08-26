const MATHS_V4_CACHE_SECONDS=3600;
const MATHS_V4_CONCEPTS='Concepts';

function ensureConceptsV4_(){
  const ss=SpreadsheetApp.getActive();let sh=ss.getSheetByName(MATHS_V4_CONCEPTS);
  if(!sh){sh=ss.insertSheet(MATHS_V4_CONCEPTS);sh.getRange(1,1,1,7).setValues([['Question_ID','Added_At','Study_Day','Chapter','Topic','Session_ID','Active']]);sh.setFrozenRows(1);}
  return sh;
}
function conceptIdsV4_(){const out={};sheetObjects_(ensureConceptsV4_()).forEach(r=>{if(String(r.question_id||'').trim()&&(!Object.prototype.hasOwnProperty.call(r,'active')||bool_(r.active)))out[String(r.question_id).trim()]=true});return out;}
function saveConceptV4(questionId,sessionId){
  ensureMathsV3_();const q=mathsRequireQuestionContextV20_(questionId,sessionId),id=String(q.question_id),sh=ensureConceptsV4_(),rows=sheetObjects_(sh),existing=rows.find(r=>String(r.question_id||'').trim()===id&&(!Object.prototype.hasOwnProperty.call(r,'active')||bool_(r.active)));
  if(existing)return {ok:true,questionId:id,inConcept:true,alreadySaved:true};
  appendSheetObject_(sh,{question_id:id,added_at:new Date(),study_day:mathsV3Day_(),chapter:q.chapter||'',topic:q.topic||'',session_id:String(sessionId||''),active:true});return {ok:true,questionId:id,inConcept:true,alreadySaved:false};
}
function mathsV4Metric_(questions,state){
  const ids=(questions||[]).map(q=>String(q.question_id));let attempted=0,wrong=0,difficult=0,starred=0,weak=0;
  ids.forEach(id=>{const s=state[id]||{},a=Number(s.attempts||0),last=String(s.last_result||'').toLowerCase();if(a>0)attempted++;if(last==='wrong')wrong++;if(isDifficultV3_(s))difficult++;if(isMarked_(s))starred++;if(last==='wrong'||isMarked_(s)||a===0||isDifficultV3_(s)||Number(s.last_response_sec||0)>=20)weak++;});
  return {total:ids.length,attempted,unseen:Math.max(0,ids.length-attempted),coverage:ids.length?Math.round(attempted*1000/ids.length)/10:0,wrong,difficult,starred,weak};
}
function getMathsScopeMetricV4(request){ensureMathsV3_();return mathsV4Metric_(scopePoolMathsV3_(request||{}),getStateMap_());}
function getMathsNewHubV4(){
  ensureMathsV3_();const qs=standardStudyQuestions_(getAllQuestions_()).filter(active_),state=getStateMap_(),by={};
  qs.forEach(q=>{const c=String(q.chapter||'Other');(by[c]||(by[c]=[])).push(q)});
  const chapters=Object.keys(by).sort().map(chapter=>({chapter,metric:mathsV4Metric_(by[chapter],state)})).filter(x=>x.metric.unseen>0);
  return {generatedAt:new Date().toISOString(),overall:mathsV4Metric_(qs,state),chapters};
}
function getMathsProgressV4(){
  ensureMathsV3_();const all=standardStudyQuestions_(getAllQuestions_()).filter(active_),qs=all.filter(q=>normalizeLabel_(q.topic)!=='concepts'),state=getStateMap_(),by={};
  qs.forEach(q=>{const c=String(q.chapter||'Other');(by[c]||(by[c]=[])).push(q)});
  const chapters=Object.keys(by).sort().map(chapter=>({chapter,group:mathsV3Group_(chapter),metric:mathsV4Metric_(by[chapter],state)}));
  return {generatedAt:new Date().toISOString(),overall:mathsV4Metric_(qs,state),advanced:mathsV4Metric_(qs.filter(q=>mathsV3Group_(q.chapter)==='advanced'),state),arithmetic:mathsV4Metric_(qs.filter(q=>mathsV3Group_(q.chapter)==='arithmetic'),state),chapters};
}
function starredMembershipV4_(){
  const membership={},days={};sheetObjects_(ensureMathsV3_()).filter(r=>String(r.type||'').toUpperCase()==='IMPORTANT'&&String(r.action||'').toUpperCase()==='ON').forEach(r=>{const id=String(r.question_id||'').trim(),day=Math.max(1,Number(r.study_day||1));if(!id)return;membership[id]=true;(days[day]||(days[day]={}))[id]=true});return {membership,days};
}
function getStarredRevisionV4(){
  ensureMathsV3_();const state=getStateMap_(),x=starredMembershipV4_(),membership=x.membership,days=x.days,currentDay=mathsV3Day_();
  function statsFor(obj){const ids=Object.keys(obj||{}),mastered=ids.filter(id=>isMastered_(state[id])).length;return {starred:ids.length,mastered,focus:ids.length-mastered};}
  const dayRows=Object.keys(days).map(Number).sort((a,b)=>b-a).map(day=>({day,stats:statsFor(days[day])}));
  const blockStart=Math.floor((currentDay-1)/10)*10+1,recentDays=dayRows.filter(x=>x.day>=blockStart&&x.day<=currentDay),monthStart=Math.floor((currentDay-1)/30)*30+1,tenBlocks=[];
  for(let hi=blockStart-1;hi>=monthStart;hi-=10){const lo=Math.max(monthStart,hi-9),members={};dayRows.filter(d=>d.day>=lo&&d.day<=hi).forEach(d=>Object.keys(days[d.day]||{}).forEach(id=>members[id]=true));if(Object.keys(members).length)tenBlocks.push({lo,hi,stats:statsFor(members),days:dayRows.filter(d=>d.day>=lo&&d.day<=hi)});}
  const months=[];for(let hi=monthStart-1;hi>=1;hi-=30){const lo=Math.max(1,hi-29),members={};dayRows.filter(d=>d.day>=lo&&d.day<=hi).forEach(d=>Object.keys(days[d.day]||{}).forEach(id=>members[id]=true));if(Object.keys(members).length)months.push({lo,hi,label:'Month '+(Math.floor((lo-1)/30)+1),stats:statsFor(members)});}
  return {generatedAt:new Date().toISOString(),currentDay,stats:statsFor(membership),recentDays,tenBlocks,months};
}
function getStarredScopeIdsV4(lo,hi){const ids={};sheetObjects_(ensureMathsV3_()).filter(r=>String(r.type||'').toUpperCase()==='IMPORTANT'&&String(r.action||'').toUpperCase()==='ON'&&Number(r.study_day||0)>=Number(lo||1)&&Number(r.study_day||0)<=Number(hi||999999)).forEach(r=>{const id=String(r.question_id||'').trim();if(id)ids[id]=true});return Object.keys(ids);}
function getConceptsHubV4(){
  ensureMathsV3_();const ids=conceptIdsV4_(),state=getStateMap_(),all=standardStudyQuestions_(getAllQuestions_()).filter(active_),pool=all.filter(q=>ids[String(q.question_id)]),by={};pool.forEach(q=>{const c=String(q.chapter||'Other');(by[c]||(by[c]=[])).push(q)});
  return {generatedAt:new Date().toISOString(),metric:mathsV4Metric_(pool,state),chapters:Object.keys(by).sort().map(chapter=>({chapter,metric:mathsV4Metric_(by[chapter],state)}))};
}
function viewPoolV4_(request){
  request=request||{};const all=standardStudyQuestions_(getAllQuestions_()).filter(active_),map={};all.forEach(q=>map[String(q.question_id)]=q);let ids=[];
  if(String(request.scope||'')==='star_history')ids=getStarredScopeIdsV4(request.starLo||1,request.starHi||999999);
  else if(String(request.scope||'')==='concept_saved')ids=Object.keys(conceptIdsV4_());
  else ids=scopePoolMathsV3_(request).map(q=>String(q.question_id));
  return ids.map(id=>map[id]).filter(Boolean);
}
function getMathsViewItemsV4(request){
  const state=getStateMap_();return viewPoolV4_(request).map(q=>{const s=state[String(q.question_id)]||{};return {id:String(q.question_id),chapter:q.chapter||'',topic:q.topic||'',prompt:q.prompt||'',answer:q.answer||'',explanation:q.explanation||'',starred:isMarked_(s),difficult:isDifficultV3_(s),attempts:Number(s.attempts||0),wrong:String(s.last_result||'').toLowerCase()==='wrong'};});
}
function newestKeyV4_(q){const raw=q.added_at||q.created_at||q.date_added||q.timestamp||q.updated_at||'';const t=new Date(raw).getTime();return isFinite(t)&&t>0?t:0;}
function rankWeakV4_(pool,state){return (pool||[]).filter(q=>!isMastered_(state[q.question_id])).map(q=>{const s=state[q.question_id]||{},last=String(s.last_result||'').toLowerCase(),attempts=Number(s.attempts||0);return {q,score:(last==='wrong'?1000:0)+(isMarked_(s)?700:0)+(attempts===0?500:0)+(isDifficultV3_(s)?350:0)+(Number(s.last_response_sec||0)>=20?200:0)+Math.min(attempts,30)}}).sort((a,b)=>b.score-a.score).map(x=>x.q);}
function enhanceMathsV4Payload_(payload){const concepts=conceptIdsV4_();payload=enhanceV3Payload_(payload,getStateMap_());if(payload&&Array.isArray(payload.questions))payload.questions.forEach(q=>q.inConcept=!!concepts[String(q.questionId)]);return payload;}
function makeSessionV4_(pool,request,label){
  const state=getStateMap_(),base=String(request.title||request.chapter||request.groupName||'Maths'),title=base+' · '+label,sessionId=Utilities.getUuid(),mode='v4_'+String(request.kind||'practice'),payload=enhanceMathsV4Payload_(sessionPayload_(sessionId,pool,state,title,mode,0,null));
  saveSession_({session_id:sessionId,mode,title,question_ids_json:JSON.stringify(pool.map(q=>q.question_id)),current_index:0,updated_at:new Date(),completed:false,params_json:JSON.stringify(request),rendered_questions_json:JSON.stringify(payload.questions||[])});return payload;
}
function startMathsV4Quiz(request){
  return startMathsPracticeV14(request||{});
}
