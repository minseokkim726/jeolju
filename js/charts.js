// 직접 그린 인라인 SVG 차트 3종(라이브러리 없음). 막대·선·가로 비율 막대.
// 막대/점마다 data-note를 달아 두면 화면이 누를 때 차트 아래 한 줄에 값을 보여 준다.
import { esc } from './format.js';

const W = 340;
const C = { bar: '#2F5D8A', barSoft: '#A9C0D6', goal: '#7A3F06', grid: '#E1E4DF', text: '#434B4F', mark: '#7A3F06', line: '#2F5D8A', dot: '#B9833F' };

// 막대 차트. bars: [{ label, value, note, goal (목표선 값|null), mark (막대 위 ■ 표시) , soft }]
export function barChart(bars, { height = 150, max = null, unit = '' } = {}) {
  const top = 20, bottom = 24, left = 4, right = 4;
  const h = height - top - bottom;
  const vmax = Math.max(1, max ?? 0, ...bars.map((b) => b.value), ...bars.map((b) => b.goal ?? 0));
  const n = bars.length || 1;
  const slot = (W - left - right) / n;
  const bw = Math.min(28, slot * 0.6);
  const y = (v) => top + h - (v / vmax) * h;
  let out = `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="${esc(bars.map((b) => `${b.label} ${b.value}${unit}`).join(', '))}">`;
  out += `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="${C.grid}"/>`;
  // 목표선: 막대마다 그 칸 폭만큼(목표가 바뀌면 계단처럼)
  bars.forEach((b, i) => {
    if (b.goal == null) return;
    const x0 = left + i * slot, x1 = x0 + slot, gy = y(b.goal);
    out += `<line x1="${x0}" x2="${x1}" y1="${gy}" y2="${gy}" stroke="${C.goal}" stroke-width="2" stroke-dasharray="4 3"/>`;
    const prev = bars[i - 1];
    if (prev && prev.goal != null && prev.goal !== b.goal) out += `<line x1="${x0}" x2="${x0}" y1="${y(prev.goal)}" y2="${gy}" stroke="${C.goal}" stroke-width="2" stroke-dasharray="2 2"/>`;
  });
  bars.forEach((b, i) => {
    const cx = left + i * slot + slot / 2;
    const by = y(b.value);
    out += `<rect x="${cx - bw / 2}" y="${by}" width="${bw}" height="${Math.max(0, y(0) - by)}" rx="3" fill="${b.soft ? C.barSoft : C.bar}"/>`;
    out += `<text x="${cx}" y="${by - 4}" text-anchor="middle" font-size="14" font-weight="700" fill="${C.text}">${esc(b.valueText ?? b.value)}</text>`;
    if (b.mark) out += `<text x="${cx}" y="${top - 6}" text-anchor="middle" font-size="14" fill="${C.mark}" font-weight="700">■</text>`;
    // 칸이 좁으면(12주 등) 아래 이름은 하나 건너 하나만(글씨가 겹치지 않게). 값 글씨도 같은 기준
    const every = slot < 40 ? 2 : 1;
    if ((n - 1 - i) % every === 0) out += `<text x="${cx}" y="${height - 6}" text-anchor="middle" font-size="14" fill="${C.text}">${esc(b.label)}</text>`;
    out += `<rect class="hit" x="${left + i * slot}" y="0" width="${slot}" height="${height}" fill="transparent" data-note="${esc(b.note || '')}"/>`;
  });
  return `${out}</svg>`;
}

// 선 차트. points: [{ label, value|null, note }], dots: 아래쪽 점을 찍을 칸 번호 배열(예: 음주일)
export function lineChart(points, { height = 150, dots = [], min = null, max = null, dotLabel = '' } = {}) {
  const top = 14, bottom = dots.length ? 38 : 24, left = 36, right = 8;
  const h = height - top - bottom;
  const vals = points.map((p) => p.value).filter((v) => v != null);
  if (!vals.length) return '';
  let lo = min ?? Math.min(...vals), hi = max ?? Math.max(...vals);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const n = points.length;
  const x = (i) => left + (n === 1 ? (W - left - right) / 2 : (i / (n - 1)) * (W - left - right));
  const y = (v) => top + h - ((v - lo) / (hi - lo)) * h;
  let out = `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="${esc(points.filter((p) => p.value != null).map((p) => `${p.label} ${p.value}`).join(', '))}">`;
  for (const v of [lo, (lo + hi) / 2, hi]) {
    out += `<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/>`;
    out += `<text x="${left - 4}" y="${y(v) + 4}" text-anchor="end" font-size="14" fill="${C.text}">${Math.round(v * 10) / 10}</text>`;
  }
  const path = points.map((p, i) => (p.value == null ? null : `${x(i)},${y(p.value)}`)).filter(Boolean);
  out += `<polyline points="${path.join(' ')}" fill="none" stroke="${C.line}" stroke-width="2.5" stroke-linejoin="round"/>`;
  points.forEach((p, i) => { if (p.value != null) out += `<circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="${C.line}"/>`; });
  for (const i of dots) out += `<circle cx="${x(i)}" cy="${height - bottom + 12}" r="3.5" fill="${C.dot}"><title>${esc(dotLabel)}</title></circle>`;
  const step = Math.max(1, Math.ceil(n / 6));
  // 아래 날짜 글씨: step 간격으로, 마지막 칸은 항상. 마지막과 44 이내로 붙는 글씨는 뺀다(겹침 방지)
  points.forEach((p, i) => { if ((i % step === 0 && (x(n - 1) - x(i) >= 44 || i === 0)) || i === n - 1) out += `<text x="${x(i)}" y="${height - 4}" text-anchor="middle" font-size="14" fill="${C.text}">${esc(p.label)}</text>`; });
  const slot = (W - left - right) / Math.max(1, n);
  points.forEach((p, i) => { out += `<rect class="hit" x="${x(i) - slot / 2}" y="0" width="${slot}" height="${height}" fill="transparent" data-note="${esc(p.note || '')}"/>`; });
  return `${out}</svg>`;
}

// 가로 비율 막대(HTML). items: [{ label, value, color }] → 막대 한 줄 + 아래 범례(이름·비율)
export function ratioBar(items) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const pct = (v) => Math.round((v / total) * 100);
  return `<div class="ratio" role="img" aria-label="${esc(items.map((i) => `${i.label} ${pct(i.value)}%`).join(', '))}">
    ${items.map((i) => `<span style="width:${(i.value / total) * 100}%;background:${i.color}"></span>`).join('')}</div>
    <div class="ratio-legend">${items.map((i) => `<span><i style="background:${i.color}"></i>${esc(i.label)} ${pct(i.value)}%</span>`).join('')}</div>`;
}
