// 목표: 장기 목표 · 제안 카드 · 현재 목표와 이번 주 진행 · 다음 단계 · 목표 이력
import * as repo from '../repo.js';
import * as R from '../rules.js';
import { esc, WD, fmtMD, fmtMDWp } from '../format.js';
import { toast, ask } from './shared.js';
import { projectLine } from './today.js';

export const dryText = (g) => (g.dryWeekdays || []).slice().sort().map((i) => WD[i]).join('·');

// "주 2회 이하 · 과음 0회 · 총량 소주 14잔 이하 · 금주 요일 월·화"
export function goalSummary(g, u, { limit = false } = {}) {
  const parts = [`주 ${g.weeklyDrinkDaysMax}회 이하`, `과음 ${g.heavyMaxPerWeek}회 이하`];
  if (g.weeklyTotalG != null) parts.push(`총량 ${R.fmtAmount(g.weeklyTotalG, u)} 이하`);
  if ((g.dryWeekdays || []).length) parts.push(`금주 요일 ${dryText(g)}`);
  if (limit) parts.push(`술자리 상한 ${R.fmtCount(g.defaultLimitG, u)}`);
  return parts.join(' · ');
}

const pctOf = (cur, max) => (max > 0 ? Math.min(100, Math.round((cur / max) * 100)) : cur > 0 ? 100 : 0);
function itemBar(label, curTxt, cur, max, over) {
  return `<div class="gi"><div class="t"><span>${esc(label)}</span><b class="${over ? 'tone-warn' : ''}">${esc(curTxt)}${over ? ' ▲' : ''}</b></div>
    <div class="bar ${over ? 'over' : ''}" role="img" aria-label="${esc(`${label} ${curTxt}`)}"><span style="width:${pctOf(cur, max)}%"></span></div></div>`;
}

// 목표 구간마다 끝난 주 중 달성한 주 수
export function periodAchievement(d, p) {
  const s = d.settings;
  let done = 0, total = 0;
  const end = p.to && p.to < d.today ? p.to : d.today;
  for (let ws = p.from; ws <= end; ws = R.addDays(ws, 7)) {
    const ev = R.weekEval(d.days, d.goals, ws, s, d.today);
    if (!ev.complete) continue;
    total++;
    if (ev.status === 'achieved') done++;
  }
  return { done, total };
}

export function render(root, d, ctx) {
  const s = d.settings;
  const u = s.unit;
  const wso = R.wsoOf(s);
  const curWs = R.weekStartOf(d.today, wso);
  const goal = R.currentGoal(d.goals, d.today, wso);
  const ev = R.weekEval(d.days, d.goals, curWs, s, d.today);
  const sug = R.goalSuggestion(d.days, d.goals, s, d.today);
  const future = R.futureGoals(d.goals, d.today, wso);
  const periods = R.goalPeriods(d.goals, wso).filter((p) => p.from <= curWs).reverse();
  const it = ev.items || {};

  let sugHtml = '';
  if (sug) {
    const text = sug.kind === 'lower'
      ? `3주 연속 달성했어요. 한 단계 낮춰 볼까요? (주 ${sug.from}회 → ${sug.to}회)`
      : `목표를 지금 수준에 맞춰 다시 잡아 볼까요? (제안: 주 ${sug.to}회)`;
    sugHtml = `<div class="card soft"><div class="h2" style="font-weight:500">${esc(text)}</div>
      <div class="small">적용하면 이번 주부터 바뀌어요. 지난 주 판정은 그대로예요.</div>
      <div class="btn-row"><button type="button" class="btn primary" data-act="sug-apply">적용</button><button type="button" class="btn" data-act="sug-keep">그대로 두기</button></div></div>`;
  }

  root.innerHTML = `
    <div class="page">
      <div class="h1">목표</div>
      <div class="card" data-el="long">
        <div class="tiny">장기 목표와 기간</div>
        <div class="row center"><div class="long-note">${s.longTermNote ? esc(s.longTermNote) : '<span class="small">아직 없어요</span>'}</div>
        <button type="button" class="btn small" data-act="long-edit">${s.longTermNote ? '고치기' : '적기'}</button></div>
        <div class="period-line">${s.startDate ? `기간 ${esc(fmtMD(s.startDate))} ~ ${s.targetDate ? esc(fmtMD(s.targetDate)) : '목표일 없음'}<br><span class="small">${esc(projectLine(s, d.today))}</span>` : '<span class="small">시작일이 없어요</span>'}</div>
      </div>
      ${sugHtml}
      ${goal ? `<div class="card">
        <div class="row center"><div class="h2">현재 목표</div><span class="tiny">${esc(fmtMDWp(R.weekStartOf(goal.effectiveFrom, wso)))}부터</span></div>
        <div style="font-size:16px">${esc(goalSummary(goal, u, { limit: true }))}</div>
        <div class="tiny">이번 주 진행 (${esc(fmtMD(curWs))}~${esc(fmtMD(R.addDays(curWs, 6)))})</div>
        <div class="goal-items">
          ${itemBar('음주일', `${ev.drinkDays}/${goal.weeklyDrinkDaysMax}일`, ev.drinkDays, goal.weeklyDrinkDaysMax, it.days === 'over')}
          ${itemBar('과음', `${ev.heavy}/${goal.heavyMaxPerWeek}회`, ev.heavy, goal.heavyMaxPerWeek, it.heavy === 'over')}
          ${goal.weeklyTotalG != null ? itemBar('총량', `${R.fmtNum(R.toDisplay(ev.totalG, u))}/${R.fmtNum(R.toDisplay(goal.weeklyTotalG, u))}${R.unitSuffix(u)}`, ev.totalG, goal.weeklyTotalG, it.total === 'over') : ''}
          ${(goal.dryWeekdays || []).length ? `<div class="gi"><div class="t"><span>금주 요일(${esc(dryText(goal))}) 위반</span><b class="${it.dry === 'over' ? 'tone-warn' : 'tone-ok'}">${ev.dryViolations.length}번${it.dry === 'over' ? ' ▲' : ' ○'}</b></div></div>` : ''}
        </div>
        ${ev.missing >= 3 ? `<div class="small">미입력 ${ev.missing}일 — 3일 이상이면 판정 보류예요.</div>` : ''}
        <a class="btn outline" href="#/goal/new">목표 바꾸기</a>
      </div>` : '<div class="card"><div class="small">목표가 없어요.</div><a class="btn outline" href="#/goal/new">목표 정하기</a></div>'}
      <div class="card">
        <div class="h2">다음 단계</div>
        ${future.length ? future.map((g) => `<div class="list-row"><span>${esc(fmtMDWp(R.weekStartOf(g.effectiveFrom, wso)))}부터 ${esc(goalSummary(g, u))}</span>
          <span class="btns"><a class="btn small" href="#/goal/${encodeURIComponent(g.id)}">고치기</a><button type="button" class="btn small" data-del="${esc(g.id)}">삭제</button></span></div>`).join('')
          : '<div class="small">미리 깔아 둔 단계가 없어요. 2~3단계를 미리 정해 둘 수 있어요.</div>'}
        <a class="btn" href="#/goal/step">단계 추가</a>
      </div>
      <div class="card">
        <div class="h2">목표 이력</div>
        ${periods.map((p) => {
          const a = periodAchievement(d, p);
          return `<div class="list-row" style="flex-direction:column;align-items:flex-start;gap:2px">
            <span class="tiny">${esc(fmtMD(p.from))} ~ ${p.to ? esc(fmtMD(p.to)) : '지금'}</span>
            <span>${esc(goalSummary(p.goal, u))}</span>
            <span class="small">${a.total ? `달성 ${a.done}주 / 끝난 주 ${a.total}주` : '아직 끝난 주가 없어요'}</span></div>`;
        }).join('') || '<div class="small">이력이 없어요.</div>'}
      </div>
      <div class="page-bottom-space"></div>
    </div>`;

  const q = (sel) => root.querySelector(sel);
  q('[data-act="long-edit"]').addEventListener('click', () => {
    const box = q('[data-el="long"]');
    box.innerHTML = `<label class="label-strong" for="lt">장기 목표 한 줄</label>
      <input id="lt" class="input" type="text" maxlength="60" value="${esc(s.longTermNote || '')}" placeholder="예: 45세 이후 비음주">
      <div class="field"><label for="lt-start">시작일</label><input id="lt-start" class="input" type="date" value="${esc(s.startDate || d.today)}"></div>
      <div class="field"><label for="lt-target">목표일 <span class="opt">(선택)</span></label><input id="lt-target" class="input" type="date" value="${esc(s.targetDate || '')}"></div>
      <div class="small">시작일을 바꾸면 기준선 대비·4주 점검이 새 시작일로 다시 계산돼요. 그 전 기록은 지우지 않아요.</div>
      <div class="error" data-el="lt-err" role="alert"></div>
      <div class="btn-row"><button type="button" class="btn primary" data-act="lt-save">저장</button><button type="button" class="btn" data-act="lt-cancel">취소</button></div>`;
    box.querySelector('#lt').focus();
    box.querySelector('[data-act="lt-save"]').addEventListener('click', async () => {
      const start = box.querySelector('#lt-start').value;
      const target = box.querySelector('#lt-target').value || null;
      const err = box.querySelector('[data-el="lt-err"]');
      if (!R.isDateStr(start)) { err.textContent = '시작일을 골라 주세요.'; return; }
      if (target && target <= start) { err.textContent = '목표일은 시작일보다 뒤여야 해요.'; return; }
      await repo.saveSettings({ longTermNote: box.querySelector('#lt').value.trim(), startDate: start, targetDate: target });
      toast('저장했어요');
      ctx.refresh();
    });
    box.querySelector('[data-act="lt-cancel"]').addEventListener('click', () => ctx.refresh());
  });
  if (sug) {
    q('[data-act="sug-apply"]').addEventListener('click', async () => {
      const { id, createdAt, effectiveFrom, ...rest } = goal;
      await repo.addGoal({ ...rest, weeklyDrinkDaysMax: sug.to, effectiveFrom: curWs, note: sug.kind === 'lower' ? '제안: 한 단계 낮춤' : '제안: 다시 잡음' });
      await repo.saveSettings({ dismissedSuggestion: curWs });
      toast(`이번 주부터 주 ${sug.to}회 이하`);
      ctx.refresh();
    });
    q('[data-act="sug-keep"]').addEventListener('click', async () => { await repo.saveSettings({ dismissedSuggestion: curWs }); ctx.refresh(); });
  }
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await ask({ title: '이 단계를 지울까요?', message: '아직 시작하지 않은 단계라 지난 기록에는 영향이 없어요.', choices: [{ label: '삭제', value: true, kind: 'primary' }, { label: '취소', value: false }] });
    if (!ok) return;
    try { await repo.deleteFutureGoal(b.dataset.del, d.today, wso); toast('지웠어요'); } catch (e) { toast(e.message); }
    ctx.refresh();
  }));
}
