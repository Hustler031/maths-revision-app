const MATHS_DAILY_VERSION='v12';
const MATHS_DAILY_DEFAULT_SIZE=20;

function mathsStudyClockV12_(){
  const tz=studyTimezone_()||'Asia/Kolkata';
  const today=Utilities.formatDate(new Date(),tz,'yyyy-MM-dd');
  const start=String(getSetting_('plan_start_date','')||today).trim()||today;
  const a=dateSerial_(start),b=dateSerial_(today);
  let day=(a!==null&&b!==null)?Math.floor(b-a)+1:Number(getSetting_('current_day',1)||1);
  if(!Number.isFinite(day)||day<1)day=1;
  return {ready:true,day:day,chapter:'Mixed Revision',timezone:tz,startDate:start,today:today};
}

function mathsCalculationIdsV12_(){
  const ids={};
  try{
    const set=getDemandSetById_(MATHS.CALC_SET_ID);
    if(set)json_(set.question_ids_json,[]).forEach(id=>{const x=String(id||'').trim();if(x)ids[x]=true});
  }catch(e){}
  return ids;
}

function mathsIsCalculationQuestionV12_(q,calcIds){
  if(!q)return true;
  const id=String(q.question_id||'').trim(),chapter=normalizeLabel_(q.chapter||''),template=String(q.template_group||'').trim().toUpperCase();
  if(calcIds&&calcIds[id])return true;
  if(/^CT\d{8}$/i.test(id)||/^CALC_DAY/.test(template)||template==='CALC_TRAINING')return true;
  return chapter==='calculation training'||chapter==='calculation memory';
}

function mathsIsDailyQuestionV12_(q,calcIds){
  if(!q||!active_(q))return false;
  if(typeof mathsIsLectureChapterSeedV11_==='function'&&!mathsIsLectureChapterSeedV11_(q))return false;
  if(mathsIsCalculationQuestionV12_(q,calcIds))return false;
  const type=normalizeLabel_(q.card_type||'');
  if(['formula','method','pattern','trap','concept','memory'].includes(type))return false;
  return true;
}

function mathsDailyEligibleV12_(){
  const calcIds=mathsCalculationIdsV12_();
  return getAllQuestions_().filter(q=>mathsIsDailyQuestionV12_(q,calcIds));
}

function mathsDailySessionsV12_(){
  return sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>normalizeLabel_(r.mode)==='daily').map(r=>{
    const p=json_(r.params_json,{});return {row:r,day:Number(p.planDay||0),params:p};
  }).filter(x=>x.day>0).sort((a,b)=>dateMs_(b.row.updated_at)-dateMs_(a.row.updated_at));
}

function mathsDailySessionForDayV12_(day){
  return mathsDailySessionsV12_().find(x=>Number(x.day)===Number(day))||null;
}

function mathsSessionQuestionIdsV12_(row){
  return new Set(json_((row&&row.question_ids_json)||'[]',[]).map(String));
}

function mathsPreviousDailyIdsV12_(day){
  const prev=mathsDailySessionForDayV12_(Number(day)-1);return prev?mathsSessionQuestionIdsV12_(prev.row):new Set();
}

function mathsRecentPracticeIdsV12_(){
  const rows=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>['daily','practice_more'].includes(normalizeLabel_(r.mode))).sort((a,b)=>dateMs_(b.updated_at)-dateMs_(a.updated_at)).slice(0,2);
  const ids=new Set();rows.forEach(r=>mathsSessionQuestionIdsV12_(r).forEach(id=>ids.add(id)));return ids;
}

function mathsDailyScoreV12_(q,state,recentIds){
  const id=String(q.question_id),s=state[id]||{},attempts=Number(s.attempts||0),last=normalizeLabel_(s.last_result),difficult=bool_(s.difficult),wrong=last==='wrong',slow=Number(s.last_response_sec||0)>=20;
  let score=0;
  if(difficult)score+=120000;
  if(wrong)score+=100000;
  if(attempts===0)score+=70000;
  if(slow)score+=30000;
  if(isMarked_(s))score+=8000;
  if(attempts>=2)score+=Math.min(15000,attempts*900);
  const lastMs=dateMs_(s.last_attempt),ageDays=lastMs?Math.floor((Date.now()-lastMs)/86400000):999;
  if(attempts>0){if(ageDays>=14)score+=50000;else if(ageDays>=7)score+=35000;else if(ageDays>=3)score+=20000;else score+=5000}
  if(recentIds&&recentIds.has(id))score-=difficult||wrong?20000:80000;
  score+=Math.random()*5000;
  return score;
}

function mathsAdaptiveDailyPoolV12_(count,recentIds){
  const state=mathsStateMapV9_();
  const eligible=mathsDailyEligibleV12_().filter(q=>!isMastered_(state[String(q.question_id)]||{}));
  return eligible.map(q=>({q:q,score:mathsDailyScoreV12_(q,state,recentIds)})).sort((a,b)=>b.score-a.score||String(a.q.question_id).localeCompare(String(b.q.question_id))).slice(0,Math.min(Number(count||MATHS_DAILY_DEFAULT_SIZE),eligible.length)).map(x=>x.q);
}

function mathsDailyCompositionV12_(pool,state){
  const out={difficult:0,wrong:0,unseen:0,revision:0};state=state||mathsStateMapV9_();
  (pool||[]).forEach(q=>{const s=state[String(q.question_id)]||{};if(bool_(s.difficult))out.difficult++;else if(normalizeLabel_(s.last_result)==='wrong')out.wrong++;else if(Number(s.attempts||0)===0)out.unseen++;else out.revision++});
  return out;
}

function mathsMakeDailySessionV12_(pool,day,mode,title,request){
  const state=mathsStateMapV9_(),sessionId=Utilities.getUuid(),composition=mathsDailyCompositionV12_(pool,state),params=Object.assign({},request||{},{planDay:Number(day),planChapter:'Mixed Revision',adaptiveDailyV12:true,dailyVersion:MATHS_DAILY_VERSION,dailyComposition:composition});
  const payload=mathsAvoidRepeatOptionV9_(sessionPayload_(sessionId,pool,state,title,mode,0,null),state);payload.planDay=Number(day);payload.planChapter='Mixed Revision';payload.dailyComposition=composition;
  saveSession_({session_id:sessionId,mode:mode,title:title,question_ids_json:JSON.stringify(pool.map(q=>q.question_id)),current_index:0,updated_at:new Date(),completed:false,params_json:JSON.stringify(params)});
  return payload;
}

function startMathsDailyV12(request){
  ensureMathsInfrastructure_();request=Object.assign({},request||{});const clock=mathsStudyClockV12_(),day=Math.max(1,Number(request.planDay||clock.day));
  const existing=mathsDailySessionForDayV12_(day);
  if(existing){if(!bool_(existing.row.completed))return resumeSession(String(existing.row.session_id));return {ok:false,dailyComplete:true,message:'Day '+day+' is complete. Use Practice More for another mixed set.'}}
  const size=Math.max(1,Number(getSetting_('daily_chapter_size',MATHS_DAILY_DEFAULT_SIZE)||MATHS_DAILY_DEFAULT_SIZE)),pool=mathsAdaptiveDailyPoolV12_(size,mathsPreviousDailyIdsV12_(day));
  if(!pool.length)return {ok:false,message:'No eligible Daily questions are available.'};
  return mathsMakeDailySessionV12_(pool,day,'daily','Day '+day+' · Mixed Revision',request);
}

function startMathsPracticeMoreV12(request){
  ensureMathsInfrastructure_();request=Object.assign({},request||{});const clock=mathsStudyClockV12_(),size=Math.max(1,Math.min(100,Number(request.count||getSetting_('practice_more_size',20)||20))),pool=mathsAdaptiveDailyPoolV12_(size,mathsRecentPracticeIdsV12_());
  if(!pool.length)return {ok:false,message:'No eligible questions are available for Practice More.'};
  return mathsMakeDailySessionV12_(pool,clock.day,'practice_more','Practice More · Mixed Revision',Object.assign({},request,{practiceMore:true}));
}

function mathsSessionAttemptCountV12_(sessionId){
  const ids={};sheetObjects_(getSheet_(MATHS.SHEETS.ATTEMPTS)).forEach(r=>{if(String(r.session_id||'')===String(sessionId||'')){const id=String(r.question_id||'').trim();if(id)ids[id]=true}});return Object.keys(ids).length;
}

function mathsPendingDailyV12_(currentDay){
  const by={};mathsDailySessionsV12_().forEach(x=>{if(!by[x.day])by[x.day]=x});const out=[];
  for(let d=Number(currentDay)-1;d>=1&&out.length<2;d--){const x=by[d];if(x&&bool_(x.row.completed))continue;out.push({day:d,chapter:'Mixed Revision',status:x?'In progress':'Not attempted',chapterTotal:MATHS_DAILY_DEFAULT_SIZE,chapterRemaining:x?Math.max(0,MATHS_DAILY_DEFAULT_SIZE-mathsSessionAttemptCountV12_(x.row.session_id)):MATHS_DAILY_DEFAULT_SIZE})}
  return out;
}

function getMathsHomeV12(){
  const snap=getMathsSnapshotV9(false),newHub=getMathsNewHubV9(),schedule=mathsStudyClockV12_(),baseTarget=Math.max(1,Number(getSetting_('daily_chapter_size',MATHS_DAILY_DEFAULT_SIZE)||MATHS_DAILY_DEFAULT_SIZE)),found=mathsDailySessionForDayV12_(schedule.day),dailyRow=found&&found.row||null,params=found&&found.params||{},sessionIds=dailyRow?json_(dailyRow.question_ids_json,[]):[],target=sessionIds.length||baseTarget,done=dailyRow?(bool_(dailyRow.completed)?target:Math.min(target,mathsSessionAttemptCountV12_(dailyRow.session_id))):0,resume=getSafeResumeSessionV9_(),concepts=getConceptsHubV9();
  return {version:snap.version,generatedAt:new Date().toISOString(),schedule:schedule,daily:{target:target,done:done,left:Math.max(0,target-done),completed:!!(dailyRow&&bool_(dailyRow.completed)),sessionId:dailyRow?String(dailyRow.session_id||''):'',composition:params.dailyComposition||null,adaptive:true},resume:resume,resumeIsDaily:!!(resume&&dailyRow&&String(resume.sessionId)===String(dailyRow.session_id)),newCount:Number(newHub.overall&&newHub.overall.total||0),starred:Number(snap.overall.starred||0),difficult:Number(snap.overall.difficult||0),concepts:Number(concepts.metric.total||0),pending:mathsPendingDailyV12_(schedule.day),overall:snap.overall};
}

function auditMathsDailyV12(){
  const pool=mathsDailyEligibleV12_(),calcIds=mathsCalculationIdsV12_();return {version:MATHS_DAILY_VERSION,studyDay:mathsStudyClockV12_(),eligible:pool.length,calculationLeak:pool.filter(q=>mathsIsCalculationQuestionV12_(q,calcIds)).length,generatedLeak:pool.filter(q=>String(q.question_id||'').toUpperCase().startsWith('GEN')).length};
}
