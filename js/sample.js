// 시험용 예시 6주 데이터(백업 파일과 같은 형식). tests.html의 [예시 6주 데이터 넣기]가 별도 저장소에 넣는다.
import * as R from './rules.js';

// 같은 결과가 나오도록 고정 난수
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function makeSample(today) {
  const rand = rng(20261120);
  const curWs = R.weekStartOf(today);
  const start = R.addDays(curWs, -35); // 6주 전 월요일
  const iso = (d) => `${d}T09:00:00.000Z`;
  const goals = [
    { id: 'demo-g1', ...R.DEFAULT_GOAL, effectiveFrom: start, weeklyDrinkDaysMax: 3, createdAt: iso(start), note: '단계적으로: 첫 2주' },
    { id: 'demo-g2', ...R.DEFAULT_GOAL, effectiveFrom: R.addDays(start, 14), weeklyDrinkDaysMax: 2, weeklyTotalG: 91, dryWeekdays: [0], createdAt: iso(start), note: '그다음부터' },
    { id: 'demo-g3', ...R.DEFAULT_GOAL, effectiveFrom: R.addDays(curWs, 14), weeklyDrinkDaysMax: 1, weeklyTotalG: 52, dryWeekdays: [0], createdAt: iso(today), note: '다음 단계' },
  ];
  // 주마다 마실 날(요일 번호)과 양(소주잔 수). 앞쪽 주일수록 많이
  const plan = [
    { days: [2, 4, 5, 6], cups: [5, 8, 4, 6] },
    { days: [1, 4, 5], cups: [4, 7, 5] },
    { days: [4, 5], cups: [5, 4] },
    { days: [3, 5], cups: [4, 3] },
    { days: [4, 5], cups: [8, 3] },
    { days: [4], cups: [4] },
  ];
  const kinds = [['soju'], ['soju', 'beer_500'], ['beer_can'], ['wine'], ['makgeolli'], ['soju', 'whisky']];
  const occ = ['회식', '모임', '가족', '혼술', '기타'];
  const days = [];
  const weekPlans = [];
  let weight = 78.6;
  for (let w = 0; w < 6; w++) {
    const ws = R.addDays(start, w * 7);
    const p = plan[w];
    weekPlans.push({ weekStart: ws, plannedDays: p.days.slice(0, w < 2 ? 3 : 2).map((i) => R.addDays(ws, i)), skipped: false, createdAt: iso(ws) });
    for (let i = 0; i < 7; i++) {
      const date = R.addDays(ws, i);
      if (date > today) break;
      if (date === today) continue; // 오늘은 비워 둔다(직접 눌러 보기용)
      const day = R.emptyDay(date);
      day.updatedAt = iso(date);
      if ((w === 1 && i === 2) || (w === 3 && i === 0)) { days.push(day); continue; } // 미입력 이틀
      const k = p.days.indexOf(i);
      if (k >= 0) {
        const cups = p.cups[k];
        const mix = kinds[Math.floor(rand() * kinds.length)];
        let g = 0;
        day.drinks = [];
        if (mix.length === 1) {
          const dg = R.DRINK_BY_KEY[mix[0]].g;
          const n = Math.max(1, Math.round((cups * 6.5) / dg));
          day.drinks.push({ type: mix[0], count: n }); g = n * dg;
        } else {
          day.drinks.push({ type: 'soju', count: cups - 2 }, { type: mix[1], count: 1 });
          g = (cups - 2) * 6.5 + R.DRINK_BY_KEY[mix[1]].g;
        }
        day.status = 'drank';
        day.alcoholG = Math.round(g * 1000) / 1000;
        day.occasion = occ[Math.floor(rand() * occ.length)];
        const late = Math.floor(rand() * 4);
        day.homeAt = ['22:40', '23:20', '00:10', '01:30'][late];
        if (rand() < 0.65) day.plan = { limitG: 26, homeBy: '23:30', altNonAlc: rand() < 0.5, note: '', createdAt: iso(date) };
        if (day.plan && day.plan.altNonAlc) day.altNonAlcDone = rand() < 0.6;
        day.condition = day.alcoholG >= 45.5 ? 1 : rand() < 0.5 ? 2 : 1;
      } else {
        day.status = 'sober';
        day.condition = rand() < 0.7 ? 3 : 2;
      }
      if (i % 2 === 0) { weight = Math.round((weight - 0.05 - rand() * 0.15 + (k >= 0 ? 0.2 : 0)) * 10) / 10; day.weightKg = weight; }
      if (k >= 0 && rand() < 0.5) day.memo = ['팀 회식', '스트레스', '그냥 당겨서', '친구 생일', '송년회 1차'][Math.floor(rand() * 5)];
      days.push(day);
    }
  }
  // 컨디션은 "그날 아침" 뜻(v2): 위에서는 마신 날 기준으로 정했으므로 다음 날로 옮긴다. 오늘은 직접 눌러 보도록 비운다.
  const moved = R.migrateDaysV1toV2(days).filter((x) => x.date !== today || x.status !== 'none' || x.weightKg != null);
  for (const x of moved) if (x.date === today) x.condition = null;
  days.length = 0;
  days.push(...moved);
  return {
    app: R.APP_ID, schemaVersion: R.SCHEMA_VERSION, exportedAt: new Date().toISOString(),
    data: {
      days, goals, weekPlans,
      settings: { ...R.DEFAULT_SETTINGS, onboarded: true, startDate: start, targetDate: `${today.slice(0, 4)}-12-31`, baseline: { drinkDaysPerWeek: 4.5, gPerOccasion: 45.5, heavyPerWeek: 2 }, longTermNote: '45세 이후 비음주', lastBackupAt: new Date().toISOString() },
      meta: [{ id: 'meta', schemaVersion: R.SCHEMA_VERSION }],
    },
  };
}
