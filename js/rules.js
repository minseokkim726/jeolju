// 규칙(판정) 모음. 순수 함수만 둔다: 입력(기록·목표·설정·기준 날짜) → 출력(값).
// DOM·저장소에 접근하지 않는다. tests.html이 이 파일을 시험한다.

export const SCHEMA_VERSION = 2; // 2: condition = 그날 아침 컨디션(v1은 다음 날 아침)
export const APP_ID = 'jeolju';

// ---------- 단위와 환산 (명세 3장) ----------
// 내부 저장은 순수 알코올 g. 표시 단위만 바뀐다.
// step: −/+ 한 번에 바뀌는 표시 값. cnt: 짧은 표시의 끝말(4.5잔·1.5병)
export const UNITS = {
  soju: { g: 6.5, label: '소주잔', pre: '소주 ', suf: '잔', cnt: '잔', step: 1, short: '잔' },
  soju_bottle: { g: 47, label: '소주 병', pre: '소주 ', suf: '병', cnt: '병', step: 0.5, short: '병' },
  std: { g: 10, label: '표준잔', pre: '', suf: '표준잔', cnt: '잔', step: 1, short: '표준잔' },
  beer: { g: 14, label: '맥주 캔(355ml)', pre: '맥주 ', suf: '캔', cnt: '캔', step: 1, short: '캔' },
};
// 주종 칩 9개(3×3). 맥주 500cc와 맥주 1병은 g이 같아도 내역 표시를 위해 따로 둔다.
export const DRINKS = [
  { key: 'soju', label: '소주 1잔', detail: '50ml, 16.5%', g: 6.5, short: '소주' },
  { key: 'soju_half', label: '소주 반 병', detail: '180ml', g: 23.5, short: '소주 반 병' },
  { key: 'soju_bottle', label: '소주 1병', detail: '360ml', g: 47, short: '소주 병' },
  { key: 'beer_can', label: '맥주 1캔', detail: '355ml, 5%', g: 14, short: '맥주 캔' },
  { key: 'beer_500', label: '맥주 500cc', detail: '', g: 20, short: '맥주 500cc' },
  { key: 'beer_bottle', label: '맥주 1병', detail: '500ml', g: 20, short: '맥주 병' },
  { key: 'wine', label: '와인 1잔', detail: '150ml, 12%', g: 14, short: '와인' },
  { key: 'makgeolli', label: '막걸리 1사발', detail: '200ml, 6%', g: 9.5, short: '막걸리' },
  { key: 'whisky', label: '위스키 1샷', detail: '30ml, 40%', g: 9.5, short: '위스키' },
];
export const DRINK_BY_KEY = Object.fromEntries(DRINKS.map((d) => [d.key, d]));
export const OCCASIONS = ['회식', '모임', '가족', '혼술', '기타'];
export const CONDITIONS = { 1: '나쁨', 2: '보통', 3: '좋음' };
// v1.3 안주(음주일만, 모두 선택). 칼로리 계산은 하지 않는다.
export const FOOD_AMOUNTS = { 1: '적게', 2: '보통', 3: '많이' };
export const FOOD_TYPES = [
  { key: 'meat', label: '고기' },
  { key: 'fried', label: '튀김·치킨' },
  { key: 'seafood', label: '회·해산물' },
  { key: 'soup', label: '국물·찌개' },
  { key: 'dry_fruit', label: '마른안주·과일' },
  { key: 'etc', label: '기타' },
];
export const FOOD_TYPE_LABEL = Object.fromEntries(FOOD_TYPES.map((x) => [x.key, x.label]));
export const FOOD_FINISH = { none: '없음', meal: '밥·면', late: '2차 야식' };
export const KCAL_PER_G = 7;

export const DEFAULT_SETTINGS = {
  unit: 'soju',
  heavyG: 45.5,
  weekStartsOn: 0, // v1.4: 0=일요일(새로 설치 기본), 1=월요일. 이미 쓰던 기기에 값이 없으면 월요일로 읽는다(repo.js)
  showWeight: true,
  showCondition: true,
  showOccasion: true,
  dayCutoffHour: 6, // v1.4: 설정에서 0~10시
  baseline: null, // { drinkDaysPerWeek, gPerOccasion, heavyPerWeek }
  longTermNote: '',
  startDate: null,
  targetDate: null, // 목표일(선택). 예 2026-12-31
  lastBackupAt: null,
  onboarded: false,
  dismissedSuggestion: null, // 제안 카드를 [그대로 두기]한 주(주 시작일)
};

export const DEFAULT_GOAL = {
  weeklyDrinkDaysMax: 2,
  weeklyTotalG: null,
  heavyMaxPerWeek: 0,
  dryWeekdays: [],
  defaultLimitG: 26,
  note: '',
};

const U = (unit) => UNITS[unit] || UNITS.soju;
export const unitG = (unit) => U(unit).g;
export const unitStep = (unit) => U(unit).step;
export const roundHalf = (x) => Math.round(x * 2) / 2;
// g → 표시 값(0.5 단위 반올림). 조금이라도 마셨으면 0이 아니라 0.5로 보인다(병 단위에서 소주 1잔이 "0병"이 되지 않게).
export function toDisplay(g, unit) {
  const v = Number(g) || 0;
  const r = roundHalf(v / unitG(unit));
  return v > 0 && r === 0 ? 0.5 : r;
}
// 표시 값 → g
export const fromDisplay = (n, unit) => Math.round((Number(n) || 0) * unitG(unit) * 1000) / 1000;
export const kcalOf = (g) => Math.round((Number(g) || 0) * KCAL_PER_G);
export const fmtNum = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
// 병 단위일 때 옆에 붙이는 잔 수: "약 10.5잔". 다른 단위면 ''
export const cupsHint = (g, unit) => (unit === 'soju_bottle' ? `약 ${fmtNum(toDisplay(g, 'soju'))}잔` : '');
// "소주 4.5잔" / "소주 1.5병 (약 10.5잔)" / "4.5표준잔" / "맥주 2캔"
export function fmtAmount(g, unit) {
  const u = U(unit);
  const hint = cupsHint(g, unit);
  return `${u.pre}${fmtNum(toDisplay(g, unit))}${u.suf}${hint ? ` (${hint})` : ''}`;
}
// 짧게: "4.5잔" / "1.5병" / "2캔"
export function fmtCount(g, unit) {
  return `${fmtNum(toDisplay(g, unit))}${U(unit).cnt}`;
}
export const unitSuffix = (unit) => U(unit).cnt;
// 기록 카드·상한 정하기의 [잔 | 병] 전환: 잔 쪽은 설정 단위가 잔 계열(소주잔·표준잔·맥주 캔)이면 그것, 아니면 소주잔
export const cupUnitOf = (unit) => (unit === 'soju_bottle' || !UNITS[unit] ? 'soju' : unit);

// ---------- 날짜 (모두 'YYYY-MM-DD', 시간대 영향 없게 UTC로 계산) ----------
const p2 = (n) => String(n).padStart(2, '0');
const toStr = (d) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toStr(parse(s)) === s;
export const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return toStr(d); };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const weekdayIdx = (s) => (parse(s).getUTCDay() + 6) % 7; // 0=월 … 6=일 (금주 요일 저장 번호와 같음)
// v1.4 한 주 시작: wso 0=일요일, 1=월요일(기본값 1은 예전 시험·호출과 같게)
export const wsoOf = (s) => (s && Number(s.weekStartsOn) === 0 ? 0 : 1);
export const weekStartOf = (s, wso = 1) => addDays(s, -((parse(s).getUTCDay() - (wso === 0 ? 0 : 1) + 7) % 7));
export const weekEndOf = (s, wso = 1) => addDays(weekStartOf(s, wso), 6);
// 주 안의 순서(0~6)에 맞춘 요일 번호(0=월 … 6=일) 배열. 일요일 시작이면 [6,0,1,2,3,4,5]
export const weekdayOrder = (wso = 1) => (wso === 0 ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]);
// 그 날짜가 주에서 몇 번째 날인지(0~6)
export const weekPos = (s, wso = 1) => daysBetween(weekStartOf(s, wso), s);
export const weekDates = (ws) => Array.from({ length: 7 }, (_, i) => addDays(ws, i));
export const monthStartOf = (s) => `${s.slice(0, 7)}-01`;
export function monthEndOf(s) { const d = parse(monthStartOf(s)); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return toStr(d); }
export function addMonths(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return toStr(d).slice(0, 7); }
export function dateRange(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
// 기기 현지 시각의 달력 날짜
export const localDateStr = (now) => `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
export function localDateOfIso(iso) { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : localDateStr(d); }

// v1.4 하루 시작 시각(0~10시, 기본 6). 틀린 값이면 6
export const cutoffOf = (s) => { const h = s && s.dayCutoffHour != null ? Number(s.dayCutoffHour) : 6; return Number.isInteger(h) && h >= 0 && h <= 10 ? h : 6; };
// 날짜 귀속: 하루 시작 시각(기본 6시) 이전이면 어제를 오늘로 본다
export function logicalToday(now, cutoffHour = 6) {
  const s = localDateStr(now);
  return now.getHours() < cutoffOf({ dayCutoffHour: cutoffHour }) ? addDays(s, -1) : s;
}

// 홈의 기본 입력 날짜: 정오 이전이고 어제가 미입력이면 어제, 그 외 오늘.
// (하루 시작 시각 이전에는 '오늘'이 이미 어제 날짜이므로 그 날짜를 그대로 쓴다)
export function defaultEntryDate(now, daysMap, settings = DEFAULT_SETTINGS) {
  const cutoff = cutoffOf(settings);
  const today = logicalToday(now, cutoff);
  if (now.getHours() < cutoff) return today;
  const yesterday = addDays(today, -1);
  if (now.getHours() < 12 && !isEntered(daysMap[yesterday])) return yesterday;
  return today;
}

// ---------- 하루 기록 ----------
export function emptyDay(date) {
  return {
    date, plan: null, status: 'none', alcoholG: 0, drinks: [], homeAt: null, altNonAlcDone: null,
    occasion: null, condition: null, weightKg: null, memo: '', food: null,
    sources: { alcohol: 'manual', weight: 'manual' }, updatedAt: null,
  };
}

export function drinksG(drinks) {
  let g = 0;
  for (const d of drinks || []) {
    if (d.type === 'manual') g += Number(d.g) || 0;
    else g += (DRINK_BY_KEY[d.type] ? DRINK_BY_KEY[d.type].g : 0) * (Number(d.count) || 0);
  }
  return Math.round(g * 1000) / 1000;
}
// "소주 3 · 맥주 500cc 1 · 직접 1.5잔"
export function drinksText(drinks, unit) {
  return (drinks || []).filter((d) => (d.type === 'manual' ? d.g > 0 : d.count > 0)).map((d) =>
    (d.type === 'manual' ? `직접 ${fmtCount(d.g, unit)}` : `${DRINK_BY_KEY[d.type] ? DRINK_BY_KEY[d.type].short : d.type} ${d.count}`)).join(' · ');
}

// ---------- 안주 (v1.3) ----------
// 하나만 고르는 칩: 같은 것을 다시 누르면 해제
export const toggleOne = (cur, v) => (cur === v ? null : v);
// 여러 개 고르는 칩: 있으면 빼고 없으면 넣는다(정해진 순서 유지)
export function toggleMany(list, key) {
  const set = new Set(list || []);
  if (set.has(key)) set.delete(key); else set.add(key);
  return FOOD_TYPES.map((x) => x.key).filter((k) => set.has(k));
}
// 저장 형태로 정리: 셋 다 비면 null, 아니면 { amount, types, finish } (모르는 값은 버림)
export function normalizeFood(f) {
  if (!f || typeof f !== 'object') return null;
  const amount = [1, 2, 3].includes(Number(f.amount)) ? Number(f.amount) : null;
  const types = FOOD_TYPES.map((x) => x.key).filter((k) => (f.types || []).includes(k));
  const finish = FOOD_FINISH[f.finish] ? f.finish : null;
  if (amount == null && !types.length && finish == null) return null;
  return { amount, types, finish };
}
export const foodOf = (day) => normalizeFood(day && day.food);
export const finishYes = (f) => !!f && (f.finish === 'meal' || f.finish === 'late');
// 상세 표기(이름표 "안주" 옆에 붙는 글): "많이 · 고기, 국물·찌개 · 마무리 밥·면" (없는 부분은 뺀다, 셋 다 없으면 '')
export function foodText(food) {
  const f = normalizeFood(food);
  if (!f) return '';
  const parts = [];
  if (f.amount != null) parts.push(FOOD_AMOUNTS[f.amount]);
  if (f.types.length) parts.push(f.types.map((k) => FOOD_TYPE_LABEL[k]).join(', '));
  if (f.finish) parts.push(`마무리 ${FOOD_FINISH[f.finish]}`);
  return parts.join(' · ');
}

// 체중 칸: 그날 저장한 값이 있으면 그것(saved), 없으면 그 전 가장 최근 값(저장 안 된 기본값). 둘 다 없으면 kg null
export function weightState(daysMap, date) {
  const own = daysMap[date];
  if (own && own.weightKg != null) return { kg: own.weightKg, saved: true, fromDate: date };
  let best = null;
  for (const d of Object.keys(daysMap)) {
    const day = daysMap[d];
    if (d < date && day && day.weightKg != null && (!best || d > best)) best = d;
  }
  return best ? { kg: daysMap[best].weightKg, saved: false, fromDate: best } : { kg: null, saved: false, fromDate: null };
}

// v1 → v2 데이터 옮기기: v1의 days[D].condition(다음 날 아침)을 days[D+1].condition(그날 아침)으로.
// D+1 기록이 없으면 status none인 빈 기록을 만들어 값만 넣는다. 입력 배열은 바꾸지 않는다.
export function migrateDaysV1toV2(daysList) {
  const byDate = {};
  for (const d of daysList || []) byDate[d.date] = { ...d, condition: null };
  for (const d of daysList || []) {
    if (d.condition == null) continue;
    const next = addDays(d.date, 1);
    if (!byDate[next]) byDate[next] = { ...emptyDay(next), updatedAt: d.updatedAt || null };
    byDate[next].condition = d.condition;
  }
  return Object.values(byDate).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// 프로젝트 기간: 시작 후 몇 일째인지, 목표일까지 며칠 남았는지
export function projectDays(s, today) {
  if (!s.startDate) return null;
  const out = { dayNo: daysBetween(s.startDate, today) + 1, toTarget: null, started: s.startDate <= today };
  if (s.targetDate && isDateStr(s.targetDate)) out.toTarget = daysBetween(today, s.targetDate);
  return out;
}

// 귀가 시각: 하루 시작 시각(기본 06:00) 이전은 다음 날로 본다. 0시면 넘기지 않음(일반 달력)
export function timeToMin(hhmm, cutoffHour = 6) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m + (h < cutoffHour ? 1440 : 0);
}
export function homeLateMin(homeAt, homeBy, cutoffHour = 6) {
  const a = timeToMin(homeAt, cutoffHour), b = timeToMin(homeBy, cutoffHour);
  if (a == null || b == null) return 0;
  return Math.max(0, a - b);
}

export const isEntered = (d) => !!d && (d.status === 'sober' || d.status === 'drank');
export const isDrinkDay = (d) => !!d && d.status === 'drank' && (Number(d.alcoholG) || 0) > 0;
export const isHeavy = (d, s) => isDrinkDay(d) && d.alcoholG >= s.heavyG;

// 계획 대비 결과(계획이 있고 입력된 날). { limitOk, homeOk, overG, lateMin }
export function planOutcome(day, cutoffHour = 6) {
  if (!day || !day.plan || !isEntered(day)) return null;
  const g = isDrinkDay(day) ? day.alcoholG : 0;
  const lateMin = isDrinkDay(day) ? homeLateMin(day.homeAt, day.plan.homeBy, cutoffHour) : 0;
  return { limitOk: g <= day.plan.limitG, homeOk: lateMin === 0, overG: Math.max(0, g - day.plan.limitG), lateMin };
}
export const planKept = (day, cutoffHour = 6) => { const o = planOutcome(day, cutoffHour); return !!o && o.limitOk && o.homeOk; };

// 하루 판정(우선순위 순): none / sober / heavy / over / planned / drank
export function dayResult(day, s) {
  if (!isEntered(day)) return 'none';
  if (!isDrinkDay(day)) return 'sober';
  if (day.alcoholG >= s.heavyG) return 'heavy';
  if (day.plan) return planKept(day, cutoffOf(s)) ? 'planned' : 'over';
  return 'drank';
}
export const RESULT_LABEL = { none: '미입력', sober: '안 마심', heavy: '과음', over: '초과', planned: '계획대로', drank: '마심' };
export const RESULT_SYMBOL = { none: '', sober: '○', heavy: '■', over: '▲', planned: '✓', drank: '●' };

// ---------- 목표 이력 ----------
export function sortGoals(goals) {
  return [...(goals || [])].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1
    : String(a.createdAt || '') < String(b.createdAt || '') ? -1 : String(a.createdAt || '') > String(b.createdAt || '') ? 1 : 0));
}
// 어떤 주(ws 시작)의 목표 = 그 주 시작일 이전 또는 그 주 안에 effectiveFrom이 있는 줄 중 가장 늦은 것
// (v1.4: effectiveFrom은 "그 날짜가 들어 있는 주부터 적용". 같은 날이면 나중에 만든 것). 없으면 null
export function goalForWeek(goals, ws) {
  const end = addDays(ws, 6);
  let g = null;
  for (const x of sortGoals(goals)) if (x.effectiveFrom <= end) g = x;
  return g;
}
export const currentGoal = (goals, today, wso = 1) => goalForWeek(goals, weekStartOf(today, wso));
// 아직 시작하지 않은 단계: 이번 주가 끝난 뒤에 effectiveFrom이 있는 줄
export const futureGoals = (goals, today, wso = 1) => sortGoals(goals).filter((g) => g.effectiveFrom > weekEndOf(today, wso));
export const goalStarted = (g, today, wso = 1) => !!g && g.effectiveFrom <= weekEndOf(today, wso);
// 실제로 적용된(같은 주의 더 나중 줄에 가려지지 않은) 목표 구간: [{ goal, from(주 시작일), to|null }]
export function goalPeriods(goals, wso = 1) {
  const sorted = sortGoals(goals);
  const wk = (g) => weekStartOf(g.effectiveFrom, wso);
  const eff = sorted.filter((g, i) => !(sorted[i + 1] && wk(sorted[i + 1]) === wk(g)));
  return eff.map((g, i) => ({ goal: g, from: wk(g), to: eff[i + 1] ? addDays(wk(eff[i + 1]), -1) : null }));
}

// ---------- 주간 판정 ----------
// 기록 시작 전 날짜는 미입력으로 세지 않는다(첫 주가 불리하지 않게)
export function weekEval(daysMap, goals, ws, s, today) {
  const goal = goalForWeek(goals, ws);
  const out = { weekStart: ws, goal, drinkDays: 0, heavy: 0, totalG: 0, sober: 0, entered: 0, missing: 0, pastDays: 0, dryViolations: [], items: null, status: 'nogoal', complete: addDays(ws, 6) < today };
  if (ws > today) { out.status = 'future'; return out; }
  for (const d of weekDates(ws)) {
    if (d > today) continue;
    out.pastDays++;
    const day = daysMap[d];
    if (!isEntered(day)) { if (!s.startDate || d >= s.startDate) out.missing++; continue; }
    out.entered++;
    if (isDrinkDay(day)) {
      out.drinkDays++;
      out.totalG += day.alcoholG;
      if (day.alcoholG >= s.heavyG) out.heavy++;
      if (goal && (goal.dryWeekdays || []).includes(weekdayIdx(d))) out.dryViolations.push(d);
    } else out.sober++;
  }
  out.totalG = Math.round(out.totalG * 1000) / 1000;
  if (!goal) return out;
  const items = {
    days: out.drinkDays <= goal.weeklyDrinkDaysMax ? 'ok' : 'over',
    heavy: out.heavy <= goal.heavyMaxPerWeek ? 'ok' : 'over',
    total: goal.weeklyTotalG == null ? 'na' : (out.totalG <= goal.weeklyTotalG ? 'ok' : 'over'),
    dry: !(goal.dryWeekdays || []).length ? 'na' : (out.dryViolations.length === 0 ? 'ok' : 'over'),
  };
  out.items = items;
  const anyOver = Object.values(items).includes('over');
  // 이미 넘은 항목이 있으면 미달성. 넘은 것이 없어도 미입력 3일 이상이면 판정 보류(달성으로 치지 않음)
  out.status = anyOver ? 'missed' : out.missing >= 3 ? 'pending' : 'achieved';
  return out;
}

// 달력 주 합계 칸의 기호: 끝난 주만 ○ 달성 / △ 미달성 / – 보류. 진행 중인 주는 이미 넘었으면 △, 아니면 … (진행)
export function weekMark(ev) {
  if (!ev || !ev.goal || ev.status === 'future') return '';
  if (!ev.complete) return ev.status === 'missed' ? '△' : '…';
  return { achieved: '○', missed: '△', pending: '–' }[ev.status] || '';
}

export function weekRemaining(ev) {
  if (!ev || !ev.goal) return null;
  return {
    days: Math.max(0, ev.goal.weeklyDrinkDaysMax - ev.drinkDays),
    totalG: ev.goal.weeklyTotalG == null ? null : Math.max(0, ev.goal.weeklyTotalG - ev.totalG),
  };
}

// 첫 주(주 시작일): 시작일과 가장 이른 기록 중 빠른 쪽
export function firstWeek(daysMap, s, today) {
  let first = s.startDate || today;
  for (const d of Object.keys(daysMap)) if (isEntered(daysMap[d]) && d < first) first = d;
  return weekStartOf(first, wsoOf(s));
}

// 주간 목표 달성 연속 주 수. 진행 중인 주는 일곱 날이 다 지나 판정이 끝났을 때만 센다(이미 미달성이면 연속이 끊김).
export function goalStreak(daysMap, goals, s, today) {
  const curWs = weekStartOf(today, wsoOf(s));
  const first = firstWeek(daysMap, s, today);
  const evs = [];
  for (let ws = first; ws <= curWs; ws = addDays(ws, 7)) evs.push(weekEval(daysMap, goals, ws, s, today));
  const counts = (e) => e.status === 'achieved' && (e.weekStart < curWs || e.pastDays === 7);
  let best = 0, run = 0;
  for (const e of evs) { if (counts(e)) { run++; best = Math.max(best, run); } else if (e.weekStart < curWs || e.status === 'missed') run = 0; }
  let current = 0;
  const cur = evs[evs.length - 1];
  if (!cur || cur.status !== 'missed') {
    let i = evs.length - 1;
    if (cur && !counts(cur)) i--;
    for (; i >= 0 && counts(evs[i]); i--) current++;
  }
  return { current, best };
}

// ---------- 연속 안 마신 날 ----------
export function soberStreak(daysMap, s, today) {
  let d = isEntered(daysMap[today]) ? today : addDays(today, -1);
  let n = 0;
  while (dayResult(daysMap[d], s) === 'sober') { n++; d = addDays(d, -1); }
  return n;
}
export function bestSoberStreak(daysMap, s) {
  const dates = Object.keys(daysMap).filter((d) => dayResult(daysMap[d], s) === 'sober').sort();
  let best = 0, run = 0, prev = null;
  for (const d of dates) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

// ---------- 기준선 대비 ----------
export const baselineWeeklyG = (b) => (b ? (Number(b.drinkDaysPerWeek) || 0) * (Number(b.gPerOccasion) || 0) : null);
// 시작일 이후 입력된 날만: 기준선이었다면 마셨을 양 − 실제 마신 양
export function savedVsBaseline(daysMap, s, today, from = s.startDate) {
  if (!s.baseline || !from) return null;
  const perDay = baselineWeeklyG(s.baseline) / 7;
  let entered = 0, actualG = 0;
  for (const d of dateRange(from, today)) {
    const day = daysMap[d];
    if (!isEntered(day)) continue;
    entered++;
    if (isDrinkDay(day)) actualG += day.alcoholG;
  }
  const expectedG = entered * perDay;
  return { entered, expectedG, actualG, savedG: Math.round((expectedG - actualG) * 1000) / 1000 };
}

// ---------- 상담 안내 ----------
export function counselNeeded(daysMap, s, today) {
  let n = 0;
  for (let i = 0; i < 14; i++) if (isHeavy(daysMap[addDays(today, -i)], s)) n++;
  return n >= 3;
}

// ---------- 목표 제안(능동 조정) ----------
// { kind: 'lower'|'adjust', from, to } 또는 null
export function goalSuggestion(daysMap, goals, s, today) {
  const curWs = weekStartOf(today, wsoOf(s));
  const cur = goalForWeek(goals, curWs);
  if (!cur || s.dismissedSuggestion === curWs) return null;
  const w = [1, 2, 3].map((i) => weekEval(daysMap, goals, addDays(curWs, -7 * i), s, today));
  const hasNext = goals.some((g) => g.effectiveFrom > addDays(curWs, 6));
  if (w.every((e) => e.status === 'achieved') && !hasNext && cur.weeklyDrinkDaysMax > 0) {
    return { kind: 'lower', from: cur.weeklyDrinkDaysMax, to: cur.weeklyDrinkDaysMax - 1 };
  }
  if (w[0].status === 'missed' && w[1].status === 'missed') {
    const avg = (w[0].drinkDays + w[1].drinkDays) / 2;
    const to = Math.min(Math.floor(avg), cur.weeklyDrinkDaysMax + 1);
    // 음주일 상한을 바꿔도 의미가 없는 경우(과음·총량만 넘음)는 띄우지 않는다
    if (to > cur.weeklyDrinkDaysMax) return { kind: 'adjust', from: cur.weeklyDrinkDaysMax, to, avg };
  }
  return null;
}

// ---------- 주간 계획 카드 ----------
// 이번 주 계획이 없고 주의 첫 이틀(월 시작: 월·화 / 일 시작: 일·월)이면 이번 주,
// 주의 마지막 날 저녁(18시~, 월 시작: 일 / 일 시작: 토)이면 다음 주 것. 아니면 null
export function weekPlanPrompt(weekPlans, today, hour, wso = 1) {
  const ws = weekStartOf(today, wso);
  const pos = weekPos(today, wso);
  const has = (k) => !!weekPlans[k] && !weekPlans[k].auto;
  if (pos <= 1 && !has(ws)) return ws;
  if (pos === 6 && hour >= 18 && !has(addDays(ws, 7))) return addDays(ws, 7);
  return null;
}

// v1.4 한 주 시작을 바꿀 때 주간 계획을 새 기준으로 다시 묶는다(찍어 둔 "마실 날"은 그대로 남김).
// 새 주마다 그 주에 든 마실 날을 모은다. 예전 계획의 주와 4일 이상 겹치는 새 주(시작일 차이 3일 이하)는 계획을 세운 주로 본다.
// skipped는 겹친 예전 계획이 모두 건너뛰기였고 마실 날이 없을 때만 true
export function regroupWeekPlans(plans, wso) {
  const out = {};
  // auto: 마실 날만 옮겨 와서 생긴 줄(그 주에 계획을 세운 것은 아님 → 주간 계획 카드는 계속 뜬다)
  const get = (ws) => out[ws] || (out[ws] = { weekStart: ws, plannedDays: [], skipped: true, auto: true, createdAt: null });
  for (const p of plans || []) {
    if (!p || !isDateStr(p.weekStart)) continue;
    if (!p.auto) {
      const ws = weekStartOf(p.weekStart, wso);
      const w = get(daysBetween(ws, p.weekStart) <= 3 ? ws : addDays(ws, 7));
      w.auto = false;
      if (!p.skipped) w.skipped = false;
      if (p.createdAt && (!w.createdAt || p.createdAt < w.createdAt)) w.createdAt = p.createdAt;
    }
    for (const d of p.plannedDays || []) {
      if (!isDateStr(d)) continue;
      const x = get(weekStartOf(d, wso));
      if (!x.plannedDays.includes(d)) x.plannedDays.push(d);
      if (p.createdAt && (!x.createdAt || p.createdAt < x.createdAt)) x.createdAt = p.createdAt;
    }
  }
  return Object.values(out).map((w) => ({ ...w, plannedDays: w.plannedDays.sort(), skipped: w.plannedDays.length ? false : w.skipped, createdAt: w.createdAt || new Date(0).toISOString() }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

// ---------- 상한 정하기 안내 ----------
export function planHints(daysMap, goals, s, date, limitG) {
  const ws = weekStartOf(date, wsoOf(s));
  const goal = goalForWeek(goals, ws);
  let others = 0, otherG = 0;
  for (const d of weekDates(ws)) {
    if (d === date) continue;
    const day = daysMap[d];
    if (isDrinkDay(day)) { others++; otherG += day.alcoholG; }
  }
  return {
    goal,
    nth: others + 1,
    overDays: !!goal && others >= goal.weeklyDrinkDaysMax,
    dryDay: !!goal && (goal.dryWeekdays || []).includes(weekdayIdx(date)),
    overHeavy: limitG >= s.heavyG,
    remainingG: goal && goal.weeklyTotalG != null ? Math.max(0, goal.weeklyTotalG - otherG) : null,
  };
}

// ---------- 백업 ----------
// 백업한 때의 날짜도 하루 시작 시각으로 센다(새벽 백업이 "-1일 전"이 되지 않게, v1.4)
export function backupDateOf(s) {
  if (!s || !s.lastBackupAt) return null;
  const d = new Date(s.lastBackupAt);
  return Number.isNaN(d.getTime()) ? null : logicalToday(d, cutoffOf(s));
}
export function backupDue(s, today) {
  const last = backupDateOf(s);
  if (!last) return !!s.startDate && daysBetween(s.startDate, today) >= 7;
  return daysBetween(last, today) >= 7;
}

export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: '백업 파일 형식이 아닙니다.' };
  if (obj.app !== APP_ID) return { ok: false, error: '절주노트 백업 파일이 아닙니다.' };
  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `이 앱이 읽을 수 없는 버전입니다(파일 버전 ${obj.schemaVersion}).` };
  }
  const d = obj.data;
  if (!d || !Array.isArray(d.days) || !Array.isArray(d.goals) || !Array.isArray(d.weekPlans) || !d.settings || typeof d.settings !== 'object') {
    return { ok: false, error: '백업 파일에 필요한 내용(days, goals, weekPlans, settings)이 없습니다.' };
  }
  for (const r of d.days) {
    if (!r || !isDateStr(r.date) || !['none', 'sober', 'drank'].includes(r.status) || typeof r.alcoholG !== 'number') {
      return { ok: false, error: `기록 형식이 맞지 않습니다(${r && r.date ? r.date : '날짜 없음'}).` };
    }
  }
  for (const g of d.goals) {
    if (!g || !g.id || !isDateStr(g.effectiveFrom) || typeof g.weeklyDrinkDaysMax !== 'number') return { ok: false, error: '목표 형식이 맞지 않습니다.' };
  }
  for (const w of d.weekPlans) if (!w || !isDateStr(w.weekStart) || !Array.isArray(w.plannedDays)) return { ok: false, error: '주간 계획 형식이 맞지 않습니다.' };
  return { ok: true };
}

// ---------- CSV (한 줄 = 하루, UTF-8 BOM) ----------
export const CSV_HEADER = 'date,status,day_result,alcohol_g,alcohol_display,unit,heavy,drinks,plan_limit_g,plan_home_by,home_at,alt_nonalc_plan,alt_nonalc_done,occasion,morning_condition,weight_kg,weight_source,week_goal_days,food_amount,food_types,food_finish,memo';
const csvCell = (v) => {
  if (v == null) return '';
  const t = String(v);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
export function buildCsv(daysList, goals, s) {
  const lines = [CSV_HEADER];
  for (const d of [...daysList].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const goal = goalForWeek(goals, weekStartOf(d.date, wsoOf(s)));
    const drinks = (d.drinks || []).map((x) => (x.type === 'manual' ? `manual:${x.g}g` : `${x.type}:${x.count}`)).join('|');
    const b = (v) => (v == null ? '' : v ? 1 : 0);
    const f = foodOf(d);
    lines.push([
      d.date, d.status, dayResult(d, s), d.alcoholG, isEntered(d) ? toDisplay(d.alcoholG, s.unit) : '', s.unit,
      isEntered(d) ? (isHeavy(d, s) ? 1 : 0) : '', drinks,
      d.plan ? d.plan.limitG : '', d.plan ? d.plan.homeBy : '', d.homeAt, d.plan ? b(d.plan.altNonAlc) : '', b(d.altNonAlcDone),
      d.occasion, d.condition, d.weightKg, d.weightKg != null ? (d.sources && d.sources.weight) || 'manual' : '',
      goal ? goal.weeklyDrinkDaysMax : '',
      f && f.amount != null ? FOOD_AMOUNTS[f.amount] : '', f ? f.types.map((k) => FOOD_TYPE_LABEL[k]).join('|') : '', f && f.finish ? FOOD_FINISH[f.finish] : '',
      d.memo,
    ].map(csvCell).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
