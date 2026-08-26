const MATHS_QUIZ_LIFECYCLE_VERSION='v15';

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
    const id=validQuestionId_(payload.questionId);
    const sessionId=String(payload.sessionId||'').trim();
    const result=String(payload.result||'seen');
    const responseSec=Math.max(0,Number(payload.responseSec||0));
    const variantType=String(payload.variantType||'');

    if(sessionId){
      const existing=sheetObjects_(getSheet_(MATHS.SHEETS.ATTEMPTS)).find(r=>String(r.session_id||'')===sessionId&&String(r.question_id||'').trim()===id);
      if(existing){
        mathsAdvanceSessionProgressV15_(sessionId,payload.nextIndex);
        const old=mathsStateMapV9_()[id]||{};
        return {ok:true,deduped:true,mastered:isMastered_(old),marked:isMarked_(old)};
      }
    }

    const st=upsertState_(id,{attempt:true,mastered:!!payload.mastered,result:result,responseSec:responseSec,lastVariant:variantType,lastCorrectOption:String(payload.correctOption||'')});
    getSheet_(MATHS.SHEETS.ATTEMPTS).appendRow([Utilities.getUuid(),new Date(),id,result,responseSec,String(payload.mode||''),sessionId,!!st.mastered,!!st.marked,variantType]);
    if(sessionId)mathsAdvanceSessionProgressV15_(sessionId,payload.nextIndex);
    bumpMathsVersionV9_();
    return {ok:true,deduped:false,mastered:!!st.mastered,marked:!!st.marked};
  });
}

function finishSessionV15(sessionId){
  return finishSession(sessionId);
}
