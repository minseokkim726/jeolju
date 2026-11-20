// 아침 카드: 그날 아침 컨디션 · 체중. 오늘 화면(항상 오늘)과 달력 [고치기](그날)가 함께 쓴다.
// condition·weightKg는 "D일 아침" 값이다(전날 음주의 결과).
import * as repo from '../repo.js';
import * as R from '../rules.js';
import { esc, fmtMD, fmtMDW } from '../format.js';
import { toast, askNumber } from './shared.js';

// 어제 요약 한 줄(오늘 화면용). 기록이 없으면 null
export function yesterdayLine(day, s) {
  if (!R.isEntered(day)) return null;
  if (!R.isDrinkDay(day)) return '안 마심';
  return `${R.fmtAmount(day.alcoholG, s.unit)}${day.homeAt ? ` · ${day.homeAt} 귀가` : ''}`;
}

// opts: { date, isToday, onRecordYesterday() }
export function mountMorning(el, d, ctx, opts) {
  const s = d.settings;
  const date = opts.date;
  const day = d.days[date] || R.emptyDay(date);
  const word = opts.isToday ? '오늘' : '그날';
  let yHtml = '';
  if (opts.isToday) {
    const y = R.addDays(date, -1);
    const line = yesterdayLine(d.days[y], s);
    yHtml = line
      ? `<div class="y-line">어제(${esc(fmtMDW(y))}): <b>${esc(line)}</b></div>`
      : `<div class="y-line row center"><span>어제 기록이 없어요</span><button type="button" class="btn small outline" data-act="rec-y">어제 기록하기</button></div>`;
  }
  const w = R.weightState(d.days, date);
  const st = { kg: w.kg, saved: w.saved, fromDate: w.fromDate };

  el.innerHTML = `
    <div class="card morning-card">
      <div class="h2">${word} 아침 (${esc(fmtMDW(date))})</div>
      ${yHtml}
      ${s.showCondition ? `<div class="field"><div class="label-strong" id="mc-cond-${date}">${word} 아침 컨디션 <span class="opt">(선택)</span></div>
        <div class="cond" role="group" aria-labelledby="mc-cond-${date}">${[1, 2, 3].map((c) => `<button type="button" class="pill" data-cond="${c}" aria-pressed="${day.condition === c}">${R.CONDITIONS[c]}</button>`).join('')}</div></div>` : ''}
      ${s.showWeight ? `<div class="field"><div class="label-strong">${word} 아침 체중(kg) <span class="opt">(선택)</span></div><div data-el="w"></div></div>` : ''}
    </div>`;

  const q = (sel) => el.querySelector(sel);
  const ry = q('[data-act="rec-y"]');
  if (ry && opts.onRecordYesterday) ry.addEventListener('click', opts.onRecordYesterday);

  // 컨디션: 누르면 바로 저장(같은 것을 다시 누르면 지움)
  el.querySelectorAll('[data-cond]').forEach((b) => b.addEventListener('click', async () => {
    const c = Number(b.dataset.cond);
    const v = day.condition === c ? null : c;
    day.condition = v;
    el.querySelectorAll('[data-cond]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.cond) === v)));
    await repo.patchDay(date, { condition: v });
    if (d.days[date]) d.days[date].condition = v;
    toast(v ? `${word} 아침 컨디션: ${R.CONDITIONS[v]}` : '컨디션을 지웠어요');
  }));

  const box = q('[data-el="w"]');
  if (!box) return;

  async function saveW(v) {
    if (v != null && !(v >= 20 && v <= 300)) { toast('체중은 20~300 사이로 적어 주세요'); return; }
    const kg = v == null ? null : Math.round(v * 10) / 10;
    await repo.patchDay(date, { weightKg: kg, sources: { ...(day.sources || {}), weight: 'manual' } });
    day.weightKg = kg;
    if (kg == null) { const nw = R.weightState({ ...d.days, [date]: { ...day, weightKg: null } }, date); Object.assign(st, nw); }
    else Object.assign(st, { kg, saved: true, fromDate: date });
    toast(kg == null ? '체중을 지웠어요' : '체중을 저장했어요');
    paintW();
  }

  // 최근 값이 있으면 회색 미리보기(저장 안 됨) + −0.1/+0.1. 누르거나 고치거나 [어제와 같음]일 때만 저장한다.
  function paintW() {
    if (st.kg == null) {
      box.innerHTML = `<input class="input w-input" type="number" inputmode="decimal" step="0.1" min="20" max="300" aria-label="${word} 아침 체중(kg)" placeholder="예: 72.4">`;
      const inp = box.querySelector('input');
      inp.addEventListener('change', () => { if (inp.value !== '') saveW(Number(inp.value)); });
      return;
    }
    const yesterday = st.fromDate === R.addDays(date, -1);
    box.innerHTML = `
      <div class="stepper w-stepper">
        <button type="button" class="round" data-w="-0.1" aria-label="체중 0.1 줄이기">−</button>
        <button type="button" class="stepper-val ${st.saved ? '' : 'unsaved'}" data-act="w-key" aria-label="체중 ${st.kg}kg ${st.saved ? '저장됨' : '저장 안 됨'} (눌러서 숫자 입력)">${R.fmtNum(st.kg)}<small>kg</small></button>
        <button type="button" class="round" data-w="0.1" aria-label="체중 0.1 늘리기">+</button>
      </div>
      <div class="w-note">${st.saved
        ? `<span>저장됨</span><button type="button" class="link-btn quiet" data-act="w-clear">지우기</button>`
        : `<span>최근 값 ${esc(fmtMD(st.fromDate))} · 아직 저장 안 됨</span><button type="button" class="btn small" data-act="w-same">${yesterday ? '어제와 같음' : '최근 값과 같음'}</button>`}</div>`;
    box.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => saveW(st.kg + Number(b.dataset.w))));
    box.querySelector('[data-act="w-key"]').addEventListener('click', async () => {
      const v = await askNumber({ title: `${word} 아침 체중(kg)`, value: st.kg, step: 0.1, min: 20, max: 300 });
      if (v != null) saveW(v);
    });
    const same = box.querySelector('[data-act="w-same"]');
    if (same) same.addEventListener('click', () => saveW(st.kg));
    const clr = box.querySelector('[data-act="w-clear"]');
    if (clr) clr.addEventListener('click', () => saveW(null));
  }
  paintW();
}
