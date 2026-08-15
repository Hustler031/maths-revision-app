function getDashboard_() {
  const all = getAllQuestions_();
  const state = getStateMap_();
  const scheduled = getScheduledPlan_();
  const today = scheduled.chapter;
  const chapterCore = all.filter(q => active_(q) && chapterMatchesPlan_(q.chapter, today) && rotationTier_(q) === 'Core');
  const masteredToday = chapterCore.filter(q => isMastered_(state[q.question_id])).length;
  const freshRemaining = chapterCore.filter(q => !isMastered_(state[q.question_id]) && Number((state[q.question_id] || {}).attempts || 0) === 0).length;
  let mastered=0, marked=0, attempted=0;
  all.forEach(q => { const s=state[q.question_id]; if(isMastered_(s)) mastered++; if(isMarked_(s)) marked++; if(s&&Number(s.attempts||0)>0) attempted++; });
  const pending = getPendingPlanDays_(scheduled.day, all, state);
  return {
    day:scheduled.day, todayChapter:today, total:all.length,
    chapterTotal:chapterCore.length, chapterRemaining:chapterCore.length-masteredToday,
    chapterMastered:masteredToday, freshRemaining:freshRemaining,
    mastered:mastered, marked:marked, attempted:attempted, generated:getGeneratedQuestions_().length,
    fractions:all.filter(q => same_(q.chapter,'Fraction Patterns')).length,
    triplets:all.filter(q => same_(q.chapter,'Triplets')).length,
    pending:pending, studyTimezone:scheduled.timezone, planStartDate:scheduled.startDate
  };
}

function getChapters_() {
  const all = getAllQuestions_();
  const state = getStateMap_();
  const map = {};
  all.forEach(q => {
    if (!active_(q)) return;
    const c = String(q.chapter || 'Other').trim() || 'Other';
    if (!map[c]) map[c] = {chapter:c,total:0,mastered:0,remaining:0,majorMap:{}};
    const m=map[c]; m.total++;
    const mastered=isMastered_(state[q.question_id]); if(mastered)m.mastered++;else m.remaining++;
    const name=majorTopicForQuestion_(q); const key=majorTopicKey_(name);
    if(!m.majorMap[key])m.majorMap[key]={key:key,name:name,total:0,mastered:0,active:0};
    m.majorMap[key].total++; if(mastered)m.majorMap[key].mastered++;else m.majorMap[key].active++;
  });
  return Object.keys(map).map(c=>{
    const m=map[c];
    const order=majorTopicOrder_(c);
    m.majorTopics=Object.values(m.majorMap).sort((a,b)=>{
      const ai=order.indexOf(a.name),bi=order.indexOf(b.name);
      if(ai>=0||bi>=0)return (ai<0?999:ai)-(bi<0?999:bi)||a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    delete m.majorMap; return m;
  }).sort((a,b)=>a.chapter.localeCompare(b.chapter));
}

function getLibraryCounts_() {
  const all = getAllQuestions_();
  const state = getStateMap_();
  const notes = sheetObjects_(getSheet_(MATHS.SHEETS.NOTES)).filter(n => String(n.note || '').trim());

  return {
    formulas:all.filter(q => String(q.card_type).toLowerCase() === 'formula').length,
    methods:all.filter(q => ['method','pattern','trap'].includes(String(q.card_type).toLowerCase())).length,
    fractions:all.filter(q => q.chapter === 'Fraction Patterns').length,
    triplets:all.filter(q => q.chapter === 'Triplets').length,
    marked:all.filter(q => isMarked_(state[q.question_id])).length,
    notes:notes.length,
    recent:Math.min(20, all.filter(active_).length)
  };
}

function filterLibrary_(all, state, cluster) {
  const c = String(cluster || '').toLowerCase();
  if (c === 'formula' || c === 'formulas') return all.filter(q => String(q.card_type).toLowerCase() === 'formula');
  if (c === 'methods') return all.filter(q => ['method','pattern','trap'].includes(String(q.card_type).toLowerCase()));
  if (c === 'fractions') return all.filter(q => q.chapter === 'Fraction Patterns');
  if (c === 'triplets') return all.filter(q => q.chapter === 'Triplets');
  if (c === 'marked') return all.filter(q => isMarked_(state[q.question_id]));

  if (c === 'notes') {
    const ids = new Set(sheetObjects_(getSheet_(MATHS.SHEETS.NOTES))
      .filter(n => String(n.note || '').trim())
      .map(n => String(n.question_id)));
    return all.filter(q => ids.has(q.question_id));
  }

  if (c === 'recent') return all.slice(-20);
  return all;
}

function filterOnDemand_(all, state, request) {
  request=request||{};
  return all.filter(q => {
    if (!active_(q)) return false;
    if (request.chapter && !same_(q.chapter, request.chapter)) return false;
    if (request.topic && !same_(q.topic, request.topic)) return false;
    if (request.subtopic && !same_(q.subtopic, request.subtopic)) return false;
    if (request.cardType && !same_(q.card_type, request.cardType)) return false;
    if (request.difficulty && !same_(q.difficulty, request.difficulty)) return false;
    if (request.markedOnly && !isMarked_(state[q.question_id])) return false;
    if (request.activeOnly && isMastered_(state[q.question_id])) return false;
    if (request.masteredOnly && !isMastered_(state[q.question_id])) return false;
    return true;
  });
}

function normalizeLabel_(value) { return String(value==null?'':value).trim().replace(/\s+/g,' ').toLowerCase(); }

function norm_(value) { return normalizeLabel_(value); }

function same_(a,b) { return normalizeLabel_(a)===normalizeLabel_(b); }

function validQuestionId_(value) { const id=String(value||'').trim(); if(!id||id==='undefined'||id==='null')throw new Error('Missing question ID.'); return id; }

function dateMs_(v){ const t=v?new Date(v).getTime():0; return Number.isFinite(t)?t:0; }

function studyTimezone_(){ return String(getSetting_('study_timezone',MATHS.DEFAULTS.study_timezone)||MATHS.DEFAULTS.study_timezone); }

function majorTopicKey_(name){ return String(name||'').trim().toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }

function shouldPromoteSubtopic_(q){
  const topic=String(q.topic||'').trim(), subtopic=String(q.subtopic||'').trim();
  if(!subtopic||same_(subtopic,topic))return false;
  const ignored=['general','basics','basic','overview','mixed','miscellaneous'];
  if(ignored.indexOf(normalizeLabel_(subtopic))>=0)return false;
  const type=normalizeLabel_(q.card_type||'');
  return ['application','question','practice','problem'].indexOf(type)>=0;
}

function majorTopicForQuestion_(q) {
  const chapter=normalizeLabel_(q.chapter), raw=normalizeLabel_((q.topic||'')+' '+(q.subtopic||''));
  if(chapter==='geometry'){
    const topic=normalizeLabel_(q.topic||'');
    if(topic==='circle'||/chord|arc|tangent|secant|cyclic|semicircle|central angle|inscribed angle|common tangent/.test(raw))return 'Circle';
    if(/quadrilateral|polygon|parallelogram|rectangle|rhombus|square|trapez|kite/.test(topic)||/quadrilateral|polygon|parallelogram|rectangle|rhombus|square|trapez|kite/.test(raw))return 'Quadrilateral & Polygon';
    if(/triangle/.test(topic)||/centroid|incenter|circumcenter|orthocenter|median|altitude|pythag|similar|congruen|equilateral|isosceles|midpoint theorem|apollonius/.test(raw))return 'Triangle';
    return 'Lines & Angles';
  }
  if(chapter==='mensuration 2d'){
    if(/path|composite/.test(raw))return 'Paths / Composite 2D';
    if(/circle|sector|semicircle|arc/.test(raw))return 'Circle';
    if(/triangle|equilateral|isosceles|right[- ]?angled|right triangle/.test(raw))return 'Triangle';
    if(/square|rectangle|parallelogram|rhombus|trapez|quadrilateral|kite/.test(raw))return 'Quadrilateral';
    if(/polygon|hexagon/.test(raw))return 'Polygon';
    return String(q.topic||'General').trim()||'General';
  }
  if(chapter==='mensuration 3d'){
    if(/cuboid|cube|box/.test(raw))return 'Cuboid & Cube';
    if(/cylinder/.test(raw))return 'Cylinder';
    if(/cone|frustum/.test(raw))return 'Cone & Frustum';
    if(/sphere|hemisphere/.test(raw))return 'Sphere & Hemisphere';
    if(/prism|pyramid|tetrahedron/.test(raw))return 'Prism & Pyramid';
    if(/combination|composite|capsule|cavity|joined|recast|melting/.test(raw))return 'Composite Solids';
    return String(q.topic||'General').trim()||'General';
  }
  if(chapter==='profit & loss and discount'){
    if(/dishonest seller|false weight|false measure|short weight|cheat/.test(raw))return 'Dishonest Sellers';
    if(normalizeLabel_(q.topic)==='discount'||/discount|marked price|markup/.test(raw))return 'Discount';
    if(shouldPromoteSubtopic_(q))return String(q.subtopic).trim();
    return 'Profit & Loss';
  }
  if(shouldPromoteSubtopic_(q))return String(q.subtopic).trim();
  return String(q.topic||'General').trim()||'General';
}

function majorTopicOrder_(chapter){
  if(same_(chapter,'Geometry'))return ['Lines & Angles','Triangle','Circle','Quadrilateral & Polygon'];
  if(same_(chapter,'Mensuration 2D'))return ['Triangle','Quadrilateral','Circle','Polygon','Paths / Composite 2D'];
  if(same_(chapter,'Mensuration 3D'))return ['Cuboid & Cube','Cylinder','Cone & Frustum','Sphere & Hemisphere','Prism & Pyramid','Composite Solids'];
  if(same_(chapter,'Profit & Loss and Discount'))return ['Profit & Loss','Dishonest Sellers','Discount'];
  return [];
}

function resolveRequestedMajorTopic_(request){
  request=request||{};
  if(request.majorTopic)return String(request.majorTopic);
  const key=String(request.majorTopicKey||''); if(!key)return '';
  const c=getChapters_().find(x=>same_(x.chapter,request.chapter));
  const t=c&&(c.majorTopics||[]).find(x=>String(x.key)===key);
  return t?String(t.name):'';
}

function weakScore_(q,s){
  s=s||{}; let score=0;
  if(norm_(s.last_result)==='wrong')score+=10000;
  if(isMarked_(s))score+=7000;
  const sec=Number(s.last_response_sec||0); if(sec>=20)score+=3000+Math.min(sec,300);
  const attempts=Number(s.attempts||0); if(attempts>=2)score+=1500+Math.min(attempts,20)*10;
  if(attempts===0)score+=700;
  return score;
}

function rankWeak_(pool,state){return pool.slice().sort((a,b)=>weakScore_(b,state[b.question_id])-weakScore_(a,state[a.question_id])||String(a.question_id).localeCompare(String(b.question_id)));}

function selectPracticePool_(all,state,request,mode){
  request=request||{}; const chapter=String(request.chapter||''); const topicMode=String(mode).indexOf('topic_')===0;
  const requestedName=topicMode?resolveRequestedMajorTopic_(request):'';
  const requestedKey=topicMode?String(request.majorTopicKey||majorTopicKey_(requestedName)):'';
  let mapped=all.filter(q=>active_(q)&&same_(q.chapter,chapter));
  if(topicMode)mapped=mapped.filter(q=>majorTopicKey_(majorTopicForQuestion_(q))===requestedKey);
  const complete=mode==='chapter'||String(mode).endsWith('_complete');
  const random=String(mode).endsWith('_random');
  const weak=String(mode).endsWith('_weak');
  let eligible=complete?mapped:mapped.filter(q=>!isMastered_(state[q.question_id]));
  let pool=eligible.slice(); const count=Math.max(1,Number(request.count||20));
  if(random)pool=shuffle_(pool).slice(0,Math.min(count,pool.length));
  if(weak)pool=rankWeak_(pool,state).slice(0,Math.min(count,pool.length));
  const label=topicMode?(requestedName||requestedKey):chapter;
  const title=label+(complete?' · Complete Bank':random?' · Random Practice':' · Weak Practice');
  return {pool:pool,title:title,majorTopic:requestedName,mappedTotal:mapped.length,eligibleTotal:eligible.length};
}

function getPlanEntries_(){
  return sheetObjects_(getSheet_(MATHS.SHEETS.PLAN)).filter(r=>r.order&&r.chapter&&normalizeLabel_(r.status)!=='continuous').map(r=>({day:Number(r.order),chapter:String(r.chapter).trim(),targetPerDay:Number(r.target_per_day||0),status:String(r.status||'')})).filter(r=>r.day>0).sort((a,b)=>a.day-b.day);
}

function getPlanEntry_(day){return getPlanEntries_().find(r=>Number(r.day)===Number(day))||null;}

function dateSerial_(ymd){const p=String(ymd||'').split('-').map(Number);if(p.length!==3||!p[0]||!p[1]||!p[2])return null;return Date.UTC(p[0],p[1]-1,p[2])/86400000;}

function getScheduledPlan_(){
  const tz=studyTimezone_(); const start=String(getSetting_('plan_start_date',MATHS.DEFAULTS.plan_start_date)||'').trim();
  const today=Utilities.formatDate(new Date(),tz,'yyyy-MM-dd'); const a=dateSerial_(start),b=dateSerial_(today); const entries=getPlanEntries_();
  let day=(a!==null&&b!==null)?Math.floor(b-a)+1:Number(getSetting_('current_day',1)||1); if(day<1)day=1;
  const maxDay=entries.length?Math.max.apply(null,entries.map(x=>x.day)):day; if(day>maxDay)day=maxDay;
  let entry=getPlanEntry_(day); if(!entry&&entries.length)entry=entries.filter(x=>x.day<=day).slice(-1)[0]||entries[0];
  return {day:entry?entry.day:day,chapter:entry?entry.chapter:String(getSetting_('today_chapter',MATHS.DEFAULTS.today_chapter)),timezone:tz,startDate:start,today:today};
}

function chapterMatchesPlan_(questionChapter,planChapter){
  const q=normalizeLabel_(questionChapter),p=normalizeLabel_(planChapter);
  if(q===p)return true;
  if(p==='heights and distances'&&(q==='height & distance'||q==='heights & distances'))return true;
  if(p==='height & distance'&&q==='heights and distances')return true;
  if(p==='mensuration'&&(q==='mensuration 2d'||q==='mensuration 3d'))return true;
  return false;
}

function plannedDayStatus_(day){
  const sessions=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(s=>{
    if(normalizeLabel_(s.mode)!=='daily')return false; const p=json_(s.params_json,{}); return Number(p.planDay||0)===Number(day);
  });
  if(!sessions.length)return 'Not attempted';
  if(sessions.some(s=>bool_(s.completed)))return 'Completed';
  if(sessions.some(s=>Number(s.current_index||0)>0))return 'In progress';
  return 'Not attempted';
}

function getPendingPlanDays_(scheduledDay,all,state){
  return getPlanEntries_().filter(e=>e.day<scheduledDay).map(e=>{
    const status=plannedDayStatus_(e.day); if(status==='Completed')return null;
    const core=all.filter(q=>active_(q)&&chapterMatchesPlan_(q.chapter,e.chapter)&&rotationTier_(q)==='Core');
    const mastered=core.filter(q=>isMastered_(state[q.question_id])).length;
    return {day:e.day,chapter:e.chapter,status:status,chapterTotal:core.length,chapterRemaining:core.length-mastered};
  }).filter(Boolean);
}

function stateDuplicateAudit_(){
  const counts={}; sheetObjects_(getSheet_(MATHS.SHEETS.STATE)).forEach(r=>{const id=String(r.question_id||'').trim();if(id)counts[id]=(counts[id]||0)+1;});
  const ids=Object.keys(counts).filter(id=>counts[id]>1); return {groups:ids.length,extraRows:ids.reduce((n,id)=>n+counts[id]-1,0),ids:ids};
}

function auditMathsRuntime_(){
  ensureMathsInfrastructure_(); const all=getAllQuestions_(),state=getStateMap_();
  const chapter=(name,mode,count)=>selectPracticePool_(all,state,{chapter:name,count:count||20},mode);
  const geometryInfo=getChapters_().find(c=>same_(c.chapter,'Geometry')); const circle=geometryInfo&&(geometryInfo.majorTopics||[]).find(t=>t.name==='Circle');
  const m2Info=getChapters_().find(c=>same_(c.chapter,'Mensuration 2D')); const tri=m2Info&&(m2Info.majorTopics||[]).find(t=>t.name==='Triangle');
  const pldInfo=getChapters_().find(c=>same_(c.chapter,'Profit & Loss and Discount')); const dishonest=pldInfo&&(pldInfo.majorTopics||[]).find(t=>t.name==='Dishonest Sellers');
  const topic=(chapterName,t,mode)=>selectPracticePool_(all,state,{chapter:chapterName,majorTopicKey:t?t.key:'',count:20},mode);
  const promotedApplicationSubtopics=all.filter(q=>active_(q)&&shouldPromoteSubtopic_(q)&&!['geometry','mensuration 2d','mensuration 3d'].includes(normalizeLabel_(q.chapter))).reduce((acc,q)=>{const name=majorTopicForQuestion_(q),key=normalizeLabel_(q.chapter)+'|'+majorTopicKey_(name);if(!acc[key])acc[key]={chapter:q.chapter,name:name,count:0};acc[key].count++;return acc;},{});
  return {
    geometry:{total:geometryInfo?geometryInfo.total:0,mastered:geometryInfo?geometryInfo.mastered:0,nonMastered:geometryInfo?geometryInfo.remaining:0,majorTopics:geometryInfo?geometryInfo.majorTopics:[],complete:chapter('Geometry','chapter_complete').pool.length,random:chapter('Geometry','chapter_random').pool.length,weak:chapter('Geometry','chapter_weak').pool.length},
    geometryCircle:circle?{mappedTotal:circle.total,mastered:circle.mastered,complete:topic('Geometry',circle,'topic_complete').pool.length,random:topic('Geometry',circle,'topic_random').pool.length,weak:topic('Geometry',circle,'topic_weak').pool.length}:null,
    mensuration2D:{total:m2Info?m2Info.total:0,majorTopics:m2Info?m2Info.majorTopics:[]},
    mensurationTriangle:tri?{mappedTotal:tri.total,complete:topic('Mensuration 2D',tri,'topic_complete').pool.length,random:topic('Mensuration 2D',tri,'topic_random').pool.length,weak:topic('Mensuration 2D',tri,'topic_weak').pool.length}:null,
    profitLossDiscount:{total:pldInfo?pldInfo.total:0,majorTopics:pldInfo?pldInfo.majorTopics:[]},
    dishonestSellers:dishonest?{mappedTotal:dishonest.total,complete:topic('Profit & Loss and Discount',dishonest,'topic_complete').pool.length,random:topic('Profit & Loss and Discount',dishonest,'topic_random').pool.length,weak:topic('Profit & Loss and Discount',dishonest,'topic_weak').pool.length}:null,
    promotedApplicationSubtopics:Object.values(promotedApplicationSubtopics),
    schedule:getScheduledPlan_(),pending:getPendingPlanDays_(getScheduledPlan_().day,all,state),stateDuplicates:stateDuplicateAudit_()
  };
}
