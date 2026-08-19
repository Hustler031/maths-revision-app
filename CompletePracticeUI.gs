// Active served UI: one quiz layer + one application layer.
function completePracticeUiPatch_(){
  ensureMathsProgressSnapshotV10_();
  const lectureChapters=mathsLectureChapterNamesV10_();
  const allowed={};lectureChapters.forEach(c=>allowed[normalizeLabel_(c)]=true);
  const bootstrapGuard='<script>(function(){try{var a=(typeof app!=="undefined"?app:window.app);if(!a)return;var allowed='+JSON.stringify(allowed)+';var current=a.bootstrap||null;Object.defineProperty(a,"bootstrap",{configurable:true,enumerable:true,get:function(){return current},set:function(v){if(v&&Array.isArray(v.chapters)){v=Object.assign({},v,{chapters:v.chapters.filter(function(c){var n=String(c&&c.chapter||"").toLowerCase().trim().replace(/\\s+/g," ");return !!allowed[n]})})}current=v}});if(current)a.bootstrap=current}catch(e){}})();</script>';
  return HtmlService.createHtmlOutputFromFile('MathsQuizUI').getContent()+bootstrapGuard+HtmlService.createHtmlOutputFromFile('MathsAppUI').getContent();
}
