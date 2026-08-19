const MATHS_CHAPTER_VISIBILITY_VERSION='v11';

function mathsIsLectureChapterSeedV11_(q){
  if(!q||!active_(q))return false;
  const chapter=normalizeLabel_(q.chapter||'');
  if(!chapter||chapter==='calculation training')return false;
  const template=String(q.template_group||'').trim().toUpperCase();
  if(template==='MOCK_QUESTIONS'||/^CALC_DAY/.test(template))return false;
  return true;
}

function mathsLectureQuestionsV11_(){
  return getAllQuestions_().filter(mathsIsLectureChapterSeedV11_);
}

function mathsChaptersV11_(){
  const all=mathsLectureQuestionsV11_(),state=mathsStateMapV9_(),map={};
  all.forEach(q=>{
    const c=String(q.chapter||'Other').trim()||'Other';
    if(!map[c])map[c]={chapter:c,total:0,mastered:0,remaining:0,majorMap:{}};
    const m=map[c],mastered=isMastered_(state[String(q.question_id)]);
    m.total++;if(mastered)m.mastered++;else m.remaining++;
    const name=majorTopicForQuestion_(q),key=majorTopicKey_(name);
    if(!m.majorMap[key])m.majorMap[key]={key,name,total:0,mastered:0,active:0};
    m.majorMap[key].total++;if(mastered)m.majorMap[key].mastered++;else m.majorMap[key].active++;
  });
  return Object.values(map).map(m=>{
    const order=majorTopicOrder_(m.chapter);
    m.majorTopics=Object.values(m.majorMap).sort((a,b)=>{
      const ai=order.indexOf(a.name),bi=order.indexOf(b.name);
      if(ai>=0||bi>=0)return(ai<0?999:ai)-(bi<0?999:bi)||a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    delete m.majorMap;return m;
  }).sort((a,b)=>a.chapter.localeCompare(b.chapter));
}

function getAppBootstrapV11(){
  const base=getAppBootstrapV9();
  base.chapters=mathsChaptersV11_();
  base.chapterVisibilityVersion=MATHS_CHAPTER_VISIBILITY_VERSION;
  return base;
}
