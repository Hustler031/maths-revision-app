function demandUiPatch_(){return `<script>
(function(){
  function demandSetById(id){return (app.bootstrap&&app.bootstrap.demandSets||[]).find(function(s){return String(s.setId)===String(id);})||null;}
  function demandScopeCount(set,type,value){
    if(type==='calculative')return Number(set.calculativeCount||0);
    if(type==='chapter'){var c=(set.chapters||[]).find(function(x){return String(x.name)===String(value);});return Number(c&&c.count||0);}
    return Number(set.count||0);
  }
  function runDemandPractice(setId,practiceMode,scopeType,scopeValue,count){
    closeModal();
    var opts={setId:String(setId),practiceMode:String(practiceMode||'all'),activeOnly:practiceMode!=='all'};
    if(count)opts.count=Number(count);
    if(scopeType==='chapter')opts.demandChapter=String(scopeValue||'');
    if(scopeType==='calculative')opts.calculativeOnly=true;
    beginQuiz('demand_set',opts);
  }
  function demandCountPicker(setId,practiceMode,scopeType,scopeValue){
    var set=demandSetById(setId);if(!set)return;
    var label=practiceMode==='weak'?'Weak Practice':'Random Practice';
    var modal=$('#modal');modal.className='modal';
    modal.innerHTML='<div class="sheet"><div class="row between"><div><div class="eyebrow">'+esc(label)+'</div><div class="quiz-title">How many questions?</div></div><button class="iconbtn" id="demandClose">×</button></div><div class="practice-actions" style="margin-top:16px"><button class="btn soft" data-demand-count="10">10</button><button class="btn soft" data-demand-count="20">20</button><button class="btn soft" data-demand-count="25">25</button></div></div>';
    $('#demandClose').onclick=closeModal;
    modal.querySelectorAll('[data-demand-count]').forEach(function(btn){btn.onclick=function(){runDemandPractice(setId,practiceMode,scopeType,scopeValue,Number(btn.dataset.demandCount));};});
  }
  function demandPracticeAction(setId,practiceMode,scopeType,scopeValue){
    if(practiceMode==='random'||practiceMode==='weak')demandCountPicker(setId,practiceMode,scopeType,scopeValue);
    else runDemandPractice(setId,'all',scopeType,scopeValue,0);
  }
  function bindPracticeButtons(root,setId,scopeType,scopeValue){
    root.querySelectorAll('[data-demand-mode]').forEach(function(btn){btn.onclick=function(){demandPracticeAction(setId,btn.dataset.demandMode,scopeType,scopeValue);};});
  }
  window.openDemandSetHub=function(setId){
    var set=demandSetById(setId);if(!set){toast('Demand set not found.');return;}
    app.view='demand_hub';nav('ondemand');$('#nav').classList.remove('hidden');
    var cats=[];
    if(Number(set.calculativeCount||0)>0)cats.push('<div class="list-card topic-row" data-demand-cat="calculative" data-demand-value="Calculative"><div class="row between"><div><b>⚡ Calculative</b><div class="muted">'+Number(set.calculativeCount||0)+' questions · also remain in their chapters</div></div><span class="tag">Open</span></div></div>');
    (set.chapters||[]).forEach(function(c){cats.push('<div class="list-card topic-row" data-demand-cat="chapter" data-demand-value="'+esc(c.name)+'"><div class="row between"><div><b>'+esc(c.name)+'</b><div class="muted">'+Number(c.count||0)+' questions</div></div><span class="tag">Open</span></div></div>');});
    $('#main').innerHTML='<div class="content"><button class="btn ghost" id="demandBack">← On Demand</button><div class="section-title">'+esc(set.name).toUpperCase()+'</div><div class="card"><div class="hub-stats"><div class="hub-stat"><b>'+Number(set.count||0)+'</b><span class="muted">Total</span></div><div class="hub-stat"><b>'+Number(set.calculativeCount||0)+'</b><span class="muted">Calculative</span></div><div class="hub-stat"><b>'+Number((set.chapters||[]).length)+'</b><span class="muted">Chapters</span></div></div><div class="practice-actions"><button class="btn ghost" data-demand-mode="all">📚 Practice All</button><button class="btn soft" data-demand-mode="random">🔀 Random</button><button class="btn ghost" data-demand-mode="weak">🎯 Weak</button></div></div><div class="section-title">Categories</div><div class="list">'+(cats.join('')||'<div class="card muted">No categories yet.</div>')+'</div></div>';
    $('#demandBack').onclick=function(){showView('ondemand');};
    bindPracticeButtons($('#main'),setId,'','');
    $('#main').querySelectorAll('[data-demand-cat]').forEach(function(card){card.onclick=function(){openDemandCategory(setId,card.dataset.demandCat,card.dataset.demandValue);};});
    window.scrollTo(0,0);
  };
  window.openDemandCategory=function(setId,type,value){
    var set=demandSetById(setId);if(!set)return;
    var count=demandScopeCount(set,type,value);
    $('#main').innerHTML='<div class="content"><button class="btn ghost" id="demandCategoryBack">← '+esc(set.name)+'</button><div class="section-title">'+esc(set.name).toUpperCase()+' → '+esc(value).toUpperCase()+'</div><div class="card"><div class="hub-stats"><div class="hub-stat"><b>'+count+'</b><span class="muted">Questions</span></div></div><div class="practice-actions"><button class="btn ghost" data-demand-mode="all">📚 Practice All</button><button class="btn soft" data-demand-mode="random">🔀 Random</button><button class="btn ghost" data-demand-mode="weak">🎯 Weak</button></div></div></div>';
    $('#demandCategoryBack').onclick=function(){openDemandSetHub(setId);};
    bindPracticeButtons($('#main'),setId,type,value);
    window.scrollTo(0,0);
  };
  window.startDemandSet=function(setId){openDemandSetHub(String(setId));};
  function patchDemandButtons(){
    document.querySelectorAll('#main [data-set-id]').forEach(function(btn){
      var id=String(btn.dataset.setId||'');
      if(id&&id!=='CALC_TRAINING'){
        btn.textContent='Open';
        btn.onclick=function(e){e.preventDefault();e.stopPropagation();openDemandSetHub(id);};
      }
    });
  }
  var main=document.getElementById('main');
  if(main){new MutationObserver(patchDemandButtons).observe(main,{childList:true,subtree:true});patchDemandButtons();}
})();
</script>`;}
