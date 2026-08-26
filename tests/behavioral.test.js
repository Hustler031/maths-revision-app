const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({console,Date,Math,JSON,Set,Map,Number,String,Array,Object,Maths:{}});
vm.runInContext(`
function normalizeLabel_(v){return String(v||'').trim().toLowerCase()}
function dateMs_(v){const n=v instanceof Date?v.getTime():new Date(v).getTime();return Number.isFinite(n)?n:0}
function json_(v,f){try{return JSON.parse(String(v||''))}catch(e){return f}}
function bool_(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1'}
function isMastered_(s){return !!(s&&bool_(s.mastered))}
function isMarked_(s){return !!(s&&bool_(s.marked))}
function mathsNewestKeyV9_(q){return dateMs_(q.added_at||q.created_at||q.date_added||'')}
function validQuestionId_(v){const id=String(v||'').trim();if(!id)throw new Error('Missing question ID');return id}
function active_(q){return normalizeLabel_(q&&q.status||'active')!=='inactive'}
function mathsRuntimeQuestionValidV20_(q){return !!(q&&q.question_id&&q.prompt&&['MCQ','REVEAL'].includes(String(q.answer_mode||'').toUpperCase()))}
const MATHS_NEW_WINDOW_DAYS=60;
`,ctx);
vm.runInContext(fs.readFileSync(path.join(root,'MathsLearningEngineV20.gs'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'MathsQuizLifecycleV15.gs'),'utf8'),ctx);
const call=(name,...args)=>vm.runInContext(`${name}(...__args)`,Object.assign(ctx,{__args:args}));

function q(id,chapter='Geometry',addedAt='2000-01-01'){
  return {question_id:id,chapter,prompt:'Question '+id,answer_mode:'MCQ',status:'Active',added_at:addedAt};
}

test('rolling five-attempt history separates Weak and Hard',()=>{
  const now=Date.now(),rows=[
    {question_id:'A',timestamp:new Date(now),result:'wrong',response_sec:48},
    {question_id:'A',timestamp:new Date(now-1000),result:'wrong',response_sec:55},
    {question_id:'A',timestamp:new Date(now-2000),result:'correct',response_sec:50},
    {question_id:'A',timestamp:new Date(now-3000),result:'correct',response_sec:45},
    {question_id:'A',timestamp:new Date(now-4000),result:'wrong',response_sec:60},
    {question_id:'A',timestamp:new Date(now-5000),result:'correct',response_sec:1},
    {question_id:'B',timestamp:new Date(now),result:'correct',response_sec:10},
    {question_id:'B',timestamp:new Date(now-1000),result:'correct',response_sec:12}
  ];
  const profiles=call('mathsAttemptProfilesFromRowsV20_',rows),state={A:{attempts:6},B:{attempts:2}};
  assert.equal(profiles.A.recent.length,5);
  assert.equal(call('mathsIsWeakV20_',q('A'),state,profiles),true);
  assert.equal(call('mathsIsHardV20_',q('A'),state,profiles),true);
  assert.equal(call('mathsIsWeakV20_',q('B'),state,profiles),false);
  assert.equal(call('mathsIsHardV20_',q('B'),state,profiles),false);
});

test('Daily produces 25 and guarantees seven timestamped fresh questions',()=>{
  const now=new Date().toISOString(),eligible=[],state={};
  for(let i=1;i<=40;i++){eligible.push(q('Q'+i,i%2?'Geometry':'Mixture & Alligation',i<=10?now:'2000-01-01'));state['Q'+i]={attempts:0}}
  const picked=call('mathsSelectDailyFromContextV20_',eligible,state,{},[],8,{size:25,newQuota:7,difficultRotationDays:3,newWindowDays:60});
  assert.equal(picked.length,25);
  assert.equal(picked.slice(0,7).filter(x=>x.added_at===now).length,7);
  assert.equal(new Set(picked.map(x=>x.question_id)).size,25);
});

test('manual Difficult is excluded until its third study day and then becomes due',()=>{
  const recent=q('D1'),due=q('D2'),normal=q('N1'),state={D1:{attempts:1,difficult:true},D2:{attempts:1,difficult:true},N1:{attempts:1}};
  const sessions=[
    {day:7,row:{params_json:'{"planDay":7}',question_ids_json:'["D1"]'}},
    {day:5,row:{params_json:'{"planDay":5}',question_ids_json:'["D2"]'}}
  ];
  const picked=call('mathsSelectDailyFromContextV20_',[recent,due,normal],state,{},sessions,8,{size:2,newQuota:0,difficultRotationDays:3});
  assert.equal(picked.some(x=>x.question_id==='D1'),false);
  assert.equal(picked.some(x=>x.question_id==='D2'),true);
});

test('completed Daily wins canonical selection when historical duplicates exist',()=>{
  const sessions=[
    {day:2,row:{completed:false,updated_at:'2026-08-26T12:00:00Z'}},
    {day:2,row:{completed:true,updated_at:'2026-08-25T12:00:00Z'}}
  ];
  assert.equal(call('mathsDailyCanonicalSessionV20_',sessions,2).row.completed,true);
});

test('server attempt validation rejects alien questions and inconsistent MCQ results',()=>{
  const question=q('Q1');question.option_a='1';question.correct_option='A';
  const session={id:'S1',row:{session_id:'S1',mode:'daily'},ids:['Q1'],rendered:[{questionId:'Q1',answerMode:'MCQ',correctOption:'A',options:[{key:'A'},{key:'B'}]}]};
  assert.throws(()=>call('mathsValidateAttemptPayloadV20_',{questionId:'Q2',result:'seen'},session,{Q1:question}),/missing|belong/i);
  assert.throws(()=>call('mathsValidateAttemptPayloadV20_',{questionId:'Q1',result:'correct'},session,{Q1:question}),/required/i);
  assert.throws(()=>call('mathsValidateAttemptPayloadV20_',{questionId:'Q1',result:'correct',selectedOption:'B'},session,{Q1:question}),/does not match/i);
  const valid=call('mathsValidateAttemptPayloadV20_',{questionId:'Q1',result:'wrong',selectedOption:'B',nextIndex:1},session,{Q1:question});
  assert.equal(valid.clientAttemptKey,'S1:Q1');
  assert.equal(valid.index,0);
});

test('exact resume hydration restores the selected option and saved result',()=>{
  const questions=[{questionId:'Q1',answerMode:'MCQ',options:[{key:'A'},{key:'B'}],correctOption:'A'}];
  const attempts=[{question_id:'Q1',result:'wrong',selected_option:'B'}];
  const hydrated=call('mathsHydrateRenderedQuestionsV20_',questions,attempts,{Q1:{}},{});
  assert.equal(hydrated[0]._selected,'B');
  assert.equal(hydrated[0]._savedResult,'wrong');
  assert.equal(hydrated[0]._attemptSaved,true);
});

test('current revision membership ignores flags that are now off',()=>{
  const ids=call('mathsCurrentRevisionIdsV20_',{A:q('A'),B:q('B'),C:q('C')},{A:{marked:true},B:{difficult:true},C:{marked:false,difficult:false}});
  assert.deepEqual(Object.keys(ids).sort(),['A','B']);
});

test('spaced intervals expand after successful retention',()=>{
  const question=q('Q1'),state={Q1:{attempts:3}},base={total:3,graded:3,accuracy:1,lastResult:'correct',avgSec:10};
  assert.equal(call('mathsReviewIntervalDaysV20_',question,state,{Q1:{...base,correctStreak:1}}),3);
  assert.equal(call('mathsReviewIntervalDaysV20_',question,state,{Q1:{...base,correctStreak:2}}),7);
  assert.equal(call('mathsReviewIntervalDaysV20_',question,state,{Q1:{...base,correctStreak:3}}),14);
});

test('active UI and server contain cache, lock, exact-resume, and legacy-alias contracts',()=>{
  const app=fs.readFileSync(path.join(root,'MathsAppUI.html'),'utf8');
  const quiz=fs.readFileSync(path.join(root,'MathsQuizUI.html'),'utf8');
  const daily=fs.readFileSync(path.join(root,'MathsDailyV12.gs'),'utf8');
  const data=fs.readFileSync(path.join(root,'Data.gs'),'utf8');
  const core=fs.readFileSync(path.join(root,'MathsCore.gs'),'utf8');
  const code=fs.readFileSync(path.join(root,'Code.gs'),'utf8');
  const v2=fs.readFileSync(path.join(root,'MathsV2.gs'),'utf8');
  assert.match(app,/readInflight/);
  assert.match(quiz,/positionWrite=positionWrite\.catch/);
  assert.match(daily,/return mathsLockedV9_/);
  assert.match(data,/rendered_questions_json/);
  assert.match(core,/mathsCurrentRevisionStatsV20_/);
  assert.match(code,/function submitRecall\(payload\)\{return submitRecallV15\(payload\)\}/);
  assert.match(v2,/return startMathsPracticeV14\(request\|\|\{\}\)/);
});
