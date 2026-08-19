// Active served UI: one quiz layer + one application layer + isolated analytical Mocks module.
// Chapter visibility comes from the authoritative Questions bank. Demand-set membership
// (including MOCK_QUESTIONS) must never decide whether an academic chapter exists.
function completePracticeUiPatch_(){
  ensureMathsProgressSnapshotV10_();
  return HtmlService.createHtmlOutputFromFile('MathsQuizUI').getContent()+HtmlService.createHtmlOutputFromFile('MathsAppUI').getContent()+HtmlService.createHtmlOutputFromFile('MathsMocksUI').getContent();
}
