function dailyLifecycleFixUi_(){
  ensureMathsCanonicalSchemaV17_();
  return HtmlService.createHtmlOutputFromFile('DailyLifecycleFixUI').getContent()
    +HtmlService.createHtmlOutputFromFile('ConceptHierarchyUI').getContent()
    +HtmlService.createHtmlOutputFromFile('MathsColdStartRepairUI').getContent();
}
