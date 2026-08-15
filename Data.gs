function getAllQuestions_() {
  return sheetObjects_(getSheet_(MATHS.SHEETS.QUESTIONS)).filter(r => r.question_id);
}

function getGeneratedQuestions_() {
  return sheetObjects_(getSheet_(MATHS.SHEETS.GENERATED)).filter(r => r.question_id);
}

function rotationTier_(q) {
  return String(q.rotation_tier || (q.chapter === 'Triplets' || q.chapter === 'Fraction Patterns' ? 'Continuous' : 'Core')).trim() || 'Core';
}

function active_(q) { return norm_(q.status || 'Active') !== 'inactive'; }

function isMastered_(s) {
  return !!(s && bool_(s.mastered));
}

function isMarked_(s) {
  return !!(s && bool_(s.marked));
}

function getNotesMap_() {
  const m = {};
  sheetObjects_(getSheet_(MATHS.SHEETS.NOTES)).forEach(r => {
    if (r.question_id) m[String(r.question_id)] = String(r.note || '');
  });
  return m;
}

function upsertState_(id, patch) {
  id=validQuestionId_(id); patch=patch||{};
  const sh=getSheet_(MATHS.SHEETS.STATE), rows=sheetObjects_(sh);
  const matches=rows.filter(r=>String(r.question_id||'').trim()===id);
  const current=getStateMap_()[id]||{question_id:id,attempts:0,mastered:false,marked:false};
  const s=Object.assign({},current);
  if(patch.attempt)s.attempts=Number(s.attempts||0)+1;
  if(Object.prototype.hasOwnProperty.call(patch,'mastered'))s.mastered=!!patch.mastered;
  if(Object.prototype.hasOwnProperty.call(patch,'marked'))s.marked=!!patch.marked;
  if(patch.attempt){s.last_attempt=new Date();s.last_result=String(patch.result||'seen');s.last_response_sec=Number(patch.responseSec||0);}
  if(Object.prototype.hasOwnProperty.call(patch,'lastVariant'))s.last_variant=String(patch.lastVariant||'');
  if(Object.prototype.hasOwnProperty.call(patch,'lastCorrectOption'))s.last_correct_option=String(patch.lastCorrectOption||'');
  const q=getAllQuestions_().concat(getGeneratedQuestions_()).find(x=>String(x.question_id)===id)||{};
  const row=[id,Number(s.attempts||0),!!s.mastered,!!s.marked,s.last_attempt||'',s.last_result||'',Number(s.last_response_sec||0),q.chapter||s.chapter||'',q.topic||s.topic||'',q.subtopic||s.subtopic||'',s.last_variant||'',s.last_correct_option||''];
  if(matches.length){matches.forEach(r=>sh.getRange(r.__row,1,1,row.length).setValues([row]));}else sh.appendRow(row);
  return {question_id:id,attempts:row[1],mastered:row[2],marked:row[3],last_attempt:row[4],last_result:row[5],last_response_sec:row[6],last_variant:row[10],last_correct_option:row[11]};
}

function getStateMap_() {
  const m={};
  sheetObjects_(getSheet_(MATHS.SHEETS.STATE)).forEach(r=>{
    const id=String(r.question_id||'').trim(); if(!id)return;
    if(!m[id]) { m[id]=Object.assign({},r); return; }
    const a=m[id], b=r;
    a.attempts=Math.max(Number(a.attempts||0),Number(b.attempts||0));
    a.mastered=isMastered_(a)||isMastered_(b);
    a.marked=isMarked_(a)||isMarked_(b);
    const ta=dateMs_(a.last_attempt), tb=dateMs_(b.last_attempt);
    if(tb>ta){ a.last_attempt=b.last_attempt; a.last_result=b.last_result; a.last_response_sec=b.last_response_sec; a.last_variant=b.last_variant; a.last_correct_option=b.last_correct_option; }
    if(!a.chapter&&b.chapter)a.chapter=b.chapter; if(!a.topic&&b.topic)a.topic=b.topic; if(!a.subtopic&&b.subtopic)a.subtopic=b.subtopic;
  });
  return m;
}

function saveSession_(s) {
  getSheet_(MATHS.SHEETS.SESSIONS).appendRow([s.session_id,s.mode,s.title,s.question_ids_json,s.current_index,s.updated_at,s.completed,s.params_json]);
}

function getSessionById_(id) {
  return sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS)).find(r => String(r.session_id) === id);
}

function updateSessionProgress_(id, index, completed) {
  const sh = getSheet_(MATHS.SHEETS.SESSIONS);
  const r = sheetObjects_(sh).find(x => String(x.session_id) === id);
  if (!r) return;
  sh.getRange(r.__row,5,1,3).setValues([[Number(index || 0), new Date(), !!completed]]);
}

function getResumeSession_() {
  const rows = sheetObjects_(getSheet_(MATHS.SHEETS.SESSIONS))
    .filter(r => r.session_id && !bool_(r.completed))
    .sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));

  if (!rows.length) return null;
  const s = rows[0];
  const ids = json_(s.question_ids_json, []);
  return {
    sessionId:s.session_id,
    title:s.title,
    currentIndex:Number(s.current_index || 0),
    total:ids.length,
    mode:s.mode
  };
}

function getDemandSets_() {
  return sheetObjects_(getSheet_(MATHS.SHEETS.DEMAND_SETS))
    .filter(r => r.set_id && String(r.status || 'Active').toLowerCase() !== 'inactive')
    .map(r => {
      const ids = json_(r.question_ids_json, []);
      const base = {
        setId:String(r.set_id),
        name:String(r.set_name || 'Demand Set'),
        description:String(r.description || ''),
        count:ids.length,
        createdAt:r.created_at ? Utilities.formatDate(new Date(r.created_at), studyTimezone_(), 'dd MMM yyyy') : ''
      };
      if (base.setId === MATHS.CALC_SET_ID) {
        const groups = calculationDayGroups_(ids);
        const keys = Object.keys(groups).sort();
        base.dayCount = keys.length;
        base.days = keys.map((key, idx) => ({key:key, dayNumber:idx+1, dateLabel:formatCalcDate_(key), count:groups[key].length}));
      }
      return base;
    });
}

function getDemandSetById_(id) {
  return sheetObjects_(getSheet_(MATHS.SHEETS.DEMAND_SETS))
    .find(r => String(r.set_id) === String(id) && String(r.status || 'Active').toLowerCase() !== 'inactive');
}

function getSettingsObject_() {
  const o = {};
  sheetObjects_(getSheet_(MATHS.SHEETS.SETTINGS)).forEach(r => {
    if (r.key) o[String(r.key)] = r.value;
  });
  return o;
}

function getSetting_(key, fallback) {
  const o = getSettingsObject_();
  return Object.prototype.hasOwnProperty.call(o,key) ? o[key] : fallback;
}

function ensureMathsInfrastructure_() {
  const ss=SpreadsheetApp.getActive();
  ensureSheet_(ss,MATHS.SHEETS.QUESTIONS,['Question_ID','Chapter','Topic','Subtopic','Card_Type','Prompt','Answer','Explanation','Memory_Cue','Difficulty','Marked_Default','Mastered_Default','Diagram_Type','Diagram_JSON','Source_File','Source_Page','Source_URL','Status','Answer_Mode','Option_A','Option_B','Option_C','Option_D','Correct_Option','Template_Group','Variant_Types','Rotation_Tier']);
  ensureSheet_(ss,MATHS.SHEETS.STATE,['Question_ID','Attempts','Mastered','Marked','Last_Attempt','Last_Result','Last_Response_Sec','Chapter','Topic','Subtopic','Last_Variant','Last_Correct_Option']);
  ensureSheet_(ss,MATHS.SHEETS.ATTEMPTS,['Attempt_ID','Timestamp','Question_ID','Result','Response_Sec','Mode','Session_ID','Mastered_After','Marked_After']);
  ensureSheet_(ss,MATHS.SHEETS.SESSIONS,['Session_ID','Mode','Title','Question_IDs_JSON','Current_Index','Updated_At','Completed','Params_JSON']);
  ensureSheet_(ss,MATHS.SHEETS.NOTES,['Question_ID','Note','Updated_At','Pinned']);
  const settings=ensureSheet_(ss,MATHS.SHEETS.SETTINGS,['Key','Value']);
  ensureSheet_(ss,MATHS.SHEETS.GENERATED,['Question_ID','Chapter','Topic','Subtopic','Card_Type','Prompt','Answer','Explanation','Memory_Cue','Difficulty','Marked_Default','Mastered_Default','Diagram_Type','Diagram_JSON','Source_File','Source_Page','Source_URL','Status','Answer_Mode','Option_A','Option_B','Option_C','Option_D','Correct_Option','Template_Group','Variant_Types','Rotation_Tier']);
  ensureSheet_(ss,MATHS.SHEETS.PLAN,['Order','Chapter','Target_Per_Day','Status','Introduced','Mastered']);
  ensureSheet_(ss,MATHS.SHEETS.DEMAND_SETS,['Set_ID','Set_Name','Description','Question_IDs_JSON','Status','Created_At']);
  const existing={}; sheetObjects_(settings).forEach(r=>{if(r.key)existing[String(r.key)]=true;});
  Object.keys(MATHS.DEFAULTS).forEach(k=>{if(!existing[k])settings.appendRow([k,MATHS.DEFAULTS[k]]);});
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  } else {
    const existing = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String);
    headers.forEach(h => {
      if (!existing.includes(h)) {
        sh.getRange(1,sh.getLastColumn()+1).setValue(h);
        existing.push(h);
      }
    });
  }

  return sh;
}

function getSheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name);
  return sh;
}

function sheetObjects_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(key_);

  return values.slice(1).map((row,i) => {
    const o = {__row:i+2};
    headers.forEach((h,j) => o[h] = row[j]);
    return o;
  });
}

function key_(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}

function bool_(v) {
  return v === true || String(v).toLowerCase() === 'true' || String(v) === '1';
}

function json_(s, fallback) {
  try { return JSON.parse(String(s || '')); }
  catch (e) { return fallback; }
}

function shuffle_(a) {
  a = a.slice();
  for (let i=a.length-1;i>0;i--) {
    const j = Math.floor(Math.random() * (i+1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function uniqueQuestions_(arr) {
  const seen = {};
  return arr.filter(q => q && !seen[q.question_id] && (seen[q.question_id] = true));
}
