from pathlib import Path

p = Path('Index.html')
s = p.read_text(encoding='utf-8')
replacements = [
    ('<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'),
    ('*{box-sizing:border-box}html{scroll-behavior:smooth;width:100%;max-width:100%;overflow-x:hidden}body{margin:0;width:100%;max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;', '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;'),
    ('.app{width:100%;max-width:820px;', '.app{max-width:820px;'),
    ('.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:820px;', '.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(820px,100%);'),
    ('.quiz-dock{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:820px;', '.quiz-dock{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(820px,100%);'),
    ("try{app.bootstrap=await server('getAppBootstrap');loading(false);showView('home')}", "try{app.bootstrap=await server('getAppBootstrap');loading(false)}"),
    ("const app={bootstrap:null,view:'home',quiz:null,qStart:0};", "const app={bootstrap:null,view:'home',quiz:null,qStart:0};\nlet pendingAttemptSave=Promise.resolve();"),
    ("""function saveAttempt(q,result){
  if(q._attemptSaved)return;
  q._attemptSaved=true;
  server('submitRecall',{questionId:q.questionId,result,mastered:!!q.mastered,mode:app.quiz.mode,sessionId:app.quiz.sessionId,nextIndex:app.quiz.index+1,responseSec:(Date.now()-app.qStart)/1000,variantType:q.variantType||'',correctOption:q.correctOption||''}).catch(()=>{q._attemptSaved=false;toast('Saving delayed. You can continue.')});
}""", """function saveAttempt(q,result){
  if(q._attemptSaved)return pendingAttemptSave;
  q._attemptSaved=true;
  const payload={questionId:q.questionId,result,mastered:!!q.mastered,mode:app.quiz.mode,sessionId:app.quiz.sessionId,nextIndex:app.quiz.index+1,responseSec:(Date.now()-app.qStart)/1000,variantType:q.variantType||'',correctOption:q.correctOption||''};
  pendingAttemptSave=pendingAttemptSave.catch(()=>{}).then(()=>server('submitRecall',payload)).catch(e=>{q._attemptSaved=false;toast('Saving delayed. Please retry before finishing.');throw e});
  return pendingAttemptSave;
}"""),
    ("""function completeQuiz(){
  const id=app.quiz.sessionId,chapter=app.quiz.planChapter||app.bootstrap.dashboard.todayChapter,mode=app.quiz.mode;
  $('#nav').classList.remove('hidden');
  $('#main').innerHTML=`<div class="content"><div class="card" style="text-align:center"><div style="font-size:36px">✓</div><h2>Session complete</h2>${mode==='daily'?`<button class="btn primary" style="width:100%" data-chapter="${esc(chapter)}" onclick="beginQuiz('practice_more',{chapter:this.dataset.chapter})">+ Practice More ${esc(chapter)}</button><div style="height:8px"></div>`:''}<button class="btn ghost" style="width:100%" onclick="showView('home')">Back Home</button></div></div>`;
  server('finishSession',id).then(()=>server('getAppBootstrap')).then(b=>app.bootstrap=b).catch(()=>{});
}""", """async function completeQuiz(){
  if(!app.quiz)return;
  const id=app.quiz.sessionId,chapter=app.quiz.planChapter||app.bootstrap.dashboard.todayChapter,mode=app.quiz.mode;
  if(typeof loading==='function')loading(true);
  try{
    await pendingAttemptSave;
    await server('finishSession',id);
    app.bootstrap=await server('getAppBootstrap');
  }catch(e){
    if(typeof loading==='function')loading(false);
    toast('Last answer is not saved yet. Please retry Finish.');
    return;
  }
  if(typeof loading==='function')loading(false);
  $('#nav').classList.remove('hidden');
  $('#main').innerHTML=`<div class="content"><div class="card" style="text-align:center"><div style="font-size:36px">✓</div><h2>Session complete</h2>${mode==='daily'?`<button class="btn primary" style="width:100%" data-chapter="${esc(chapter)}" onclick="beginQuiz('practice_more',{chapter:this.dataset.chapter})">+ Practice More ${esc(chapter)}</button><div style="height:8px"></div>`:''}<button class="btn ghost" style="width:100%" onclick="showView('home')">Back Home</button></div></div>`;
}"""),
]
for old, new in replacements:
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
