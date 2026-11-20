// 통계 집계. 순수 함수만 둔다(입력: 기록·목표·설정·기간 → 출력: 값). DOM·저장소 접근 금지.
// 모든 값은 기간 안의 "입력된 날"만으로 계산하고 입력률을 함께 돌려준다.
import * as R from './rules.js';

export const PERIODS = [
  { key: 'week', label: '이번 주' },
  { key: '4w', label: '최근 4주' },
  { key: 'month', label: '이번 달' },
  { key: '12w', label: '최근 12주' },
  { key: 'since', label: '시작 후' },
];

// 최소 표본
export const MIN = { weekday: 3, planCompare: 3, weeks: 2, weightWeeks: 3, baselineRecent: 7, food: 3, foodGroup: 2 };

export function periodRange(key, daysMap, s, today) {
  const ws = R.weekStartOf(today);
  if (key === 'week') return { from: ws, to: today };
  if (key === 'month') return { from: R.monthStartOf(today), to: today };
  if (key === '12w') return { from: R.addDays(ws, -77), to: today };
  if (key === 'since') {
    // 시작일~오늘. 시작일이 없으면 가장 이른 기록부터, 시작일이 아직 오지 않았으면 오늘 하루
    let first = s.startDate;
    if (!first) { first = today; for (const d of Object.keys(daysMap)) if (R.isEntered(daysMap[d]) && d < first) first = d; }
    return { from: first > today ? today : first, to: today };
  }
  return { from: R.addDays(ws, -21), to: today }; // 최근 4주(이번 주 포함 4주)
}

const round1 = (x) => Math.round(x * 10) / 10;

// 1. 요약
export function summary(daysMap, s, from, to) {
  const o = { days: 0, entered: 0, drinkDays: 0, sober: 0, heavy: 0, totalG: 0, planDays: 0, planKept: 0 };
  for (const d of R.dateRange(from, to)) {
    o.days++;
    const day = daysMap[d];
    if (!R.isEntered(day)) continue;
    o.entered++;
    if (R.isDrinkDay(day)) { o.drinkDays++; o.totalG += day.alcoholG; if (day.alcoholG >= s.heavyG) o.heavy++; } else o.sober++;
    if (day.plan) { o.planDays++; if (R.planKept(day)) o.planKept++; }
  }
  o.totalG = Math.round(o.totalG * 1000) / 1000;
  o.avgPerDrinkG = o.drinkDays ? o.totalG / o.drinkDays : 0;
  o.perWeek = o.entered ? (o.drinkDays / o.entered) * 7 : 0; // 입력된 날 기준 주 평균 음주일
  o.weeklyG = o.entered ? (o.totalG / o.entered) * 7 : 0;
  return o;
}

// 2. 기준선 대비: 시작 후 줄인 양 + 기준선 주 평균 vs 최근 4주 주 평균
export function baselineCompare(daysMap, s, today) {
  if (!s.baseline) return null;
  const saved = R.savedVsBaseline(daysMap, s, today);
  const ws = R.weekStartOf(today);
  const recent = summary(daysMap, s, R.addDays(ws, -21), today);
  return {
    saved,
    baselineWeeklyG: R.baselineWeeklyG(s.baseline),
    recentWeeklyG: recent.weeklyG,
    recentEntered: recent.entered,
    enough: recent.entered >= MIN.baselineRecent,
  };
}

// 3. 주별 추이
export function weekly(daysMap, goals, s, from, to, today) {
  const out = [];
  for (let ws = R.weekStartOf(from); ws <= to; ws = R.addDays(ws, 7)) {
    const ev = R.weekEval(daysMap, goals, ws, s, today);
    out.push({ weekStart: ws, drinkDays: ev.drinkDays, totalG: ev.totalG, heavy: ev.heavy, entered: ev.entered, goalMax: ev.goal ? ev.goal.weeklyDrinkDaysMax : null, goalTotalG: ev.goal ? ev.goal.weeklyTotalG : null, status: ev.status, complete: ev.complete });
  }
  return out;
}

// 4. 요일 패턴(월~일). top: 가장 많이 마신 요일(같으면 평균 양이 많은 쪽)
export function weekdayPattern(daysMap, s, from, to) {
  const rows = Array.from({ length: 7 }, (_, i) => ({ wd: i, entered: 0, drink: 0, totalG: 0, avgG: 0 }));
  for (const d of R.dateRange(from, to)) {
    const day = daysMap[d];
    if (!R.isEntered(day)) continue;
    const r = rows[R.weekdayIdx(d)];
    r.entered++;
    if (R.isDrinkDay(day)) { r.drink++; r.totalG += day.alcoholG; }
  }
  for (const r of rows) r.avgG = r.drink ? r.totalG / r.drink : 0;
  const drink = rows.reduce((a, r) => a + r.drink, 0);
  let top = null;
  for (const r of rows) if (r.drink > 0 && (!top || r.drink > top.drink || (r.drink === top.drink && r.avgG > top.avgG))) top = r;
  return { rows, drink, enough: drink >= MIN.weekday, need: Math.max(0, MIN.weekday - drink), top };
}

// 5. 상황별
export function byOccasion(daysMap, s, from, to) {
  const map = {};
  for (const d of R.dateRange(from, to)) {
    const day = daysMap[d];
    if (!R.isDrinkDay(day) || !day.occasion) continue;
    const r = map[day.occasion] || (map[day.occasion] = { occasion: day.occasion, count: 0, totalG: 0, heavy: 0 });
    r.count++;
    r.totalG += day.alcoholG;
    if (day.alcoholG >= s.heavyG) r.heavy++;
  }
  return R.OCCASIONS.filter((o) => map[o]).map((o) => ({ ...map[o], avgG: map[o].totalG / map[o].count }));
}

// 5-1. 최근 마신 이유: 메모가 있는 음주일, 최근 것부터 n건
export function recentReasons(daysMap, from, to, n = 5) {
  return R.dateRange(from, to).reverse().filter((d) => R.isDrinkDay(daysMap[d]) && (daysMap[d].memo || '').trim())
    .slice(0, n).map((d) => ({ date: d, g: daysMap[d].alcoholG, memo: daysMap[d].memo.trim() }));
}

// 5-2. 안주(v1.3): 요약 숫자 + 종류별 횟수(많은 순). 안주가 입력된 음주일이 3일 미만이면 enough=false
export function foodStats(daysMap, from, to) {
  const o = { drinkDays: 0, withFood: 0, many: 0, finish: 0, meal: 0, late: 0, types: [] };
  const cnt = {};
  for (const d of R.dateRange(from, to)) {
    const day = daysMap[d];
    if (!R.isDrinkDay(day)) continue;
    o.drinkDays++;
    const f = R.foodOf(day);
    if (!f) continue;
    o.withFood++;
    if (f.amount === 3) o.many++;
    if (f.finish === 'meal') { o.finish++; o.meal++; }
    if (f.finish === 'late') { o.finish++; o.late++; }
    for (const k of f.types) cnt[k] = (cnt[k] || 0) + 1;
  }
  o.types = R.FOOD_TYPES.filter((x) => cnt[x.key]).map((x) => ({ key: x.key, label: x.label, count: cnt[x.key] }))
    .sort((a, b) => b.count - a.count); // 같은 횟수면 정해진 순서(안정 정렬)
  o.enough = o.withFood >= MIN.food;
  o.need = Math.max(0, MIN.food - o.withFood);
  return o;
}

// 5-3. 다음 날 아침 체중 변화(D+1 아침 − D 아침). 날 D가 기간 안이고 두 체중이 모두 있을 때만.
// 묶음: 안주 양(적게·보통·많이), 마무리(없음·있음), 비교용 안 마신 날. 2일 미만 묶음은 avg=null("–")
export function foodWeightChange(daysMap, from, to) {
  const g = { a1: [], a2: [], a3: [], finNo: [], finYes: [], sober: [] };
  for (const d of R.dateRange(from, to)) {
    const day = daysMap[d];
    const next = daysMap[R.addDays(d, 1)];
    if (!day || day.weightKg == null || !next || next.weightKg == null) continue;
    const ch = next.weightKg - day.weightKg;
    if (R.isEntered(day) && !R.isDrinkDay(day)) { g.sober.push(ch); continue; }
    if (!R.isDrinkDay(day)) continue;
    const f = R.foodOf(day);
    if (!f) continue;
    if (f.amount) g[`a${f.amount}`].push(ch);
    if (f.finish === 'none') g.finNo.push(ch);
    else if (R.finishYes(f)) g.finYes.push(ch);
  }
  const out = {};
  for (const [k, a] of Object.entries(g)) {
    out[k] = { n: a.length, avg: a.length >= MIN.foodGroup ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100 : null };
  }
  return out;
}

// 6. 주종 비율(g 기준). 숫자 직접 입력분은 'manual'
export function drinkTypes(daysMap, from, to) {
  const g = {};
  let total = 0;
  for (const d of R.dateRange(from, to)) {
    const day = daysMap[d];
    if (!R.isDrinkDay(day)) continue;
    const list = (day.drinks || []).length ? day.drinks : [{ type: 'manual', g: day.alcoholG }];
    for (const x of list) {
      const v = R.drinksG([x]);
      if (!(v > 0)) continue;
      g[x.type] = (g[x.type] || 0) + v;
      total += v;
    }
  }
  const order = [...R.DRINKS.map((x) => x.key), 'manual'];
  return { total, items: order.filter((k) => g[k]).map((k) => ({ type: k, g: g[k], ratio: g[k] / total })) };
}

// 7. 술자리 계획: 계획 세운 날 vs 안 세운 날(음주일)의 평균 양, 상한 달성률, 귀가 평균 초과 분
export function planCompare(daysMap, s, from, to) {
  const w = { n: 0, g: 0 }, wo = { n: 0, g: 0 };
  let planDays = 0, kept = 0, lateSum = 0, lateN = 0;
  for (const d of R.dateRange(from, to)) {
    const day = daysMap[d];
    if (!R.isEntered(day)) continue;
    if (day.plan) {
      planDays++;
      if (R.planKept(day)) kept++;
      if (R.isDrinkDay(day) && day.plan.homeBy && day.homeAt) { lateSum += R.homeLateMin(day.homeAt, day.plan.homeBy); lateN++; }
    }
    if (!R.isDrinkDay(day)) continue;
    const t = day.plan ? w : wo;
    t.n++;
    t.g += day.alcoholG;
  }
  const n = w.n + wo.n;
  return {
    withPlan: { n: w.n, avgG: w.n ? w.g / w.n : 0 },
    withoutPlan: { n: wo.n, avgG: wo.n ? wo.g / wo.n : 0 },
    planDays, kept, keptRate: planDays ? kept / planDays : null,
    avgLateMin: lateN ? Math.round(lateSum / lateN) : null,
    enough: n >= MIN.planCompare && w.n > 0 && wo.n > 0,
    need: Math.max(0, MIN.planCompare - n),
  };
}

// 8. 다음 날 컨디션: 기간 안의 음주 기록 D(입력된 날)와 D+1일 아침 컨디션을 짝지어 D의 판정별로 평균
export function conditionAfter(daysMap, s, from, to) {
  const g = { sober: [], drank: [], heavy: [] };
  for (const d of R.dateRange(from, to)) {
    const day = daysMap[d];
    const next = daysMap[R.addDays(d, 1)];
    if (!R.isEntered(day) || !next || !next.condition) continue;
    const r = R.dayResult(day, s);
    const k = r === 'sober' ? 'sober' : r === 'heavy' ? 'heavy' : 'drank';
    g[k].push(next.condition);
  }
  const avg = (a) => (a.length ? round1(a.reduce((x, y) => x + y, 0) / a.length) : null);
  return { any: g.sober.length + g.drank.length + g.heavy.length > 0, sober: { n: g.sober.length, avg: avg(g.sober) }, drank: { n: g.drank.length, avg: avg(g.drank) }, heavy: { n: g.heavy.length, avg: avg(g.heavy) } };
}

// 9. 체중: 점들 + 음주일 + 주별 (그 주 체중 변화, 다음 주 음주일 수)
export function weightTrend(daysMap, s, from, to, today) {
  const points = [];
  const drinkDates = [];
  for (const d of R.dateRange(from, to)) {
    const day = daysMap[d];
    if (day && day.weightKg != null) points.push({ date: d, kg: day.weightKg });
    if (R.isDrinkDay(day)) drinkDates.push(d);
  }
  // 주마다 마지막 체중
  const lastOfWeek = {};
  for (const p of points) lastOfWeek[R.weekStartOf(p.date)] = p.kg;
  const weeks = Object.keys(lastOfWeek).sort();
  const rows = [];
  for (let i = 1; i < weeks.length; i++) {
    const ws = weeks[i];
    const next = R.addDays(ws, 7);
    if (next > today) continue; // 다음 주가 아직 시작하지 않음
    const nextEv = R.weekEval(daysMap, [], next, s, today);
    rows.push({ weekStart: ws, changeKg: round1(lastOfWeek[ws] - lastOfWeek[weeks[i - 1]]), nextDrinkDays: nextEv.drinkDays, nextComplete: nextEv.complete });
  }
  return { points, drinkDates, rows, any: points.length > 0, tableEnough: rows.length >= MIN.weightWeeks };
}

// 10. 4주 점검(시작일부터 28일)
export function fourWeekCheck(daysMap, goals, s, today) {
  if (!s.startDate) return null;
  const from = s.startDate;
  const end = R.addDays(from, 27);
  const to = end < today ? end : today;
  if (to < from) return null;
  const sm = summary(daysMap, s, from, to);
  const weeks = [];
  for (let ws = R.weekStartOf(from); ws <= to; ws = R.addDays(ws, 7)) weeks.push(R.weekEval(daysMap, goals, ws, s, today));
  const pts = weightTrend(daysMap, s, from, to, today).points;
  return {
    from, end, to, done: today > end, dayNo: R.daysBetween(from, to) + 1,
    entered: sm.entered, days: sm.days, heavy: sm.heavy, planDays: sm.planDays, planKept: sm.planKept,
    weekDrinkDays: weeks.map((e) => e.drinkDays),
    achievedWeeks: weeks.filter((e) => e.complete && e.status === 'achieved').length,
    completeWeeks: weeks.filter((e) => e.complete).length,
    weight: pts.length >= 2 ? { from: pts[0].kg, to: pts[pts.length - 1].kg } : null,
  };
}

const md = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

export function fourWeekText(c, u) {
  const lines = [`[절주노트 4주 점검] ${md(c.from)}~${md(c.end)}${c.done ? '' : ` (${c.dayNo}일째)`}`];
  lines.push(`입력 ${c.entered}/${c.days}일 · 과음 ${c.heavy}회 · 상한 달성 ${c.planKept}/${c.planDays}`);
  lines.push(`주별 음주일 ${c.weekDrinkDays.join('·')} · 목표 달성 ${c.achievedWeeks}/${c.completeWeeks}주`);
  if (c.weight) lines.push(`체중 ${c.weight.from} → ${c.weight.to}kg`);
  return lines.join('\n');
}

// 11. 주간 요약 복사 글
export function weekSummaryText(daysMap, goals, s, ws, today) {
  const ev = R.weekEval(daysMap, goals, ws, s, today);
  const to = R.addDays(ws, 6) < today ? R.addDays(ws, 6) : today;
  const sm = summary(daysMap, s, ws, to);
  const streak = R.goalStreak(daysMap, goals, s, today);
  const w = weightTrend(daysMap, s, ws, to, today).points;
  const g = ev.goal;
  const lines = [`[절주노트 주간 요약] ${md(ws)}~${md(R.addDays(ws, 6))}${g ? ` · 목표 주 ${g.weeklyDrinkDaysMax}회 이하` : ''}`];
  lines.push(`음주일 ${ev.drinkDays}${g ? `/${g.weeklyDrinkDaysMax}` : ''} · 과음 ${ev.heavy} · 총량 ${R.fmtAmount(ev.totalG, s.unit)} · 상한 달성 ${sm.planKept}/${sm.planDays}`);
  lines.push(`안 마신 날 ${sm.sober} · 입력 ${sm.entered}/${sm.days}일 · 목표 달성 ${streak.current}주 연속`);
  if (w.length >= 2) lines.push(`체중 ${w[0].kg} → ${w[w.length - 1].kg}kg`);
  else if (w.length === 1) lines.push(`체중 ${w[0].kg}kg`);
  return lines.join('\n');
}
