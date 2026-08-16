function selectGroupPractice_(all, generated, state, request, mode) {
  request=request||{};
  const complete=String(mode).endsWith('_complete');
  const random=String(mode).endsWith('_random');
  const weak=String(mode).endsWith('_weak');
  const groupName=String(request.groupName||request.group||'Practice Group');
  const chapters=(request.chapters||[]).map(x=>normalizeLabel_(x)).filter(Boolean);
  const source=String(request.source||'questions');
  let pool=[];

  if(source==='generated') {
    pool=(generated||[]).filter(q=>{
      if(!active_(q))return false;
      if(request.generatedChapter&&!same_(q.chapter,request.generatedChapter))return false;
      if(request.generatedTopic&&!same_(q.topic,request.generatedTopic))return false;
      return true;
    });
  } else {
    pool=standardStudyQuestions_(all).filter(q=>chapters.includes(normalizeLabel_(q.chapter)));
  }

  if(!complete)pool=pool.filter(q=>!isMastered_(state[q.question_id]));
  const count=Math.max(1,Number(request.count||20));
  if(random)pool=shuffle_(pool).slice(0,Math.min(count,pool.length));
  if(weak)pool=rankWeak_(pool,state).slice(0,Math.min(count,pool.length));
  if(complete)pool=shuffle_(pool);

  const suffix=complete?'Practice All':random?'Random Practice':'Weak Practice';
  return {pool:pool,title:groupName+' · '+suffix};
}
