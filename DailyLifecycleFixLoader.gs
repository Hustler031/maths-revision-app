function dailyLifecycleFixUi_(){
  return HtmlService.createHtmlOutputFromFile('DailyLifecycleFixUI').getContent()
    +HtmlService.createHtmlOutputFromFile('ConceptHierarchyUI').getContent()
    +HtmlService.createHtmlOutputFromFile('MathsColdStartRepairUI').getContent()
    +HtmlService.createHtmlOutputFromFile('CalculationSpeedUI').getContent();
}
