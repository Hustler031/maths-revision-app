const MATHS = {
  TITLE: 'Maths Revision',
  SHEETS: {
    QUESTIONS: 'Questions', STATE: 'State', ATTEMPTS: 'Attempts', SESSIONS: 'Sessions',
    NOTES: 'Notes', SETTINGS: 'Settings', GENERATED: 'Generated_Practice', PLAN: 'Chapter_Plan'
  },
  DEFAULTS: {
    daily_chapter_size: 30,
    daily_reinforcement_size: 10,
    practice_more_size: 20,
    current_day: 1,
    today_chapter: 'Coordinate Geometry',
    show_timer: true,
    mastered_excluded_daily: true,
    marked_reinforcement_enabled: true
  }
};

function doGet() {
  ensureMathsInfrastructure_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(MATHS.TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupMathsRevision() {
  ensureMathsInfrastructure_();
  return getAppBootstrap();
}

function getAppBootstrap() {
  ensureMathsInfrastructure_();
  return {
    title: MATHS.TITLE,
    dashboard: getDashboard_(),
    chapters: getChapters_(),
    library: getLibraryCounts_(),
    resume: getResumeSession_(),
    settings: getSettingsObject_()
  };
}

function getDashboard() { ensureMathsInfrastructure_(); return getDashboard_(); }
function getChapters() { ensureMathsInfrastructure_(); return getChapters_(); }
function getLibraryCounts() { ensureMathsInfrastructure_(); return getLibraryCounts_(); }
function getResumeSession() { ensureMathsInfrastructure_(); return getResumeSession_(); }

function startQuiz(request) {
  ensureMathsInfrastructure_();
  request = request || {};
  const mode = String(request.mode || 'daily');
  const all = getAllQuestions_();
  const state = getStateMap_();
  let pool = [];
  let title = 'Maths Revision';

  if (mode === 'daily') {
    const today = String(getSetting_('today_chapter', MATHS.DEFAULTS.today_chapter));
    const size = Number(getSetting_('daily_chapter_size', MATHS.DEFAULTS.daily_chapter_size));
    const reinforcementSize = Number(getSetting_('daily_reinforcement_size', MATHS.DEFAULTS.daily_reinforcement_size));
    const chapterPool = all.filter(q => active_(q) && q.chapter === today && !isMastered_(state[q.question_id]));
    const seen = chapterPool.filter(q => Number((state[q.question_id] || {}).attempts || 0) > 0);
    const fresh = chapterPool.filter(q => !Number((state[q.question_id] || {}).attempts || 0));
    pool = takeMixed_(seen, fresh, size);

    if (bool_(getSetting_('marked_reinforcement_enabled', true)) && reinforcementSize > 0) {
      const marked = all.filter(q => active_(q) && q.chapter !== today && isMarked_(state[q.question_id]) && !isMastered_(state[q.question_id]));
      const continuous = all.filter(q => active_(q) && ['Calculation Patterns','Fraction Patterns','Triplets'].includes(q.chapter) && !isMastered_(state[q.question_id]));
      pool = uniqueQuestions_(pool.concat(shuffle_(marked.concat(continuous)).slice(0, reinforcementSize)));
    }
    title = 'Day ' + getSetting_('current_day', 1) + ' · ' + today;
  }

  if (mode === 'practice_more') {
    const chapter = String(request.chapter || getSetting_('today_chapter', MATHS.DEFAULTS.today_chapter));
    const size = Number(request.count || getSetting_('practice_more_size', 20));
    pool = shuffle_(all.filter(q => active_(q) && q.chapter === chapter && !isMastered_(state[q.question_id]))).slice(0, size);
    title = 'Practice More · ' + chapter;
  }

  if (mode === 'chapter') {
    const chapter = String(request.chapter || '');
    pool = all.filter(q => active_(q) && q.chapter === chapter);
    title = chapter + ' · Complete Bank';
  }

  if (mode === 'library') {
    const cluster = String(request.cluster || 'Formula');
    pool = filterLibrary_(all, state, cluster);
    title = 'Library · ' + cluster;
  }

  if (mode === 'ondemand') {
    pool = filterOnDemand_(all, state, request);
    const count = Math.max(1, Number(request.count || 20));
    pool = shuffle_(pool).slice(0, count);
    title = 'On Demand' + (request.topic ? ' · ' + request.topic : '');
  }

  if (mode === 'generated') {
    const generated = getGeneratedQuestions_();
    pool = filterOnDemand_(generated, state, request);
    const count = Math.max(1, Number(request.count || 20));
    pool = shuffle_(pool).slice(0, count);
    title = 'Generated Practice';
  }

  if (!pool.length) return { ok:false, message:'No eligible questions found for this selection.' };
  const sessionId = Utilities.getUuid();
  saveSession_({session_id:sessionId, mode:mode, title:title, question_ids_json:JSON.stringify(pool.map(q=>q.question_id)), current_index:0, updated_at:new Date(), completed:false, params_json:JSON.stringify(request)});
  return sessionPayload_(sessionId, pool, state, title, mode, 0);
}

function resumeSession(sessionId) {
  ensureMathsInfrastructure_();
  const s = getSessionById_(String(sessionId || ''));
  if (!s) return {ok:false, message:'Saved session not found.'};
  const allMap = {};
  getAllQuestions_().concat(getGeneratedQuestions_()).forEach(q => allMap[q.question_id] = q);
  const ids = json_(s.question_ids_json, []);
  const list = ids.map(id => allMap[id]).filter(Boolean);
  return sessionPayload_(s.session_id, list, getStateMap_(), s.title || 'Resume', s.mode || '', Number(s.current_index || 0));
}

function submitRecall(payload) {
  ensureMathsInfrastructure_();
  payload = payload || {};
  const id = String(payload.questionId || '');
  if (!id) throw new Error('Missing question ID.');
  const result = String(payload.result || 'seen');
  const mastered = !!payload.mastered;
  const now = new Date();
  const responseSec = Number(payload.responseSec || 0);
  const st = upsertState_(id, {attempt:true, mastered:mastered, result:result, responseSec:responseSec});
  getSheet_(MATHS.SHEETS.ATTEMPTS).appendRow([
    Utilities.getUuid(), now, id, result, responseSec, String(payload.mode || ''), String(payload.sessionId || ''), !!st.mastered, !!st.marked
  ]);
  if (payload.sessionId) updateSessionProgress_(String(payload.sessionId), Number(payload.nextIndex || 0), false);
  return {ok:true, mastered:!!st.mastered, marked:!!st.marked};
}

function setMastered(questionId, mastered) {
  ensureMathsInfrastructure_();
  const st = upsertState_(String(questionId), {mastered:!!mastered});
  return {mastered:!!st.mastered};
}

function toggleMarked(questionId) {
  ensureMathsInfrastructure_();
  const id = String(questionId || '');
  const current = getStateMap_()[id];
  const st = upsertState_(id, {marked:!isMarked_(current)});
  return {marked:!!st.marked};
}

function saveNote(questionId, note) {
  ensureMathsInfrastructure_();
  const id = String(questionId || '');
  const sh = getSheet_(MATHS.SHEETS.NOTES);
  const rows = sheetObjects_(sh);
  const found = rows.find(r => String(r.question_id) === id);
  if (found) sh.getRange(found.__row, 2, 1, 2).setValues([[String(note || ''), new Date()]]);
  else sh.appendRow([id, String(note || ''), new Date(), false]);
  return {ok:true, note:String(note || '')};
}

function getNote(questionId) {
  ensureMathsInfrastructure_();
  const id = String(questionId || '');
  const found = sheetObjects_(getSheet_(MATHS.SHEETS.NOTES)).find(r => String(r.question_id) === id);
  return {note:found ? String(found.note || '') : ''};
}

function finishSession(sessionId) {
  ensureMathsInfrastructure_();
  updateSessionProgress_(String(sessionId || ''), 999999, true);
  return getDashboard_();
}

function getDashboard_() {
  const all = getAllQuestions_();
  const state = getStateMap_();
  const today = String(getSetting_('today_chapter', MATHS.DEFAULTS.today_chapter));
  const chapter = all.filter(q => active_(q) && q.chapter === today);
  const masteredToday = chapter.filter(q => isMastered_(state[q.question_id])).length;
  const activeToday = chapter.length - masteredToday;
  let mastered=0, marked=0, attempted=0;
  all.forEach(q => {
    const s = state[q.question_id];
    if (isMastered_(s)) mastered++;
    if (isMarked_(s)) marked++;
    if (s && Number(s.attempts || 0)>0) attempted++;
  });
  return {
    day:Number(getSetting_('current_day',1)), todayChapter:today, total:all.length,
    chapterTotal:chapter.length, chapterRemaining:activeToday, chapterMastered:masteredToday,
    mastered:mastered, marked:marked, attempted:attempted,
    generated:getGeneratedQuestions_().length
  };
}

function getChapters_() {
  const all = getAllQuestions_();
  const state = getStateMap_();
  const map = {};
  all.forEach(q => {
    if (!active_(q)) return;
    const c = q.chapter || 'Other';
    if (!map[c]) map[c] = {chapter:c,total:0,mastered:0,remaining:0,topics:{}};
    map[c].total++;
    if (isMastered_(state[q.question_id])) map[c].mastered++; else map[c].remaining++;
    const t = q.topic || 'General'; map[c].topics[t] = (map[c].topics[t] || 0) + 1;
  });
  return Object.values(map).sort((a,b)=>a.chapter.localeCompare(b.chapter));
}

function getLibraryCounts_() {
  const all = getAllQuestions_();
  const state = getStateMap_();
  const notes = sheetObjects_(getSheet_(MATHS.SHEETS.NOTES)).filter(n => String(n.note || '').trim());
  const typeCount = t => all.filter(q => String(q.card_type).toLowerCase() === t.toLowerCase()).length;
  return {
    formulas:typeCount('Formula'), methods:all.filter(q => ['method','pattern','trap'].includes(String(q.card_type).toLowerCase())).length,
    fractions:all.filter(q => /fraction/i.test(q.chapter+' '+q.topic)).length,
    triplets:all.filter(q => /triplet/i.test(q.chapter+' '+q.topic)).length,
    marked:all.filter(q => isMarked_(state[q.question_id])).length,
    notes:notes.length,
    recent:all.filter(q => active_(q)).slice(-20).length
  };
}

function filterLibrary_(all, state, cluster) {
  const c = cluster.toLowerCase();
  if (c === 'formula' || c === 'formulas') return all.filter(q => String(q.card_type).toLowerCase()==='formula');
  if (c === 'methods') return all.filter(q => ['method','pattern','trap'].includes(String(q.card_type).toLowerCase()));
  if (c === 'fractions') return all.filter(q => /fraction/i.test(q.chapter+' '+q.topic));
  if (c === 'triplets') return all.filter(q => /triplet/i.test(q.chapter+' '+q.topic));
  if (c === 'marked') return all.filter(q => isMarked_(state[q.question_id]));
  if (c === 'notes') {
    const noteIds = new Set(sheetObjects_(getSheet_(MATHS.SHEETS.NOTES)).filter(n=>String(n.note||'').trim()).map(n=>String(n.question_id)));
    return all.filter(q => noteIds.has(q.question_id));
  }
  if (c === 'recent') return all.slice(-20);
  return all;
}

function filterOnDemand_(all, state, request) {
  return all.filter(q => {
    if (!active_(q)) return false;
    if (request.chapter && q.chapter !== request.chapter) return false;
    if (request.topic && q.topic !== request.topic) return false;
    if (request.subtopic && q.subtopic !== request.subtopic) return false;
    if (request.cardType && q.card_type !== request.cardType) return false;
    if (request.difficulty && q.difficulty !== request.difficulty) return false;
    if (request.markedOnly && !isMarked_(state[q.question_id])) return false;
    if (request.activeOnly && isMastered_(state[q.question_id])) return false;
    if (request.masteredOnly && !isMastered_(state[q.question_id])) return false;
    return true;
  });
}

function sessionPayload_(sessionId, pool, state, title, mode, currentIndex) {
  return {ok:true, sessionId:sessionId, title:title, mode:mode, currentIndex:currentIndex, total:pool.length,
    questions:pool.map(q => sanitizeQuestion_(q, state[q.question_id]))};
}

function sanitizeQuestion_(q, s) {
  return {
    id:q.question_id, chapter:q.chapter, topic:q.topic, subtopic:q.subtopic, cardType:q.card_type,
    prompt:q.prompt, answer:q.answer, explanation:q.explanation, memoryCue:q.memory_cue,
    difficulty:q.difficulty, diagramType:q.diagram_type, diagramJson:q.diagram_json,
    sourceFile:q.source_file, sourcePage:q.source_page, sourceUrl:q.source_url,
    mastered:isMastered_(s), marked:isMarked_(s), attempts:Number((s||{}).attempts||0)
  };
}

function getAllQuestions_() { return sheetObjects_(getSheet_(MATHS.SHEETS.QUESTIONS)).filter(r => r.question_id); }
function getGeneratedQuestions_() { return sheetObjects_(getSheet_(MATHS.SHEETS.GENERATED)).filter(r => r.question_id); }

function upsertState_(id, patch) {
  const sh = getSheet_(MATHS.SHEETS.STATE);
  const rows = sheetObjects_(sh);
  const found = rows.find(r => String(r.question_id) === id);
  let s = found ? Object.assign({}, found) : {question_id:id, attempts:0, mastered:false, marked:false};
  if (patch.attempt) s.attempts = Number(s.attempts || 0) + 1;
  if (Object.prototype.hasOwnProperty.call(patch,'mastered')) s.mastered = !!patch.mastered;
  if (Object.prototype.hasOwnProperty.call(patch,'marked')) s.marked = !!patch.marked;
  if (patch.attempt) {
    s.last_attempt = new Date(); s.last_result = String(patch.result || 'seen'); s.last_response_sec = Number(patch.responseSec || 0);
  }
  const q = getAllQuestions_().concat(getGeneratedQuestions_()).find(x => x.question_id === id) || {};
  const row = [id, Number(s.attempts||0), !!s.mastered, !!s.marked, s.last_attempt||'', s.last_result||'', Number(s.last_response_sec||0), q.chapter||'', q.topic||'', q.subtopic||''];
  if (found) sh.getRange(found.__row,1,1,10).setValues([row]); else sh.appendRow(row);
  return {question_id:id, attempts:row[1], mastered:row[2], marked:row[3], last_attempt:row[4], last_result:row[5], last_response_sec:row[6]};
}

function getStateMap_() { const m={}; sheetObjects_(getSheet_(MATHS.SHEETS.STATE)).forEach(r=>{if(r.question_id)m[String(r.question_id)]=r}); return m; }
function isMastered_(s){ return !!(s && bool_(s.mastered)); }
function isMarked_(s){ return !!(s && bool_(s.marked)); }
function active_(q){ return String(q.status || 'Active').toLowerCase() !== 'inactive'; }

function saveSession_(s){ getSheet_(MATHS.SHEETS.SESSIONS).appendRow([s.session_id,s.mode,s.title,s.question_ids_json,s.current_index,s.updated_at,s.completed,s.params_json]); }
function getSessionById_(id){ return sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).find(r=>String(r.session_id)===id); }
function updateSessionProgress_(id, index, completed){
  const sh=getSheet_(MATHS.SHEETS.SESSIONS), rows=sheetObjects_(sh), r=rows.find(x=>String(x.session_id)===id); if(!r)return;
  sh.getRange(r.__row,5,1,3).setValues([[Number(index||0),new Date(),!!completed]]);
}
function getResumeSession_(){
  const rows=sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).filter(r=>r.session_id&&!bool_(r.completed)).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
  if(!rows.length)return null; const s=rows[0], ids=json_(s.question_ids_json,[]); return {sessionId:s.session_id,title:s.title,currentIndex:Number(s.current_index||0),total:ids.length,mode:s.mode};
}

function getSettingsObject_(){ const o={}; sheetObjects_(getSheet_(MATHS.SHEETS.SETTINGS)).forEach(r=>{if(r.key)o[String(r.key)]=r.value}); return o; }
function getSetting_(key, fallback){ const o=getSettingsObject_(); return Object.prototype.hasOwnProperty.call(o,key) ? o[key] : fallback; }

function ensureMathsInfrastructure_(){
  const ss=SpreadsheetApp.getActive();
  ensureSheet_(ss,MATHS.SHEETS.QUESTIONS,['Question_ID','Chapter','Topic','Subtopic','Card_Type','Prompt','Answer','Explanation','Memory_Cue','Difficulty','Marked_Default','Mastered_Default','Diagram_Type','Diagram_JSON','Source_File','Source_Page','Source_URL','Status']);
  ensureSheet_(ss,MATHS.SHEETS.STATE,['Question_ID','Attempts','Mastered','Marked','Last_Attempt','Last_Result','Last_Response_Sec','Chapter','Topic','Subtopic']);
  ensureSheet_(ss,MATHS.SHEETS.ATTEMPTS,['Attempt_ID','Timestamp','Question_ID','Result','Response_Sec','Mode','Session_ID','Mastered_After','Marked_After']);
  ensureSheet_(ss,MATHS.SHEETS.SESSIONS,['Session_ID','Mode','Title','Question_IDs_JSON','Current_Index','Updated_At','Completed','Params_JSON']);
  ensureSheet_(ss,MATHS.SHEETS.NOTES,['Question_ID','Note','Updated_At','Pinned']);
  const settings=ensureSheet_(ss,MATHS.SHEETS.SETTINGS,['Key','Value']);
  ensureSheet_(ss,MATHS.SHEETS.GENERATED,['Question_ID','Chapter','Topic','Subtopic','Card_Type','Prompt','Answer','Explanation','Memory_Cue','Difficulty','Marked_Default','Mastered_Default','Diagram_Type','Diagram_JSON','Source_File','Source_Page','Source_URL','Status']);
  ensureSheet_(ss,MATHS.SHEETS.PLAN,['Order','Chapter','Target_Per_Day','Status','Introduced','Mastered']);
  if(settings.getLastRow()===1){ Object.keys(MATHS.DEFAULTS).forEach(k=>settings.appendRow([k,MATHS.DEFAULTS[k]])); settings.appendRow(['app_title',MATHS.TITLE]); }
}
function ensureSheet_(ss,name,headers){ let sh=ss.getSheetByName(name); if(!sh)sh=ss.insertSheet(name); if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]); return sh; }
function getSheet_(name){ const sh=SpreadsheetApp.getActive().getSheetByName(name); if(!sh)throw new Error('Missing sheet: '+name); return sh; }
function sheetObjects_(sh){ if(!sh||sh.getLastRow()<2)return[]; const values=sh.getDataRange().getValues(), headers=values[0].map(h=>key_(h)); return values.slice(1).map((row,i)=>{const o={__row:i+2}; headers.forEach((h,j)=>o[h]=row[j]); return o;}); }
function key_(s){ return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
function bool_(v){ return v===true || String(v).toLowerCase()==='true' || String(v)==='1'; }
function json_(s,f){ try{return JSON.parse(String(s||''))}catch(e){return f} }
function shuffle_(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function uniqueQuestions_(arr){ const seen={}; return arr.filter(q=>q&&!seen[q.question_id]&&(seen[q.question_id]=true)); }
function takeMixed_(seen,fresh,size){ const a=shuffle_(seen), b=shuffle_(fresh), out=[]; while(out.length<size&&(a.length||b.length)){ if(a.length)out.push(a.shift()); if(out.length<size&&b.length)out.push(b.shift()); } return uniqueQuestions_(out).slice(0,size); }

