function saveSessionPositionV3(sessionId,index){
  ensureMathsInfrastructure_();
  return mathsLockedV9_(()=>{const ctx=mathsRequireSessionV20_(sessionId),safe=Math.max(0,Math.min(ctx.ids.length-1,Number(index||0)));
    if(bool_(ctx.row.completed))return {ok:true,sessionId:ctx.id,currentIndex:safe,completed:true};
    updateSessionProgress_(ctx.id,safe,false);
    return {ok:true,sessionId:ctx.id,currentIndex:safe};
  });
}
