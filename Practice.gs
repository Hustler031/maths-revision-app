function selectCalculationTraining_(ids, map, state, request) {
  const groups = calculationDayGroups_(ids);
  const keys = Object.keys(groups).sort();
  if (!keys.length) return {pool:[], title:'Calculation Training', meta:null};

  const latestKey = keys[keys.length - 1];
  const calcMode = String(request.calcMode || 'day').toLowerCase();
  const requestedKey = String(request.calcDayKey || latestKey);

  let pool;
  let currentKey = requestedKey;
  let title;

  if (calcMode === 'mixed' || calcMode === 'random' || calcMode === 'weak') {
    const allIds = [];
    keys.forEach(k => allIds.push.apply(allIds, groups[k]));
    const allPool = allIds.map(id => map[String(id)]).filter(q => q && active_(q));
    const count = Math.max(1, Number(request.count || 30));
    if (calcMode === 'random') {
      pool = shuffle_(allPool).slice(0, Math.min(count, allPool.length));
      title = 'Calculation Training · Random Practice';
      currentKey = 'RANDOM';
    } else if (calcMode === 'weak') {
      pool = weakCalculationSample_(allPool, state, count);
      title = 'Calculation Training · Weak Practice';
      currentKey = 'WEAK';
    } else {
      pool = weightedCalculationMixed_(allPool, state, count);
      title = 'Calculation Training · Mixed Revision';
      currentKey = 'MIXED';
    }
  } else {
    if (!groups[currentKey]) currentKey = latestKey;
    pool = groups[currentKey].map(id => map[String(id)]).filter(q => q && active_(q));
    pool = shuffle_(pool);
    const dayNumber = keys.indexOf(currentKey) + 1;
    title = 'Calculation Training · Day ' + dayNumber + ' · ' + formatCalcDate_(currentKey);
  }

  return {
    pool:pool,
    title:title,
    meta:buildCalculationMeta_(ids, {calcMode:calcMode, calcDayKey:currentKey})
  };
}

function buildCalculationMeta_(ids, request) {
  const groups = calculationDayGroups_(ids);
  const keys = Object.keys(groups).sort();
  if (!keys.length) return null;

  const latestKey = keys[keys.length - 1];
  const mode = String(request.calcMode || '').toLowerCase();
  const currentKey = mode === 'mixed' ? 'MIXED'
    : mode === 'random' ? 'RANDOM'
    : mode === 'weak' ? 'WEAK'
    : String(request.calcDayKey || latestKey);

  return {
    isCalculationTraining:true,
    setId:MATHS.CALC_SET_ID,
    latestKey:latestKey,
    currentKey:currentKey,
    days:keys.map((key, idx) => ({
      key:key,
      dayNumber:idx + 1,
      dateLabel:formatCalcDate_(key),
      label:'Day ' + (idx + 1) + ' · ' + formatCalcDate_(key),
      count:groups[key].length
    }))
  };
}

function calculationDayGroups_(ids) {
  const groups = {};
  (ids || []).forEach(id => {
    const m = String(id || '').match(/^CT(\d{6})\d{2}$/i);
    if (!m) return;
    const key = m[1];
    if (!groups[key]) groups[key] = [];
    groups[key].push(String(id));
  });
  return groups;
}

function formatCalcDate_(key) {
  const s = String(key || '');
  if (!/^\d{6}$/.test(s)) return s;
  const yy = 2000 + Number(s.slice(0,2));
  const mm = Number(s.slice(2,4));
  const dd = Number(s.slice(4,6));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return dd + ' ' + (months[mm-1] || '') + ' ' + yy;
}

function weightedCalculationMixed_(pool, state, count) {
  const scored = pool.map(q => {
    const s = state[q.question_id] || {};
    const wrong = String(s.last_result || '').toLowerCase() === 'wrong' ? 6 : 0;
    const slow = Number(s.last_response_sec || 0) >= 25 ? 3 : Number(s.last_response_sec || 0) >= 15 ? 1 : 0;
    const fresh = Number(s.attempts || 0) === 0 ? 2 : 0;
    return {q:q, weight:1 + wrong + slow + fresh};
  });

  const out = [];
  const used = {};
  while (out.length < Math.min(count, scored.length)) {
    const available = scored.filter(x => !used[x.q.question_id]);
    if (!available.length) break;
    const total = available.reduce((sum,x) => sum + x.weight, 0);
    let r = Math.random() * total;
    let chosen = available[available.length - 1];
    for (let i=0;i<available.length;i++) {
      r -= available[i].weight;
      if (r <= 0) { chosen = available[i]; break; }
    }
    used[chosen.q.question_id] = true;
    out.push(chosen.q);
  }
  return out;
}

function weakCalculationSample_(pool, state, count) {
  const attemptedWeak = pool.map(q => {
    const s = state[q.question_id] || {};
    const attempts = Number(s.attempts || 0);
    const wrong = String(s.last_result || '').toLowerCase() === 'wrong';
    const sec = Number(s.last_response_sec || 0);
    const slow = sec >= 15;
    const score = (wrong ? 10 : 0) + (sec >= 25 ? 6 : slow ? 3 : 0) + Math.min(attempts, 3);
    return {q:q, score:score, weak:wrong || slow};
  });
  let candidates = attemptedWeak.filter(x => x.weak).sort((a,b) => b.score-a.score);
  if (!candidates.length) return weightedCalculationMixed_(pool, state, count);
  const out = [];
  const used = {};
  candidates.forEach(x => { if(out.length<count && !used[x.q.question_id]){used[x.q.question_id]=true;out.push(x.q);} });
  if (out.length < count) {
    weightedCalculationMixed_(pool, state, count).forEach(q => {if(out.length<count&&!used[q.question_id]){used[q.question_id]=true;out.push(q);}});
  }
  return out.slice(0, Math.min(count, pool.length));
}

function weightedGeneratedSample_(pool, state, count, request) {
  const src = pool.slice();
  if (!src.length) return [];
  const isCalc = String(request.chapter || '') === 'Calculation Memory' || src.some(q => q.chapter === 'Calculation Memory');
  if (!isCalc) return shuffle_(src).slice(0, count);

  const weighted = [];
  src.forEach(q => {
    const st = state[q.question_id] || {};
    const attempts = Number(st.attempts || 0);
    const priority = /Priority/i.test(String(q.subtopic || '')) ? 5 : 1;
    const weakness = String(st.last_result || '').toLowerCase() === 'wrong' ? 3 : 0;
    const freshness = attempts === 0 ? 2 : 0;
    const copies = Math.max(1, priority + weakness + freshness);
    for (let i=0;i<copies;i++) weighted.push(q);
  });

  const out = [];
  const used = {};
  shuffle_(weighted).forEach(q => {
    if (out.length >= count || used[q.question_id]) return;
    used[q.question_id] = true;
    out.push(q);
  });

  if (out.length < count) {
    shuffle_(src).forEach(q => {
      if (out.length < count && !used[q.question_id]) {
        used[q.question_id] = true;
        out.push(q);
      }
    });
  }

  return out.slice(0, count);
}

function rebalanceMcqPositions_(questions) {
  const mcqs = questions.filter(q => q.answerMode === 'MCQ' && Array.isArray(q.options) && q.options.length === 4);
  const targets = [];

  while (targets.length < mcqs.length) {
    const block = shuffle_(['A','B','C','D']);
    if (targets.length && block[0] === targets[targets.length - 1]) {
      const t = block[0]; block[0] = block[1]; block[1] = t;
    }
    targets.push.apply(targets, block);
  }

  mcqs.forEach((q, idx) => forceCorrectPosition_(q, targets[idx]));
}

function forceCorrectPosition_(q, targetKey) {
  const keys = ['A','B','C','D'];
  const correctObj = (q.options || []).find(o => o.key === q.correctOption);
  if (!correctObj) return;

  const wrong = shuffle_((q.options || []).filter(o => o.key !== q.correctOption).map(o => ({text:o.text})));
  const targetIndex = keys.indexOf(targetKey);
  const rebuilt = [];
  let w = 0;

  for (let i=0;i<4;i++) {
    if (i === targetIndex) rebuilt.push({key:keys[i], text:correctObj.text});
    else rebuilt.push({key:keys[i], text:wrong[w++].text});
  }

  q.options = rebuilt;
  q.correctOption = targetKey;
}
