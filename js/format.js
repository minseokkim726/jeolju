// 화면 표시용 서식 도우미
import * as R from './rules.js';

export const WD = ['월', '화', '수', '목', '금', '토', '일']; // 0=월
export const WD_FULL = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const md = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
export const fmtMD = md; // 11/19
export const fmtMDW = (s) => `${md(s)} ${WD[R.weekdayIdx(s)]}`; // 11/19 목
export const fmtMDWp = (s) => `${md(s)}(${WD[R.weekdayIdx(s)]})`; // 11/19(목)
export const fmtYM = (ym) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`;
export const fmtWeek = (ws) => `${md(ws)}~${md(R.addDays(ws, 6))}`;
export const compactDate = (s) => s.replaceAll('-', '');

// 오늘/어제/그제 또는 날짜
export function relDay(date, today) {
  const diff = R.daysBetween(date, today);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff === 2) return '그제';
  return '';
}

export const fmtMin = (min) => (min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : `${min}분`);
export const fmtKcal = (k) => `${Math.round(k).toLocaleString('ko-KR')} kcal`;
export const fmtOne = (n) => (Math.round(n * 10) / 10).toString();
