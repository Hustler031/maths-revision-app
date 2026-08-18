function saveSessionPositionV3(sessionId,index){
  ensureMathsInfrastructure_();
  const id=String(sessionId||'').trim();
  if(!id)throw new Error('Missing session ID.');
  updateSessionProgress_(id,Math.max(0,Number(index||0)),false);
  return {ok:true,sessionId:id,currentIndex:Math.max(0,Number(index||0))};
}
