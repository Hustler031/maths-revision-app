const MATHS_V4_CACHE_SECONDS=3600;
function mathsV4Metric_(questions,state){
  const ids=(questions||[]).map(q=>String(q.question_id));let attempted=0,wrong=0,difficult=0,starred=0,weak=0;
  ids.forEach(id=>{const s=state[id]||{},a=Number(s.attempts||0),last=String(s.last_result||'').toLowerCase();if(a>0)attempted++;if(last==='wrong')wrong++;if(isDifficultV3_(s))difficult++;if(isMarked_(s))starred++;if(last==='wrong'||isDifficultV3_(s)||Number(s.last_response_sec||0)>=20)weak++;});
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
  ensureMathsV3_();const qs=standardStudyQuestions_(getAllQuestions_()).filter(active_),state=getStateMap_(),by={};qs.forEach(q=>{const c=String(q.chapter||'Other');(by[c]||(by[c]=[])).push(q)});
  const chapters=Object.keys(by).sort().map(chapter=>({chapter,group:mathsV3Group_(chapter),metric:mathsV4Metric_(by[chapter],state),questions:mathsV4Metric_(by[chapter].filter(q=>normalizeLabel_(q.topic)==='questions'),state),concepts:mathsV4Metric_(by[chapter].filter(q=>normalizeLabel_(q.topic)==='concepts'),state)}));
  return {generatedAt:new Date().toISOString(),overall:mathsV4Metric_(qs,state),advanced:mathsV4Metric_(qs.filter(q=>mathsV3Group_(q.chapter)==='advanced'),state),arithmetic:mathsV4Metric_(qs.filter(q=>mathsV3Group_(q.chapter)==='arithmetic'),state),chapters};
}
function getStarredRevisionV4(){
  ensureMathsV3_();const state=getStateMap_(),log=sheetObjects_(ensureMathsV3_()),membership={},days={};
  log.filter(r=>String(r.type||'').toUpperCase()==='IMPORTANT'&&String(r.action||'').toUpperCase()==='ON').forEach(r=>{const id=String(r.question_id||'').trim(),day=Math.max(1,Number(r.study_day||1));if(!id)return;membership[id]=true;(days[day]||(days[day]={}))[id]=true;});
  function statsFor(obj){const x=Object.keys(obj||{}),mastered=x.filter(id=>isMastered_(state[id])).length;return {starred:x.length,mastered,focus:x.length-mastered};}
  const currentDay=mathsV3Day_(),dayRows=Object.keys(days).map(Number).sort((a,b)=>b-a).map(day=>({day,stats:statsFor(days[day])})),blocks=[];
  for(let hi=Math.floor((currentDay-1)/10)*10+10;hi>=1;hi-=10){const lo=Math.max(1,hi-9),members={};dayRows.filter(x=>x.day>=lo&&x.day<=hi).forEach(x=>Object.keys(days[x.day]||{}).forEach(id=>members[id]=true));if(Object.keys(members).length)blocks.push({lo,hi,stats:statsFor(members),days:dayRows.filter(x=>x.day>=lo&&x.day<=hi)});}
  return {generatedAt:new Date().toISOString(),currentDay,stats:statsFor(membership),blocks};
}
function getStarredScopeIdsV4(lo,hi){ensureMathsV3_();const ids={};sheetObjects_(ensureMathsV3_()).filter(r=>String(r.type||'').toUpperCase()==='IMPORTANT'&&String(r.action||'').toUpperCase()==='ON'&&Number(r.study_day||0)>=Number(lo||1)&&Number(r.study_day||0)<=Number(hi||999999)).forEach(r=>{const id=String(r.question_id||'').trim();if(id)ids[id]=true});return Object.keys(ids);}
function startMathsV4Quiz(request){
  request=request||{};if(String(request.scope||'')!=='star_history')return startMathsV3Quiz(request);
  ensureMathsV3_();const state=getStateMap_(),ids=getStarredScopeIdsV4(request.starLo||1,request.starHi||999999),map={};standardStudyQuestions_(getAllQuestions_()).filter(active_).forEach(q=>map[String(q.question_id)]=q);let pool=ids.map(id=>map[id]).filter(Boolean),kind=String(request.kind||'all').toLowerCase(),count=Math.max(1,Math.min(100,Number(request.count||20)));
  if(kind==='new')pool=pool.filter(q=>Number((state[q.question_id]||{}).attempts||0)===0).sort((a,b)=>String(b.question_id).localeCompare(String(a.question_id)));
  else if(kind==='weak')pool=pool.filter(q=>!isMastered_(state[q.question_id])).map(q=>{const s=state[q.question_id]||{},last=String(s.last_result||'').toLowerCase();return {q,score:(isDifficultV3_(s)?100:0)+(last==='wrong'?60:0)+(Number(s.last_response_sec||0)>=20?30:0)}}).sort((a,b)=>b.score-a.score).map(x=>x.q);
  else if(kind==='mastered')pool=pool.filter(q=>isMastered_(state[q.question_id]));
  else if(kind==='difficult')pool=pool.filter(q=>isDifficultV3_(state[q.question_id]));
  else if(kind==='random')pool=shuffle_(pool.filter(q=>!isMastered_(state[q.question_id])));
  else pool=pool.filter(q=>!isMastered_(state[q.question_id]));
  if(kind!=='all')pool=pool.slice(0,Math.min(count,pool.length));if(!pool.length)return {ok:false,message:'No eligible questions found for this revision scope.'};
  const label=kind==='all'?'Practice All':kind.charAt(0).toUpperCase()+kind.slice(1),title=String(request.title||'Starred Revision')+' · '+label,sessionId=Utilities.getUuid(),payload=enhanceV3Payload_(sessionPayload_(sessionId,pool,state,title,'v4_'+kind,0,null),state);
  saveSession_({session_id:sessionId,mode:'v4_'+kind,title,question_ids_json:JSON.stringify(pool.map(q=>q.question_id)),current_index:0,updated_at:new Date(),completed:false,params_json:JSON.stringify(request)});return payload;
}
