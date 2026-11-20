// 첫 실행 3단계: 1 평소(기준선) → 2 목표(프리셋) → 3 장기 목표. 각 단계 건너뛰기 가능.
import * as repo from '../repo.js';
import * as R from '../rules.js';
import { esc, fmtMDWp } from '../format.js';
import { askNumber, stepperHtml } from './shared.js';

const st = { days: 4.5, perG: 45.5, heavy: 2, preset: 'gradual' };

// 프리셋 목표 줄. 공통: 과음 주 0회, 술자리 상한 소주 4잔
export function presetGoals(preset, ws) {
  const common = { heavyMaxPerWeek: 0, defaultLimitG: 26, weeklyTotalG: null, dryWeekdays: [] };
  if (preset === 'gradual') {
    return [
      { ...common, weeklyDrinkDaysMax: 3, effectiveFrom: ws, note: '단계적으로: 첫 2주' },
      { ...common, weeklyDrinkDaysMax: 2, effectiveFrom: R.addDays(ws, 14), note: '단계적으로: 그다음부터' },
    ];
  }
  return [{ ...common, weeklyDrinkDaysMax: 2, effectiveFrom: ws, note: '바로' }];
}

const dots = (n) => `<div class="steps-dots" aria-label="${n}/3단계">${[1, 2, 3].map((i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div>`;

export function render(root, d, ctx) {
  const s = d.settings;
  const u = s.unit;
  const n = ['1', '2', '3'].includes(ctx.param) ? Number(ctx.param) : 1;
  const ws = R.weekStartOf(d.today);
  if (n === 1 && s.baseline) { st.days = s.baseline.drinkDaysPerWeek; st.perG = s.baseline.gPerOccasion; st.heavy = s.baseline.heavyPerWeek; }

  let body = '';
  if (n === 1) {
    body = `<div class="h1">요즘 어떻게 마시나요?</div>
      <div class="small">시작 후 얼마나 줄었는지 비교하는 기준이 돼요. 대충이어도 괜찮아요.</div>
      <div class="card" style="gap:12px">
        <div class="label-strong">요즘 일주일에 며칠 마시나요?</div>${stepperHtml('days', '일주일에 며칠', '')}
        <div class="label-strong">한 번에 보통 얼마나?</div>${stepperHtml('per', '한 번에 보통', '')}
        <div class="label-strong">그중 과음은 주 몇 번?</div>${stepperHtml('heavy', '과음 주 몇 번', '')}
      </div>`;
  } else if (n === 2) {
    const p2 = R.addDays(ws, 14);
    body = `<div class="h1">목표를 골라 주세요</div>
      <div class="small">나중에 목표 탭에서 언제든 고칠 수 있어요. 공통: 과음 주 0회, 술자리 상한 소주 4잔.</div>
      <div class="pills" style="flex-direction:column" role="group" aria-label="목표 프리셋">
        <button type="button" class="preset" data-preset="gradual"><span class="t">단계적으로<span class="badge">권장</span></span><span class="d">첫 2주 주 3회 이하 → ${esc(fmtMDWp(p2))}부터 주 2회 이하</span></button>
        <button type="button" class="preset" data-preset="now"><span class="t">바로</span><span class="d">이번 주(${esc(fmtMDWp(ws))})부터 주 2회 이하</span></button>
        <button type="button" class="preset" data-preset="custom"><span class="t">직접 정하기</span><span class="d">음주일·과음·총량·금주 요일을 직접</span></button>
      </div>`;
  } else {
    body = `<div class="h1">기간과 장기 목표</div>
      <div class="small">목표 탭 맨 위에 보여요. 시작일 말고는 비워 둬도 돼요.</div>
      <div class="card" style="gap:12px">
        <div class="field"><label for="wl-start">시작일</label>
          <input id="wl-start" class="input" type="date" value="${esc(s.startDate || d.today)}"></div>
        <div class="field"><label for="wl-target">목표일 <span class="opt">(선택, 예: 연말)</span></label>
          <input id="wl-target" class="input" type="date" value="${esc(s.targetDate || '')}"></div>
        <div class="field"><label class="label-strong" for="wl-note">장기 목표 <span class="opt">(선택)</span></label>
          <input id="wl-note" class="input" type="text" maxlength="60" placeholder="예: 45세 이후 비음주" value="${esc(s.longTermNote || '')}"></div>
        <div class="error" data-el="err" role="alert"></div>
      </div>`;
  }

  root.innerHTML = `
    <div class="page form">
      ${dots(n)}
      ${body}
    </div>
    <div class="actions form-actions">
      <button type="button" class="btn primary big" data-act="next">${n === 3 ? '시작하기' : '다음'}</button>
      <button type="button" class="btn link" data-act="skip">건너뛰기</button>
    </div>`;

  const q = (sel) => root.querySelector(sel);
  const finish = async (note) => {
    await repo.saveSettings({ onboarded: true, ...(note != null ? { longTermNote: note } : {}) });
    ctx.go('today');
  };

  if (n === 1) {
    const paint = () => {
      q('[data-stepper="days"] [data-val]').textContent = `${R.fmtNum(st.days)}일`;
      q('[data-stepper="per"] [data-val]').textContent = R.fmtAmount(st.perG, u);
      q('[data-stepper="heavy"] [data-val]').textContent = `${st.heavy}번`;
    };
    paint();
    const step = (id, fn) => root.querySelectorAll(`[data-stepper="${id}"] [data-step]`).forEach((x) => x.addEventListener('click', () => { fn(Number(x.dataset.step)); paint(); }));
    step('days', (k) => { st.days = Math.min(7, Math.max(0, st.days + k * 0.5)); });
    step('per', (k) => { st.perG = R.fromDisplay(Math.max(0, R.toDisplay(st.perG, u) + k * R.unitStep(u)), u); });
    step('heavy', (k) => { st.heavy = Math.min(7, Math.max(0, st.heavy + k)); });
    q('[data-stepper="per"] [data-val]').addEventListener('click', async () => {
      const v = await askNumber({ title: `한 번에 보통 (${R.UNITS[u].label})`, value: R.toDisplay(st.perG, u), max: 50 });
      if (v != null) { st.perG = R.fromDisplay(R.roundHalf(v), u); paint(); }
    });
    q('[data-stepper="days"] [data-val]').addEventListener('click', async () => {
      const v = await askNumber({ title: '일주일에 며칠', value: st.days, max: 7 });
      if (v != null) { st.days = R.roundHalf(v); paint(); }
    });
    q('[data-stepper="heavy"] [data-val]').addEventListener('click', async () => {
      const v = await askNumber({ title: '과음 주 몇 번', value: st.heavy, step: 1, max: 7 });
      if (v != null) { st.heavy = Math.round(v); paint(); }
    });
    q('[data-act="next"]').addEventListener('click', async () => {
      await repo.saveSettings({ baseline: { drinkDaysPerWeek: st.days, gPerOccasion: st.perG, heavyPerWeek: st.heavy } });
      ctx.go('welcome/2');
    });
    q('[data-act="skip"]').addEventListener('click', () => ctx.go('welcome/2'));
  } else if (n === 2) {
    const paint = () => root.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === st.preset)));
    paint();
    root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { st.preset = b.dataset.preset; paint(); }));
    q('[data-act="next"]').addEventListener('click', async () => {
      if (st.preset === 'custom') { ctx.go('goal/welcome'); return; }
      await repo.replaceGoals(presetGoals(st.preset, ws));
      ctx.go('welcome/3');
    });
    q('[data-act="skip"]').addEventListener('click', () => ctx.go('welcome/3')); // 기본 목표(주 2회) 그대로
  } else {
    q('[data-act="next"]').addEventListener('click', async () => {
      const start = q('#wl-start').value;
      const target = q('#wl-target').value || null;
      if (!R.isDateStr(start)) { q('[data-el="err"]').textContent = '시작일을 골라 주세요.'; return; }
      if (target && target <= start) { q('[data-el="err"]').textContent = '목표일은 시작일보다 뒤여야 해요.'; return; }
      await repo.saveSettings({ startDate: start, targetDate: target });
      finish(q('#wl-note').value.trim());
    });
    q('[data-act="skip"]').addEventListener('click', () => finish(null));
  }
}
