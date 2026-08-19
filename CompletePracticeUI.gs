// Active served UI: one quiz layer + one application layer + isolated analytical Mocks module.
// Main chapter visibility is server-owned by getAppBootstrapV11(): mock/calculation collection rows
// retain their academic Chapter for analytics but cannot create Advanced/Arithmetic chapter cards.
function completePracticeUiPatch_(){
  ensureMathsProgressSnapshotV10_();
  const quizUi=HtmlService.createHtmlOutputFromFile('MathsQuizUI').getContent();
  const appUi=HtmlService.createHtmlOutputFromFile('MathsAppUI').getContent()
    .replace('r.getAppBootstrapV9()','r.getAppBootstrapV11()');
  const mocksUi=HtmlService.createHtmlOutputFromFile('MathsMocksUI').getContent();
  return quizUi+appUi+mocksUi;
}
