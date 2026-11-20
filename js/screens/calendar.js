// 달력: 한 칸에 마신 양과 결과 기호 · 주 합계 칸 · 월 요약 · 그날 상세와 [고치기]
import * as R from '../rules.js';
import { esc, WD, fmtYM, fmtMDW } from '../format.js';
import { dayMark } from './shared.js';
import { mountRecord, resultLine } from './recordCard.js';
import { mountMorning } from './morningCard.js';

// 화면을 다시 그려도 유지할 것
const view = { selected: null, editing: false, legendOpen: false };

// 칸 하나: 안 마심 = 초록 바탕 0, 마신 날 = 마신 양(표시 단위) + 모서리 기호(✓ 계획대로 · 없음 계획 없이 · ▲ 초과 · ■ 과음)
export function cellContent(day, s, unit) {
  const r = R.dayResult(day, s);
  if (r === 'none') return { cls: 'st-none', amount: '', sym: '', label: '미입력' };
  if (r === 'sober') return { cls: 'st-sober', amount: '0', sym: '', label: '안 마심' };
  const sym = { planned: '✓', drank: '', over: '▲', heavy: '■' }[r];
  return { cls: `st-${r}`, amount: R.fmtNum(R.toDisplay(day.alcoholG, unit)), sym, label: `${R.fmtCount(day.alcoholG, unit)} · ${R.RESULT_LABEL[r]}` };
}

export function monthSummary(days, s, ym, today) {
  const from = `${ym}-01`;
  const to = R.monthEndOf(from) < today ? R.monthEndOf(from) : today;
  const out = { sober: 0, drink: 0, heavy: 0, totalG: 0, entered: 0, days: 0 };
  if (from > today) return out;
  for (const d of R.dateRange(from, to)) {
    out.days++;
    const day = days[d];
    if (!R.isEntered(day)) continue;
    out.entered++;
    if (R.isDrinkDay(day)) { out.drink++; out.totalG += day.alcoholG; if (day.alcoholG >= s.heavyG) out.heavy++; } else out.sober++;
  }
  return out;
}

const WSUM_LABEL = { achieved: '달성', missed: '미달성', pending: '판정 보류', nogoal: '목표 없음', future: '' };

export function render(root, d, ctx) {
  const s = d.settings;
  const u = s.unit;
  const ym = ctx.param && /^\d{4}-\d{2}$/.test(ctx.param) ? ctx.param : d.today.slice(0, 7);
  const first = `${ym}-01`;
  const last = R.monthEndOf(first);
  if (!view.selected || view.selected.slice(0, 7) !== ym) { view.selected = d.today.slice(0, 7) === ym ? d.today : null; view.editing = false; }

  // 월요일 시작, 주 단위 줄
  const weeks = [];
  for (let ws = R.weekStartOf(first); ws <= last; ws = R.addDays(ws, 7)) weeks.push(ws);

  const cellHtml = (date) => {
    if (date.slice(0, 7) !== ym) return '<div class="cell out" aria-hidden="true"></div>';
    const day = d.days[date];
    const future = date > d.today;
    const ws = R.weekStartOf(date);
    const goal = R.goalForWeek(d.goals, ws);
    const planned = future && (((d.weekPlans[ws] && d.weekPlans[ws].plannedDays) || []).includes(date) || !!(day && day.plan));
    const viol = goal && (goal.dryWeekdays || []).includes(R.weekdayIdx(date)) && R.isDrinkDay(day);
    const n = Number(date.slice(8));
    let c;
    if (future) c = { cls: 'st-future', amount: planned ? '•' : '', sym: '', label: planned ? '마실 날로 정함' : '' };
    else c = cellContent(day, s, u);
    return `<button type="button" class="cell ${c.cls} ${date === d.today ? 'is-today' : ''} ${date === view.selected ? 'is-sel' : ''}" data-date="${date}"
      aria-label="${esc(`${fmtMDW(date)} ${c.label}${viol ? ' · 금주 요일 위반' : ''}`)}" aria-pressed="${date === view.selected}">
      <span class="n">${n}</span>${c.sym ? `<span class="sym">${c.sym}</span>` : ''}<span class="s ${future ? 'plan-dot' : ''}">${esc(c.amount)}</span>${viol ? '<i class="viol" aria-hidden="true"></i>' : ''}
    </button>`;
  };

  const wsumHtml = (ws) => {
    const ev = R.weekEval(d.days, d.goals, ws, s, d.today);
    if (ev.status === 'future' || !ev.goal) return '<div class="wsum" aria-hidden="true"></div>';
    const mark = R.weekMark(ev);
    const stateTxt = ev.complete ? WSUM_LABEL[ev.status] : ev.status === 'missed' ? '이미 넘음(진행 중)' : '진행 중';
    return `<div class="wsum ${ev.complete ? '' : 'live'}" aria-label="${esc(`이 주 음주일 ${ev.drinkDays} / 목표 ${ev.goal.weeklyDrinkDaysMax} · ${stateTxt}`)}">
      <span>${ev.drinkDays}/${ev.goal.weeklyDrinkDaysMax}</span><span class="m">${mark}</span></div>`;
  };

  const ms = monthSummary(d.days, s, ym, d.today);
  const prevYm = R.addMonths(ym, -1);
  const pm = monthSummary(d.days, s, prevYm, d.today);
  const hasPrev = pm.entered > 0 && ms.entered > 0;
  const diffG = ms.totalG - pm.totalG;
  const diffTxt = hasPrev ? (Math.abs(diffG) < R.unitG(u) / 4 ? '지난달과 같음' : `지난달보다 ${R.fmtCount(Math.abs(diffG), u)} ${diffG < 0 ? '적음' : '많음'}`) : '';

  root.innerHTML = `
    <div class="page">
      <div class="cal-nav">
        <a class="icon-btn" href="#/cal/${prevYm}" aria-label="이전 달">◀</a>
        <div class="h2">${esc(fmtYM(ym))}</div>
        <a class="icon-btn" href="#/cal/${R.addMonths(ym, 1)}" aria-label="다음 달">▶</a>
      </div>
      <div class="card cal-card">
        <div class="cal-grid">
          ${WD.map((w) => `<div class="hd">${w}</div>`).join('')}<div class="hd">주</div>
          ${weeks.map((ws) => R.weekDates(ws).map(cellHtml).join('') + wsumHtml(ws)).join('')}
        </div>
        <details class="legend-wrap" ${view.legendOpen ? 'open' : ''}>
          <summary class="link-btn" style="display:flex;align-items:center">범례</summary>
          <div class="legend">
            <span><i class="st-sober">0</i>안 마심</span><span><i class="st-planned">✓</i>계획대로</span><span><i class="st-drank">4</i>계획 없이 마심</span>
            <span><i class="st-over">▲</i>초과</span><span><i class="st-heavy">■</i>과음</span><span><i class="st-none"></i>미입력</span>
            <span><i class="st-future" style="color:var(--primary)">•</i>마실 날</span><span><i class="st-none" style="position:relative"><b class="viol"></b></i>금주 요일 위반</span>
            <span>숫자 = 마신 양(${esc(R.UNITS[u].label)})</span>
          </div>
          <div class="legend"><span>주 칸: 음주일/목표 · 끝난 주 ○ 달성 · △ 미달성 · – 판정 보류(미입력 3일 이상) · 진행 중인 주 … (이미 넘었으면 △)</span></div>
        </details>
      </div>
      <div class="card">
        <div class="h2">${Number(ym.slice(5))}월 요약</div>
        <div class="small" style="color:var(--text);font-size:16px">안 마신 날 ${ms.sober}일 · 음주일 ${ms.drink}일 · 과음 ${ms.heavy}회 · 총량 ${esc(R.fmtAmount(ms.totalG, u))}</div>
        <div class="small">입력 ${ms.entered}/${ms.days}일${diffTxt ? ` · ${esc(diffTxt)}` : ''}</div>
      </div>
      <div data-el="detail"></div>
      <div class="page-bottom-space"></div>
    </div>`;

  root.querySelector('.legend-wrap').addEventListener('toggle', (e) => { view.legendOpen = e.target.open; });
  root.querySelectorAll('[data-date]').forEach((b) => b.addEventListener('click', () => {
    view.editing = view.selected === b.dataset.date ? view.editing : false;
    view.selected = b.dataset.date;
    ctx.refresh();
  }));
  // 화면 아래로 상세를 붙인다
  const det = root.querySelector('[data-el="detail"]');
  if (view.selected) renderDetail(det, d, ctx, view.selected);
}

function renderDetail(el, d, ctx, date) {
  const s = d.settings;
  const u = s.unit;
  const day = d.days[date];
  if (view.editing && date <= d.today) {
    el.innerHTML = '<div data-el="morning"></div><div data-el="rec"></div><button type="button" class="btn link" data-act="close" style="width:100%">닫기</button>';
    mountMorning(el.querySelector('[data-el="morning"]'), d, ctx, { date, isToday: date === d.today });
    mountRecord(el.querySelector('[data-el="rec"]'), d, { ...ctx, refresh: () => { view.editing = false; ctx.refresh(); } }, { date, onDate: null, openDrank: day && day.status === 'drank' });
    el.querySelector('[data-act="close"]').addEventListener('click', () => { view.editing = false; ctx.refresh(); });
    return;
  }
  const future = date > d.today;
  const m = dayMark(day, s);
  const rows = [];
  const add = (k, v) => { if (v != null && v !== '') rows.push(`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`); };
  if (!future) add('결과', `${m.sym ? `${m.sym} ` : ''}${m.label}`);
  if (R.isDrinkDay(day)) {
    add('양', `${R.fmtAmount(day.alcoholG, u)} (${R.fmtNum(Math.round(day.alcoholG * 10) / 10)}g · 약 ${R.kcalOf(day.alcoholG)}kcal)`);
    add('주종', R.drinksText(day.drinks, u));
  }
  if (day && day.plan) {
    const p = day.plan;
    add('계획', `상한 ${R.fmtCount(p.limitG, u)}${p.homeBy ? ` · ${p.homeBy} 귀가` : ''}${p.altNonAlc ? ' · 무알콜 교대' : ''}${p.note ? ` · ${p.note}` : ''}`);
    if (R.isEntered(day)) add('계획과 결과', resultLine(day, s));
    if (p.altNonAlc && day.altNonAlcDone != null) add('무알콜 교대', day.altNonAlcDone ? '했음' : '못 함');
  }
  if (day && day.homeAt) add('귀가', day.homeAt);
  if (day && day.occasion) add('상황', day.occasion);
  if (day && day.condition) add('아침 컨디션', `그날 아침 ${R.CONDITIONS[day.condition]}`);
  if (day && day.weightKg != null) add('아침 체중', `${day.weightKg}kg`);
  if (day && day.memo) add('메모', day.memo);
  el.innerHTML = `<div class="card detail">
    <div class="row center"><div class="h2">${esc(fmtMDW(date))}</div></div>
    ${rows.length ? `<dl>${rows.join('')}</dl>` : `<div class="small">${future ? '아직 오지 않은 날이에요.' : '기록이 없어요.'}</div>`}
    <div class="btn-row">
      ${future ? `<a class="btn outline" href="#/plan/${date}" style="grid-column:span 2">${day && day.plan ? '상한 고치기' : '상한 정하기'}</a>`
        : `<button type="button" class="btn outline" data-act="edit" style="${date === d.today ? '' : 'grid-column:span 2'}">${R.isEntered(day) ? '고치기' : '기록하기'}</button>
           ${date === d.today ? `<a class="btn" href="#/plan/${date}">상한 정하기</a>` : ''}`}
    </div>
  </div>`;
  const e = el.querySelector('[data-act="edit"]');
  if (e) e.addEventListener('click', () => { view.editing = true; ctx.refresh(); });
}
