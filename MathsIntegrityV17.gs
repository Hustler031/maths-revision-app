const MATHS_INTEGRITY_VERSION='v17';
const MATHS_EXTERNAL_FINGERPRINT_CACHE_SEC=20;
const MATHS_RESUME_MAX_AGE_MS=72*60*60*1000;

function mathsCanonicalSchemaV17_(){
  return {
    Questions:['Question_ID','Chapter','Topic','Subtopic','Card_Type','Prompt','Answer','Explanation','Memory_Cue','Difficulty','Marked_Default','Mastered_Default','Diagram_Type','Diagram_JSON','Source_File','Source_Page','Source_URL','Status','Answer_Mode','Option_A','Option_B','Option_C','Option_D','Correct_Option','Template_Group','Variant_Types','Rotation_Tier','Practice_Bank'],
    State:['Question_ID','Attempts','Mastered','Marked','Last_Attempt','Last_Result','Last_Response_Sec','Chapter','Topic','Subtopic','Last_Variant','Last_Correct_Option','Difficult'],
    Attempts:['Attempt_ID','Timestamp','Question_ID','Result','Response_Sec','Mode','Session_ID','Mastered_After','Marked_After','Variant_Type'],
    Sessions:['Session_ID','Mode','Title','Question_IDs_JSON','Current_Index','Updated_At','Completed','Params_JSON','Rendered_Questions_JSON'],
    Concepts:['Question_ID','Added_At','Study_Day','Chapter','Topic','Session_ID','Active'],
    Demand_Sets:['Set_ID','Set_Name','Description','Question_IDs_JSON','Status','Created_At'],
    Generated_Practice:['Question_ID','Chapter','Topic','Subtopic','Card_Type','Prompt','Answer','Explanation','Memory_Cue','Difficulty','Marked_Default','Mastered_Default','Diagram_Type','Diagram_JSON','Source_File','Source_Page','Source_URL','Status','Answer_Mode','Option_A','Option_B','Option_C','Option_D','Correct_Option','Template_Group','Variant_Types','Rotation_Tier'],
    Settings:['Key','Value'],
    Chapter_Plan:['Order','Chapter','Target_Per_Day','Status','Introduced','Mastered']
  };
}

function ensureMathsCanonicalSchemaV17_(){
  const ss=SpreadsheetApp.getActive(),schema=mathsCanonicalSchemaV17_();
  Object.keys(schema).forEach(name=>ensureSheet_(ss,name,schema[name]));
  return validateMathsCanonicalSchemaV17_();
}

function validateMathsCanonicalSchemaV17_(){
  const ss=SpreadsheetApp.getActive(),schema=mathsCanonicalSchemaV17_(),sheets={};let ok=true;
  Object.keys(schema).forEach(name=>{
    const sh=ss.getSheetByName(name),required=schema[name],actual=sh&&sh.getLastColumn()?sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(String):[];
    const missing=required.filter(h=>actual.indexOf(h)<0);if(!sh||missing.length)ok=false;
    sheets[name]={exists:!!sh,missing:missing,extra:actual.filter(h=>required.indexOf(h)<0)};
  });
  return {ok:ok,version:MATHS_INTEGRITY_VERSION,sheets:sheets};
}

function mathsVisibleDataFingerprintV17_(force){
  const cache=CacheService.getScriptCache(),key='maths:v17:visible-data-fingerprint';
  if(!force){const hit=cache.get(key);if(hit)return hit;}
  const ss=SpreadsheetApp.getActive(),names=['Questions','Concepts','Demand_Sets','Generated_Practice','Chapter_Plan'],parts=[];
  names.forEach(name=>{
    const sh=ss.getSheetByName(name);if(!sh){parts.push([name,'MISSING']);return;}
    const lr=sh.getLastRow(),lc=sh.getLastColumn();
    parts.push([name,lr,lc,lr&&lc?sh.getRange(1,1,lr,lc).getDisplayValues():[]]);
  });
  const raw=JSON.stringify(parts),digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw,Utilities.Charset.UTF_8);
  const fp=Utilities.base64EncodeWebSafe(digest).replace(/=+$/,'');
  try{cache.put(key,fp,MATHS_EXTERNAL_FINGERPRINT_CACHE_SEC)}catch(e){}
  return fp;
}

function mathsConceptRegistryReconcileV17_(){
  const qRows=getAllQuestions_(),qMap={},wanted={};
  qRows.forEach(q=>{const id=String(q.question_id||'').trim();if(!id)return;qMap[id]=q;if(active_(q)&&normalizeLabel_(q.practice_bank||'')==='concepts')wanted[id]=q;});
  const sh=ensureConceptsV4_(),rows=sheetObjects_(sh),activeRows={};
  rows.forEach(r=>{const id=String(r.question_id||'').trim();if(id&&(!Object.prototype.hasOwnProperty.call(r,'active')||bool_(r.active)))(activeRows[id]||(activeRows[id]=[])).push(r);});
  let added=0,deactivated=0;
  Object.keys(wanted).forEach(id=>{
    if(activeRows[id]&&activeRows[id].length)return;
    const q=wanted[id];sh.appendRow([id,new Date(),mathsV3Day_(),q.chapter||'',q.topic||'','external-sync-v17',true]);added++;
  });
  Object.keys(activeRows).forEach(id=>{
    const q=qMap[id];
    if(q&&active_(q)&&normalizeLabel_(q.practice_bank||'')==='concepts')return;
    activeRows[id].forEach(r=>{sh.getRange(r.__row,7).setValue(false);deactivated++;});
  });
  if(added||deactivated){try{CacheService.getScriptCache().remove('maths:v17:visible-data-fingerprint')}catch(e){}}
  return {added:added,deactivated:deactivated};
}

function syncMathsExternalDataV17(){
  ensureMathsCanonicalSchemaV17_();
  return mathsLockedV9_(()=>{
    const props=PropertiesService.getScriptProperties(),before=mathsVisibleDataFingerprintV17_(false),previous=String(props.getProperty('MATHS_VISIBLE_DATA_FINGERPRINT_V17')||'');
    let changed=!previous||previous!==before,conceptSync={added:0,deactivated:0};
    if(changed)conceptSync=mathsConceptRegistryReconcileV17_();
    const after=(conceptSync.added||conceptSync.deactivated)?mathsVisibleDataFingerprintV17_(true):before;
    let version=mathsVersionV9_();
    if(changed){version=bumpMathsVersionV9_();props.setProperty('MATHS_VISIBLE_DATA_FINGERPRINT_V17',after);}
    return {ok:true,changed:changed,version:String(version),fingerprint:after,conceptSync:conceptSync,generatedAt:new Date().toISOString()};
  });
}

function mathsResumeCandidateV17_(s,valid,currentDay,now){
  if(!s||!s.session_id||bool_(s.completed))return false;
  const ids=json_(s.question_ids_json,[]).map(String),index=Math.max(0,Number(s.current_index||0));
  if(!ids.length||index>=ids.length||!ids.slice(index).some(id=>valid.has(id)))return false;
  const updated=dateMs_(s.updated_at),age=updated?Math.max(0,now-updated):Number.POSITIVE_INFINITY,mode=normalizeLabel_(s.mode||''),params=json_(s.params_json,{});
  if(mode==='daily')return Number(params.planDay||0)===Number(currentDay||0)&&age<=7*24*60*60*1000;
  return age<=MATHS_RESUME_MAX_AGE_MS;
}

function getMathsResumePolicyV17(){
  const valid=new Set(Object.keys(mathsQuestionMapV9_())),currentDay=Number((getScheduledPlan_()||{}).day||0),now=Date.now();
  const rows=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>r.session_id&&!bool_(r.completed)).sort((a,b)=>dateMs_(b.updated_at)-dateMs_(a.updated_at));
  const selected=rows.find(s=>mathsResumeCandidateV17_(s,valid,currentDay,now))||null;
  const resume=selected?{sessionId:String(selected.session_id),title:String(selected.title||'Practice'),currentIndex:Math.max(0,Number(selected.current_index||0)),total:json_(selected.question_ids_json,[]).length,mode:selected.mode}:null;
  return {ok:true,resume:resume,ignoredStale:rows.filter(s=>!mathsResumeCandidateV17_(s,valid,currentDay,now)).length,currentDay:currentDay};
}

function getMathsStartupPayloadV17(){
  const sync=syncMathsExternalDataV17(),bootstrap=getAppBootstrapV14(),home=getMathsHomeV14(),policy=getMathsResumePolicyV17();
  home.resume=policy.resume;
  home.resumeIsDaily=!!(policy.resume&&home.daily&&String(policy.resume.sessionId)===String(home.daily.sessionId||''));
  return {ok:true,version:String(sync.version||home.version||bootstrap.version||''),cacheSchema:'academic-v14-cache1',compat:'v14',bootstrap:bootstrap,home:home,resumePolicy:policy,externalSync:sync,generatedAt:new Date().toISOString()};
}

function mathsDuplicateIdsV17_(rows,key){
  const seen={},dups={};(rows||[]).forEach(r=>{const id=String(r[key]||'').trim();if(!id)return;(seen[id]||(seen[id]=[])).push(Number(r.__row||0));});
  Object.keys(seen).forEach(id=>{if(seen[id].length>1)dups[id]=seen[id];});return dups;
}
function mathsOptionValueV17_(q,key){return String(q['option_'+String(key||'').toLowerCase()]||'').trim();}
function mathsSetExpectedV17_(setId,q){
  const id=String(q&&q.question_id||''),bank=normalizeLabel_(q&&q.practice_bank||''),template=String(q&&q.template_group||'').trim().toUpperCase();
  if(setId==='MOCK_QUESTIONS')return /^MQ\d+$/.test(id)&&bank==='mock'&&template==='MOCK_QUESTIONS';
  if(setId==='MOCK_FORMULA_REVISION')return /^MFR\d+$/.test(id)&&bank==='mock formula revision'&&template==='MOCK_FORMULA_REVISION';
  if(setId===MATHS.CALC_SET_ID)return /^CT\d+$/.test(id)&&bank==='calculation'&&template==='CALC_TRAINING';
  return true;
}

function auditMathsDataIntegrityV17(){
  const schema=validateMathsCanonicalSchemaV17_(),questions=sheetObjects_(getSheet_(MATHS.SHEETS.QUESTIONS)).filter(r=>String(r.question_id||'').trim()),generated=sheetObjects_(getSheet_(MATHS.SHEETS.GENERATED)).filter(r=>String(r.question_id||'').trim()),allRows=questions.concat(generated),qById={};
  allRows.forEach(q=>{const id=String(q.question_id||'').trim();if(id&&!qById[id])qById[id]=q;});
  const duplicateQuestionIds=mathsDuplicateIdsV17_(questions,'question_id'),conceptRows=sheetObjects_(ensureConceptsV4_()).filter(r=>String(r.question_id||'').trim()),duplicateConceptRegistryIds=mathsDuplicateIdsV17_(conceptRows,'question_id'),activeConceptRows=conceptRows.filter(r=>!Object.prototype.hasOwnProperty.call(r,'active')||bool_(r.active)),duplicateActiveConceptIds=mathsDuplicateIdsV17_(activeConceptRows,'question_id'),activeConceptSet={};
  activeConceptRows.forEach(r=>activeConceptSet[String(r.question_id).trim()]=true);
  const activeConceptQuestions=questions.filter(q=>active_(q)&&normalizeLabel_(q.practice_bank||'')==='concepts'),conceptQuestionMissingRegistry=activeConceptQuestions.filter(q=>!activeConceptSet[String(q.question_id)]).map(q=>String(q.question_id)),registryMissingQuestion=activeConceptRows.filter(r=>!qById[String(r.question_id)]).map(r=>String(r.question_id)),inactiveConceptMismatch=activeConceptRows.filter(r=>{const q=qById[String(r.question_id)];return q&&(!active_(q)||normalizeLabel_(q.practice_bank||'')!=='concepts');}).map(r=>String(r.question_id));

  const invalidStatus=[],missingPracticeBank=[],answerModeMismatch=[],invalidCorrectOption=[],blankCorrectOption=[],answerOptionMismatch=[],malformedRows=[];
  questions.forEach(q=>{
    const id=String(q.question_id||'').trim(),status=normalizeLabel_(q.status||''),mode=String(q.answer_mode||'').trim().toUpperCase(),bank=normalizeLabel_(q.practice_bank||''),correct=String(q.correct_option||'').trim().toUpperCase();
    if(!['active','inactive'].includes(status))invalidStatus.push(id);
    if(active_(q)&&!bank)missingPracticeBank.push(id);
    if(bank==='mock formula revision'&&mode!=='REVEAL')answerModeMismatch.push(id);
    if(mode==='REVEAL'&&!String(q.answer||'').trim())answerModeMismatch.push(id);
    if(mode==='MCQ'){
      if(!['A','B','C','D'].includes(correct))invalidCorrectOption.push(id);
      else if(!mathsOptionValueV17_(q,correct))blankCorrectOption.push(id);
      else if(String(q.answer||'').trim()&&normalizeLabel_(q.answer)!==normalizeLabel_(mathsOptionValueV17_(q,correct)))answerOptionMismatch.push(id);
    } else if(!mode&&(['A','B','C','D'].some(k=>mathsOptionValueV17_(q,k))||correct))answerModeMismatch.push(id);
    if(['active','inactive','reveal','mcq'].includes(normalizeLabel_(q.source_url||''))||['active','inactive'].includes(normalizeLabel_(q.answer_mode||''))||['reveal','mcq'].includes(normalizeLabel_(q.status||'')))malformedRows.push(id);
  });

  const demandRows=sheetObjects_(getSheet_(MATHS.SHEETS.DEMAND_SETS)).filter(r=>r.set_id&&normalizeLabel_(r.status||'Active')!=='inactive'),demandSets={};
  demandRows.forEach(r=>{
    const setId=String(r.set_id),ids=json_(r.question_ids_json,null),badJson=!Array.isArray(ids);ids=Array.isArray(ids)?ids.map(String):[];const seen={},duplicates=[];ids.forEach(id=>{seen[id]=(seen[id]||0)+1;if(seen[id]===2)duplicates.push(id);});
    const missing=ids.filter(id=>!qById[id]),inactive=ids.filter(id=>qById[id]&&!active_(qById[id])),wrongCollection=ids.filter(id=>qById[id]&&!mathsSetExpectedV17_(setId,qById[id]));
    demandSets[setId]={count:ids.length,badJson:badJson,duplicateIds:duplicates,missingIds:missing,inactiveIds:inactive,wrongCollectionIds:wrongCollection,ok:!badJson&&!duplicates.length&&!missing.length&&!inactive.length&&!wrongCollection.length};
  });

  const stateRows=sheetObjects_(getSheet_(MATHS.SHEETS.STATE)).filter(r=>r.question_id),orphanState=stateRows.filter(r=>!qById[String(r.question_id)]).map(r=>String(r.question_id)),duplicateStateIds=mathsDuplicateIdsV17_(stateRows,'question_id'),sessionRows=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>r.session_id&&!bool_(r.completed)),orphanActiveSessions=[];
  sessionRows.forEach(s=>{const missing=json_(s.question_ids_json,[]).map(String).filter(id=>!qById[id]);if(missing.length)orphanActiveSessions.push({sessionId:String(s.session_id),missingIds:missing});});
  const academic=typeof auditMathsFocusedPracticeV14==='function'?auditMathsFocusedPracticeV14():{practiceBankLeak:null,mockLeak:null,calculationLeak:null,conceptLeak:null};
  const circleConceptIds=activeConceptQuestions.filter(q=>chapterMatchesPlan_(q.chapter,'Geometry')&&normalizeLabel_(q.topic||'')==='circle').map(q=>String(q.question_id)).filter(id=>/^CIRC\d+$/.test(id)),circleAcademicIds=questions.filter(q=>active_(q)&&normalizeLabel_(q.practice_bank||'')==='academic'&&chapterMatchesPlan_(q.chapter,'Geometry')&&normalizeLabel_(q.topic||'')==='circle'&&/^CIRQ\d+$/.test(String(q.question_id))).map(q=>String(q.question_id));
  const mfrRepairIds=['MFR035','MFR036','MFR037','MFR038','MFR039','MFR040','MFR041'],mfrRepairOk=mfrRepairIds.filter(id=>{const q=qById[id];return q&&active_(q)&&String(q.answer_mode||'').toUpperCase()==='REVEAL'&&normalizeLabel_(q.practice_bank||'')==='mock formula revision';});
  const criticalCount=Object.keys(duplicateQuestionIds).length+Object.keys(duplicateActiveConceptIds).length+conceptQuestionMissingRegistry.length+registryMissingQuestion.length+inactiveConceptMismatch.length+invalidStatus.length+missingPracticeBank.length+answerModeMismatch.length+invalidCorrectOption.length+blankCorrectOption.length+malformedRows.length+orphanState.length+orphanActiveSessions.length+Object.keys(duplicateStateIds).length+Object.values(demandSets).filter(x=>!x.ok).length+Number(academic.practiceBankLeak||0)+Number(academic.mockLeak||0)+Number(academic.calculationLeak||0)+Number(academic.conceptLeak||0);
  return {ok:schema.ok&&criticalCount===0,version:MATHS_INTEGRITY_VERSION,generatedAt:new Date().toISOString(),schema:schema,duplicateQuestionIds:duplicateQuestionIds,duplicateQuestionIdCount:Object.keys(duplicateQuestionIds).length,duplicateConceptRegistryIds:duplicateConceptRegistryIds,duplicateActiveConceptIds:duplicateActiveConceptIds,conceptQuestionMissingRegistry:conceptQuestionMissingRegistry,registryMissingQuestion:registryMissingQuestion,inactiveConceptMismatch:inactiveConceptMismatch,invalidStatus:invalidStatus,missingPracticeBank:missingPracticeBank,answerModeMismatch:Array.from(new Set(answerModeMismatch)),invalidCorrectOption:invalidCorrectOption,blankCorrectOption:blankCorrectOption,answerOptionMismatch:answerOptionMismatch,malformedRows:malformedRows,demandSets:demandSets,orphanState:orphanState,duplicateStateIds:duplicateStateIds,orphanActiveSessions:orphanActiveSessions,academic:academic,circleConceptCount:new Set(circleConceptIds).size,circleAcademicCount:new Set(circleAcademicIds).size,mfrRepairOk:mfrRepairOk,mfrRepairCount:mfrRepairOk.length,criticalCount:criticalCount};
}

function getMathsRepairStatusV17(){
  const audit=auditMathsDataIntegrityV17_();
  return {ok:audit.ok,version:MATHS_INTEGRITY_VERSION,cache:syncMathsExternalDataV17(),resume:getMathsResumePolicyV17(),audit:audit};
}
