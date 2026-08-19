// Active served UI: one quiz layer + one application layer.
function completePracticeUiPatch_(){return HtmlService.createHtmlOutputFromFile('MathsQuizUI').getContent()+HtmlService.createHtmlOutputFromFile('MathsAppUI').getContent();}
