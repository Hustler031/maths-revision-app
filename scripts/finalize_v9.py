from pathlib import Path

core=Path('MathsCore.gs')
s=core.read_text(encoding='utf-8')
s=s.replace("const MATHS_CORE_CACHE_SEC=3600;","const MATHS_CORE_CACHE_SEC=300;")
s=s.replace("function mathsAvoidRepeatOptionV9_(payload,state){\n  if(!payload||!Array.isArray(payload.questions))return payload;payload.questions.forEach(q=>{const s=state[String(q.questionId)]||{};q.important=isMarked_(s);q.marked=isMarked_(s);q.difficult=bool_(s.difficult);q.inConcept=!!mathsConceptIdsV9_()[String(q.questionId)];", "function mathsAvoidRepeatOptionV9_(payload,state){\n  if(!payload||!Array.isArray(payload.questions))return payload;const conceptIds=mathsConceptIdsV9_();payload.questions.forEach(q=>{const s=state[String(q.questionId)]||{};q.important=isMarked_(s);q.marked=isMarked_(s);q.difficult=bool_(s.difficult);q.inConcept=!!conceptIds[String(q.questionId)];")
needle="  if(scope==='star_history'){const x=mathsRevisionMembershipV9_(),lo=Number(request.starLo||1),hi=Number(request.starHi||999999),ids={};Object.keys(x.days).map(Number).filter(d=>d>=lo&&d<=hi).forEach(d=>Object.keys(x.days[d]||{}).forEach(id=>ids[id]=true));return Object.keys(ids).map(id=>map[id]).filter(Boolean)}\n"
insert=needle+"  if(scope==='new_practice'){let pool=mathsNewPoolV9_(mathsStudyQuestionsV9_(),mathsStateMapV9_());if(chapter)pool=pool.filter(q=>chapterMatchesPlan_(q.chapter,chapter));return pool}\n"
if "scope==='new_practice'" not in s:
    if needle not in s: raise SystemExit('new-practice insertion anchor missing')
    s=s.replace(needle,insert)
s=s.replace("const state=mathsStateMapV9_(),kind=String(request.kind||'random').toLowerCase(),count=Math.max(1,Math.min(100,Number(request.count||20)));let pool=mathsScopePoolV9_(request),label='Random';\n  if(kind==='all'){pool=shuffle_(pool);label='Practice All'}", "const state=mathsStateMapV9_(),kind=String(request.kind||'random').toLowerCase(),scope=String(request.scope||'all').toLowerCase(),count=Math.max(1,Math.min(100,Number(request.count||20)));let pool=mathsScopePoolV9_(request),label='Random';\n  if(kind==='all'){if(scope==='star_history')pool=pool.filter(q=>!isMastered_(state[String(q.question_id)]));pool=shuffle_(pool);label='Practice All'}")
old="function getMathsHomeV9(){const snap=getMathsSnapshotV9(false),schedule=getScheduledPlan_(),target=Math.max(1,Number((getPlanEntry_(schedule.day)||{}).targetPerDay||getSetting_('daily_chapter_size',20)||20)),sessions=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>normalizeLabel_(r.mode)==='daily').sort((a,b)=>dateMs_(b.updated_at)-dateMs_(a.updated_at));let daily=null;"
new="function getMathsHomeV9(){const snap=getMathsSnapshotV9(false),newHub=getMathsNewHubV9(),schedule=getScheduledPlan_(),target=Math.max(1,Number((getPlanEntry_(schedule.day)||{}).targetPerDay||getSetting_('daily_chapter_size',20)||20)),sessions=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>normalizeLabel_(r.mode)==='daily').sort((a,b)=>dateMs_(b.updated_at)-dateMs_(a.updated_at));let daily=null;"
s=s.replace(old,new)
s=s.replace("newCount:Number(getMathsNewHubV9().overall.unseen||getMathsNewHubV9().overall.total||0)","newCount:Number(newHub.overall&&newHub.overall.total||0)")
core.write_text(s,encoding='utf-8')

ui=Path('MathsAppUI.html')
u=ui.read_text(encoding='utf-8')
u=u.replace("bindActions(qs('#main'),{scope:'all',title:'All New Practice'},'standard')","bindActions(qs('#main'),{scope:'new_practice',title:'All New Practice'},'standard')")
u=u.replace("const req={scope:'chapter',chapter:ch,title:ch+' · New Practice'}","const req={scope:'new_practice',chapter:ch,title:ch+' · New Practice'}")
ui.write_text(u,encoding='utf-8')
