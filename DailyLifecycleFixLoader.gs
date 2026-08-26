function dailyLifecycleFixUi_(){
  ensureMathsCanonicalSchemaV18_();
  return HtmlService.createHtmlOutputFromFile('DailyLifecycleFixUI').getContent()
    +HtmlService.createHtmlOutputFromFile('ConceptHierarchyUI').getContent()
    +HtmlService.createHtmlOutputFromFile('MathsColdStartRepairUI').getContent()
    +HtmlService.createHtmlOutputFromFile('CalculationSpeedUI').getContent()
    +HtmlService.createHtmlOutputFromFile('CalculationPdfSeedUI').getContent();
}
