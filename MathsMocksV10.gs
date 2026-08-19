const MATHS_MOCK_SET_ID_V10='MOCK_QUESTIONS';

function mathsMockPoolV10_(chapter){
  const set=getDemandSetById_(MATHS_MOCK_SET_ID_V10);if(!set)return[];
  const map=mathsQuestionMapV9_();let pool=json_(set.question_ids_json,[]).map(id=>map[String(id)]).filter(q=>q&&active_(q));
  if(chapter)pool=pool.filter(q=>chapterMatchesPlan_(q.chapter,String(chapter)));
  return pool;
}
function mathsMockMetricV10_(pool,state){
  const m=mathsMetricV9_(pool,state);m.correct=Math.max(0,Number(m.attempted||0)-Number(m.wrong||0));return m;
}
function getMathsMocksHubV10(){
  ensureMathsInfrastructure_();const state=mathsStateMapV9_(),pool=mathsMockPoolV10_(),by={};
  pool.forEach(q=>{const c=String(q.chapter||'Other').trim()||'Other';(by[c]||(by[c]=[])).push(q)});
  const chapters=Object.keys(by).map(chapter=>({chapter,metric:mathsMockMetricV10_(by[chapter],state)})).sort((a,b)=>Number(b.metric.wrong||0)-Number(a.metric.wrong||0)||Number(b.metric.wrongPct||0)-Number(a.metric.wrongPct||0)||a.chapter.localeCompare(b.chapter));
  return {version:mathsVersionV9_(),generatedAt:new Date().toISOString(),setId:MATHS_MOCK_SET_ID_V10,overall:mathsMockMetricV10_(pool,state),chapters};
}
function getMathsMockQuestionsV10(chapter){
  const state=mathsStateMapV9_(),notes=getNotesMap_();
  return mathsMockPoolV10_(chapter).map(q=>{const id=String(q.question_id),s=state[id]||{},served=serveQuestion_(q,s,notes[id]||'');return {id,chapter:q.chapter||'',topic:q.topic||'',subtopic:q.subtopic||'',prompt:served.prompt||q.prompt||'',options:served.options||[],correctOption:served.correctOption||'',answer:served.answer||q.answer||'',explanation:served.explanation||q.explanation||'',memoryCue:served.memoryCue||q.memory_cue||'',sourceFile:q.source_file||'',sourcePage:q.source_page||'',attempts:Number(s.attempts||0),lastResult:normalizeLabel_(s.last_result),wrong:normalizeLabel_(s.last_result)==='wrong',starred:isMarked_(s),difficult:bool_(s.difficult)};});
}
function startMathsMockPracticeV10(request){
  ensureMathsInfrastructure_();request=Object.assign({},request||{});const state=mathsStateMapV9_(),kind=String(request.kind||'random').toLowerCase(),count=Math.max(1,Math.min(100,Number(request.count||20)));let pool=mathsMockPoolV10_(request.chapter),label='Random';
  if(kind==='all'){pool=shuffle_(pool);label='Practice All'}
  else if(kind==='new'){pool=mathsNewPoolV9_(pool,state).slice(0,count);label='New'}
  else if(kind==='weak'){pool=mathsWeakRankV9_(pool,state).slice(0,count);label='Weak'}
  else if(kind==='starred'||kind==='important'){pool=shuffle_(pool.filter(q=>isMarked_(state[String(q.question_id)])&&!isMastered_(state[String(q.question_id)]))).slice(0,count);label='Starred'}
  else if(kind==='difficult'){pool=shuffle_(pool.filter(q=>bool_((state[String(q.question_id)]||{}).difficult)&&!isMastered_(state[String(q.question_id)]))).slice(0,count);label='Difficult'}
  else {pool=shuffle_(pool.filter(q=>!isMastered_(state[String(q.question_id)]))).slice(0,count);label='Random'}
  if(!pool.length)return {ok:false,message:'No eligible '+label.toLowerCase()+' mock questions found for this selection.'};
  request.scope='mock_questions';request.setId=MATHS_MOCK_SET_ID_V10;request.title=request.chapter?'Mocks · '+String(request.chapter):'Mock Questions';return makeMathsSessionV9_(pool,request,label);
}
