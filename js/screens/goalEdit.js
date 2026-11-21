// 목표 편집: #/goal/new(목표 바꾸기) · #/goal/step(단계 추가) · #/goal/<id>(미래 단계 고치기) · #/goal/welcome(첫 실행 직접 정하기)
import * as repo from '../repo.js';
import * as R from '../rules.js';
import { esc, WD, fmtMDWp } from '../format.js';
import { toast, askNumber, stepperHtml } from './shared.js';

// 최근 4주(오늘 포함 28일) 평균: 주 n회, 한 번에 n g
export function recentLevel(days, today) {
  let drink = 0, g = 0, entered = 0;
  for (const d of R.dateRange(R.addDays(today, -27), today)) {
    const day = days[d];
    if (!R.isEntered(day)) continue;
    entered++;
    if (R.isDrinkDay(day)) { drink++; g += day.alcoholG; }
  }
  return { entered, perWeek: drink / 4, perOccasionG: drink ? g / drink : 0 };
}

export function render(root, d, ctx) {
  const s = d.settings;
  const u = s.unit;
  const wso = R.wsoOf(s);
  const curWs = R.weekStartOf(d.today, wso);
  const mode = ctx.param === 'step' || ctx.param === 'welcome' || ctx.param === 'new' ? ctx.param : 'edit';
  const editing = mode === 'edit' ? d.goals.find((g) => g.id === ctx.param) : null;
  if (mode === 'edit' && (!editing || R.goalStarted(editing, d.today, wso))) {
    root.innerHTML = '<div class="page"><a class="back" href="#/goals">← 목표</a><div class="small">고칠 수 있는 단계가 아니에요(이미 시작했거나 없음).</div></div>';
    return;
  }
  const lastFrom = d.goals.reduce((m, g) => (g.effectiveFrom > m ? g.effectiveFrom : m), curWs);
  const lastWs = R.weekStartOf(lastFrom, wso);
  const base = editing || (mode === 'step' ? R.goalForWeek(d.goals, lastWs) : R.currentGoal(d.goals, d.today, wso)) || R.DEFAULT_GOAL;
  const st = {
    max: base.weeklyDrinkDaysMax, heavy: base.heavyMaxPerWeek, totalOn: base.weeklyTotalG != null,
    totalG: base.weeklyTotalG ?? base.weeklyDrinkDaysMax * base.defaultLimitG,
    dry: [...(base.dryWeekdays || [])], limitG: base.defaultLimitG,
  };
  if (mode === 'step' && !editing) st.max = Math.max(0, st.max - 1);

  // 적용 시작 후보(한 주 시작 요일만). 고치는 단계의 날짜가 다른 요일이면(예: 월요일 기준일 때 만든 단계) 그 주의 시작일로 보여 준다
  const mondays = [];
  const editWs = editing ? R.weekStartOf(editing.effectiveFrom, wso) : null;
  const firstPick = mode === 'step' ? R.addDays(lastWs, 7) : mode === 'edit' ? R.addDays(curWs, 7) : R.addDays(curWs, 14);
  for (let i = 0; i < 26; i++) mondays.push(R.addDays(firstPick, i * 7));
  if (editWs && !mondays.includes(editWs)) { mondays.push(editWs); mondays.sort(); }
  const startOpts = mode === 'step' || mode === 'edit' ? ['pick'] : mode === 'welcome' ? ['this'] : ['this', 'next', 'pick'];
  st.start = startOpts[0];
  st.pick = editing ? editWs : mondays[0];

  const lv = recentLevel(d.days, d.today);
  const title = { new: '목표 바꾸기', step: '단계 추가', edit: '단계 고치기', welcome: '목표 직접 정하기' }[mode];

  root.innerHTML = `
    <form class="page form" novalidate>
      <div class="row"><a class="back" href="${mode === 'welcome' ? '#/welcome/2' : '#/goals'}">← ${mode === 'welcome' ? '처음 설정' : '목표'}</a></div>
      <div class="h1">${title}</div>
      <div class="card soft small" style="color:var(--text)">${lv.entered ? `최근 4주 평균 주 ${R.fmtNum(R.roundHalf(lv.perWeek))}회 · 한 번에 ${esc(R.fmtAmount(lv.perOccasionG, u))}` : '아직 최근 4주 기록이 없어요.'}</div>
      <div class="card" style="gap:12px">
        <div class="label-strong">주간 음주일 상한</div>${stepperHtml('max', '주간 음주일 상한', '')}
        <div class="label-strong">주간 과음 허용</div>${stepperHtml('heavy', '주간 과음 허용', '')}
        <label class="check"><input type="checkbox" id="ge-total"> 주간 총량 상한 정하기</label>
        <div data-el="total-box">${stepperHtml('total', '주간 총량 상한', '')}</div>
        <div class="field"><div class="label-strong" id="ge-dry">금주 요일 <span class="opt">(선택, 여러 개)</span></div>
          <div class="wd-chips" role="group" aria-labelledby="ge-dry">${R.weekdayOrder(wso).map((i) => `<button type="button" class="wd-chip" data-dry="${i}">${WD[i]}</button>`).join('')}</div></div>
        <div class="label-strong">술자리 상한 기본값</div>${stepperHtml('limit', '술자리 상한 기본값', '')}
      </div>
      <div class="card" style="gap:10px">
        <div class="label-strong">적용 시작</div>
        ${startOpts.length > 1 ? `<div class="modes3" role="group" aria-label="적용 시작">
          <button type="button" class="pill" data-start="this">이번 주부터<small>${esc(fmtMDWp(curWs))}</small></button>
          <button type="button" class="pill" data-start="next">다음 주부터<small>${esc(fmtMDWp(R.addDays(curWs, 7)))}</small></button>
          <button type="button" class="pill" data-start="pick">날짜 고르기<small>${wso === 0 ? '일요일만' : '월요일만'}</small></button></div>` : ''}
        ${startOpts.includes('pick') ? `<select class="input" id="ge-pick" aria-label="적용 시작 ${wso === 0 ? '일요일' : '월요일'}">${mondays.map((m) => `<option value="${m}" ${m === st.pick ? 'selected' : ''}>${esc(fmtMDWp(m))}부터</option>`).join('')}</select>` : ''}
        ${mode === 'welcome' ? `<div class="small">이번 주(${esc(fmtMDWp(curWs))})부터 적용해요.</div>` : ''}
        <div class="small">지난 주의 달성 판정은 바뀌지 않아요.</div>
      </div>
      <div class="tiny">참고: 질병관리청 고위험음주 기준 — 한 자리에서 소주 남자 7잔·여자 5잔 이상을 주 2회 이상.</div>
      <div class="error" data-el="err" role="alert"></div>
    </form>
    <div class="actions form-actions"><button type="button" class="btn primary big" data-act="save">저장</button></div>`;

  const q = (sel) => root.querySelector(sel);
  const disp = (g) => R.toDisplay(g, u);
  function paint() {
    q('[data-stepper="max"] [data-val]').textContent = `주 ${st.max}회 이하`;
    q('[data-stepper="heavy"] [data-val]').textContent = `주 ${st.heavy}회`;
    q('[data-stepper="total"] [data-val]').textContent = `${R.fmtAmount(st.totalG, u)} 이하`;
    q('[data-stepper="limit"] [data-val]').textContent = R.fmtAmount(st.limitG, u);
    q('#ge-total').checked = st.totalOn;
    q('[data-el="total-box"]').hidden = !st.totalOn;
    root.querySelectorAll('[data-dry]').forEach((b) => b.setAttribute('aria-pressed', String(st.dry.includes(Number(b.dataset.dry)))));
    root.querySelectorAll('[data-start]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.start === st.start)));
    const pick = q('#ge-pick');
    if (pick) pick.hidden = st.start !== 'pick';
  }
  paint();
  const step = (id, fn) => root.querySelectorAll(`[data-stepper="${id}"] [data-step]`).forEach((x) => x.addEventListener('click', () => { fn(Number(x.dataset.step)); paint(); }));
  step('max', (k) => { st.max = Math.min(7, Math.max(0, st.max + k)); });
  step('heavy', (k) => { st.heavy = Math.min(3, Math.max(0, st.heavy + k)); });
  step('total', (k) => { st.totalG = R.fromDisplay(Math.max(0, disp(st.totalG) + k * R.unitStep(u)), u); });
  step('limit', (k) => { st.limitG = R.fromDisplay(Math.max(0.5, disp(st.limitG) + k * R.unitStep(u)), u); });
  const key = (id, title, get, set, opt) => q(`[data-stepper="${id}"] [data-val]`).addEventListener('click', async () => {
    const v = await askNumber({ title, value: get(), ...opt });
    if (v != null) { set(v); paint(); }
  });
  key('max', '주간 음주일 상한(0~7)', () => st.max, (v) => { st.max = Math.round(v); }, { step: 1, max: 7 });
  key('heavy', '주간 과음 허용(0~3)', () => st.heavy, (v) => { st.heavy = Math.round(v); }, { step: 1, max: 3 });
  key('total', `주간 총량 상한(${R.UNITS[u].label})`, () => disp(st.totalG), (v) => { st.totalG = R.fromDisplay(R.roundHalf(v), u); }, { max: 200 });
  key('limit', `술자리 상한 기본값(${R.UNITS[u].label})`, () => disp(st.limitG), (v) => { st.limitG = R.fromDisplay(R.roundHalf(Math.max(0.5, v)), u); }, { min: 0.5, max: 50 });
  q('#ge-total').addEventListener('change', (e) => {
    st.totalOn = e.target.checked;
    if (st.totalOn) st.totalG = st.max * st.limitG; // 제안값 = 음주일 상한 × 술자리 상한 기본값
    paint();
  });
  root.querySelectorAll('[data-dry]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.dry);
    st.dry = st.dry.includes(i) ? st.dry.filter((x) => x !== i) : [...st.dry, i].sort();
    paint();
  }));
  root.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => { st.start = b.dataset.start; paint(); }));
  const pick = q('#ge-pick');
  if (pick) pick.addEventListener('change', () => { st.pick = pick.value; });

  q('[data-act="save"]').addEventListener('click', async () => {
    const effectiveFrom = st.start === 'this' ? curWs : st.start === 'next' ? R.addDays(curWs, 7) : st.pick;
    if (R.weekPos(effectiveFrom, wso) !== 0) { q('[data-el="err"]').textContent = `적용 시작은 ${wso === 0 ? '일요일' : '월요일'}만 고를 수 있어요.`; return; }
    const goal = {
      weeklyDrinkDaysMax: st.max, heavyMaxPerWeek: st.heavy, weeklyTotalG: st.totalOn ? st.totalG : null,
      dryWeekdays: st.dry, defaultLimitG: st.limitG, effectiveFrom, note: editing ? editing.note || '' : '',
    };
    try {
      if (mode === 'welcome') { await repo.replaceGoals([goal]); ctx.go('welcome/3'); return; }
      if (editing) await repo.updateFutureGoal(editing.id, goal, d.today, wso);
      else await repo.addGoal(goal);
      toast(`${fmtMDWp(effectiveFrom)}부터 주 ${st.max}회 이하`);
      ctx.go('goals');
    } catch (e) { q('[data-el="err"]').textContent = e.message || String(e); }
  });
}
