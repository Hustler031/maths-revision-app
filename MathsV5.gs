function mathsV5Pool_(request){
  request=request||{};
  const scope=String(request.scope||'').toLowerCase();
  if(scope==='star_history'||scope==='concept_saved') return viewPoolV4_(request);
  if(scope==='demand_set') return demandPoolV3_(request.setId);
  return scopePoolMathsV3_(request);
}

function getMathsScopeMetricV5(request){
  ensureMathsV3_();
  return mathsV4Metric_(mathsV5Pool_(request||{}),getStateMap_());
}

function startMathsV5Quiz(request){
  ensureMathsV3_();
  request=request||{};
  const kind=String(request.kind||'random').toLowerCase();
  const scope=String(request.scope||'').toLowerCase();
  if(kind!=='difficult'||(scope!=='star_history'&&scope!=='concept_saved')) return startMathsV4Quiz(request);
  const state=getStateMap_();
  const count=Math.max(1,Math.min(100,Number(request.count||20)));
  let pool=mathsV5Pool_(request).filter(q=>isDifficultV3_(state[String(q.question_id)])&&!isMastered_(state[String(q.question_id)]));
  pool=pool.slice(0,Math.min(count,pool.length));
  if(!pool.length)return {ok:false,message:'No difficult questions found for this revision scope.'};
  return makeSessionV4_(pool,request,'Difficult');
}
