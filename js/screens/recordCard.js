// 기록 카드: [안 마셨어요] / [마셨어요] + 선택 칸. 오늘 화면과 달력의 [고치기]가 함께 쓴다.
import * as repo from '../repo.js';
import * as R from '../rules.js';
import { esc, fmtMDW, relDay, fmtMin } from '../format.js';
import { toast, ask, askNumber, stepperHtml, unitToggleHtml, inputUnit } from './shared.js';

// 저장된 결과 한 줄: "4잔 · 00:10 귀가 — 상한 4잔·23:30 중 잔은 지킴, 귀가 40분 늦음"
export function resultLine(day, s) {
  if (!R.isEntered(day)) return '';
  if (!R.isDrinkDay(day)) return '안 마셨어요';
  const u = s.unit;
  let t = R.fmtCount(day.alcoholG, u);
  if (day.homeAt) t += ` · ${day.homeAt} 귀가`;
  if (day.plan) {
    const o = R.planOutcome(day);
    const p = day.plan;
    const parts = [];
    const homeChecked = !!(p.homeBy && day.homeAt);
    if (o.limitOk && (!homeChecked || o.homeOk)) parts.push(homeChecked ? '모두 지킴' : `${R.unitSuffix(u)}은 지킴`);
    else {
      parts.push(o.limitOk ? `${R.unitSuffix(u)}은 지킴` : `${R.unitSuffix(u)}은 ${R.fmtCount(o.overG, u)} 넘음`);
      if (homeChecked) parts.push(o.homeOk ? '귀가는 지킴' : `귀가 ${fmtMin(o.lateMin)} 늦음`);
    }
    t += ` — 상한 ${R.fmtCount(p.limitG, u)}${p.homeBy ? `·${p.homeBy}` : ''} 중 ${parts.join(', ')}`;
  }
  if (day.alcoholG >= s.heavyG) t += ` · 과음 기준(${R.fmtCount(s.heavyG, u)}) 이상`;
  return t;
}

export function recordTitle(date, today) {
  const rel = relDay(date, today);
  return rel ? `${rel}(${fmtMDW(date)}) 기록` : `${fmtMDW(date)} 기록`;
}

// el에 기록 카드를 그린다. opts: { date, onDate(newDate)|null, openDrank }
export function mountRecord(el, d, ctx, opts) {
  const s = d.settings;
  let u = inputUnit.get(s.unit); // 입력 단위([잔 | 병] 전환). 기본은 설정의 표시 단위
  const date = opts.date;
  const day = d.days[date] || R.emptyDay(date);
  const plan = day.plan;
  const status = day.status;

  // 마셨어요 입력 상태: 칩 내역 + 직접 입력분(g)
  const chips = [];
  let manualG = 0;
  for (const x of day.drinks || []) {
    if (x.type === 'manual') manualG += Number(x.g) || 0;
    else if (R.DRINK_BY_KEY[x.type]) chips.push({ type: x.type, count: x.count });
  }
  if (status === 'drank' && !(day.drinks || []).length) manualG = day.alcoholG;
  const st = { chips, manualG, history: [], open: !!opts.openDrank || false };
  const chipG = () => R.drinksG(st.chips);
  const totalG = () => Math.max(0, chipG() + st.manualG);
  const snapshot = () => st.history.push({ chips: st.chips.map((c) => ({ ...c })), manualG: st.manualG });
  function setTotal(newG) {
    newG = Math.max(0, Math.round(newG * 1000) / 1000);
    if (newG >= chipG()) st.manualG = newG - chipG();
    else { st.chips = []; st.manualG = newG; }
  }

  const occ = { v: day.occasion };
  const navs = opts.onDate ? {
    prev: `<button type="button" class="icon-btn" data-nav="-1" aria-label="이전 날">◀</button>`,
    next: `<button type="button" class="icon-btn" data-nav="1" aria-label="다음 날" ${date >= d.today ? 'disabled' : ''}>▶</button>`,
  } : { prev: '', next: '' };

  el.innerHTML = `
    <div class="card record-card">
      <div class="rec-head">${navs.prev}<div class="h2" data-el="title">${esc(recordTitle(date, d.today))}</div>${navs.next}</div>
      <div class="two-btns">
        <button type="button" class="btn big sober" data-act="sober" aria-pressed="${status === 'sober'}">${status === 'sober' ? '○ ' : ''}안 마셨어요</button>
        <button type="button" class="btn big drank" data-act="drank" aria-pressed="${status === 'drank'}" aria-expanded="false">${status === 'drank' ? '● ' : ''}마셨어요</button>
      </div>
      ${R.isEntered(day) ? `<div class="result-line" data-el="result">${esc(resultLine(day, s))}</div>` : ''}
      ${plan ? `<div class="small">계획: 상한 ${esc(R.fmtCount(plan.limitG, u))}${plan.homeBy ? ` · ${esc(plan.homeBy)} 귀가` : ''}${plan.altNonAlc ? ' · 무알콜 교대' : ''}</div>` : ''}
      <div class="drank-panel" data-el="panel" hidden>
        <div class="amount">
          <div class="amount-top">${unitToggleHtml(s.unit, u)}</div>
          ${stepperHtml('amt', '마신 양', '', { big: true })}
          <div class="amount-unit"><span data-el="unitlabel"></span> · 약 <span data-el="grams"></span>g</div>
        </div>
        <div class="drink-chips" role="group" aria-label="주종 칩(누를 때마다 더함)">
          ${R.DRINKS.map((x) => `<button type="button" class="drink-chip" data-drink="${x.key}"><b>${esc(x.label)}</b>${x.detail ? `<span>${esc(x.detail)}</span>` : ''}</button>`).join('')}
        </div>
        <div class="tally"><span data-el="tally"></span><button type="button" class="link-btn" data-act="undo">되돌리기</button></div>
        <div class="field">
          <label for="rc-home">귀가 시각 <span class="opt">(선택)</span></label>
          <input id="rc-home" class="input" type="time" value="${esc(day.homeAt || '')}">
        </div>
        ${s.showOccasion ? `<div class="field"><div class="label-strong" id="rc-occ">상황 <span class="opt">(선택)</span></div>
          <div class="pills" role="group" aria-labelledby="rc-occ">${R.OCCASIONS.map((o) => `<button type="button" class="pill" data-occ="${o}" aria-pressed="${day.occasion === o}">${o}</button>`).join('')}</div></div>` : ''}
        <div class="field"><label for="rc-memo">마신 이유·한 줄 메모 <span class="opt">(선택)</span></label>
          <input id="rc-memo" class="input" type="text" maxlength="200" value="${esc(day.memo || '')}" placeholder="팀 회식, 스트레스, 그냥 당겨서"></div>
        ${plan && plan.altNonAlc ? `<label class="check"><input type="checkbox" id="rc-alt" ${day.altNonAlcDone ? 'checked' : ''}> 무알콜 교대 했어요</label>` : ''}
        <div class="error" data-el="err" role="alert"></div>
        <button type="button" class="btn primary big" data-act="save">기록하기</button>
        ${status === 'drank' ? '<button type="button" class="link-btn quiet" data-act="clear">이 날 기록 지우기</button>' : ''}
      </div>
      ${status === 'sober' ? `<div class="sober-memo" data-el="smemo">
        ${day.memo ? `<div class="memo-line"><span>메모: ${esc(day.memo)}</span><button type="button" class="link-btn" data-act="smemo-open">고치기</button></div>`
          : '<button type="button" class="link-btn" data-act="smemo-open">메모 추가</button>'}
        <div class="field" data-el="smemo-form" hidden>
          <label for="rc-smemo">한 줄 메모 <span class="opt">(선택)</span></label>
          <div class="memo-row"><input id="rc-smemo" class="input" type="text" maxlength="200" value="${esc(day.memo || '')}" placeholder="회식에서 사이다로 버팀">
          <button type="button" class="btn small primary" data-act="smemo-save">저장</button></div>
        </div>
      </div>` : ''}
    </div>`;

  const q = (sel) => el.querySelector(sel);
  const panel = q('[data-el="panel"]');
  const drankBtn = q('[data-act="drank"]');

  function paint() {
    const g = totalG();
    const hint = R.cupsHint(g, u);
    q('[data-el="unitlabel"]').textContent = `${R.UNITS[u].label} 기준${hint ? ` (${hint})` : ''}`;
    el.querySelectorAll('[data-unit-in]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unitIn === u)));
    q('[data-val]').textContent = R.fmtNum(R.toDisplay(g, u));
    q('[data-val]').setAttribute('aria-label', `마신 양 ${R.fmtNum(R.toDisplay(g, u))}${R.unitSuffix(u)} (눌러서 숫자 입력)`);
    q('[data-el="grams"]').textContent = R.fmtNum(Math.round(g * 10) / 10);
    const list = [...st.chips];
    if (st.manualG > 0) list.push({ type: 'manual', g: st.manualG });
    q('[data-el="tally"]').textContent = R.drinksText(list, u) || '주종 칩을 누르면 더해져요';
    q('[data-act="undo"]').disabled = !st.history.length;
  }
  function setOpen(open) {
    st.open = open;
    panel.hidden = !open;
    drankBtn.setAttribute('aria-expanded', String(open));
    if (open) paint();
  }
  setOpen(st.open);

  if (opts.onDate) el.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => opts.onDate(R.addDays(date, Number(b.dataset.nav)))));

  q('[data-act="sober"]').addEventListener('click', async () => {
    if (status === 'drank') {
      const ok = await ask({ title: '안 마신 날로 바꿀까요?', message: `이미 적은 양(${R.fmtCount(day.alcoholG, u)})이 지워집니다.`, choices: [{ label: '바꾸기', value: true, kind: 'primary' }, { label: '취소', value: false }] });
      if (!ok) return;
    }
    await repo.saveSober(date);
    toast('기록했어요');
    ctx.refresh();
  });
  drankBtn.addEventListener('click', () => setOpen(!st.open));

  el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    snapshot();
    // 지금 보이는 값(0.5 단위)에서 한 칸(잔 1 / 병 0.5) 움직인다
    setTotal(R.fromDisplay(Math.max(0, R.toDisplay(totalG(), u) + Number(b.dataset.step) * R.unitStep(u)), u));
    paint();
  }));
  q('[data-val]').addEventListener('click', async () => {
    const v = await askNumber({ title: `마신 양 (${R.UNITS[u].label})`, value: R.toDisplay(totalG(), u), step: 0.5, max: 200 });
    if (v == null) return;
    snapshot();
    setTotal(R.fromDisplay(v, u));
    paint();
  });
  el.querySelectorAll('[data-unit-in]').forEach((b) => b.addEventListener('click', () => {
    u = b.dataset.unitIn;
    inputUnit.set(s.unit, u);
    paint();
  }));
  el.querySelectorAll('[data-drink]').forEach((b) => b.addEventListener('click', () => {
    snapshot();
    const c = st.chips.find((x) => x.type === b.dataset.drink);
    if (c) c.count++;
    else st.chips.push({ type: b.dataset.drink, count: 1 });
    paint();
  }));
  q('[data-act="undo"]').addEventListener('click', () => {
    const prev = st.history.pop();
    if (!prev) return;
    st.chips = prev.chips;
    st.manualG = prev.manualG;
    paint();
  });
  el.querySelectorAll('[data-occ]').forEach((b) => b.addEventListener('click', () => {
    occ.v = occ.v === b.dataset.occ ? null : b.dataset.occ;
    el.querySelectorAll('[data-occ]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.occ === occ.v)));
  }));
  q('[data-act="save"]').addEventListener('click', async () => {
    const g = totalG();
    if (!(g > 0)) { q('[data-el="err"]').textContent = '마신 양을 적어 주세요. 안 마셨으면 [안 마셨어요]를 눌러 주세요.'; return; }
    const drinks = st.chips.filter((c) => c.count > 0).map((c) => ({ type: c.type, count: c.count }));
    if (st.manualG > 0) drinks.push({ type: 'manual', g: Math.round(st.manualG * 1000) / 1000 });
    const alt = q('#rc-alt');
    await repo.saveDrank(date, { drinks, homeAt: q('#rc-home').value || null, occasion: occ.v, altNonAlcDone: alt ? alt.checked : null, memo: q('#rc-memo').value.trim() });
    toast('기록했어요');
    ctx.refresh();
  });
  const clearBtn = q('[data-act="clear"]');
  if (clearBtn) clearBtn.addEventListener('click', async () => {
    const ok = await ask({ title: '이 날 기록을 지울까요?', message: '마신 양·귀가·상황이 지워지고 미입력으로 돌아갑니다. 계획·메모와 그날 아침 컨디션·체중은 남아요.', choices: [{ label: '지우기', value: true, kind: 'primary' }, { label: '취소', value: false }] });
    if (!ok) return;
    await repo.clearEntry(date);
    toast('지웠어요');
    ctx.refresh();
  });

  // 안 마신 날의 [메모 추가]
  const so = q('[data-act="smemo-open"]');
  if (so) so.addEventListener('click', () => { q('[data-el="smemo-form"]').hidden = false; so.hidden = true; q('#rc-smemo').focus(); });
  const ss = q('[data-act="smemo-save"]');
  if (ss) ss.addEventListener('click', async () => { await repo.patchDay(date, { memo: q('#rc-smemo').value.trim() }); toast('메모를 저장했어요'); ctx.refresh(); });
}
