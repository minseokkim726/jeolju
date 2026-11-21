// 오늘(홈): 이번 주 띠 · 주간 계획 카드 · 오늘 아침 카드 · 오늘 술자리 카드 · 음주 기록 카드 · 작은 타일 · 백업 알림
import * as repo from '../repo.js';
import * as R from '../rules.js';
import { esc, WD, fmtWeek, fmtMD } from '../format.js';
import { weekStripHtml, exportBackup, toast } from './shared.js';
import { mountRecord } from './recordCard.js';
import { mountMorning } from './morningCard.js';

// 기록 카드에서 고른 날짜(같은 날 안에서만 유지)
const view = { date: null, forToday: null };
// 주간 계획 카드에서 찍는 중인 날짜
const wp = { weekStart: null, days: [] };

export function weekLine(d, ev) {
  const s = d.settings;
  if (!ev.goal) return '';
  const rem = R.weekRemaining(ev);
  let t = `음주일 ${ev.drinkDays}/${ev.goal.weeklyDrinkDaysMax} · 남은 여유 ${rem.days}일`;
  if (ev.goal.weeklyTotalG != null) t += ` · 총량 ${totalPair(ev.totalG, ev.goal.weeklyTotalG, s.unit)}`;
  if (ev.heavy) t += ` · 과음 ${ev.heavy}`;
  return t;
}

// "소주 4/14잔"
export function totalPair(cur, max, unit) {
  const U = R.UNITS[unit] || R.UNITS.soju;
  return `${U.pre}${R.fmtNum(R.toDisplay(cur, unit))}/${R.fmtNum(R.toDisplay(max, unit))}${U.suf}`;
}

// 머리말 둘째 줄: "시작 11/21 · 12일째 · 연말(12/31)까지 29일"
export function projectLine(s, today) {
  const p = R.projectDays(s, today);
  if (!p) return '';
  if (!p.started) return `${fmtMD(s.startDate)} 시작 · ${-p.dayNo + 1}일 남음`;
  let t = `시작 ${fmtMD(s.startDate)} · ${p.dayNo}일째`;
  if (p.toTarget != null) {
    const name = s.targetDate.slice(5) === '12-31' ? '연말' : '목표일';
    t += p.toTarget >= 0 ? ` · ${name}(${fmtMD(s.targetDate)})까지 ${p.toTarget}일` : ` · ${name}(${fmtMD(s.targetDate)}) 지남`;
  }
  return t;
}

export function goalText(g) {
  if (!g) return '목표 없음';
  return `주 ${g.weeklyDrinkDaysMax}회 이하`;
}

function planCardHtml(d) {
  const ws = R.weekPlanPrompt(d.weekPlans, d.today, d.now.getHours(), R.wsoOf(d.settings));
  if (!ws) return '';
  const goal = R.goalForWeek(d.goals, ws);
  // 한 주 시작을 바꿔 옮겨 온 마실 날이 있으면 미리 찍혀 있게(v1.4)
  if (wp.weekStart !== ws) { wp.weekStart = ws; wp.days = [...((d.weekPlans[ws] && d.weekPlans[ws].plannedDays) || [])]; }
  const isNext = ws > d.today;
  const max = goal ? goal.weeklyDrinkDaysMax : null;
  const over = max != null && wp.days.length > max ? wp.days.length - max : 0;
  return `<div class="card plan-week" data-el="weekplan">
    <div class="h2">${isNext ? `다음 주(${fmtWeek(ws)})` : '이번 주'} 목표 ${esc(goalText(goal))}. 마실 날이 정해져 있나요?</div>
    <div class="wd-chips" role="group" aria-label="마실 날 고르기">
      ${R.weekDates(ws).map((date) => `<button type="button" class="wd-chip" data-wpday="${date}" aria-pressed="${wp.days.includes(date)}" ${date < d.today ? 'disabled' : ''}>${WD[R.weekdayIdx(date)]}<small>${Number(date.slice(8))}</small></button>`).join('')}
    </div>
    <div class="small tone-warn" data-el="wpover">${over ? `목표보다 ${over}일 많아요` : ''}</div>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="wp-save">정했어요</button>
      <button type="button" class="btn" data-act="wp-skip">${isNext ? '다음 주는' : '이번 주는'} 건너뛰기</button>
    </div>
  </div>`;
}

export function render(root, d, ctx) {
  const s = d.settings;
  const u = s.unit;
  const ws = R.weekStartOf(d.today, R.wsoOf(s));
  const ev = R.weekEval(d.days, d.goals, ws, s, d.today);
  const goal = ev.goal;
  const planned = (d.weekPlans[ws] && d.weekPlans[ws].plannedDays) || [];
  if (view.forToday !== d.today || !view.date) { view.date = R.defaultEntryDate(d.now, d.days, s); view.forToday = d.today; }
  const todayDay = d.days[d.today];
  const plan = todayDay && todayDay.plan;
  const dryToday = goal && (goal.dryWeekdays || []).includes(R.weekdayIdx(d.today));
  const streak = R.soberStreak(d.days, s, d.today);
  const best = R.bestSoberStreak(d.days, s);
  const gs = R.goalStreak(d.days, d.goals, s, d.today);
  const saved = R.savedVsBaseline(d.days, s, d.today);

  let savedTile;
  if (!saved) savedTile = `<div class="tile"><div class="k">시작 후 줄인 양</div><div class="v small-v">기준선 없음</div><a class="tiny link" href="#/settings">평소 음주량 적기</a></div>`;
  else if (saved.savedG >= 0) savedTile = `<div class="tile"><div class="k">시작 후 줄인 양</div><div class="v">${esc(R.fmtCount(saved.savedG, u))}</div><div class="tiny">${esc(R.UNITS[u].label)} 기준</div></div>`;
  else savedTile = `<div class="tile"><div class="k">기준선과 비교</div><div class="v">${esc(R.fmtCount(-saved.savedG, u))} 더</div><div class="tiny">기준보다 더 마심</div></div>`;

  root.innerHTML = `
    <div class="page">
      <div class="top-row">
        <div><div class="h1">절주노트</div><div class="sub">${esc(projectLine(s, d.today) || `이번 주 목표 ${goalText(goal)}`)}</div></div>
        <a class="icon-btn gear" href="#/settings" aria-label="설정">⚙</a>
      </div>
      ${R.backupDue(s, d.today) ? `<div class="band"><span>마지막 백업 후 7일이 지났어요</span><button type="button" data-act="backup">지금 내보내기</button></div>` : ''}
      <div class="card week-card">
        ${weekStripHtml(d, ws, planned)}
        <div class="week-line">${esc(weekLine(d, ev))}</div>
      </div>
      ${planCardHtml(d)}
      <div data-el="morning"></div>
      <div class="card today-plan">
        ${plan ? `<div class="row center"><div><div class="label-strong">오늘 술자리</div>
            <div class="plan-text">오늘 상한 ${esc(R.fmtCount(plan.limitG, u))}${plan.homeBy ? ` · ${esc(plan.homeBy)} 귀가` : ''}${plan.altNonAlc ? ' · 무알콜 교대' : ''}</div></div>
            <a class="btn small outline" href="#/plan/${d.today}">고치기</a></div>`
          : `<a class="btn outline" href="#/plan/${d.today}">술자리 전: 상한 정하기</a>`}
        ${dryToday ? '<div class="tiny">오늘은 금주 요일</div>' : ''}
      </div>
      <div data-el="record"></div>
      <div class="tiles">
        <div class="tile"><div class="k">안 마신 날 연속</div><div class="v">${streak}일</div><div class="tiny">최고 ${best}일</div></div>
        <div class="tile"><div class="k">목표 달성</div><div class="v">${gs.current}주 연속</div><div class="tiny">최고 ${gs.best}주</div></div>
        ${savedTile}
      </div>
      <div class="page-bottom-space"></div>
    </div>`;

  mountMorning(root.querySelector('[data-el="morning"]'), d, ctx, {
    date: d.today,
    isToday: true,
    onRecordYesterday: async () => {
      view.date = R.addDays(d.today, -1);
      await ctx.refresh();
      const r = document.querySelector('[data-el="record"]');
      if (r) r.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
  });

  mountRecord(root.querySelector('[data-el="record"]'), d, ctx, {
    date: view.date,
    onDate: (nd) => { if (nd > d.today) return; view.date = nd; ctx.refresh(); },
  });

  const b = root.querySelector('[data-act="backup"]');
  if (b) b.addEventListener('click', async () => { if (await exportBackup(d.today)) ctx.refresh(); });

  // 주간 계획 카드
  const card = root.querySelector('[data-el="weekplan"]');
  if (card) {
    const max = R.goalForWeek(d.goals, wp.weekStart);
    card.querySelectorAll('[data-wpday]').forEach((btn) => btn.addEventListener('click', () => {
      const v = btn.dataset.wpday;
      wp.days = wp.days.includes(v) ? wp.days.filter((x) => x !== v) : [...wp.days, v];
      btn.setAttribute('aria-pressed', String(wp.days.includes(v)));
      const over = max ? wp.days.length - max.weeklyDrinkDaysMax : 0;
      card.querySelector('[data-el="wpover"]').textContent = over > 0 ? `목표보다 ${over}일 많아요` : '';
    }));
    card.querySelector('[data-act="wp-save"]').addEventListener('click', async () => {
      await repo.saveWeekPlan(wp.weekStart, wp.days);
      toast(wp.days.length ? `마실 날 ${wp.days.length}일을 찍어 뒀어요` : '이번 주는 마실 날 없이 시작해요');
      ctx.refresh();
    });
    card.querySelector('[data-act="wp-skip"]').addEventListener('click', async () => {
      await repo.saveWeekPlan(wp.weekStart, [], true);
      ctx.refresh();
    });
  }
}
