const MATHS = Object.freeze({
  TITLE: 'Maths Revision',
  SHEETS: {QUESTIONS:'Questions',STATE:'State',ATTEMPTS:'Attempts',SESSIONS:'Sessions',NOTES:'Notes',SETTINGS:'Settings',GENERATED:'Generated_Practice',PLAN:'Chapter_Plan',DEMAND_SETS:'Demand_Sets'},
  DEFAULTS:{daily_chapter_size:25,daily_new_quota:7,difficult_rotation_days:3,new_content_window_days:60,daily_reinforcement_size:0,practice_more_size:20,current_day:1,today_chapter:'Coordinate Geometry',mastered_excluded_daily:true,marked_reinforcement_enabled:true,study_timezone:'Asia/Kolkata',plan_start_date:'2026-08-18'},
  CALC_SET_ID:'CALC_TRAINING'
});
function doGet(){let html=HtmlService.createHtmlOutputFromFile('Index').getContent();html=html.replace('<meta name="viewport" content="width=device-width, initial-scale=1">','<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');html=html.replace('*{box-sizing:border-box}html{scroll-behavior:smooth;width:100%;max-width:100%;overflow-x:hidden}body{margin:0;width:100%;max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;','*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;');html=html.replace('.app{width:100%;max-width:820px;','.app{max-width:820px;');html=html.replace('.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:820px;','.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(820px,100%);');html=html.replace('.quiz-dock{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:820px;','.quiz-dock{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(820px,100%);');html=html.replace(/init\(\);\s*<\/script>\s*<\/body>/,'applyTheme();\n</script>\n</body>');html=html.replace('</body>',demandUiPatch_()+chapterGroupsUiPatch_()+completePracticeUiPatch_()+dailyLifecycleFixUi_()+'</body>');return HtmlService.createHtmlOutput(html).setTitle(MATHS.TITLE).addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);}
function setupMathsRevision(){ensureMathsInfrastructure_();return getAppBootstrap();}
function getAppBootstrap(){return getAppBootstrapV14();}
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
  ensureMathsInfrastructure_();request=request||{};const mode=String(request.mode||'daily'),focused={chapter:'all',chapter_complete:'all',chapter_random:'random',chapter_weak:'weak',topic_complete:'all',topic_random:'random',topic_weak:'weak',group_complete:'all',group_random:'random',group_weak:'weak'};
  if(mode==='daily')return startMathsDailyV12(request);
  if(mode==='practice_more')return startMathsPracticeMoreV12(request);
  if(Object.prototype.hasOwnProperty.call(focused,mode)){const scope=mode.indexOf('group_')===0?'group':mode.indexOf('topic_')===0?'topic':'chapter';return startMathsPracticeV14(Object.assign({},request,{scope:scope,kind:focused[mode]}));}
  const all=mathsStudyQuestionsV9_(),generated=getGeneratedQuestions_().filter(active_),state=mathsStateMapV9_();let pool=[],title=MATHS.TITLE,calcMeta=null,planDay=null,planChapter='',majorTopic='';
  if(mode==='library'){const cluster=String(request.cluster||'Formula');pool=filterLibraryV9_(all,state,cluster);title='Library · '+cluster;}
  if(mode==='ondemand'){pool=filterOnDemandV9_(all,state,request);const count=Math.max(1,Number(request.count||20));pool=shuffle_(pool).slice(0,count);title='On Demand'+(request.chapter?' · '+request.chapter:'');}
  if(mode==='generated'){pool=filterOnDemandV9_(generated,state,request);const count=Math.max(1,Number(request.count||20));pool=weightedGeneratedSample_(pool,state,count,request);title=request.title?String(request.title):'Quick Practice';}
  if(mode==='demand_set'){const setId=String(request.setId||''),set=getDemandSetById_(setId);if(!set)return {ok:false,message:'Saved demand set not found.'};const ids=json_(set.question_ids_json,[]),map=mathsQuestionMapV9_();if(setId===MATHS.CALC_SET_ID){const selection=selectCalculationTraining_(ids,map,state,request);pool=selection.pool;title=selection.title;calcMeta=selection.meta;}else{const selection=selectDemandSetPool_(ids,map,state,request,set.set_name);pool=selection.pool;title=selection.title;}}
  if(!pool.length)return {ok:false,message:'No eligible questions found for this selection.'};
  const sessionId=Utilities.getUuid(),payload=mathsAvoidRepeatOptionV9_(sessionPayload_(sessionId,pool,state,title,mode,0,calcMeta),state);payload.planDay=planDay;payload.planChapter=planChapter;payload.majorTopic=majorTopic;
  saveSession_({session_id:sessionId,mode:mode,title:title,question_ids_json:JSON.stringify(pool.map(q=>q.question_id)),current_index:0,updated_at:new Date(),completed:false,params_json:JSON.stringify(request),rendered_questions_json:JSON.stringify(payload.questions||[])});return payload;
}
function resumeSession(sessionId){
  ensureMathsInfrastructure_();const ctx=mathsRequireSessionV20_(sessionId),s=ctx.row,request=json_(s.params_json,{});let calcMeta=null;
  if(String(s.mode||'')==='demand_set'&&String(request.setId||'')===MATHS.CALC_SET_ID){const set=getDemandSetById_(MATHS.CALC_SET_ID);if(set)calcMeta=buildCalculationMeta_(json_(set.question_ids_json,[]),request)}
  const map=mathsQuestionMapV9_(),state=mathsStateMapV9_();let questions=ctx.rendered;
  if(!Array.isArray(questions)||!questions.length){const list=ctx.ids.map(id=>map[id]).filter(Boolean),fresh=mathsAvoidRepeatOptionV9_(sessionPayload_(s.session_id,list,state,s.title||'Resume',s.mode||'',Number(s.current_index||0),calcMeta),state);questions=fresh.questions||[];updateSheetObject_(getSheet_(MATHS.SHEETS.SESSIONS),s.__row,{rendered_questions_json:JSON.stringify(questions)});}
  questions=mathsHydrateRenderedQuestionsV20_(questions,mathsSessionAttemptsV20_(ctx.id),state,mathsConceptIdsV9_());
  return {ok:true,sessionId:ctx.id,title:String(s.title||'Resume'),mode:String(s.mode||''),currentIndex:Math.max(0,Math.min(Number(s.current_index||0),Math.max(0,questions.length-1))),total:questions.length,questions:questions,calcMeta:calcMeta||null,planDay:Number(request.planDay||0)||null,planChapter:String(request.planChapter||''),majorTopic:resolveRequestedMajorTopic_(request)||''};
}
function submitRecall(payload){return submitRecallV15(payload)}
function setMastered(questionId,mastered){return mathsLockedV9_(()=>{ensureMathsInfrastructure_();const q=mathsRequireQuestionV20_(questionId),st=upsertState_(q.question_id,{mastered:!!mastered});bumpMathsVersionV9_();return {mastered:!!st.mastered}})}
function toggleMarked(questionId){const r=toggleStarredV9(questionId,'');return {ok:!!r.ok,marked:!!r.important}}
function saveNote(questionId,note){ensureMathsInfrastructure_();return mathsLockedV9_(()=>{const q=mathsRequireQuestionV20_(questionId),id=String(q.question_id),sh=getSheet_(MATHS.SHEETS.NOTES),rows=sheetObjects_(sh),found=rows.find(r=>String(r.question_id)===id);if(found)updateSheetObject_(sh,found.__row,{note:String(note||''),updated_at:new Date()});else appendSheetObject_(sh,{question_id:id,note:String(note||''),updated_at:new Date(),pinned:false});return {ok:true,note:String(note||'')};});}
function finishSession(sessionId){ensureMathsInfrastructure_();return mathsLockedV9_(()=>{const ctx=mathsRequireSessionV20_(sessionId),id=ctx.id,target=Array.from(new Set(ctx.ids)).length,done=mathsSessionAttemptCountV12_(id);if(done<target){updateSessionProgress_(id,Math.max(0,done),false);return {ok:false,incomplete:true,done:done,target:target,message:'Quiz is '+done+'/'+target+'. Finish after every question is durably saved.'};}updateSessionProgress_(id,target,true);bumpMathsVersionV9_();return {ok:true,dashboard:mathsDashboardV9_()};})}
