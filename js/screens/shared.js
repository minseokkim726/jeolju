// 여러 화면이 함께 쓰는 도우미: 대화 상자, 알림, 백업, 주간 띠
import * as repo from '../repo.js';
import * as R from '../rules.js';
import { esc, compactDate, WD, fmtMD } from '../format.js';

export const $ = (sel, root = document) => root.querySelector(sel);

let toastTimer = null;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// 선택 대화 상자. choices: [{ label, value, kind }] → 고른 value(닫으면 null)
export function ask({ title, message = '', choices }) {
  const dlg = $('#dialog');
  dlg.innerHTML = `
    <p class="title">${esc(title)}</p>
    ${message ? `<p class="msg">${esc(message)}</p>` : ''}
    <div class="choices">
      ${choices.map((c, i) => `<button type="button" class="btn ${c.kind || ''}" data-i="${i}">${esc(c.label)}</button>`).join('')}
    </div>`;
  return new Promise((resolve) => {
    let result = null;
    dlg.querySelectorAll('[data-i]').forEach((b) =>
      b.addEventListener('click', () => { result = choices[+b.dataset.i].value; dlg.close(); }));
    dlg.addEventListener('close', () => resolve(result), { once: true });
    dlg.showModal();
  });
}
export const alertMsg = (title, message) => ask({ title, message, choices: [{ label: '확인', value: true, kind: 'primary' }] });

// 숫자 키패드로 값 받기(표시 단위). 취소면 null
export function askNumber({ title, value, step = 0.5, min = 0, max = 99 }) {
  const dlg = $('#dialog');
  dlg.innerHTML = `
    <p class="title">${esc(title)}</p>
    <form method="dialog" class="choices">
      <input class="input big-input" type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${esc(value)}" aria-label="${esc(title)}">
      <button type="submit" class="btn primary" value="ok">확인</button>
      <button type="button" class="btn" data-x>취소</button>
    </form>`;
  const input = dlg.querySelector('input');
  return new Promise((resolve) => {
    let result = null;
    dlg.querySelector('form').addEventListener('submit', () => {
      const v = Number(input.value);
      if (input.value !== '' && Number.isFinite(v)) result = Math.min(max, Math.max(min, v));
    });
    dlg.querySelector('[data-x]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => resolve(result), { once: true });
    dlg.showModal();
    input.select();
  });
}

// 파일 저장: 공유가 되면 공유 시트, 아니면 다운로드
async function saveFile(file) {
  if (navigator.canShare && navigator.share) {
    let can = false;
    try { can = navigator.canShare({ files: [file] }); } catch { can = false; }
    if (can) {
      try { await navigator.share({ files: [file], title: file.name }); return true; } catch (err) {
        if (err && err.name === 'AbortError') { toast('내보내기를 취소했어요'); return false; }
      }
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

export async function exportBackup(today) {
  const data = await repo.exportData();
  const file = new File([JSON.stringify(data, null, 2)], `jeolju-backup-${compactDate(today)}.json`, { type: 'application/json' });
  if (!(await saveFile(file))) return false;
  await repo.markBackedUp();
  toast('내보냈어요');
  return true;
}

export async function exportCsvFile(today) {
  const text = await repo.exportCsv();
  const file = new File([text], `jeolju-${compactDate(today)}.csv`, { type: 'text/csv' });
  if (await saveFile(file)) toast('CSV를 내보냈어요');
}

// 가져오기: 파일 고르기 → 형식 확인 → "현재 데이터를 덮어씁니다" 확인 → 교체. 바꿨으면 true.
export function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.className = 'visually-hidden';
  document.body.appendChild(input);
  return new Promise((resolve) => {
    const done = (v) => { input.remove(); resolve(v); };
    input.addEventListener('cancel', () => done(false));
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) { done(false); return; }
      let obj;
      try { obj = JSON.parse(await f.text()); } catch {
        await alertMsg('가져오지 못했어요', '백업 파일(JSON)이 아닙니다. 아무것도 바꾸지 않았어요.');
        done(false); return;
      }
      const v = R.validateBackup(obj);
      if (!v.ok) { await alertMsg('가져오지 못했어요', `${v.error}\n아무것도 바꾸지 않았어요.`); done(false); return; }
      const when = R.localDateOfIso(obj.exportedAt);
      const entered = obj.data.days.filter(R.isEntered).length;
      const yes = await ask({
        title: '현재 데이터를 덮어씁니다',
        message: `백업 파일(${when || '날짜 모름'} · 기록 ${entered}일 · 목표 ${obj.data.goals.length}줄)로 지금 데이터를 모두 바꿉니다.`,
        choices: [{ label: '덮어쓰기', value: true, kind: 'primary' }, { label: '취소', value: false }],
      });
      if (!yes) { done(false); return; }
      const res = await repo.importData(obj);
      if (!res.ok) { await alertMsg('가져오지 못했어요', res.error); done(false); return; }
      toast('가져왔어요');
      done(true);
    });
    input.click();
  });
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* 아래 방법으로 */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

// 하루 칸(달력·주간 띠 공통): 상태별 클래스와 기호
export function dayMark(day, s) {
  const r = R.dayResult(day, s);
  return { cls: `st-${r}`, sym: R.RESULT_SYMBOL[r], label: R.RESULT_LABEL[r], result: r };
}

// 이번 주 띠(월~일 7칸). planned: 마실 날로 찍어 둔 날짜 배열
export function weekStripHtml(d, ws, planned = [], selected = null) {
  const s = d.settings;
  const goal = R.goalForWeek(d.goals, ws);
  return `<div class="strip" role="list">${R.weekDates(ws).map((date, i) => {
    const future = date > d.today;
    const m = dayMark(d.days[date], s);
    const dry = goal && (goal.dryWeekdays || []).includes(i);
    const viol = dry && R.isDrinkDay(d.days[date]);
    const cls = [future ? 'st-future' : m.cls, date === d.today ? 'is-today' : '', planned.includes(date) ? 'is-planned' : '', date === selected ? 'is-sel' : ''].join(' ');
    const label = `${fmtMD(date)} ${WD[i]} ${future ? '' : m.label}${planned.includes(date) ? ' · 마실 날' : ''}${viol ? ' · 금주 요일 위반' : ''}`;
    return `<div class="strip-day" role="listitem" aria-label="${esc(label)}">
      <span class="wd">${WD[i]}</span>
      <span class="dot ${cls}">${future ? '' : esc(m.sym)}${viol ? '<i class="viol" aria-hidden="true"></i>' : ''}</span>
      <span class="dd">${Number(date.slice(8))}</span>
    </div>`;
  }).join('')}</div>`;
}

// −/+ 스테퍼 HTML. data-step 버튼과 가운데 값 버튼(누르면 키패드)
export function stepperHtml(id, label, valueText, { big = false } = {}) {
  return `<div class="stepper ${big ? 'big' : ''}" data-stepper="${id}">
    <button type="button" class="round" data-step="-1" aria-label="${esc(label)} 줄이기">−</button>
    <button type="button" class="stepper-val" data-val aria-label="${esc(label)}: ${esc(valueText)} (눌러서 숫자 입력)">${esc(valueText)}</button>
    <button type="button" class="round" data-step="1" aria-label="${esc(label)} 늘리기">+</button>
  </div>`;
}

// [잔 | 병] 입력 단위 전환. 이번 실행 동안만 기억하고, 설정의 표시 단위가 바뀌면 그것으로 돌아간다.
const unitMem = { base: null, cur: null };
export const inputUnit = {
  get(base) { return unitMem.base === base && unitMem.cur ? unitMem.cur : base; },
  set(base, cur) { unitMem.base = base; unitMem.cur = cur; },
};
export function unitToggleHtml(base, cur) {
  const cup = R.cupUnitOf(base);
  return `<div class="seg unit-seg" role="group" aria-label="입력 단위">
    <button type="button" data-unit-in="${cup}" aria-pressed="${cur === cup}">${esc(R.UNITS[cup].short)}</button>
    <button type="button" data-unit-in="soju_bottle" aria-pressed="${cur === 'soju_bottle'}">병</button>
  </div>`;
}
