// 설정: 표시 단위 · 과음 기준 · 칸 보이기 · 평소 음주량(기준선) · 백업 · 환산표
import * as repo from '../repo.js';
import * as R from '../rules.js';
import { esc } from '../format.js';
import { toast, exportBackup, importBackup, exportCsvFile, askNumber, stepperHtml } from './shared.js';
import { APP_VERSION } from '../version.js';

export function render(root, d, ctx) {
  const s = d.settings;
  const b = s.baseline || { drinkDaysPerWeek: 4.5, gPerOccasion: R.fromDisplay(7, 'soju'), heavyPerWeek: 2 };
  const st = {
    unit: s.unit, heavyG: s.heavyG,
    showWeight: s.showWeight, showCondition: s.showCondition, showOccasion: s.showOccasion,
    days: b.drinkDaysPerWeek, perG: b.gPerOccasion, heavyPW: b.heavyPerWeek,
    bTouched: !!s.baseline, // 기준선을 적은 적이 없으면 손댔을 때만 저장
  };
  const last = R.localDateOfIso(s.lastBackupAt);

  root.innerHTML = `
    <form class="page form" novalidate>
      <div class="row"><a class="back" href="#/today">← 오늘</a></div>
      <div class="h1">설정</div>
      <div class="card" style="gap:12px">
        <div class="h2">표시 단위</div>
        <div class="modes2" role="group" aria-label="표시 단위">
          ${Object.entries(R.UNITS).map(([k, v]) => `<button type="button" class="pill" data-unit="${k}">${esc(v.label)}<small>${R.fmtNum(v.g)}g</small></button>`).join('')}
        </div>
        <div class="small">단위를 바꿔도 기록과 목표 값은 그대로예요(보이는 숫자만 바뀜). 소주 병은 0.5병 단위로 보이고 옆에 잔 수를 함께 적어요.</div>
      </div>
      <div class="card" style="gap:12px">
        <div class="h2">과음 기준</div>
        ${stepperHtml('heavy', '과음 기준', '')}
        <div class="small">이 양 이상이면 과음으로 셉니다. 기본 소주 7잔(45.5g). 과음 기준은 g으로 저장돼요.</div>
      </div>
      <div class="card" style="gap:6px">
        <div class="h2">기록 칸 보이기</div>
        <label class="check"><input type="checkbox" data-show="showCondition"> 아침 컨디션</label>
        <label class="check"><input type="checkbox" data-show="showWeight"> 체중</label>
        <label class="check"><input type="checkbox" data-show="showOccasion"> 상황(회식·모임 등)</label>
      </div>
      <div class="card" style="gap:12px">
        <div class="h2">평소 음주량 (기준선)</div>
        <div class="small">${s.baseline ? '"시작 후 줄인 양"을 계산하는 기준이에요.' : '아직 적지 않았어요. 적으면 "시작 후 줄인 양"이 보여요.'}</div>
        <div class="label-strong">일주일에 며칠</div>${stepperHtml('bdays', '일주일에 며칠', '')}
        <div class="label-strong">한 번에 보통</div>${stepperHtml('bper', '한 번에 보통', '')}
        <div class="label-strong">그중 과음은 주 몇 번</div>${stepperHtml('bheavy', '과음 주 몇 번', '')}
      </div>
      <div class="error" data-el="err" role="alert"></div>
      <button type="button" class="btn primary big" data-act="save">설정 저장</button>
      <div class="card" style="gap:10px">
        <div class="h2">데이터 백업</div>
        <div class="small" ${R.backupDue(s, d.today) ? 'style="color:var(--warn)"' : ''}>마지막 백업: ${last ? `${esc(last)} (${R.daysBetween(last, d.today)}일 전)` : '아직 없음'} · 7일마다 알려줘요</div>
        <div class="btn-row">
          <button type="button" class="btn outline" data-act="export">내보내기(JSON)</button>
          <button type="button" class="btn" data-act="import">가져오기</button>
        </div>
        <button type="button" class="btn" data-act="csv">CSV 내보내기(엑셀용)</button>
        <div class="small">기록은 이 기기 안에만 저장됩니다. 앱을 지우거나 기기를 바꾸면 백업 파일로만 되살릴 수 있어요.</div>
      </div>
      <details class="card fold">
        <summary class="h2">환산표 (대략치)</summary>
        <table class="stat-table">
          <thead><tr><th>주종</th><th>순수 알코올</th><th>소주잔</th></tr></thead>
          <tbody>${R.DRINKS.map((x) => `<tr><td>${esc(x.label)}${x.detail ? ` <span class="tiny">(${esc(x.detail)})</span>` : ''}</td><td class="num">${R.fmtNum(x.g)}g</td><td class="num">${R.fmtNum(R.toDisplay(x.g, 'soju'))}</td></tr>`).join('')}</tbody>
        </table>
        <div class="small">소주 1병(360ml, 16.5%) = 47g(소주 약 7잔), 표준잔 = 10g, 맥주 캔(355ml) = 14g. 알코올 칼로리 = g × 7kcal(알코올분만).</div>
      </details>
      <div class="app-version">앱 버전 ${esc(APP_VERSION)}${d.demo ? ' · 예시 데이터' : ''}</div>
    </form>`;

  const q = (sel) => root.querySelector(sel);
  const su = () => R.unitSuffix(st.unit);
  function paint() {
    root.querySelectorAll('[data-unit]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.unit === st.unit)));
    q('[data-stepper="heavy"] [data-val]').textContent = `${R.fmtNum(R.toDisplay(st.heavyG, st.unit))}${su()} (${R.fmtNum(st.heavyG)}g)`;
    q('[data-stepper="bdays"] [data-val]').textContent = `${R.fmtNum(st.days)}일`;
    q('[data-stepper="bper"] [data-val]').textContent = R.fmtAmount(st.perG, st.unit);
    q('[data-stepper="bheavy"] [data-val]').textContent = `${st.heavyPW}번`;
    root.querySelectorAll('[data-show]').forEach((x) => { x.checked = !!st[x.dataset.show]; });
  }
  paint();
  root.querySelectorAll('[data-unit]').forEach((x) => x.addEventListener('click', () => { st.unit = x.dataset.unit; paint(); }));
  root.querySelectorAll('[data-show]').forEach((x) => x.addEventListener('change', () => { st[x.dataset.show] = x.checked; }));
  const step = (id, fn) => root.querySelectorAll(`[data-stepper="${id}"] [data-step]`).forEach((x) => x.addEventListener('click', () => { if (id[0] === 'b') st.bTouched = true; fn(Number(x.dataset.step)); paint(); }));
  const disp = (g) => R.toDisplay(g, st.unit);
  step('heavy', (k) => { st.heavyG = R.fromDisplay(Math.max(R.unitStep(st.unit), disp(st.heavyG) + k * R.unitStep(st.unit)), st.unit); });
  step('bdays', (k) => { st.days = Math.min(7, Math.max(0, st.days + k * 0.5)); });
  step('bper', (k) => { st.perG = R.fromDisplay(Math.max(0, disp(st.perG) + k * R.unitStep(st.unit)), st.unit); });
  step('bheavy', (k) => { st.heavyPW = Math.min(7, Math.max(0, st.heavyPW + k)); });
  const key = (id, title, get, set, opt) => q(`[data-stepper="${id}"] [data-val]`).addEventListener('click', async () => {
    const v = await askNumber({ title, value: get(), ...opt });
    if (v != null) { if (id[0] === 'b') st.bTouched = true; set(v); paint(); }
  });
  key('heavy', '과음 기준', () => disp(st.heavyG), (v) => { st.heavyG = R.fromDisplay(R.roundHalf(Math.max(0.5, v)), st.unit); }, { min: 0.5, max: 50 });
  key('bdays', '일주일에 며칠', () => st.days, (v) => { st.days = R.roundHalf(v); }, { max: 7 });
  key('bper', '한 번에 보통', () => disp(st.perG), (v) => { st.perG = R.fromDisplay(R.roundHalf(v), st.unit); }, { max: 50 });
  key('bheavy', '과음 주 몇 번', () => st.heavyPW, (v) => { st.heavyPW = Math.round(v); }, { step: 1, max: 7 });

  q('[data-act="save"]').addEventListener('click', async () => {
    try {
      await repo.saveSettings({
        unit: st.unit, heavyG: st.heavyG, showWeight: st.showWeight, showCondition: st.showCondition, showOccasion: st.showOccasion,
        baseline: st.bTouched ? { drinkDaysPerWeek: st.days, gPerOccasion: st.perG, heavyPerWeek: st.heavyPW } : s.baseline,
      });
      toast('설정을 저장했어요');
      ctx.go('today');
    } catch (e) { q('[data-el="err"]').textContent = `저장하지 못했어요: ${e.message || e}`; }
  });
  q('[data-act="export"]').addEventListener('click', async () => { if (await exportBackup(d.today)) ctx.refresh(); });
  q('[data-act="import"]').addEventListener('click', async () => { if (await importBackup()) ctx.go('today'); });
  q('[data-act="csv"]').addEventListener('click', () => exportCsvFile(d.today));
}
