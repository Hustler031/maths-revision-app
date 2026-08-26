function practiceResumeIdentity_(request){
  request=request||{};
  const mode=String(request.mode||'');
  if(mode==='chapter_complete')return 'chapter_complete|'+String(request.chapter||'').trim();
  if(mode==='topic_complete')return 'topic_complete|'+String(request.chapter||'').trim()+'|'+String(request.majorTopicKey||request.majorTopic||'').trim();
  if(mode==='group_complete'){
    const chapters=(request.chapters||[]).map(String).sort();
    return 'group_complete|'+String(request.groupName||'').trim()+'|'+String(request.source||'')+'|'+String(request.generatedChapter||'')+'|'+String(request.generatedTopic||'')+'|'+chapters.join('~');
  }
  if(mode==='demand_set'&&String(request.practiceMode||'all').toLowerCase()==='all'&&String(request.setId||'')!==MATHS.CALC_SET_ID){
    return 'demand_set|'+String(request.setId||'')+'|'+String(request.demandChapter||'')+'|'+(request.calculativeOnly?'calculative':'all');
  }
  return '';
}

function getPracticeCheckpoint(request){
  ensureMathsInfrastructure_();
  request=request||{};
  const wanted=practiceResumeIdentity_(request);
  if(!wanted)return {ok:true,hasProgress:false};
  const rows=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS))
    .filter(r=>r.session_id&&!bool_(r.completed))
    .sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
  for(const s of rows){
    const params=json_(s.params_json,{});
    if(practiceResumeIdentity_(params)!==wanted)continue;
    const ids=json_(s.question_ids_json,[]);
    if(!ids.length)continue;
    const index=Math.max(0,Math.min(Number(s.current_index||0),ids.length-1));
    return {ok:true,hasProgress:index>0,sessionId:String(s.session_id),currentIndex:index,resumeQuestion:index+1,total:ids.length,title:String(s.title||'Complete Practice')};
  }
  return {ok:true,hasProgress:false};
}

function saveSessionPosition(sessionId,index){
  return saveSessionPositionV3(sessionId,index);
}
