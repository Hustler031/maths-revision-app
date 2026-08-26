const MATHS_QUIZ_LIFECYCLE_VERSION='v20';

function mathsRequireQuestionV20_(questionId){
  const id=validQuestionId_(questionId),q=mathsQuestionMapV9_()[id];
  if(!q||!active_(q)||!mathsRuntimeQuestionValidV20_(q))throw new Error('Question is missing, inactive, or malformed: '+id);
  return q;
}

function mathsRequireSessionV20_(sessionId){
  const id=String(sessionId||'').trim();if(!id)throw new Error('Missing session ID.');
  const session=getSessionById_(id);if(!session)throw new Error('Session not found.');
  const ids=json_(session.question_ids_json,[]).map(String).filter(Boolean);if(!ids.length)throw new Error('Session has no questions.');
  return {id:id,row:session,ids:ids,rendered:json_(session.rendered_questions_json,[])};
}

function mathsRequireQuestionContextV20_(questionId,sessionId){
  const q=mathsRequireQuestionV20_(questionId),sid=String(sessionId||'').trim();
  if(sid){const ctx=mathsRequireSessionV20_(sid);if(ctx.ids.indexOf(String(q.question_id))<0)throw new Error('Question does not belong to this session.');}
  return q;
}

function mathsValidateAttemptPayloadV20_(payload,session,questionMap){
  payload=payload||{};const id=validQuestionId_(payload.questionId),ctx=session&&session.row?session:{row:session,ids:json_(session&&session.question_ids_json,[]).map(String),rendered:json_(session&&session.rendered_questions_json,[])},q=(questionMap||{})[id];
  if(!q||!active_(q)||!mathsRuntimeQuestionValidV20_(q))throw new Error('Question is missing, inactive, or malformed: '+id);
  const index=(ctx.ids||[]).indexOf(id);if(index<0)throw new Error('Question does not belong to this session.');
  const result=normalizeLabel_(payload.result||'');if(!['correct','wrong','seen'].includes(result))throw new Error('Invalid recall result.');
  const rendered=(ctx.rendered||[]).find(x=>String(x.questionId||'')===id)||null,mode=String(rendered&&rendered.answerMode||'').toUpperCase(),selected=String(payload.selectedOption||'').toUpperCase(),keys=rendered&&Array.isArray(rendered.options)?rendered.options.map(o=>String(o.key||'').toUpperCase()):[];
  if(mode==='MCQ'&&!selected)throw new Error('Selected option is required for an MCQ question.');
  if(mode==='MCQ'&&selected&&keys.indexOf(selected)<0)throw new Error('Selected option is not valid for this question.');
  if(mode==='MCQ'&&selected){const expected=selected===String(rendered.correctOption||'').toUpperCase()?'correct':'wrong';if(result!==expected)throw new Error('Recall result does not match the selected option.');}
  if(mode==='REVEAL'&&result!=='seen')throw new Error('Reveal questions must be saved as seen.');
  const nextIndex=Math.max(0,Math.min(ctx.ids.length,Number(payload.nextIndex==null?index+1:payload.nextIndex)));
  return {id:id,index:index,result:result,nextIndex:nextIndex,responseSec:Math.max(0,Math.min(86400,Number(payload.responseSec||0))),variantType:String(rendered&&rendered.variantType||payload.variantType||''),correctOption:String(rendered&&rendered.correctOption||''),selectedOption:selected,clientAttemptKey:String(payload.clientAttemptKey||((session.id||ctx.row.session_id||'')+':'+id)),mode:String(ctx.row.mode||payload.mode||'')};
}

function mathsSessionAttemptsV20_(sessionId){
  return sheetObjects_(getSheet_(MATHS.SHEETS.ATTEMPTS)).filter(r=>String(r.session_id||'')===String(sessionId||'')).sort((a,b)=>dateMs_(a.timestamp)-dateMs_(b.timestamp));
}

function mathsHydrateRenderedQuestionsV20_(questions,attemptRows,state,conceptIds){
  const latest={};(attemptRows||[]).forEach(r=>latest[String(r.question_id||'')]=r);
  return (questions||[]).map(q=>{const x=Object.assign({},q),id=String(x.questionId||''),a=latest[id],s=(state||{})[id]||{};x.mastered=isMastered_(s);x.marked=isMarked_(s);x.important=isMarked_(s);x.difficult=bool_(s.difficult);x.inConcept=!!((conceptIds||{})[id]);if(a){x._attemptSaved=true;x._serverHydrated=true;x._revealed=true;x._savedResult=normalizeLabel_(a.result||'seen');if(x.answerMode==='MCQ'){x._answered=true;x._selected=String(a.selected_option||'').toUpperCase()}}return x});
}

function mathsAdvanceSessionProgressV15_(sessionId,nextIndex){
  const id=String(sessionId||'').trim();
  if(!id)return;
  const s=getSessionById_(id);
  if(!s||bool_(s.completed))return;
  const current=Math.max(0,Number(s.current_index||0));
  const next=Math.max(current,Math.max(0,Number(nextIndex||0)));
  updateSessionProgress_(id,next,false);
}

function submitRecallV15(payload){
  ensureMathsInfrastructure_();
  payload=payload||{};
  return mathsLockedV9_(()=>{
    const session=mathsRequireSessionV20_(payload.sessionId),v=mathsValidateAttemptPayloadV20_(payload,session,mathsQuestionMapV9_()),sessionId=session.id,id=v.id;
    const existing=mathsSessionAttemptsV20_(sessionId).find(r=>String(r.client_attempt_key||'')===v.clientAttemptKey||(String(r.question_id||'').trim()===id));
    if(existing){
      const old=mathsStateMapV9_()[id]||{};
      return {ok:true,deduped:true,mastered:isMastered_(old),marked:isMarked_(old),result:normalizeLabel_(existing.result||v.result),selectedOption:String(existing.selected_option||v.selectedOption||'')};
    }
    if(bool_(session.row.completed))throw new Error('Completed sessions cannot accept new attempts.');

    const st=upsertState_(id,{attempt:true,mastered:!!payload.mastered,result:v.result,responseSec:v.responseSec,lastVariant:v.variantType,lastCorrectOption:v.correctOption});
    appendSheetObject_(getSheet_(MATHS.SHEETS.ATTEMPTS),{attempt_id:Utilities.getUuid(),timestamp:new Date(),question_id:id,result:v.result,response_sec:v.responseSec,mode:v.mode,session_id:sessionId,mastered_after:!!st.mastered,marked_after:!!st.marked,variant_type:v.variantType,selected_option:v.selectedOption,question_index:v.index,client_attempt_key:v.clientAttemptKey});
    bumpMathsVersionV9_();
    return {ok:true,deduped:false,mastered:!!st.mastered,marked:!!st.marked,result:v.result,selectedOption:v.selectedOption};
  });
}

function finishSessionV15(sessionId){
  return finishSession(sessionId);
}
