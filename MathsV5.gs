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
  return startMathsPracticeV14(request||{});
}
