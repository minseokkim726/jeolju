// 상한 정하기(술자리 전): 날짜 · 상한 양 · 귀가 목표 · 무알콜 교대 · 한 줄
import * as repo from '../repo.js';
import * as R from '../rules.js';
import { esc, fmtMDW } from '../format.js';
import { toast, ask, askNumber, stepperHtml, unitToggleHtml, inputUnit } from './shared.js';

export function render(root, d, ctx) {
  const s = d.settings;
  let u = inputUnit.get(s.unit); // [잔 | 병] 전환
  const quick = () => (u === 'soju_bottle' ? [0.5, 1, 1.5, 2] : [2, 3, 4, 5]);
  let date = R.isDateStr(ctx.param) ? ctx.param : d.today;
  const cur = (d.days[date] && d.days[date].plan) || null;
  const goal = R.goalForWeek(d.goals, R.weekStartOf(date, R.wsoOf(s))) || R.DEFAULT_GOAL;
  const st = {
    limitG: cur ? cur.limitG : goal.defaultLimitG,
    homeBy: cur ? cur.homeBy || '' : '23:00',
    alt: cur ? !!cur.altNonAlc : false,
  };

  root.innerHTML = `
    <form class="page form" novalidate>
      <div class="row"><a class="back" href="#/today">← 오늘</a></div>
      <div class="h1">상한 정하기</div>
      <div class="sub">술자리 전에 정해 두면 다음 날 기록과 비교해 보여줘요.</div>
      <div class="card" style="gap:14px">
        <div class="field">
          <label for="pl-date">날짜</label>
          <input id="pl-date" class="input" type="date" value="${date}" min="${R.addDays(d.today, -6)}">
        </div>
        <div class="field">
          <div class="row center"><div class="label-strong" data-el="ulabel">상한 양</div>${unitToggleHtml(s.unit, u)}</div>
          ${stepperHtml('limit', '상한 양', '', { big: true })}
          <div class="amount-unit" data-el="hint"></div>
          <div class="pills center" role="group" aria-label="자주 쓰는 상한" data-el="quick"></div>
        </div>
        <div class="field">
          <label for="pl-home">귀가 목표 시각</label>
          <input id="pl-home" class="input" type="time" value="${esc(st.homeBy)}">
        </div>
        <label class="check"><input type="checkbox" id="pl-alt" ${st.alt ? 'checked' : ''}> 무알콜 음료와 번갈아 마시기</label>
        <div class="field">
          <label for="pl-note">한 줄 <span class="opt">(선택)</span></label>
          <input id="pl-note" class="input" type="text" maxlength="100" value="${esc(cur ? cur.note || '' : '')}" placeholder="예: 2차는 안 간다">
        </div>
      </div>
      <div class="hints" data-el="hints" aria-live="polite"></div>
    </form>
    <div class="actions form-actions">
      <button type="button" class="btn primary big" data-act="save">저장</button>
      ${cur ? '<button type="button" class="btn link" data-act="delete">계획 삭제</button>' : ''}
    </div>`;

  const q = (sel) => root.querySelector(sel);
  function paintQuick() {
    q('[data-el="quick"]').innerHTML = quick().map((n) => `<button type="button" class="pill" data-quick="${n}">${R.fmtNum(n)}${R.unitSuffix(u)}</button>`).join('');
    root.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => { st.limitG = R.fromDisplay(Number(b.dataset.quick), u); paint(); }));
  }
  function paint() {
    const v = R.fmtNum(R.toDisplay(st.limitG, u));
    q('[data-val]').textContent = `${v}${R.unitSuffix(u)}`;
    q('[data-el="ulabel"]').textContent = `상한 양 (${R.UNITS[u].label})`;
    q('[data-el="hint"]').textContent = R.cupsHint(st.limitG, u);
    root.querySelectorAll('[data-unit-in]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unitIn === u)));
    root.querySelectorAll('[data-quick]').forEach((b) => b.setAttribute('aria-pressed', String(R.fromDisplay(Number(b.dataset.quick), u) === st.limitG)));
    const h = R.planHints(d.days, d.goals, s, date, st.limitG);
    const lines = [];
    if (h.overDays) lines.push(`이번 주 ${h.nth}번째 술자리예요.`);
    if (h.dryDay) lines.push('금주 요일로 정한 날이에요.');
    if (h.overHeavy) lines.push(`과음 기준(${R.fmtCount(s.heavyG, u)}) 이상이에요.`);
    if (h.remainingG != null) lines.push(`이번 주 남은 양 ${R.fmtAmount(h.remainingG, u)}`);
    q('[data-el="hints"]').innerHTML = lines.map((t) => `<div class="hint">${esc(t)}</div>`).join('');
  }
  paintQuick();
  paint();

  root.querySelectorAll('[data-unit-in]').forEach((b) => b.addEventListener('click', () => {
    u = b.dataset.unitIn;
    inputUnit.set(s.unit, u);
    paintQuick();
    paint();
  }));
  root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    st.limitG = Math.max(R.unitG(u) / 2, R.fromDisplay(R.toDisplay(st.limitG, u) + Number(b.dataset.step) * R.unitStep(u), u));
    paint();
  }));
  q('[data-val]').addEventListener('click', async () => {
    const v = await askNumber({ title: `상한 양 (${R.UNITS[u].label})`, value: R.toDisplay(st.limitG, u), min: 0.5, max: 50 });
    if (v == null) return;
    st.limitG = R.fromDisplay(R.roundHalf(v), u);
    paint();
  });
  q('#pl-date').addEventListener('change', (e) => { if (R.isDateStr(e.target.value)) { date = e.target.value; paint(); } });

  async function save() {
    if (!R.isDateStr(date)) { toast('날짜를 골라 주세요'); return; }
    await repo.savePlan(date, { limitG: st.limitG, homeBy: q('#pl-home').value || null, altNonAlc: q('#pl-alt').checked, note: q('#pl-note').value.trim() });
    toast(`${fmtMDW(date)} 상한을 저장했어요`);
    ctx.go(date > d.today ? `cal/${date.slice(0, 7)}` : 'today');
  }
  q('form').addEventListener('submit', (e) => { e.preventDefault(); save(); });
  q('[data-act="save"]').addEventListener('click', save);
  const del = q('[data-act="delete"]');
  if (del) del.addEventListener('click', async () => {
    const ok = await ask({ title: '이 날 계획을 지울까요?', choices: [{ label: '삭제', value: true, kind: 'primary' }, { label: '취소', value: false }] });
    if (!ok) return;
    await repo.deletePlan(ctx.param && R.isDateStr(ctx.param) ? ctx.param : d.today);
    toast('계획을 지웠어요');
    ctx.go('today');
  });
}
