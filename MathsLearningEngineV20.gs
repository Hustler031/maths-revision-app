const MATHS_LEARNING_ENGINE_VERSION='v20';
const MATHS_DAILY_SIZE_V20=25;
const MATHS_DAILY_NEW_QUOTA_V20=7;
const MATHS_DIFFICULT_ROTATION_DAYS_V20=3;
const MATHS_ATTEMPT_WINDOW_V20=5;

function mathsStableNumberV20_(value){
  const s=String(value||'');let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}

function mathsAttemptProfilesFromRowsV20_(rows){
  const grouped={};
  (rows||[]).forEach((r,i)=>{
    const id=String(r.question_id||r.Question_ID||'').trim();if(!id)return;
    const at=dateMs_(r.timestamp||r.Timestamp||r.attempted_at||'');
    (grouped[id]||(grouped[id]=[])).push({
      at:at||i+1,
      result:normalizeLabel_(r.result||r.Result||'seen'),
      sec:Math.max(0,Number(r.response_sec||r.Response_Sec||0)),
      mode:String(r.mode||r.Mode||''),
      sessionId:String(r.session_id||r.Session_ID||'')
    });
  });
  const out={};
  Object.keys(grouped).forEach(id=>{
    const all=grouped[id].sort((a,b)=>b.at-a.at),recent=all.slice(0,MATHS_ATTEMPT_WINDOW_V20),graded=recent.filter(x=>x.result==='correct'||x.result==='wrong');
    let wrongStreak=0,correctStreak=0;
    for(const x of recent){if(x.result==='wrong')wrongStreak++;else break}
    for(const x of recent){if(x.result==='correct')correctStreak++;else break}
    const correct=graded.filter(x=>x.result==='correct').length,secs=recent.map(x=>x.sec).filter(x=>x>0);
    out[id]={
      total:all.length,recent:recent,graded:graded.length,correct:correct,
      accuracy:graded.length?correct/graded.length:null,
      avgSec:secs.length?secs.reduce((a,b)=>a+b,0)/secs.length:0,
      lastResult:recent.length?recent[0].result:'',lastAt:recent.length?recent[0].at:0,
      wrongStreak:wrongStreak,correctStreak:correctStreak
    };
  });
  return out;
}

function mathsAttemptProfileMapV20_(force){
  const version=mathsVersionV9_(),key='maths:v20:attempt-profiles:'+version,c=mathsCacheV9_();
  if(!force){const hit=c.get(key);if(hit)try{return JSON.parse(hit)}catch(e){}}
  const out=mathsAttemptProfilesFromRowsV20_(sheetObjects_(getSheet_(MATHS.SHEETS.ATTEMPTS)));
  try{c.put(key,JSON.stringify(out),MATHS_CORE_CACHE_SEC)}catch(e){}
  return out;
}

function mathsTimeThresholdV20_(q){
  const chapter=normalizeLabel_(q&&q.chapter||''),prompt=String(q&&q.prompt||'');
  if(chapter==='geometry'||chapter==='coordinate geometry'||prompt.length>=220)return 45;
  return 30;
}

function mathsIsHardV20_(q,state,profiles){
  const id=String(q&&q.question_id||''),p=(profiles||{})[id]||{},s=(state||{})[id]||{};
  if(isMastered_(s)||Number(p.graded||0)<2)return false;
  return Number(p.wrongStreak||0)>=2||(Number(p.graded||0)>=3&&Number(p.accuracy)>=0&&Number(p.accuracy)<=.5)||(Number(p.total||0)>=3&&Number(p.avgSec||0)>=mathsTimeThresholdV20_(q)*1.5);
}

function mathsIsWeakV20_(q,state,profiles){
  const id=String(q&&q.question_id||''),p=(profiles||{})[id]||{},s=(state||{})[id]||{};
  if(isMastered_(s)||!Number(p.total||0))return false;
  return p.lastResult==='wrong'||(Number(p.graded||0)>=2&&Number(p.accuracy)>=0&&Number(p.accuracy)<.75)||Number(p.avgSec||0)>=mathsTimeThresholdV20_(q);
}

function mathsWeakScoreV20_(q,state,profiles){
  const id=String(q.question_id),p=(profiles||{})[id]||{},s=(state||{})[id]||{};let score=0;
  if(mathsIsHardV20_(q,state,profiles))score+=100000;
  if(p.lastResult==='wrong')score+=70000;
  score+=Math.round((1-Number(p.accuracy==null?1:p.accuracy))*30000);
  score+=Math.min(20000,Number(p.avgSec||0)*300);
  if(bool_(s.difficult))score+=5000;
  return score;
}

function mathsWeakRankV20_(pool,state,profiles){
  profiles=profiles||mathsAttemptProfileMapV20_(false);
  return (pool||[]).filter(q=>mathsIsWeakV20_(q,state,profiles)).sort((a,b)=>mathsWeakScoreV20_(b,state,profiles)-mathsWeakScoreV20_(a,state,profiles)||String(a.question_id).localeCompare(String(b.question_id)));
}

function mathsHardRankV20_(pool,state,profiles){
  profiles=profiles||mathsAttemptProfileMapV20_(false);
  return (pool||[]).filter(q=>mathsIsHardV20_(q,state,profiles)).sort((a,b)=>mathsWeakScoreV20_(b,state,profiles)-mathsWeakScoreV20_(a,state,profiles)||String(a.question_id).localeCompare(String(b.question_id)));
}

function mathsReviewIntervalDaysV20_(q,state,profiles){
  const id=String(q.question_id),p=(profiles||{})[id]||{},s=(state||{})[id]||{};
  if(!Number(p.total||0))return 0;
  if(p.lastResult==='wrong')return 1;
  if(mathsIsHardV20_(q,state,profiles))return 2;
  if(mathsIsWeakV20_(q,state,profiles))return 3;
  if(isMarked_(s))return 7;
  if(Number(p.correctStreak||0)>=3)return 14;
  if(Number(p.correctStreak||0)>=2)return 7;
  return 3;
}

function mathsLastDailyDayByIdV20_(sessions){
  const out={};
  (sessions||[]).forEach(x=>{
    const row=x.row||x,params=x.params||json_(row.params_json,{}),day=Number(x.day||params.planDay||0);
    if(!day)return;
    json_(row.question_ids_json,[]).map(String).forEach(id=>{out[id]=Math.max(Number(out[id]||0),day)});
  });
  return out;
}

function mathsDailyCanonicalSessionV20_(sessions,day){
  const matches=(sessions||[]).filter(x=>Number(x.day||((x.params||{}).planDay)||0)===Number(day));
  return matches.sort((a,b)=>Number(bool_((b.row||b).completed))-Number(bool_((a.row||a).completed))||dateMs_((b.row||b).updated_at)-dateMs_((a.row||a).updated_at))[0]||null;
}

function mathsDailyScoreV20_(q,state,profiles,day,lastDailyDay){
  const id=String(q.question_id),s=state[id]||{},p=profiles[id]||{},lastDay=Number(lastDailyDay[id]||0),ageDays=p.lastAt?Math.max(0,Math.floor((Date.now()-p.lastAt)/86400000)):999;
  let score=0;
  if(p.lastResult==='wrong')score+=90000;
  if(mathsIsHardV20_(q,state,profiles))score+=75000;
  else if(mathsIsWeakV20_(q,state,profiles))score+=55000;
  if(isMarked_(s))score+=12000;
  score+=Math.min(45000,ageDays*3500);
  if(lastDay)score+=Math.min(25000,Math.max(0,Number(day)-lastDay)*4000);
  score+=mathsStableNumberV20_(id+':'+day)%5000;
  return score;
}

function mathsSelectDailyFromContextV20_(eligible,state,profiles,sessions,day,options){
  options=options||{};const size=Math.max(1,Number(options.size||MATHS_DAILY_SIZE_V20)),newQuota=Math.max(0,Math.min(size,Number(options.newQuota==null?MATHS_DAILY_NEW_QUOTA_V20:options.newQuota))),rotation=Math.max(1,Number(options.difficultRotationDays||MATHS_DIFFICULT_ROTATION_DAYS_V20)),recentWindow=Math.max(1,Number(options.newWindowDays||MATHS_NEW_WINDOW_DAYS));
  const lastDailyDay=mathsLastDailyDayByIdV20_(sessions),basePool=(eligible||[]).filter(q=>!isMastered_((state||{})[String(q.question_id)]||{})),pool=basePool.filter(q=>{const id=String(q.question_id),s=(state||{})[id]||{},last=Number(lastDailyDay[id]||0);return !bool_(s.difficult)||!last||Number(day)-last>=rotation}),picked=[],pickedIds={},chapterCounts={};
  const add=q=>{const id=String(q&&q.question_id||'');if(!id||pickedIds[id]||picked.length>=size)return false;pickedIds[id]=true;picked.push(q);const c=normalizeLabel_(q.chapter||'other');chapterCounts[c]=Number(chapterCounts[c]||0)+1;return true};
  const balanced=list=>(list||[]).slice().sort((a,b)=>{
    const ca=Number(chapterCounts[normalizeLabel_(a.chapter||'other')]||0),cb=Number(chapterCounts[normalizeLabel_(b.chapter||'other')]||0);
    return ca-cb||mathsDailyScoreV20_(b,state,profiles,day,lastDailyDay)-mathsDailyScoreV20_(a,state,profiles,day,lastDailyDay)||String(a.question_id).localeCompare(String(b.question_id));
  });
  const now=Date.now(),freshCut=now-recentWindow*86400000,unseen=pool.filter(q=>Number(((state||{})[String(q.question_id)]||{}).attempts||0)===0),fresh=unseen.filter(q=>{const t=mathsNewestKeyV9_(q);return t&&t>=freshCut;}).sort((a,b)=>mathsNewestKeyV9_(b)-mathsNewestKeyV9_(a)||String(a.question_id).localeCompare(String(b.question_id))),newCandidates=fresh.concat(unseen.filter(q=>fresh.indexOf(q)<0));
  balanced(fresh).slice(0,newQuota).forEach(add);
  if(picked.length<newQuota)balanced(unseen.filter(q=>!pickedIds[String(q.question_id)])).slice(0,newQuota-picked.length).forEach(add);
  const difficultDue=pool.filter(q=>{const id=String(q.question_id),s=state[id]||{},last=Number(lastDailyDay[id]||0);return bool_(s.difficult)&&(!last||Number(day)-last>=rotation)});
  balanced(difficultDue).forEach(add);
  const weakDue=pool.filter(q=>{const id=String(q.question_id),p=profiles[id]||{},interval=mathsReviewIntervalDaysV20_(q,state,profiles),age=p.lastAt?Math.floor((now-p.lastAt)/86400000):999;return mathsIsWeakV20_(q,state,profiles)&&age>=interval;});
  balanced(weakDue).forEach(add);
  const spacedDue=pool.filter(q=>{const id=String(q.question_id),p=profiles[id]||{},interval=mathsReviewIntervalDaysV20_(q,state,profiles),age=p.lastAt?Math.floor((now-p.lastAt)/86400000):999;return Number(p.total||0)>0&&age>=interval;});
  balanced(spacedDue).forEach(add);
  balanced(newCandidates).forEach(add);
  balanced(pool).forEach(add);
  return picked;
}

function mathsDailyCompositionV20_(pool,state,profiles,day,sessions){
  const out={new:0,difficultDue:0,hard:0,weak:0,dueRevision:0,chapters:{}},lastDaily=mathsLastDailyDayByIdV20_(sessions||[]);
  (pool||[]).forEach(q=>{const id=String(q.question_id),s=(state||{})[id]||{},p=(profiles||{})[id]||{},c=String(q.chapter||'Other');out.chapters[c]=Number(out.chapters[c]||0)+1;if(Number(s.attempts||0)===0)out.new++;if(bool_(s.difficult)&&(!lastDaily[id]||Number(day)-Number(lastDaily[id])>=MATHS_DIFFICULT_ROTATION_DAYS_V20))out.difficultDue++;if(mathsIsHardV20_(q,state,profiles))out.hard++;else if(mathsIsWeakV20_(q,state,profiles))out.weak++;else if(Number(p.total||0)>0)out.dueRevision++;});
  return out;
}

function mathsCurrentRevisionIdsV20_(questionMap,state){
  const out={};Object.keys(questionMap||{}).forEach(id=>{const s=(state||{})[id]||{};if(isMarked_(s)||bool_(s.difficult))out[id]=true});return out;
}
