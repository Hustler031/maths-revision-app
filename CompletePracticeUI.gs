// Active served UI: one quiz layer + one application layer + isolated Mocks and finalization behavior.
// V12 finalization keeps the single App renderer, swaps only the Daily endpoint/text at assembly time,
// and adds quiz-only timer/date-rollover behavior without introducing another page renderer.
function completePracticeUiPatch_(){
  ensureMathsProgressSnapshotV10_();
  const quizUi=HtmlService.createHtmlOutputFromFile('MathsQuizUI').getContent();
  let appUi=HtmlService.createHtmlOutputFromFile('MathsAppUI').getContent()
    .replace('r.getAppBootstrapV9()','r.getAppBootstrapV11()')
    .replace('r.getMathsHomeV9()','r.getMathsHomeV12()')
    .replace("Finish Day '+day+' first, then use focused practice.",'Mixed adaptive revision · whole question bank, Calculation excluded.')
    .replace("Fresh-first: '+target+' questions · reinforcement 0","Adaptive mix: '+target+' questions · Difficult, wrong, unseen and due first")
    .replace("'+(done?'Continue Day '+day+' · '+left+' left':'Start Day '+day+' · '+left+' left')+'","'+(daily.completed?'Practice More':done?'Continue Day '+day+' · '+left+' left':'Start Day '+day+' · '+left+' left')+'")
    .replace("qs('#maDaily').onclick=()=>beginQuiz('daily',{planDay:day});","qs('#maDaily').onclick=()=>daily.completed?beginQuiz('practice_more',{count:target}):beginQuiz('daily',{planDay:day});");
  const mocksUi=HtmlService.createHtmlOutputFromFile('MathsMocksUI').getContent();
  const finalizationUi=HtmlService.createHtmlOutputFromFile('MathsFinalizationUIV12').getContent();
  return quizUi+appUi+mocksUi+finalizationUi;
}
