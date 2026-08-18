function completePracticeUiPatch_(){return `<style>
.quiz-jump-tag{cursor:pointer;user-select:none}.question-jump-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:14px}.question-jump-grid button{padding:10px 4px}.resume-card{background:var(--primary2);border:1px solid var(--line);border-radius:14px;padding:14px;margin-top:12px}.resume-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}@media(max-width:390px){.question-jump-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.resume-actions{grid-template-columns:1fr}}
</style><script>
(function(){
  function isCompletePractice(mode,opts){
    mode=String(mode||'');opts=opts||{};
    if(mode==='chapter_complete'||mode==='topic_complete'||mode==='group_complete')return true;
    return mode==='demand_set'&&String(opts.practiceMode||'all').toLowerCase()==='all'&&String(opts.setId||'')!=='CALC_TRAINING';
  }
  var baseBeginQuiz=window.beginQuiz;
  function startFreshComplete(mode,opts){closeModal();return baseBeginQuiz(mode,Object.assign({},opts||{}));}
  window.beginQuiz=async function(mode,opts){
    opts=opts||{};
    if(!isCompletePractice(mode,opts)||opts.__skipCompleteResume)return baseBeginQuiz(mode,opts);
    loading(true);
    try{
      var req=Object.assign({mode:mode},opts),cp=await server('getPracticeCheckpoint',req);loading(false);
      if(!cp||!cp.hasProgress)return baseBeginQuiz(mode,opts);
      var modal=$('#modal');modal.className='modal';
      modal.innerHTML='<div class="sheet"><div class="row between"><div><div class="eyebrow">Complete Practice</div><div class="quiz-title">Continue this bank?</div></div><button class="iconbtn" id="completeResumeClose">×</button></div><div class="resume-card"><b>'+esc(cp.title||'Complete Practice')+'</b><div class="muted" style="margin-top:4px">Last position: Question '+Number(cp.resumeQuestion)+' of '+Number(cp.total)+'</div><div class="resume-actions"><button class="btn primary" id="completeResumeBtn">Resume from Q'+Number(cp.resumeQuestion)+'</button><button class="btn ghost" id="completeRestartBtn">Start from Q1</button></div></div><div class="muted" style="font-size:12px;margin-top:12px">Inside the quiz, tap the question counter to jump directly to any question number.</div></div>';
      $('#completeResumeClose').onclick=closeModal;
      $('#completeResumeBtn').onclick=function(){closeModal();resumeQuiz(cp.sessionId);};
      $('#completeRestartBtn').onclick=function(){startFreshComplete(mode,opts);};
    }catch(e){loading(false);return baseBeginQuiz(mode,opts);}
  };

  window.openQuestionJump=function(){
    if(!app.quiz||!app.quiz.questions||!app.quiz.questions.length)return;
    var total=app.quiz.questions.length,current=app.quiz.index+1,modal=$('#modal');modal.className='modal';
    var buttons='';for(var i=1;i<=total;i++)buttons+='<button class="btn '+(i===current?'primary':'ghost')+'" data-jump-q="'+i+'">'+i+'</button>';
    modal.innerHTML='<div class="sheet"><div class="row between"><div><div class="eyebrow">Question selector</div><div class="quiz-title">Jump to question</div></div><button class="iconbtn" id="jumpClose">×</button></div><div class="muted" style="font-size:12px;margin-top:4px">Current: Q'+current+' of '+total+'</div><div class="question-jump-grid">'+buttons+'</div></div>';
    $('#jumpClose').onclick=closeModal;
    modal.querySelectorAll('[data-jump-q]').forEach(function(btn){btn.onclick=function(){var target=Math.max(1,Math.min(total,Number(btn.dataset.jumpQ||1)));closeModal();app.quiz.index=target-1;app.qStart=Date.now();renderQuestion();window.scrollTo(0,0);server('saveSessionPosition',app.quiz.sessionId,app.quiz.index).catch(function(){});};});
  };

  var baseRenderQuestion=window.renderQuestion;
  window.renderQuestion=function(){
    baseRenderQuestion();
    if(!app.quiz)return;
    var counter=document.querySelector('.quiz-head .tag');
    if(counter){counter.classList.add('quiz-jump-tag');counter.setAttribute('role','button');counter.setAttribute('tabindex','0');counter.setAttribute('aria-label','Jump to question');counter.textContent='Q '+(app.quiz.index+1)+'/'+app.quiz.questions.length+' ▾';counter.onclick=window.openQuestionJump;counter.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();window.openQuestionJump();}};}
  };

  var baseSaveAndHome=window.saveAndHome;
  window.saveAndHome=function(){if(app.quiz&&app.quiz.sessionId)server('saveSessionPosition',app.quiz.sessionId,app.quiz.index).catch(function(){});return baseSaveAndHome();};
})();
</script>`+HtmlService.createHtmlOutputFromFile('MathsV2UI').getContent();}
