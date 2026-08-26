const MATHS_DAILY_VERSION='v20';
const MATHS_DAILY_DEFAULT_SIZE=MATHS_DAILY_SIZE_V20;

function mathsStudyClockV12_(){
  const tz=studyTimezone_()||'Asia/Kolkata';
  const today=Utilities.formatDate(new Date(),tz,'yyyy-MM-dd');
  const start=String(getSetting_('plan_start_date','')||today).trim()||today;
  const a=dateSerial_(start),b=dateSerial_(today);
  let day=(a!==null&&b!==null)?Math.floor(b-a)+1:Number(getSetting_('current_day',1)||1);
  if(!Number.isFinite(day)||day<1)day=1;
  return {ready:true,day:day,chapter:'Mixed Revision',timezone:tz,startDate:start,today:today};
}

function mathsDemandSetIdsV12_(setId){
  const ids={};
  try{
    const set=getDemandSetById_(String(setId||''));
    if(set)json_(set.question_ids_json,[]).forEach(id=>{const x=String(id||'').trim();if(x)ids[x]=true});
  }catch(e){}
  return ids;
}

function mathsCalculationIdsV12_(){return mathsDemandSetIdsV12_(MATHS.CALC_SET_ID)}
function mathsMockIdsV12_(){return mathsDemandSetIdsV12_('MOCK_QUESTIONS')}

function mathsDailyLectureChapterNamesV12_(){
  const names={};
  try{
    sheetObjects_(getSheet_(MATHS.SHEETS.PLAN)).forEach(r=>{
      if(normalizeLabel_(r.status||'Active')==='inactive')return;
      const chapter=String(r.chapter||r.chapter_name||'').trim();
      if(chapter)names[normalizeLabel_(chapter)]=chapter;
    });
  }catch(e){}
  return names;
}

function mathsIsCalculationQuestionV12_(q,calcIds){
  if(!q)return true;
  const id=String(q.question_id||'').trim(),chapter=normalizeLabel_(q.chapter||''),template=String(q.template_group||'').trim().toUpperCase();
  if(calcIds&&calcIds[id])return true;
  if(/^CT\d{8}$/i.test(id)||/^CALC_DAY/.test(template)||template==='CALC_TRAINING')return true;
  return chapter==='calculation training'||chapter==='calculation memory';
}

function mathsIsDailyQuestionV12_(q,ctx){
  if(!q||!active_(q))return false;
  ctx=ctx||{};
  const id=String(q.question_id||'').trim(),chapter=normalizeLabel_(q.chapter||''),topic=normalizeLabel_(q.topic||''),type=normalizeLabel_(q.card_type||'');
  if(!id||!ctx.lectureChapters||!ctx.lectureChapters[chapter])return false;
  if(ctx.calcIds&&ctx.calcIds[id])return false;
  if(ctx.mockIds&&ctx.mockIds[id])return false;
  if(mathsIsCalculationQuestionV12_(q,ctx.calcIds))return false;
  if(topic==='concepts')return false;
  if(['formula','concept','memory','pattern','trap'].includes(type))return false;
  return true;
}

function mathsDailyContextV12_(){return {calcIds:mathsCalculationIdsV12_(),mockIds:mathsMockIdsV12_(),lectureChapters:mathsDailyLectureChapterNamesV12_()}}
function mathsDailyEligibleV12_(){return mathsAcademicQuestionsV14_()}

function mathsDailySessionsV12_(){
  return sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>normalizeLabel_(r.mode)==='daily').map(r=>{
    const p=json_(r.params_json,{});return {row:r,day:Number(p.planDay||0),params:p};
  }).filter(x=>x.day>0).sort((a,b)=>dateMs_(b.row.updated_at)-dateMs_(a.row.updated_at));
}

function mathsDailySessionForDayV12_(day){return mathsDailyCanonicalSessionV20_(mathsDailySessionsV12_(),day)}
function mathsSessionQuestionIdsV12_(row){return new Set(json_((row&&row.question_ids_json)||'[]',[]).map(String))}
function mathsPreviousDailyIdsV12_(day){const prev=mathsDailySessionForDayV12_(Number(day)-1);return prev?mathsSessionQuestionIdsV12_(prev.row):new Set()}

function mathsRecentPracticeIdsV12_(){
  const rows=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>['daily','practice_more'].includes(normalizeLabel_(r.mode))).sort((a,b)=>dateMs_(b.updated_at)-dateMs_(a.updated_at)).slice(0,2);
  const ids=new Set();rows.forEach(r=>mathsSessionQuestionIdsV12_(r).forEach(id=>ids.add(id)));return ids;
}

function mathsDailyScoreV12_(q,state,recentIds){
  const profiles=mathsAttemptProfileMapV20_(false),day=mathsStudyClockV12_().day,lastDaily=mathsLastDailyDayByIdV20_(mathsDailySessionsV12_());let score=mathsDailyScoreV20_(q,state,profiles,day,lastDaily);
  if(recentIds&&recentIds.has(String(q.question_id)))score-=80000;return score;
}

function mathsAdaptiveDailyPoolV12_(count,recentIds,studyDay){
  const state=mathsStateMapV9_(),profiles=mathsAttemptProfileMapV20_(false),sessions=mathsDailySessionsV12_(),day=Math.max(1,Number(studyDay||mathsStudyClockV12_().day)),size=Math.min(Math.max(1,Number(count||MATHS_DAILY_DEFAULT_SIZE)),mathsDailyEligibleV12_().length),options={size:size,newQuota:Number(getSetting_('daily_new_quota',MATHS_DAILY_NEW_QUOTA_V20)||MATHS_DAILY_NEW_QUOTA_V20),difficultRotationDays:Number(getSetting_('difficult_rotation_days',MATHS_DIFFICULT_ROTATION_DAYS_V20)||MATHS_DIFFICULT_ROTATION_DAYS_V20),newWindowDays:Number(getSetting_('new_content_window_days',MATHS_NEW_WINDOW_DAYS)||MATHS_NEW_WINDOW_DAYS)},eligible=mathsDailyEligibleV12_();
  if(recentIds&&recentIds.size){const fresh=eligible.filter(q=>!recentIds.has(String(q.question_id))),fallback=eligible.filter(q=>recentIds.has(String(q.question_id)));let picked=mathsSelectDailyFromContextV20_(fresh,state,profiles,sessions,day,options);if(picked.length<size)picked=uniqueQuestions_(picked.concat(mathsSelectDailyFromContextV20_(fallback,state,profiles,sessions,day,Object.assign({},options,{size:size-picked.length,newQuota:0}))));return picked.slice(0,size)}
  return mathsSelectDailyFromContextV20_(eligible,state,profiles,sessions,day,options);
}

function mathsDailyCompositionV12_(pool,state,day){
  state=state||mathsStateMapV9_();return mathsDailyCompositionV20_(pool,state,mathsAttemptProfileMapV20_(false),Math.max(1,Number(day||mathsStudyClockV12_().day)),mathsDailySessionsV12_());
}

function mathsMakeDailySessionV12_(pool,day,mode,title,request){
  const state=mathsStateMapV9_(),sessionId=Utilities.getUuid(),composition=mathsDailyCompositionV12_(pool,state,day),params=Object.assign({},request||{},{planDay:Number(day),planChapter:'Mixed Revision',adaptiveDailyV12:true,dailyVersion:MATHS_DAILY_VERSION,dailyComposition:composition});
  const payload=mathsAvoidRepeatOptionV9_(sessionPayload_(sessionId,pool,state,title,mode,0,null),state);payload.planDay=Number(day);payload.planChapter='Mixed Revision';payload.dailyComposition=composition;
  saveSession_({session_id:sessionId,mode,title,question_ids_json:JSON.stringify(pool.map(q=>q.question_id)),current_index:0,updated_at:new Date(),completed:false,params_json:JSON.stringify(params),rendered_questions_json:JSON.stringify(payload.questions||[])});
  return payload;
}

function startMathsDailyV12(request){
  ensureMathsInfrastructure_();request=Object.assign({},request||{});
  return mathsLockedV9_(()=>{const clock=mathsStudyClockV12_(),day=Math.max(1,Number(request.planDay||clock.day)),existing=mathsDailySessionForDayV12_(day);
    if(existing){if(!bool_(existing.row.completed))return resumeSession(String(existing.row.session_id));return {ok:false,dailyComplete:true,message:'Day '+day+' is complete. Use Practice More for another mixed set.'}}
    const pool=mathsAdaptiveDailyPoolV12_(MATHS_DAILY_DEFAULT_SIZE,null,day);if(!pool.length)return {ok:false,message:'No eligible Daily questions are available.'};
    return mathsMakeDailySessionV12_(pool,day,'daily','Day '+day+' · Mixed Revision',request);
  });
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
  for(let d=Number(currentDay)-1;d>=1&&out.length<5;d--){const x=mathsDailySessionForDayV12_(d);if(x&&bool_(x.row.completed))continue;out.push({day:d,chapter:'Mixed Revision',status:x?'In progress':'Not attempted',chapterTotal:x?json_(x.row.question_ids_json,[]).length:MATHS_DAILY_DEFAULT_SIZE,chapterRemaining:x?Math.max(0,json_(x.row.question_ids_json,[]).length-mathsSessionAttemptCountV12_(x.row.session_id)):MATHS_DAILY_DEFAULT_SIZE})}
  return out;
}

function getMathsHomeV12(){
  const snap=typeof readMathsProgressSnapshotV10==='function'?readMathsProgressSnapshotV10():getMathsSnapshotV9(false),schedule=mathsStudyClockV12_(),baseTarget=MATHS_DAILY_DEFAULT_SIZE,found=mathsDailySessionForDayV12_(schedule.day),dailyRow=found&&found.row||null,params=found&&found.params||{},sessionIds=dailyRow?json_(dailyRow.question_ids_json,[]):[],target=sessionIds.length||baseTarget,done=dailyRow?(bool_(dailyRow.completed)?target:Math.min(target,mathsSessionAttemptCountV12_(dailyRow.session_id))):0,resume=getSafeResumeSessionV9_(),state=mathsStateMapV9_(),newCount=mathsNewPoolV9_(mathsStudyQuestionsV9_(),state).length,conceptCount=Object.keys(mathsConceptIdsV9_()).length;
  return {version:mathsVersionV9_(),generatedAt:new Date().toISOString(),schedule,daily:{target,done,left:Math.max(0,target-done),completed:!!(dailyRow&&bool_(dailyRow.completed)),sessionId:dailyRow?String(dailyRow.session_id||''):'',composition:params.dailyComposition||null,adaptive:true},resume,resumeIsDaily:!!(resume&&dailyRow&&String(resume.sessionId)===String(dailyRow.session_id)),newCount,starred:Number(snap.overall&&snap.overall.starred||0),difficult:Number(snap.overall&&snap.overall.difficult||0),concepts:conceptCount,pending:mathsPendingDailyV12_(schedule.day),overall:snap.overall||{}};
}

function auditMathsDailyV12(){
  const ctx=mathsDailyContextV12_(),pool=mathsDailyEligibleV12_(),byChapter={};pool.forEach(q=>byChapter[String(q.chapter||'Other')]=Number(byChapter[String(q.chapter||'Other')]||0)+1);
  return {version:MATHS_DAILY_VERSION,studyDay:mathsStudyClockV12_(),eligible:pool.length,chapters:byChapter,calculationLeak:pool.filter(q=>mathsIsCalculationQuestionV12_(q,ctx.calcIds)).length,mockLeak:pool.filter(q=>ctx.mockIds[String(q.question_id)]).length,conceptLeak:pool.filter(q=>normalizeLabel_(q.topic||'')==='concepts').length,miscLeak:pool.filter(q=>['fraction patterns','triplets'].includes(normalizeLabel_(q.chapter||''))).length,generatedLeak:pool.filter(q=>String(q.question_id||'').toUpperCase().startsWith('GEN')).length};
}
