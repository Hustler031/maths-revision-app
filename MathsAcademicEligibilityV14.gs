const MATHS_ACADEMIC_ELIGIBILITY_VERSION='v14';

function mathsCollectionIdsV14_(setId){
  const ids={};
  try{
    const set=getDemandSetById_(String(setId||''));
    if(set)json_(set.question_ids_json,[]).forEach(id=>{const x=String(id||'').trim();if(x)ids[x]=true});
  }catch(e){}
  return ids;
}

function mathsAcademicContextV14_(){
  return {mockIds:mathsCollectionIdsV14_('MOCK_QUESTIONS'),calcIds:mathsCollectionIdsV14_(MATHS.CALC_SET_ID)};
}

function mathsIsNormalAcademicQuestionV14_(q,ctx){
  if(!q||!active_(q))return false;
  if(!mathsRuntimeQuestionValidV20_(q))return false;
  ctx=ctx||{};
  const id=String(q.question_id||'').trim(),chapter=normalizeLabel_(q.chapter||''),topic=normalizeLabel_(q.topic||''),type=normalizeLabel_(q.card_type||''),template=String(q.template_group||'').trim().toUpperCase(),bank=normalizeLabel_(q.practice_bank||'');
  if(!id||!chapter)return false;
  // Positive inclusion: normal chapter practice accepts only rows explicitly classified ACADEMIC.
  if(bank!=='academic')return false;
  // Defense in depth: known special collections remain blocked even if misclassified later.
  if(ctx.mockIds&&ctx.mockIds[id])return false;
  if(ctx.calcIds&&ctx.calcIds[id])return false;
  if(template==='MOCK_QUESTIONS'||template==='CALC_TRAINING'||/^CALC_DAY/.test(template))return false;
  if(chapter==='calculation training'||chapter==='calculation memory')return false;
  if(topic==='concepts')return false;
  if(['formula','concept','memory','pattern','trap'].includes(type))return false;
  return true;
}

function mathsAcademicQuestionsV14_(){const ctx=mathsAcademicContextV14_();return getAllQuestions_().filter(q=>mathsIsNormalAcademicQuestionV14_(q,ctx));}

function mathsScopePoolV14_(request){
  request=request||{};
  const scope=String(request.scope||'all').toLowerCase();
  if(scope==='demand_set'||scope==='star_history'||scope==='revision_current'||scope==='concept_saved')return mathsScopePoolV9_(request);
  const chapter=String(request.chapter||''),topic=String(request.majorTopic||request.majorTopicKey||''),chapters=(request.chapters||[]).map(String);
  let all=mathsAcademicQuestionsV14_();
  if(scope==='new_practice'){
    let pool=mathsNewPoolV9_(all,mathsStateMapV9_());
    if(chapter)pool=pool.filter(q=>chapterMatchesPlan_(q.chapter,chapter));
    return pool;
  }
  return all.filter(q=>{
    if(scope==='chapter'&&chapter&&!chapterMatchesPlan_(q.chapter,chapter))return false;
    if(scope==='topic'){
      if(chapter&&!chapterMatchesPlan_(q.chapter,chapter))return false;
      const key=typeof majorTopicForQuestion_==='function'?majorTopicForQuestion_(q):String(q.topic||'');
      if(topic&&normalizeLabel_(key)!==normalizeLabel_(topic)&&majorTopicKey_(key)!==String(topic)&&normalizeLabel_(q.topic)!==normalizeLabel_(topic))return false;
    }
    if(scope==='group'&&chapters.length&&!chapters.some(c=>chapterMatchesPlan_(q.chapter,c)))return false;
    return true;
  });
}

function startMathsPracticeV14(request){
  ensureMathsV3_();request=Object.assign({},request||{});
  const state=mathsStateMapV9_(),kind=String(request.kind||'random').toLowerCase(),scope=String(request.scope||'all').toLowerCase(),count=Math.max(1,Math.min(100,Number(request.count||20)));
  let pool=mathsScopePoolV14_(request),label='Random';
  if(kind==='all'){if(scope==='star_history'||scope==='revision_current')pool=pool.filter(q=>!isMastered_(state[String(q.question_id)]));pool=shuffle_(pool);label='Practice All'}
  else if(kind==='new'){pool=mathsNewPoolV9_(pool,state).slice(0,count);label='New'}
  else if(kind==='weak'){pool=mathsWeakRankV9_(pool,state).slice(0,count);label='Weak'}
  else if(kind==='hard'){pool=mathsHardRankV20_(pool,state,mathsAttemptProfileMapV20_(false)).slice(0,count);label='Hard'}
  else if(kind==='starred'||kind==='important'){pool=shuffle_(pool.filter(q=>isMarked_(state[String(q.question_id)])&&!isMastered_(state[String(q.question_id)]))).slice(0,count);label='Starred'}
  else if(kind==='difficult'){pool=shuffle_(pool.filter(q=>bool_((state[String(q.question_id)]||{}).difficult)&&!isMastered_(state[String(q.question_id)]))).slice(0,count);label='Difficult'}
  else {pool=shuffle_(pool.filter(q=>!isMastered_(state[String(q.question_id)]))).slice(0,count);label='Random'}
  if(!pool.length)return {ok:false,message:'No eligible '+label.toLowerCase()+' questions found for this selection.'};
  return makeMathsSessionV9_(pool,request,label);
}

function getMathsScopeMetricV14(request){return Object.assign({version:mathsVersionV9_(),eligibilityVersion:MATHS_ACADEMIC_ELIGIBILITY_VERSION},mathsMetricV9_(mathsScopePoolV14_(request||{}),mathsStateMapV9_()));}

function getMathsViewItemsV14(request){
  const state=mathsStateMapV9_();
  return mathsScopePoolV14_(request||{}).map(q=>{
    const s=state[String(q.question_id)]||{},served=serveQuestion_(q,s,getNotesMap_()[String(q.question_id)]||'');
    return {id:String(q.question_id),chapter:q.chapter||'',topic:q.topic||'',subtopic:q.subtopic||'',prompt:served.prompt||q.prompt||'',options:served.options||[],correctOption:served.correctOption||'',answer:served.answer||q.answer||'',explanation:served.explanation||q.explanation||'',memoryCue:served.memoryCue||q.memory_cue||'',sourceFile:q.source_file||'',sourcePage:q.source_page||'',starred:isMarked_(s),difficult:bool_(s.difficult),hard:mathsIsHardV20_(q,state,mathsAttemptProfileMapV20_(false)),weak:mathsIsWeakV20_(q,state,mathsAttemptProfileMapV20_(false)),attempts:Number(s.attempts||0),wrong:normalizeLabel_(s.last_result)==='wrong'};
  });
}

function buildMathsSnapshotV14_(){
  const version=mathsVersionV9_(),state=mathsStateMapV9_(),all=mathsAcademicQuestionsV14_(),by={};
  all.forEach(q=>{const c=String(q.chapter||'Other');(by[c]||(by[c]=[])).push(q)});
  const chapters=Object.keys(by).sort().map(chapter=>({chapter,group:mathsGroupV9_(chapter),metric:mathsMetricV9_(by[chapter],state)}));
  return {version,eligibilityVersion:MATHS_ACADEMIC_ELIGIBILITY_VERSION,generatedAt:new Date().toISOString(),overall:mathsMetricV9_(all,state),advanced:mathsMetricV9_(all.filter(q=>mathsGroupV9_(q.chapter)==='advanced'),state),arithmetic:mathsMetricV9_(all.filter(q=>mathsGroupV9_(q.chapter)==='arithmetic'),state),misc:mathsMetricV9_(all.filter(q=>mathsGroupV9_(q.chapter)==='misc'),state),chapters};
}

function getMathsSnapshotV14(force){
  const c=mathsCacheV9_(),key=mathsCacheKeyV9_('progress-academic-v14');
  if(!force){const raw=c.get(key);if(raw)try{return JSON.parse(raw)}catch(e){}}
  const out=buildMathsSnapshotV14_();try{c.put(key,JSON.stringify(out),MATHS_CORE_CACHE_SEC)}catch(e){}return out;
}

function getMathsNewHubV14(){
  const snap=getMathsSnapshotV14(false),state=mathsStateMapV9_(),newPool=mathsNewPoolV9_(mathsAcademicQuestionsV14_(),state),by={};
  newPool.forEach(q=>{const c=String(q.chapter||'Other');(by[c]||(by[c]=[])).push(q)});
  return {version:snap.version,eligibilityVersion:MATHS_ACADEMIC_ELIGIBILITY_VERSION,generatedAt:new Date().toISOString(),overall:mathsMetricV9_(newPool,state),chapters:Object.keys(by).sort().map(chapter=>({chapter,metric:mathsMetricV9_(by[chapter],state)}))};
}

function mathsChaptersV14_(){
  const all=mathsAcademicQuestionsV14_(),state=mathsStateMapV9_(),map={};
  all.forEach(q=>{
    const c=String(q.chapter||'Other').trim()||'Other';if(!map[c])map[c]={chapter:c,total:0,mastered:0,remaining:0,majorMap:{}};
    const m=map[c],mastered=isMastered_(state[String(q.question_id)]);m.total++;if(mastered)m.mastered++;else m.remaining++;
    const name=majorTopicForQuestion_(q),key=majorTopicKey_(name);if(!m.majorMap[key])m.majorMap[key]={key,name,total:0,mastered:0,active:0};m.majorMap[key].total++;if(mastered)m.majorMap[key].mastered++;else m.majorMap[key].active++;
  });
  return Object.values(map).map(m=>{const order=majorTopicOrder_(m.chapter);m.majorTopics=Object.values(m.majorMap).sort((a,b)=>{const ai=order.indexOf(a.name),bi=order.indexOf(b.name);if(ai>=0||bi>=0)return(ai<0?999:ai)-(bi<0?999:bi)||a.name.localeCompare(b.name);return a.name.localeCompare(b.name)});delete m.majorMap;return m}).sort((a,b)=>a.chapter.localeCompare(b.chapter));
}

function getAppBootstrapV14(){const base=getAppBootstrapV11();base.chapters=mathsChaptersV14_();base.chapterVisibilityVersion=MATHS_ACADEMIC_ELIGIBILITY_VERSION;return base;}

function getMathsHomeV14(){
  const base=getMathsHomeV12(),snap=getMathsSnapshotV14(false),newHub=getMathsNewHubV14();
  base.overall=snap.overall;base.newCount=Number(newHub.overall&&newHub.overall.total||0);base.starred=Number(snap.overall&&snap.overall.starred||0);base.difficult=Number(snap.overall&&snap.overall.difficult||0);base.eligibilityVersion=MATHS_ACADEMIC_ELIGIBILITY_VERSION;return base;
}

function auditMathsFocusedPracticeV14(){
  const ctx=mathsAcademicContextV14_(),pool=mathsAcademicQuestionsV14_(),byChapter={};pool.forEach(q=>byChapter[String(q.chapter||'Other')]=Number(byChapter[String(q.chapter||'Other')]||0)+1);
  return {version:MATHS_ACADEMIC_ELIGIBILITY_VERSION,eligible:pool.length,chapters:byChapter,practiceBankLeak:pool.filter(q=>normalizeLabel_(q.practice_bank||'')!=='academic').length,mockLeak:pool.filter(q=>(ctx.mockIds&&ctx.mockIds[String(q.question_id)])||String(q.template_group||'').trim().toUpperCase()==='MOCK_QUESTIONS').length,calculationLeak:pool.filter(q=>(ctx.calcIds&&ctx.calcIds[String(q.question_id)])||normalizeLabel_(q.chapter)==='calculation training'||/^CALC_DAY/.test(String(q.template_group||'').trim().toUpperCase())).length,conceptLeak:pool.filter(q=>normalizeLabel_(q.topic)==='concepts'||['formula','concept','memory','pattern','trap'].includes(normalizeLabel_(q.card_type))).length};
}
