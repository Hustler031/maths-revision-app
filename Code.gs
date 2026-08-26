const MATHS = Object.freeze({
  TITLE: 'Maths Revision',
  SHEETS: {QUESTIONS:'Questions',STATE:'State',ATTEMPTS:'Attempts',SESSIONS:'Sessions',NOTES:'Notes',SETTINGS:'Settings',GENERATED:'Generated_Practice',PLAN:'Chapter_Plan',DEMAND_SETS:'Demand_Sets'},
  DEFAULTS:{daily_chapter_size:20,daily_reinforcement_size:0,practice_more_size:20,current_day:1,today_chapter:'Coordinate Geometry',mastered_excluded_daily:true,marked_reinforcement_enabled:true,study_timezone:'Asia/Kolkata',plan_start_date:'2026-08-18'},
  CALC_SET_ID:'CALC_TRAINING'
});
function doGet(){ensureMathsInfrastructure_();let html=HtmlService.createHtmlOutputFromFile('Index').getContent();html=html.replace('<meta name="viewport" content="width=device-width, initial-scale=1">','<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');html=html.replace('*{box-sizing:border-box}html{scroll-behavior:smooth;width:100%;max-width:100%;overflow-x:hidden}body{margin:0;width:100%;max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;','*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;');html=html.replace('.app{width:100%;max-width:820px;','.app{max-width:820px;');html=html.replace('.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:820px;','.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(820px,100%);');html=html.replace('.quiz-dock{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:820px;','.quiz-dock{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(820px,100%);');html=html.replace('</body>',demandUiPatch_()+chapterGroupsUiPatch_()+completePracticeUiPatch_()+dailyLifecycleFixUi_()+'</body>');return HtmlService.createHtmlOutput(html).setTitle(MATHS.TITLE).addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);}
function setupMathsRevision(){ensureMathsInfrastructure_();return getAppBootstrap();}
function getAppBootstrap(){return getAppBootstrapV9();}
function getSafeResumeSession_(){return getSafeResumeSessionV9_();}

function selectDemandSetPool_(ids,map,state,request,setName){
  let pool=(ids||[]).map(id=>map[String(id)]).filter(q=>q&&active_(q));
  if(request.demandChapter)pool=pool.filter(q=>same_(q.chapter,request.demandChapter));
  if(request.calculativeOnly)pool=pool.filter(isCalculativeDemandQuestion_);
  const practiceMode=String(request.practiceMode||'all').toLowerCase();
  const count=Math.max(1,Number(request.count||20));
  if(practiceMode!=='all')pool=pool.filter(q=>!isMastered_(state[String(q.question_id)]));
  if(practiceMode==='weak')pool=mathsWeakRankV9_(pool,state).slice(0,Math.min(count,pool.length));
  else if(practiceMode==='random')pool=shuffle_(pool).slice(0,Math.min(count,pool.length));
  else pool=shuffle_(pool);
  const scope=request.calculativeOnly?'Calculative':request.demandChapter?String(request.demandChapter):'';
  const suffix=practiceMode==='weak'?'Weak Practice':practiceMode==='random'?'Random Practice':'Practice All';
  return {pool:pool,title:String(setName||'Demand Set')+(scope?' · '+scope:'')+' · '+suffix};
}

function startQuiz(request){
  ensureMathsInfrastructure_();request=request||{};const mode=String(request.mode||'daily'),all=mathsStudyQuestionsV9_(),study=mathsAcademicQuestionsV14_(),generated=getGeneratedQuestions_().filter(active_),state=mathsStateMapV9_();let pool=[],title=MATHS.TITLE,calcMeta=null,planDay=null,planChapter='',majorTopic='';
  if(mode==='daily'){
    const scheduled=getScheduledPlan_(),requestedDay=Number(request.planDay||scheduled.day),entry=getPlanEntry_(requestedDay)||getPlanEntry_(scheduled.day);if(!entry)return {ok:false,message:'No scheduled lecture chapter yet.'};
    planDay=Number(entry.day);planChapter=String(entry.chapter||'');const size=Math.max(1,Number(entry.targetPerDay||getSetting_('daily_chapter_size',20)||20)),reinforcementSize=Math.max(0,Number(getSetting_('daily_reinforcement_size',0)||0));
    const chapterPool=study.filter(q=>chapterMatchesPlan_(q.chapter,planChapter)&&rotationTier_(q)==='Core'&&!isMastered_(state[String(q.question_id)])),fresh=shuffle_(chapterPool.filter(q=>Number((state[String(q.question_id)]||{}).attempts||0)===0)),seen=shuffle_(chapterPool.filter(q=>Number((state[String(q.question_id)]||{}).attempts||0)>0));
    pool=fresh.slice(0,size);if(pool.length<size)pool=uniqueQuestions_(pool.concat(seen.slice(0,size-pool.length)));
    if(reinforcementSize>0&&bool_(getSetting_('marked_reinforcement_enabled',true))){const marked=study.filter(q=>!chapterMatchesPlan_(q.chapter,planChapter)&&isMarked_(state[String(q.question_id)])&&!isMastered_(state[String(q.question_id)])),continuous=study.filter(q=>rotationTier_(q)==='Continuous'&&!isMastered_(state[String(q.question_id)]));pool=uniqueQuestions_(pool.concat(shuffle_(marked.concat(continuous)).slice(0,reinforcementSize)))}
    title='Day '+planDay+' · '+planChapter;request.planDay=planDay;request.planChapter=planChapter;
  }
  if(mode==='practice_more'){const chapter=String(request.chapter||getScheduledPlan_().chapter||''),size=Math.max(1,Number(request.count||getSetting_('practice_more_size',20)));pool=shuffle_(study.filter(q=>chapterMatchesPlan_(q.chapter,chapter)&&!isMastered_(state[String(q.question_id)]))).slice(0,size);title='Practice More · '+chapter;}
  if(['chapter','chapter_complete','chapter_random','chapter_weak','topic_complete','topic_random','topic_weak'].includes(mode)){const selected=selectPracticePoolV9_(all,state,request,mode);pool=selected.pool;title=selected.title;majorTopic=selected.majorTopic||'';}
  if(['group_complete','group_random','group_weak'].includes(mode)){const selected=selectGroupPracticeV9_(all,generated,state,request,mode);pool=selected.pool;title=selected.title;}
  if(mode==='library'){const cluster=String(request.cluster||'Formula');pool=filterLibraryV9_(all,state,cluster);title='Library · '+cluster;}
  if(mode==='ondemand'){pool=filterOnDemandV9_(all,state,request);const count=Math.max(1,Number(request.count||20));pool=shuffle_(pool).slice(0,count);title='On Demand'+(request.chapter?' · '+request.chapter:'');}
  if(mode==='generated'){pool=filterOnDemandV9_(generated,state,request);const count=Math.max(1,Number(request.count||20));pool=weightedGeneratedSample_(pool,state,count,request);title=request.title?String(request.title):'Quick Practice';}
  if(mode==='demand_set'){const setId=String(request.setId||''),set=getDemandSetById_(setId);if(!set)return {ok:false,message:'Saved demand set not found.'};const ids=json_(set.question_ids_json,[]),map=mathsQuestionMapV9_();if(setId===MATHS.CALC_SET_ID){const selection=selectCalculationTraining_(ids,map,state,request);pool=selection.pool;title=selection.title;calcMeta=selection.meta;}else{const selection=selectDemandSetPool_(ids,map,state,request,set.set_name);pool=selection.pool;title=selection.title;}}
  if(!pool.length)return {ok:false,message:'No eligible questions found for this selection.'};
  const sessionId=Utilities.getUuid(),payload=mathsAvoidRepeatOptionV9_(sessionPayload_(sessionId,pool,state,title,mode,0,calcMeta),state);payload.planDay=planDay;payload.planChapter=planChapter;payload.majorTopic=majorTopic;
  saveSession_({session_id:sessionId,mode:mode,title:title,question_ids_json:JSON.stringify(pool.map(q=>q.question_id)),current_index:0,updated_at:new Date(),completed:false,params_json:JSON.stringify(request)});return payload;
}
function resumeSession(sessionId){ensureMathsInfrastructure_();const s=getSessionById_(String(sessionId||''));if(!s)return {ok:false,message:'Saved session not found.'};const request=json_(s.params_json,{});let calcMeta=null;if(String(s.mode||'')==='demand_set'&&String(request.setId||'')===MATHS.CALC_SET_ID){const set=getDemandSetById_(MATHS.CALC_SET_ID);if(set)calcMeta=buildCalculationMeta_(json_(set.question_ids_json,[]),request)}const map=mathsQuestionMapV9_(),ids=json_(s.question_ids_json,[]),list=ids.map(id=>map[String(id)]).filter(Boolean),state=mathsStateMapV9_(),payload=mathsAvoidRepeatOptionV9_(sessionPayload_(s.session_id,list,state,s.title||'Resume',s.mode||'',Number(s.current_index||0),calcMeta),state);payload.planDay=Number(request.planDay||0)||null;payload.planChapter=String(request.planChapter||'');payload.majorTopic=resolveRequestedMajorTopic_(request)||'';return payload;}
function submitRecall(payload){
  ensureMathsInfrastructure_();payload=payload||{};return mathsLockedV9_(()=>{const id=validQuestionId_(payload.questionId),result=String(payload.result||'seen'),responseSec=Math.max(0,Number(payload.responseSec||0)),variantType=String(payload.variantType||''),st=upsertState_(id,{attempt:true,mastered:!!payload.mastered,result:result,responseSec:responseSec,lastVariant:variantType,lastCorrectOption:String(payload.correctOption||'')});getSheet_(MATHS.SHEETS.ATTEMPTS).appendRow([Utilities.getUuid(),new Date(),id,result,responseSec,String(payload.mode||''),String(payload.sessionId||''),!!st.mastered,!!st.marked]);if(payload.sessionId)updateSessionProgress_(String(payload.sessionId),Number(payload.nextIndex||0),false);bumpMathsVersionV9_();return {ok:true,mastered:!!st.mastered,marked:!!st.marked}})}
function setMastered(questionId,mastered){return mathsLockedV9_(()=>{ensureMathsInfrastructure_();const id=validQuestionId_(questionId),st=upsertState_(id,{mastered:!!mastered});bumpMathsVersionV9_();return {mastered:!!st.mastered}})}
function toggleMarked(questionId){return mathsLockedV9_(()=>{ensureMathsInfrastructure_();const id=validQuestionId_(questionId),current=mathsStateMapV9_()[id],st=upsertState_(id,{marked:!isMarked_(current)});bumpMathsVersionV9_();return {marked:!!st.marked}})}
function saveNote(questionId,note){ensureMathsInfrastructure_();const id=validQuestionId_(questionId),sh=getSheet_(MATHS.SHEETS.NOTES),rows=sheetObjects_(sh),found=rows.find(r=>String(r.question_id)===id);if(found)sh.getRange(found.__row,2,1,2).setValues([[String(note||''),new Date()]]);else sh.appendRow([id,String(note||''),new Date(),false]);return {ok:true,note:String(note||'')};}
function finishSession(sessionId){ensureMathsInfrastructure_();const id=String(sessionId||''),session=getSessionById_(id);if(!session)return {ok:false,message:'Session not found.'};const target=Array.from(new Set(json_(session.question_ids_json,[]).map(String).filter(Boolean))).length,done=mathsSessionAttemptCountV12_(id);if(done<target){updateSessionProgress_(id,Math.max(0,done),false);return {ok:false,incomplete:true,done:done,target:target,message:'Quiz is '+done+'/'+target+'. Finish after every question is durably saved.'};}updateSessionProgress_(id,999999,true);bumpMathsVersionV9_();return {ok:true,dashboard:mathsDashboardV9_()};}
