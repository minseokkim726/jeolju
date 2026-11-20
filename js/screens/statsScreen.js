// 통계: 기간 선택 → 요약 · 기준선 대비 · 주별 추이 · 요일 패턴 · 상황별 · 주종 · 술자리 계획 · 컨디션 · 체중 · 4주 점검 · 주간 요약
import * as R from '../rules.js';
import * as ST from '../stats.js';
import { barChart, lineChart, ratioBar } from '../charts.js';
import { esc, WD, WD_FULL, fmtMD, fmtWeek, fmtKcal } from '../format.js';
import { toast, copyText } from './shared.js';

const view = { period: '4w', weekly: 'days' };
const DRINK_COLORS = { soju: '#2F5D8A', soju_half: '#24486B', soju_bottle: '#16324D', beer_can: '#6C8FB3', beer_500: '#A9C0D6', beer_bottle: '#8AA8C6', wine: '#8C5A2B', makgeolli: '#B9833F', whisky: '#5B6468', manual: '#C9CEC6' };
const need = (n, kind = 'day') => `<div class="empty-note">${kind === 'drink' ? `음주일 기록이 ${n}번 더 쌓이면 보여요` : `기록이 ${n}일 더 쌓이면 보여요`}</div>`;
const card = (title, body, extra = '') => `<div class="card"${extra}><div class="h2">${title}</div>${body}<div class="chart-note" aria-live="polite"></div></div>`;
const tile = (k, v, why = '') => `<div class="stat-tile"><span class="k">${k}</span><span class="v">${v}</span>${why ? `<span class="why">${why}</span>` : ''}</div>`;
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');
const condTxt = (v) => (v == null ? '–' : `${v} (${v >= 2.5 ? '좋음' : v >= 1.5 ? '보통' : '나쁨'} 쪽)`);

export function render(root, d, ctx) {
  const s = d.settings;
  const u = s.unit;
  const amt = (g) => esc(R.fmtAmount(g, u));
  const cnt = (g) => esc(R.fmtCount(g, u));
  const { from, to } = ST.periodRange(view.period, d.days, s, d.today);
  const sm = ST.summary(d.days, s, from, to);
  const parts = [];

  // 1. 요약
  parts.push(card('요약', sm.entered ? `<div class="stat-tiles">
      ${tile('음주일', `${sm.drinkDays}일`, `주 평균 ${R.fmtNum(Math.round(sm.perWeek * 10) / 10)}회`)}
      ${tile('안 마신 날', `${sm.sober}일`)}
      ${tile('과음', `${sm.heavy}회`, `기준 ${cnt(s.heavyG)} 이상`)}
      ${tile('총량', amt(sm.totalG), `음주일당 ${cnt(sm.avgPerDrinkG)} · 약 ${fmtKcal(R.kcalOf(sm.totalG))}`)}
      ${tile('상한 달성', sm.planDays ? `${sm.planKept}/${sm.planDays}` : '–', sm.planDays ? '계획 세운 날 중' : '계획 세운 날 없음')}
      ${tile('입력한 날', `${sm.entered}/${sm.days}일`, `입력률 ${pct(sm.entered, sm.days)}`)}
    </div><div class="tiny">칼로리는 알코올분만 계산한 대략치(안주·맥주 탄수화물 제외)</div>` : need(1)));

  // 2. 기준선 대비
  const bc = ST.baselineCompare(d.days, s, d.today);
  if (!bc) parts.push(card('기준선 대비', '<div class="empty-note">설정에서 평소 음주량을 적으면 보여요. <a class="link" href="#/settings">설정으로</a></div>'));
  else {
    const sv = bc.saved;
    const head = sv && sv.entered ? (sv.savedG >= 0
      ? `<div class="st-big">시작 후 줄인 양 ${amt(sv.savedG)} · 약 ${fmtKcal(R.kcalOf(sv.savedG))}</div>`
      : `<div class="st-big">기준보다 ${cnt(-sv.savedG)} 더 · 약 ${fmtKcal(R.kcalOf(-sv.savedG))}</div>`) : need(1);
    const mx = Math.max(bc.baselineWeeklyG, bc.recentWeeklyG, 1);
    const bars = bc.enough ? `<div class="hbars">
        <div class="hbar"><span>기준선 주 평균</span><div class="bar"><span style="width:${(bc.baselineWeeklyG / mx) * 100}%;background:var(--line-strong)"></span></div><span class="v">${cnt(bc.baselineWeeklyG)}</span></div>
        <div class="hbar"><span>최근 4주 주 평균</span><div class="bar"><span style="width:${(bc.recentWeeklyG / mx) * 100}%"></span></div><span class="v">${cnt(bc.recentWeeklyG)}</span></div>
      </div>` : need(ST.MIN.baselineRecent - bc.recentEntered);
    parts.push(card('기준선 대비', `${head}<div class="small">시작일(${esc(fmtMD(s.startDate))}) 이후 입력한 ${sv ? sv.entered : 0}일만 비교해요.</div>${bars}`));
  }

  // 3. 주별 추이
  const wk = ST.weekly(d.days, d.goals, s, from, to, d.today);
  const wkWith = wk.filter((w) => w.entered > 0);
  let wkBody;
  if (wk.length < 2) wkBody = '<div class="empty-note">기간을 최근 4주 이상으로 고르면 보여요</div>';
  else if (wkWith.length < ST.MIN.weeks) wkBody = need(7 * (ST.MIN.weeks - wkWith.length));
  else if (view.weekly === 'days') {
    wkBody = barChart(wk.map((w) => ({
      label: fmtMD(w.weekStart), value: w.drinkDays, goal: w.goalMax, mark: w.heavy > 0,
      note: `${fmtWeek(w.weekStart)}: 음주일 ${w.drinkDays}일${w.goalMax != null ? ` / 목표 ${w.goalMax}` : ''} · 과음 ${w.heavy} · 입력 ${w.entered}일${w.complete ? '' : ' (진행 중)'}`,
    })), { max: 7, unit: '일' }) + '<div class="legend"><span>막대 = 음주일</span><span><i style="border-top:2px dashed var(--warn);height:0;border-radius:0"></i>목표</span><span style="color:var(--warn)">■ 과음한 주</span></div>';
  } else {
    wkBody = lineChart(wk.map((w) => ({ label: fmtMD(w.weekStart), value: w.entered ? R.toDisplay(w.totalG, u) : null, note: `${fmtWeek(w.weekStart)}: 총량 ${R.fmtAmount(w.totalG, u)}${w.goalTotalG != null ? ` / 목표 ${R.fmtAmount(w.goalTotalG, u)}` : ''}` })), { min: 0 })
      + `<div class="legend"><span>선 = 주별 총량(${esc(R.UNITS[u].label)})</span></div>`;
  }
  parts.push(card('주별 추이', `<div class="seg" role="group" aria-label="주별 추이 보기">
      <button type="button" data-weekly="days" aria-pressed="${view.weekly === 'days'}">음주일</button>
      <button type="button" data-weekly="total" aria-pressed="${view.weekly === 'total'}">총량</button></div>${wkBody}`));

  // 4. 요일 패턴
  const wp = ST.weekdayPattern(d.days, s, from, to);
  parts.push(card('요일 패턴', wp.enough ? `
    ${wp.top ? `<div class="st-big">${WD_FULL[wp.top.wd]}에 가장 많이 마셨어요(${wp.top.entered}번 중 ${wp.top.drink}번)</div>` : ''}
    ${barChart(wp.rows.map((r) => ({ label: WD[r.wd], value: r.drink, note: `${WD_FULL[r.wd]}: ${r.entered}번 중 ${r.drink}번 마심${r.drink ? ` · 평균 ${R.fmtAmount(r.avgG, u)}` : ''}` })), { unit: '번' })}
    <div class="wd-avg"><span class="tiny">평균 양</span>${wp.rows.map((r) => `<span>${r.drink ? esc(R.fmtNum(R.toDisplay(r.avgG, u))) : '–'}</span>`).join('')}</div>` : need(wp.need, 'drink')));

  // 5. 상황별
  const oc = ST.byOccasion(d.days, s, from, to);
  const rr = ST.recentReasons(d.days, from, to, 5);
  const rrHtml = rr.length ? `<div class="label-strong" style="margin-top:6px">최근 마신 이유</div>
      <ul class="reasons">${rr.map((x) => `<li><span class="rd">${esc(fmtMD(x.date))} · ${cnt(x.g)}</span><span>${esc(x.memo)}</span></li>`).join('')}</ul>` : '';
  if (oc.length || rr.length) {
    parts.push(card('상황별', `${oc.length ? `<table class="stat-table"><thead><tr><th>상황</th><th class="num">횟수</th><th class="num">평균 양</th><th class="num">과음</th></tr></thead>
      <tbody>${oc.map((o) => `<tr><td>${esc(o.occasion)}</td><td class="num">${o.count}</td><td class="num">${cnt(o.avgG)}</td><td class="num">${o.heavy}</td></tr>`).join('')}</tbody></table>` : ''}${rrHtml}`));
  }

  // 5-2. 안주(v1.3)
  const fs = ST.foodStats(d.days, from, to);
  {
    let body;
    if (!fs.enough) body = `<div class="empty-note">안주 기록이 ${fs.need}일 더 쌓이면 보여요</div>`;
    else {
      const fw = ST.foodWeightChange(d.days, from, to);
      const mx = Math.max(1, ...fs.types.map((t) => t.count));
      const kg = (v) => (v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(2)}kg`);
      const row = (label, x) => `<tr><td>${label}</td><td class="num">${kg(x.avg)}</td><td class="num">${x.n}일</td></tr>`;
      body = `<div class="stat-lines"><div>음주일 ${fs.drinkDays}일 중 안주 기록 ${fs.withFood}일 · 많이 ${fs.many}일 · 마무리 ${fs.finish}일(밥·면 ${fs.meal}, 2차 야식 ${fs.late})</div></div>
        ${fs.types.length ? `<div class="label-strong" style="margin-top:6px">종류별 횟수</div><div class="hbars food-bars">${fs.types.map((t) => `<div class="hbar"><span>${esc(t.label)}</span><div class="bar"><span style="width:${(t.count / mx) * 100}%"></span></div><span class="v">${t.count}번</span></div>`).join('')}</div>` : ''}
        <div class="label-strong" style="margin-top:10px">다음 날 아침 체중 변화</div>
        <table class="stat-table"><thead><tr><th>그날</th><th class="num">평균 변화</th><th class="num">날 수</th></tr></thead><tbody>
          ${row('안주 적게', fw.a1)}${row('안주 보통', fw.a2)}${row('안주 많이', fw.a3)}
          ${row('마무리 없음', fw.finNo)}${row('마무리 있음', fw.finYes)}
          <tr class="ref"><td>안 마신 날</td><td class="num">${kg(fw.sober.avg)}</td><td class="num">${fw.sober.n}일</td></tr></tbody></table>
        <div class="tiny">그날 아침과 다음 날 아침 체중이 모두 있는 날만 · 2일 미만은 –</div>`;
    }
    parts.push(card('안주', body));
  }

  // 6. 주종 비율
  const dt = ST.drinkTypes(d.days, from, to);
  if (dt.items.length) {
    parts.push(card('주종 비율 (알코올 g 기준)', ratioBar(dt.items.map((i) => ({ label: i.type === 'manual' ? '직접 입력' : R.DRINK_BY_KEY[i.type].short, value: i.g, color: DRINK_COLORS[i.type] })))));
  }

  // 7. 술자리 계획
  const pc = ST.planCompare(d.days, s, from, to);
  let pcBody;
  if (!pc.planDays) pcBody = '<div class="empty-note">술자리 전에 상한을 정한 날이 생기면 보여요</div>';
  else {
    const mx = Math.max(pc.withPlan.avgG, pc.withoutPlan.avgG, 1);
    pcBody = `<div class="stat-lines">
        <div>상한 달성률 <b>${pct(pc.kept, pc.planDays)}</b> (${pc.kept}/${pc.planDays})</div>
        ${pc.avgLateMin != null ? `<div>귀가 시각 평균 ${pc.avgLateMin ? `<b>${pc.avgLateMin}분</b> 늦음` : '<b>지킴</b>'}</div>` : ''}
      </div>
      ${pc.enough ? `<div class="hbars">
        <div class="hbar"><span>계획 세운 날</span><div class="bar"><span style="width:${(pc.withPlan.avgG / mx) * 100}%"></span></div><span class="v">${cnt(pc.withPlan.avgG)}</span></div>
        <div class="hbar"><span>안 세운 날</span><div class="bar"><span style="width:${(pc.withoutPlan.avgG / mx) * 100}%;background:var(--line-strong)"></span></div><span class="v">${cnt(pc.withoutPlan.avgG)}</span></div>
      </div><div class="tiny">음주일 평균 양 · 계획 ${pc.withPlan.n}번 / 계획 없이 ${pc.withoutPlan.n}번</div>`
        : (pc.need ? need(pc.need, 'drink') : '<div class="empty-note">계획 세운 날과 안 세운 날이 모두 있어야 비교할 수 있어요</div>')}`;
  }
  parts.push(card('술자리 계획', pcBody));

  // 8. 다음 날 컨디션
  const cd = ST.conditionAfter(d.days, s, from, to);
  if (cd.any) {
    parts.push(card('다음 날 컨디션', `<table class="stat-table"><thead><tr><th>전날</th><th class="num">아침 평균(1 나쁨~3 좋음)</th><th class="num">날 수</th></tr></thead><tbody>
      <tr><td>안 마신 다음 날</td><td class="num">${condTxt(cd.sober.avg)}</td><td class="num">${cd.sober.n}</td></tr>
      <tr><td>마신 다음 날</td><td class="num">${condTxt(cd.drank.avg)}</td><td class="num">${cd.drank.n}</td></tr>
      <tr><td>과음 다음 날</td><td class="num">${condTxt(cd.heavy.avg)}</td><td class="num">${cd.heavy.n}</td></tr></tbody></table>`));
  }

  // 9. 체중
  const wt = ST.weightTrend(d.days, s, from, to, d.today);
  if (wt.any) {
    const dates = R.dateRange(from, to);
    const byDate = Object.fromEntries(wt.points.map((p) => [p.date, p.kg]));
    const drinkSet = new Set(wt.drinkDates);
    const chart = wt.points.length >= 2 ? lineChart(dates.map((dd) => ({ label: fmtMD(dd), value: byDate[dd] ?? null, note: `${fmtMD(dd)}${byDate[dd] != null ? ` · ${byDate[dd]}kg` : ''}${drinkSet.has(dd) ? ' · 음주일' : ''}` })),
      { dots: dates.map((dd, i) => (drinkSet.has(dd) ? i : -1)).filter((i) => i >= 0), dotLabel: '음주일' })
      + '<div class="legend"><span>선 = 체중(kg)</span><span><i style="background:var(--warn-dark);border-radius:50%;width:8px;height:8px"></i>아래 점 = 음주일</span></div>' : need(1);
    const table = wt.tableEnough ? `<div class="small" style="margin-top:6px">주별 체중 변화와 다음 주 음주일</div>
      <table class="stat-table"><thead><tr><th>주</th><th class="num">체중 변화</th><th class="num">다음 주 음주일</th></tr></thead><tbody>
      ${wt.rows.map((r) => `<tr><td>${esc(fmtWeek(r.weekStart))}</td><td class="num">${r.changeKg > 0 ? '+' : ''}${r.changeKg}kg</td><td class="num">${r.nextDrinkDays}${r.nextComplete ? '' : ' (진행 중)'}</td></tr>`).join('')}</tbody></table>`
      : `<div class="tiny">주별 표는 체중 기록이 ${ST.MIN.weightWeeks + 1}주 이상 쌓이면 보여요</div>`;
    parts.push(card('체중', chart + table));
  }

  // 10. 4주 점검
  const fc = ST.fourWeekCheck(d.days, d.goals, s, d.today);
  if (fc) {
    parts.push(card(`4주 점검 <span class="tiny">${esc(fmtMD(fc.from))}~${esc(fmtMD(fc.end))}${fc.done ? '' : ` · ${fc.dayNo}/28일째`}</span>`, `<div class="stat-tiles">
        ${tile('입력한 날', `${fc.entered}/${fc.days}일`)}
        ${tile('과음', `${fc.heavy}회`)}
        ${tile('주별 음주일', esc(fc.weekDrinkDays.join('·')))}
        ${tile('상한 달성률', fc.planDays ? `${pct(fc.planKept, fc.planDays)}` : '–', fc.planDays ? `${fc.planKept}/${fc.planDays}` : '')}
        ${tile('목표 달성 주', `${fc.achievedWeeks}/${fc.completeWeeks}주`, '끝난 주 기준')}
        ${tile('체중 변화', fc.weight ? `${R.fmtNum(Math.round((fc.weight.to - fc.weight.from) * 10) / 10)}kg` : '–', fc.weight ? `${fc.weight.from} → ${fc.weight.to}` : '')}
      </div><button type="button" class="btn" data-copy="four">점검 요약 복사</button>`));
  }

  // 11. 주간 요약 복사(이번 주)
  const weekText = view.period === 'week' ? ST.weekSummaryText(d.days, d.goals, s, R.weekStartOf(d.today), d.today) : '';
  if (weekText) parts.push(card('주간 요약', `<pre class="summary">${esc(weekText)}</pre><button type="button" class="btn" data-copy="week">주간 요약 복사</button>`));

  const counsel = R.counselNeeded(d.days, s, d.today);

  root.innerHTML = `
    <div class="page">
      <div class="h1">통계</div>
      <div class="period-chips" role="group" aria-label="기간">
        ${ST.PERIODS.map((p) => `<button type="button" class="pill" data-period="${p.key}" aria-pressed="${p.key === view.period}">${p.label}</button>`).join('')}
      </div>
      <div class="tiny">${esc(fmtMD(from))} ~ ${esc(fmtMD(to))} · 입력된 날만으로 계산</div>
      ${parts.join('')}
      ${counsel ? '<div class="counsel">과음이 이어지면 혼자보다 함께가 쉬워요. 가까운 정신건강복지센터나 중독관리통합지원센터에서 상담(AUDIT 선별 포함)을 받을 수 있어요.</div>' : ''}
      <div class="page-bottom-space"></div>
    </div>`;

  root.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => { view.period = b.dataset.period; ctx.refresh(); }));
  root.querySelectorAll('[data-weekly]').forEach((b) => b.addEventListener('click', () => { view.weekly = b.dataset.weekly; ctx.refresh(); }));
  root.querySelectorAll('.hit').forEach((h) => h.addEventListener('click', () => {
    const c = h.closest('.card');
    const note = c && c.querySelector('.chart-note');
    if (note) note.textContent = h.dataset.note || '';
  }));
  root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const text = b.dataset.copy === 'week' ? weekText : ST.fourWeekText(fc, u);
    toast((await copyText(text)) ? '복사했어요' : '복사하지 못했어요');
  }));
}
