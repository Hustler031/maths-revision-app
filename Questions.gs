function sessionPayload_(sessionId, pool, state, title, mode, currentIndex, calcMeta) {
  const noteMap = getNotesMap_();
  const questions = pool.map(q => serveQuestion_(q, state[q.question_id], noteMap[q.question_id] || ''));
  rebalanceMcqPositions_(questions);

  return {
    ok:true,
    sessionId:sessionId,
    title:title,
    mode:mode,
    currentIndex:currentIndex,
    total:questions.length,
    questions:questions,
    calcMeta:calcMeta || null
  };
}

function serveQuestion_(q, s, note) {
  if (q.chapter === 'Triplets') return serveTriplet_(q, s, note);
  if (q.chapter === 'Fraction Patterns') return serveFraction_(q, s, note);
  if (q.chapter === 'Calculation Memory') return serveCalculationMemory_(q, s, note);

  const mode = inferAnswerMode_(q);
  const base = baseQuestion_(q, s, note);
  base.answerMode = mode;
  base.variantType = 'BASE';
  base.diagramType = shouldShowDiagram_(q) ? String(q.diagram_type || '') : '';
  base.diagramJson = shouldShowDiagram_(q) ? String(q.diagram_json || '') : '';

  if (mode === 'MCQ') {
    const built = buildOptions_(q);
    base.options = built.options;
    base.correctOption = built.correctOption;
  } else {
    base.options = [];
    base.correctOption = '';
  }

  return base;
}

function baseQuestion_(q, s, note) {
  return {
    questionId:String(q.question_id || ''),
    chapter:String(q.chapter || ''),
    topic:String(q.topic || ''),
    subtopic:String(q.subtopic || ''),
    cardType:String(q.card_type || ''),
    prompt:String(q.prompt || ''),
    answer:String(q.answer || ''),
    explanation:String(q.explanation || ''),
    memoryCue:String(q.memory_cue || ''),
    difficulty:String(q.difficulty || 'Medium'),
    sourceFile:String(q.source_file || ''),
    sourcePage:String(q.source_page || ''),
    sourceUrl:String(q.source_url || ''),
    rotationTier:rotationTier_(q),
    mastered:isMastered_(s),
    marked:isMarked_(s),
    attempts:Number((s || {}).attempts || 0),
    note:String(note || '')
  };
}

function inferAnswerMode_(q) {
  if (q.chapter === 'Triplets' || q.chapter === 'Fraction Patterns' || q.chapter === 'Calculation Training' || q.chapter === 'Calculation Memory') return 'MCQ';
  const explicit = String(q.answer_mode || '').trim().toUpperCase();
  if (explicit === 'MCQ' || explicit === 'REVEAL') return explicit;
  const type = String(q.card_type || '').toLowerCase();
  return ['formula','pattern','calculation','application'].includes(type) ? 'MCQ' : 'REVEAL';
}

function shouldShowDiagram_(q) {
  const type=String(q.diagram_type||'').trim();
  const raw=String(q.diagram_json||'').trim();
  if(!type||!raw||raw==='{}')return false;
  try {
    const parsed=JSON.parse(raw);
    return !!(parsed && !Array.isArray(parsed) && typeof parsed==='object' && Object.keys(parsed).length && parsed.show!==false);
  } catch(e) { return false; }
}

function buildOptions_(q) {
  const explicit = [q.option_a, q.option_b, q.option_c, q.option_d].map(x => String(x || '').trim());
  if (explicit.every(Boolean)) {
    const ck = String(q.correct_option || '').trim().toUpperCase();
    const answer = String(q.answer || '').trim();
    let correctText = '';
    if (['A','B','C','D'].includes(ck)) correctText = explicit[['A','B','C','D'].indexOf(ck)];
    if (!correctText) correctText = explicit.find(x => normalize_(x) === normalize_(answer)) || answer;
    return shuffleOptionTexts_(explicit, correctText, String((q.__state || {}).last_correct_option || ''));
  }

  const bank = coordinateOptionBank_()[String(q.question_id || '')];
  if (bank) return shuffleOptionTexts_(bank, String(q.answer || ''));

  const answer = String(q.answer || '').trim();
  return shuffleOptionTexts_([answer, 'None of these', 'Cannot be determined', 'Not applicable'], answer);
}

function coordinateOptionBank_() {
  return {
    CG002:['m = -a/b','m = a/b','m = -b/a','m = b/a'],
    CG003:['x-intercept: set y=0; y-intercept: set x=0','x-intercept: set x=0; y-intercept: set y=0','Set x=y=0 for both','Differentiate the equation'],
    CG004:['x/a + y/b = 1','x/b + y/a = 1','ax + by = 1','x/a - y/b = 1'],
    CG005:['√[(x2-x1)^2 + (y2-y1)^2]','√[(x2+x1)^2 + (y2+y1)^2]','(x2-x1)+(y2-y1)','√[(x2-x1)+(y2-y1)]'],
    CG006:['m = (y2-y1)/(x2-x1)','m = (x2-x1)/(y2-y1)','m = (y2+y1)/(x2+x1)','m = -(y2-y1)/(x2-x1)'],
    CG008:['(x,-y)','(-x,y)','(-x,-y)','(y,x)'],
    CG009:['(-x,y)','(x,-y)','(-x,-y)','(y,x)'],
    CG010:['(-x,-y)','(-x,y)','(x,-y)','(y,x)'],
    CG011:['(y,x)','(-y,-x)','(-x,y)','(x,-y)'],
    CG012:['(2h-x, y)','(x,2h-y)','(h-x,y)','(2x-h,y)'],
    CG013:['(x, 2k-y)','(2k-x,y)','(x,k-y)','(x,2y-k)'],
    CG014:['(x-x1)/a = (y-y1)/b = -2(ax1+by1+c)/(a^2+b^2)','(x+x1)/a = (y+y1)/b = 2(ax1+by1+c)/(a^2+b^2)','(x-x1)/b = (y-y1)/a = -(ax1+by1+c)/(a^2+b^2)','(x-x1)/a = (y-y1)/b = -(ax1+by1+c)/(a^2+b^2)'],
    CG015:['((m x2+n x1)/(m+n), (m y2+n y1)/(m+n))','((m x1+n x2)/(m+n), (m y1+n y2)/(m+n))','((m x2-n x1)/(m-n), (m y2-n y1)/(m-n))','((x1+x2)/2,(y1+y2)/2)'],
    CG016:['((m x2-n x1)/(m-n), (m y2-n y1)/(m-n))','((m x2+n x1)/(m+n), (m y2+n y1)/(m+n))','((m x1-n x2)/(m-n), (m y1-n y2)/(m-n))','((x1+x2)/2,(y1+y2)/2)'],
    CG017:['((x1+x2)/2, (y1+y2)/2)','((x2-x1)/2,(y2-y1)/2)','(x1+x2,y1+y2)','((x1+y1)/2,(x2+y2)/2)'],
    CG018:['1/2 |x1(y2-y3)+x2(y3-y1)+x3(y1-y2)|','|x1(y2-y3)+x2(y3-y1)+x3(y1-y2)|','1/3 |x1(y2-y3)+x2(y3-y1)+x3(y1-y2)|','1/2 |x1(y2+y3)+x2(y3+y1)+x3(y1+y2)|'],
    CG019:['Area of triangle formed by them = 0','All three slopes must be 0','Their midpoint must be the origin','All x-coordinates must be equal'],
    CG020:['slope AB = slope BC (or AB = AC)','slope AB × slope BC = -1','slope AB + slope BC = 0','All slopes are undefined'],
    CG021:['y-y1 = m(x-x1)','y+y1 = m(x+x1)','x-x1 = m(y-y1)','y-y1 = (x-x1)/m²'],
    CG023:['m1 = m2','m1m2 = -1','m1 + m2 = 0','m1/m2 = -1'],
    CG024:['m1 m2 = -1','m1 = m2','m1 + m2 = 1','m1m2 = 1'],
    CG025:['tanθ = |(m1-m2)/(1+m1m2)|','tanθ = |(m1+m2)/(1-m1m2)|','tanθ = |(1+m1m2)/(m1-m2)|','tanθ = |m1-m2|'],
    CG026:['m = tanθ','m = sinθ','m = cosθ','m = cotθ'],
    CG027:['|ax1+by1+c|/√(a^2+b^2)','|ax1+by1+c|/(a^2+b^2)','|ax1+by1-c|/√(a^2-b^2)','√(a^2+b^2)/|ax1+by1+c|'],
    CG028:['|c1-c2|/√(a^2+b^2)','|c1+c2|/√(a^2+b^2)','|c1-c2|/(a^2+b^2)','√(a^2+b^2)/|c1-c2|'],
    CG032:['((x1+x2+x3)/3, (y1+y2+y3)/3)','((x1+x2+x3)/2,(y1+y2+y3)/2)','((x1+x2)/2,(y1+y2)/2)','((x1+x2+x3),(y1+y2+y3))'],
    CG034:['((a x1+b x2+c x3)/(a+b+c), (a y1+b y2+c y3)/(a+b+c))','((x1+x2+x3)/3,(y1+y2+y3)/3)','((a x1+b x2+c x3)/(abc),(a y1+b y2+c y3)/(abc))','((x1/a+x2/b+x3/c),(y1/a+y2/b+y3/c))'],
    CG039:['PA² = PB²','PA = PB²','PA² + PB² = 0','slope PA = slope PB'],
    CG040:['Area = |ab|/2','Area = |ab|','Area = |a+b|/2','Area = |a-b|/2'],
    CG042:['ax + by - (ax1+by1) = 0','bx - ay - (bx1-ay1)=0','ax - by + (ax1+by1)=0','a(x-x1)-b(y-y1)=0'],
    CG043:['bx - ay + k = 0 (or any proportional form)','ax + by + k = 0','ax - by + k = 0','-ax - by + k = 0'],
    CG044:['Substitute the point coordinates directly into the line equation.','Differentiate the line equation.','Set both coordinates equal to zero.','Use only the x-coordinate.'],
    CG045:['(d/a, d/b, d/c)','(a/d,b/d,c/d)','(d/a,d/a,d/a)','(a,b,c)']
  };
}

function serveFraction_(q, s, note) {
  const base = baseQuestion_(q, s, note);
  const parsed = parseFractionCard_(q);
  const variants = splitVariants_(q.variant_types, ['DIRECT','REVERSE','MULTIPLE']);
  const variant = chooseVariant_(variants, String((s || {}).last_variant || ''));

  let prompt;
  let answer;
  let choices;
  let explanation;

  if (variant === 'REVERSE') {
    prompt = parsed.fractionText + ' ≈ ?';
    answer = formatPercent_(parsed.percent);
    choices = [parsed.percent, parsed.percent + parsed.basePercent, Math.max(0, parsed.percent - parsed.basePercent), parsed.percent + 2 * parsed.basePercent].map(formatPercent_);
    explanation = parsed.fractionText + ' means ' + parsed.numerator + ' × (' + formatPercent_(parsed.basePercent) + '). Therefore it is approximately ' + formatPercent_(parsed.percent) + '.';
  } else if (variant === 'MULTIPLE') {
    prompt = formatPercent_(parsed.basePercent) + ' × ' + parsed.numerator + ' ≈ ?';
    answer = parsed.fractionText;
    choices = nearbyFractions_(parsed.numerator, parsed.denominator);
    explanation = formatPercent_(parsed.basePercent) + ' is the 1/' + parsed.denominator + ' pattern. Multiplying by ' + parsed.numerator + ' gives ' + parsed.fractionText + '.';
  } else {
    prompt = formatPercent_(parsed.percent) + ' ≈ ?';
    answer = parsed.fractionText;
    choices = nearbyFractions_(parsed.numerator, parsed.denominator);
    explanation = formatPercent_(parsed.basePercent) + ' ≈ 1/' + parsed.denominator + '. Since ' + formatPercent_(parsed.percent) + ' is ' + parsed.numerator + ' times that base percentage, think ' + parsed.fractionText + '.';
  }

  const shuffled = shuffleOptionTexts_(uniqueStrings_(choices.concat([answer])).slice(0,4), answer, String((s || {}).last_correct_option || ''));

  base.prompt = prompt;
  base.answer = answer;
  base.explanation = explanation;
  base.answerMode = 'MCQ';
  base.options = shuffled.options;
  base.correctOption = shuffled.correctOption;
  base.variantType = variant;
  base.diagramType = '';
  base.diagramJson = '';
  return base;
}

function serveTriplet_(q, s, note) {
  const base = baseQuestion_(q, s, note);
  const t = parseTripletCard_(q);
  const variants = splitVariants_(q.variant_types, ['MISSING','RECOGNIZE','SCALED','NOT_TRIPLET','APPLICATION']);
  const variant = chooseVariant_(variants, String((s || {}).last_variant || ''));

  let prompt = '';
  let answer = '';
  let choices = [];
  let explanation = '';

  if (variant === 'RECOGNIZE') {
    prompt = 'Which of the following is a Pythagorean triplet?';
    answer = t.a + ', ' + t.b + ', ' + t.c;
    choices = [answer, t.a + ', ' + t.b + ', ' + (t.c + 1), (t.a + 1) + ', ' + t.b + ', ' + t.c, t.a + ', ' + (t.b - 1) + ', ' + t.c];
    explanation = 'Check a² + b² = c². For ' + answer + ': ' + t.a + '² + ' + t.b + '² = ' + (t.a*t.a + t.b*t.b) + ' = ' + t.c + '².';
  } else if (variant === 'NOT_TRIPLET') {
    const valid = shuffle_(tripletPool_().filter(x => !(x[0] === t.a && x[1] === t.b && x[2] === t.c)));
    const bad = [t.a, t.b, t.c + 1];
    prompt = 'Which of the following is NOT a Pythagorean triplet?';
    answer = bad.join(', ');
    choices = [answer].concat(valid.slice(0,3).map(x => x.join(', ')));
    explanation = t.a + '² + ' + t.b + '² = ' + (t.a*t.a + t.b*t.b) + ', but ' + (t.c+1) + '² = ' + ((t.c+1)*(t.c+1)) + ', so that option fails the Pythagorean test.';
  } else if (variant === 'APPLICATION') {
    prompt = 'A right triangle has perpendicular sides ' + t.a + ' and ' + t.b + '. What is its hypotenuse?';
    answer = String(t.c);
    choices = nearbyNumbers_(t.c);
    explanation = t.a + '² + ' + t.b + '² = ' + (t.a*t.a + t.b*t.b) + ' = ' + t.c + '², so the hypotenuse is ' + t.c + '.';
  } else if (variant === 'SCALED') {
    const factor = (t.a + t.b + t.c) % 2 === 0 ? 3 : 2;
    const A = t.a * factor;
    const B = t.b * factor;
    const C = t.c * factor;
    prompt = A + ', ' + B + ', ?';
    answer = String(C);
    choices = nearbyNumbers_(C);
    explanation = 'This is ' + factor + ' × (' + t.a + ', ' + t.b + ', ' + t.c + '). Multiples of a Pythagorean triplet remain triplets.';
  } else {
    prompt = t.a + ', ' + t.b + ', ?';
    answer = String(t.c);
    choices = nearbyNumbers_(t.c);
    explanation = 'Recognize ' + t.a + '-' + t.b + '-' + t.c + '. Verification: ' + t.a + '² + ' + t.b + '² = ' + t.c + '².';
  }

  const shuffled = shuffleOptionTexts_(uniqueStrings_(choices.concat([answer])).slice(0,4), answer, String((s || {}).last_correct_option || ''));

  base.prompt = prompt;
  base.answer = answer;
  base.explanation = explanation;
  base.memoryCue = t.a + '-' + t.b + '-' + t.c;
  base.answerMode = 'MCQ';
  base.options = shuffled.options;
  base.correctOption = shuffled.correctOption;
  base.variantType = variant;
  base.diagramType = '';
  base.diagramJson = '';
  return base;
}

function serveCalculationMemory_(q, s, note) {
  const base = baseQuestion_(q, s, note);
  const isCube = String(q.topic || '').toLowerCase() === 'cubes' || /^CB/i.test(String(q.question_id || ''));
  const nMatch = String(q.question_id || '').match(/(\d+)$/) || String(q.prompt || '').match(/(\d+)/);
  const n = Number(nMatch ? nMatch[1] : 1);
  const value = isCube ? n*n*n : n*n;
  const fallbackVariants = isCube ? ['DIRECT','REVERSE','IDENTIFY'] : ['DIRECT','REVERSE','IDENTIFY','NEARBY'];
  const variants = splitFlexibleVariants_(q.variant_types, fallbackVariants);
  const variant = chooseVariant_(variants, String((s || {}).last_variant || ''));

  let prompt = '';
  let answer = '';
  let choices = [];
  let explanation = '';
  let memoryCue = '';

  if (variant === 'REVERSE') {
    prompt = value + ' is the ' + (isCube ? 'cube' : 'square') + ' of which number?';
    answer = String(n);
    choices = closeRoots_(n);
    explanation = 'Recall the pair directly: ' + n + (isCube ? '³ = ' : '² = ') + value + '.';
    memoryCue = value + ' ↔ ' + n + (isCube ? '³' : '²');
  } else if (variant === 'IDENTIFY') {
    prompt = 'Which of the following pairings is correct?';
    answer = n + (isCube ? '³ = ' : '² = ') + value;
    const roots = closeRoots_(n).filter(x => Number(x) !== n).slice(0,3);
    choices = [answer].concat(roots.map((r,i) => {
      const rr = Number(r);
      const trueVal = isCube ? rr*rr*rr : rr*rr;
      return rr + (isCube ? '³ = ' : '² = ') + sameUnitDistractor_(trueVal, i+1, 10);
    }));
    explanation = 'The exact memory pair is ' + answer + '. Recall the full value, not only the last digit.';
    memoryCue = 'Exact pair.';
  } else {
    prompt = n + (isCube ? '³ = ?' : '² = ?');
    answer = String(value);
    choices = sameUnitDigitOptions_(value, 10);
    explanation = (isCube ? 'Cube' : 'Square') + ' to memorize: ' + n + (isCube ? '³ = ' : '² = ') + value + '.';
    memoryCue = 'Instant target: ' + n + (isCube ? '³ → ' : '² → ') + value;
  }

  const shuffled = shuffleOptionTexts_(uniqueStrings_(choices.concat([answer])).slice(0,4), answer, String((s || {}).last_correct_option || ''));

  base.prompt = prompt;
  base.answer = answer;
  base.explanation = explanation;
  base.memoryCue = memoryCue;
  base.answerMode = 'MCQ';
  base.options = shuffled.options;
  base.correctOption = shuffled.correctOption;
  base.variantType = variant;
  base.diagramType = '';
  base.diagramJson = '';
  return base;
}

function parseFractionCard_(q) {
  const percentMatch = String(q.prompt || '').match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  const percent = percentMatch ? Number(percentMatch[1]) : 0;
  const frMatches = String(q.answer || '').match(/(\d+)\s*\/\s*(\d+)/g) || [];
  const first = frMatches[0] || '1/1';
  const p = first.split('/').map(Number);
  const numerator = p[0] || 1;
  const denominator = p[1] || 1;
  const basePercent = numerator ? percent / numerator : percent;
  return {percent:percent, numerator:numerator, denominator:denominator, fractionText:first.replace(/\s/g,''), basePercent:basePercent};
}

function parseTripletCard_(q) {
  const nums = String(q.prompt || '').match(/\d+/g) || [];
  const a = Number(nums[0] || 3);
  const b = Number(nums[1] || 4);
  const ans = String(q.answer || '').match(/\d+/);
  const c = Number(ans ? ans[0] : Math.round(Math.sqrt(a*a+b*b)));
  return {a:a,b:b,c:c};
}

function splitVariants_(raw, fallback) {
  const arr = String(raw || '').split(/[|,]/).map(x => x.trim().toUpperCase()).filter(Boolean);
  return arr.length ? arr : fallback.slice();
}

function splitFlexibleVariants_(raw, fallback) {
  const arr = String(raw || '').split(/[|,]/).map(x => x.trim().toUpperCase()).filter(Boolean);
  const normalized = arr.map(v => v === 'MIXED' ? 'IDENTIFY' : v);
  return normalized.length ? normalized : fallback.slice();
}

function chooseVariant_(variants, last) {
  const choices = variants.filter(v => v !== String(last || '').toUpperCase());
  const pool = choices.length ? choices : variants;
  return pool[Math.floor(Math.random() * pool.length)];
}

function nearbyFractions_(n, d) {
  return uniqueStrings_([n, Math.max(1,n-1), n+1, n+2].map(x => x + '/' + d));
}

function nearbyNumbers_(n) {
  const d = n < 20 ? 1 : (n < 60 ? 2 : 3);
  return uniqueStrings_([String(n), String(Math.max(1,n-d)), String(n+d), String(n+2*d)]);
}

function tripletPool_() {
  return [[3,4,5],[5,12,13],[8,15,17],[7,24,25],[20,21,29],[12,35,37],[9,40,41],[11,60,61],[28,45,53],[33,56,65]];
}

function formatPercent_(x) {
  const rounded = Math.round(x * 100) / 100;
  return (Math.abs(rounded - Math.round(rounded)) < 1e-9 ? String(Math.round(rounded)) : rounded.toFixed(2).replace(/0$/,'').replace(/\.$/,'')) + '%';
}

function sameUnitDigitOptions_(correctValue, step) {
  const c = Number(correctValue);
  const vals = [c];
  const offsets = shuffle_([1,2,3,4,5,6]);
  offsets.forEach(k => {
    if (vals.length >= 4) return;
    const sign = vals.length % 2 ? -1 : 1;
    let v = c + sign * k * Number(step || 10);
    if (v <= 0 || Math.abs(v)%10 !== Math.abs(c)%10) v = c + k * Number(step || 10);
    if (v > 0 && Math.abs(v)%10 === Math.abs(c)%10 && !vals.includes(v)) vals.push(v);
  });
  let k = 1;
  while (vals.length < 4) {
    const v = c + k*10;
    if (!vals.includes(v)) vals.push(v);
    k++;
  }
  return vals.map(String);
}

function sameUnitDistractor_(trueValue, index, step) {
  const c = Number(trueValue);
  const s = Number(step || 10);
  let v = c + (index % 2 ? index*s : -index*s);
  if (v <= 0 || Math.abs(v)%10 !== Math.abs(c)%10) v = c + index*10;
  return v;
}

function closeRoots_(n) {
  const c = Number(n);
  return shuffle_(uniqueStrings_([c,c-1,c+1,c+2,c-2,c+3].filter(x => x > 0).map(String))).slice(0,4);
}

function shuffleOptionTexts_(texts, correctText, avoidOption) {
  const correct = String(correctText || '').trim();
  const uniq = uniqueStrings_(texts.map(String));
  if (!uniq.some(x => normalize_(x) === normalize_(correct))) uniq.unshift(correct);
  while (uniq.length < 4) uniq.push('None of these ' + uniq.length);

  let objs = uniq.slice(0,4).map(text => ({text:text, correct:normalize_(text) === normalize_(correct)}));
  objs = shuffle_(objs);

  const keys = ['A','B','C','D'];
  let correctOption = '';
  let options = objs.map((o,i) => {
    if (o.correct) correctOption = keys[i];
    return {key:keys[i], text:o.text};
  });

  if (!correctOption) {
    options[0] = {key:'A', text:correct};
    correctOption = 'A';
  }

  const avoid = String(avoidOption || '').toUpperCase();
  if (avoid && correctOption === avoid) {
    const ci = keys.indexOf(correctOption);
    const candidates = [0,1,2,3].filter(i => i !== ci);
    const swapIndex = candidates[Math.floor(Math.random()*candidates.length)];
    const temp = options[ci].text;
    options[ci].text = options[swapIndex].text;
    options[swapIndex].text = temp;
    correctOption = keys[swapIndex];
  }

  return {options:options, correctOption:correctOption};
}

function uniqueStrings_(arr) {
  const seen = {};
  return arr.filter(x => {
    const k = normalize_(x);
    if (!k || seen[k]) return false;
    seen[k] = 1;
    return true;
  });
}

function normalize_(x) {
  return String(x || '').replace(/\s+/g,'').toLowerCase();
}
