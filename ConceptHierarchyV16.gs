const MATHS_CONCEPT_HIERARCHY_VERSION='v16';

function mathsConceptIdsV16_(){
  const ids={};
  sheetObjects_(ensureConceptsV4_()).forEach(r=>{
    const id=String(r.question_id||'').trim();
    if(id&&(!Object.prototype.hasOwnProperty.call(r,'active')||bool_(r.active)))ids[id]=true;
  });
  return ids;
}

function mathsConceptPoolV16_(){
  const map=mathsQuestionMapV9_(),ids=mathsConceptIdsV16_();
  return Object.keys(ids).map(id=>map[id]).filter(Boolean);
}

function mathsConceptTopicV16_(q){
  const raw=typeof majorTopicForQuestion_==='function'?majorTopicForQuestion_(q):String(q.topic||'General');
  const name=String(raw||'General').trim()||'General';
  const key=typeof majorTopicKey_==='function'?majorTopicKey_(name):normalizeLabel_(name).replace(/[^a-z0-9]+/g,'_');
  return {name:name,key:key};
}

function mathsConceptFilterV16_(request){
  request=request||{};
  const chapter=String(request.chapter||'').trim(),topic=String(request.majorTopic||request.majorTopicKey||'').trim();
  return mathsConceptPoolV16_().filter(q=>{
    if(chapter&&!chapterMatchesPlan_(q.chapter,chapter))return false;
    if(topic){
      const t=mathsConceptTopicV16_(q);
      if(normalizeLabel_(t.name)!==normalizeLabel_(topic)&&String(t.key)!==String(topic))return false;
    }
    return true;
  });
}

function mathsConceptTopicRowsV16_(chapter,pool,state){
  const by={};
  (pool||[]).forEach(q=>{
    const t=mathsConceptTopicV16_(q);
    if(!by[t.key])by[t.key]={name:t.name,key:t.key,pool:[]};
    by[t.key].pool.push(q);
  });
  const order=typeof majorTopicOrder_==='function'?majorTopicOrder_(chapter):[];
  return Object.values(by).sort((a,b)=>{
    const ai=order.indexOf(a.name),bi=order.indexOf(b.name);
    if(ai>=0||bi>=0)return(ai<0?999:ai)-(bi<0?999:bi)||a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  }).map(x=>({name:x.name,key:x.key,metric:mathsMetricV9_(x.pool,state)}));
}

function getConceptsHubV16(){
  const state=mathsStateMapV9_(),pool=mathsConceptPoolV16_(),by={};
  pool.forEach(q=>{const c=String(q.chapter||'Other').trim()||'Other';(by[c]||(by[c]=[])).push(q)});
  const chapters=Object.keys(by).sort().map(chapter=>{
    const chapterPool=by[chapter],topics=mathsConceptTopicRowsV16_(chapter,chapterPool,state),order=typeof majorTopicOrder_==='function'?majorTopicOrder_(chapter):[];
    return {chapter:chapter,metric:mathsMetricV9_(chapterPool,state),nested:Array.isArray(order)&&order.length>0,topics:topics};
  });
  return {version:mathsVersionV9_(),hierarchyVersion:MATHS_CONCEPT_HIERARCHY_VERSION,generatedAt:new Date().toISOString(),metric:mathsMetricV9_(pool,state),chapters:chapters};
}

function startConceptPracticeV16(request){
  request=Object.assign({},request||{});
  const state=mathsStateMapV9_(),kind=String(request.kind||'random').toLowerCase(),count=Math.max(1,Math.min(100,Number(request.count||20)));
  let pool=mathsConceptFilterV16_(request),label='Random';
  if(kind==='all'){pool=shuffle_(pool);label='Practice All'}
  else if(kind==='new'){pool=mathsNewPoolV9_(pool,state).slice(0,count);label='New'}
  else if(kind==='weak'){pool=mathsWeakRankV9_(pool,state).slice(0,count);label='Weak'}
  else if(kind==='hard'){pool=mathsHardRankV20_(pool,state,mathsAttemptProfileMapV20_(false)).slice(0,count);label='Hard'}
  else if(kind==='difficult'){pool=shuffle_(pool.filter(q=>bool_((state[String(q.question_id)]||{}).difficult)&&!isMastered_(state[String(q.question_id)]))).slice(0,count);label='Difficult'}
  else {pool=shuffle_(pool.filter(q=>!isMastered_(state[String(q.question_id)]))).slice(0,count);label='Random'}
  if(!pool.length)return {ok:false,message:'No eligible '+label.toLowerCase()+' concept questions found for this selection.'};
  request.scope='concept_saved';
  return makeMathsSessionV9_(pool,request,label);
}

function getConceptViewItemsV16(request){
  const state=mathsStateMapV9_(),notes=getNotesMap_();
  return mathsConceptFilterV16_(request||{}).map(q=>{
    const id=String(q.question_id),s=state[id]||{},served=serveQuestion_(q,s,notes[id]||'');
    return {id:id,chapter:q.chapter||'',topic:q.topic||'',subtopic:q.subtopic||'',prompt:served.prompt||q.prompt||'',options:served.options||[],correctOption:served.correctOption||'',answer:served.answer||q.answer||'',explanation:served.explanation||q.explanation||'',memoryCue:served.memoryCue||q.memory_cue||'',sourceFile:q.source_file||'',sourcePage:q.source_page||'',starred:isMarked_(s),difficult:bool_(s.difficult),attempts:Number(s.attempts||0),wrong:normalizeLabel_(s.last_result)==='wrong'};
  });
}
