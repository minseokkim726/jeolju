// 데이터 접근 계층. 화면 코드는 저장소(IndexedDB)에 직접 접근하지 않고 이 모듈만 호출한다.
import * as R from './rules.js';

// 주소에 ?demo=1 이 있으면 예시 데이터용 별도 저장소를 쓴다(실제 기록과 섞이지 않게).
export const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1';
export const DB_NAME = DEMO ? 'jeolju-demo' : 'jeolju';
const DB_VERSION = 1;
const STORES = ['days', 'goals', 'weekPlans', 'settings', 'meta'];

// ---------- IndexedDB 작은 래퍼 ----------
const dbPromises = {};
function openDb(name = DB_NAME) {
  if (dbPromises[name]) return dbPromises[name];
  dbPromises[name] = new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const make = (n, keyPath) => { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath }); };
      make('days', 'date');
      make('goals', 'id');
      make('weekPlans', 'weekStart');
      make('settings', 'id');
      make('meta', 'id');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); delete dbPromises[name]; };
      resolve(db);
    };
    req.onerror = () => { delete dbPromises[name]; reject(req.error); };
  });
  return dbPromises[name];
}

async function readAll(names = STORES, dbName = DB_NAME) {
  const db = await openDb(dbName);
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, 'readonly');
    const out = {};
    for (const n of names) { const r = t.objectStore(n).getAll(); r.onsuccess = () => { out[n] = r.result; }; }
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('읽기 취소됨'));
  });
}

// 한 트랜잭션으로 쓴다. { put: {store: [items]}, del: {store: [keys]}, clear: [stores] }
async function write({ put = {}, del = {}, clear = [] }, dbName = DB_NAME) {
  const names = [...new Set([...Object.keys(put), ...Object.keys(del), ...clear])];
  if (!names.length) return;
  const db = await openDb(dbName);
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, 'readwrite');
    for (const n of clear) t.objectStore(n).clear();
    for (const [n, keys] of Object.entries(del)) for (const k of keys) t.objectStore(n).delete(k);
    for (const [n, items] of Object.entries(put)) for (const it of items) t.objectStore(n).put(it);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('저장 취소됨'));
  });
}

export function newId(prefix = 'g') {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// 저장된 설정 + 기본값. v1.4 전부터 쓰던 기기(저장된 설정에 weekStartsOn이 없음)는 월요일로 읽는다(새로 설치하면 일요일)
function withDefaults(rest) {
  return { ...R.DEFAULT_SETTINGS, ...(rest.weekStartsOn == null ? { weekStartsOn: 1 } : {}), ...rest };
}
function settingsOf(rows) {
  const s = (rows || []).find((r) => r.id === 'settings');
  if (!s) return { ...R.DEFAULT_SETTINGS };
  const { id, ...rest } = s;
  return withDefaults(rest);
}

// ---------- 시작 ----------
// 처음이면 기본 설정과 기본 목표(주 2회) 한 줄을 만든다. { firstRun } 반환
export async function init(today) {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch { /* 지원하지 않는 브라우저 */ }
  const all = await readAll(['settings', 'goals', 'meta']);
  const s = settingsOf(all.settings);
  const hasSettings = all.settings.some((r) => r.id === 'settings');
  const put = {};
  if (!hasSettings) put.settings = [{ id: 'settings', ...R.DEFAULT_SETTINGS, startDate: today }];
  if (!all.goals.length) {
    put.goals = [{ id: newId('goal'), ...R.DEFAULT_GOAL, effectiveFrom: R.weekStartOf((hasSettings && s.startDate) || today, R.wsoOf(s)), createdAt: new Date().toISOString() }];
  }
  const meta = all.meta.find((m) => m.id === 'meta');
  if (!meta) put.meta = [{ id: 'meta', schemaVersion: R.SCHEMA_VERSION }];
  // v1.4.1 같은 주(현재 한 주 시작 기준)에 목표가 여러 줄이면 나중에 만든 것만 남긴다(한 번 정리되면 다음부터는 지울 것이 없음)
  if (all.goals.length) {
    const { removeIds } = R.dedupeGoals(all.goals, R.wsoOf(s));
    if (removeIds.length) await write({ del: { goals: removeIds } });
  }
  await write({ put });
  // v1 → v2: 컨디션을 그날 아침 뜻으로 옮긴다(한 번만, 한 트랜잭션)
  if (meta && (meta.schemaVersion || 1) < 2) {
    const { days } = await readAll(['days']);
    await write({ clear: ['days'], put: { days: R.migrateDaysV1toV2(days), meta: [{ ...meta, schemaVersion: R.SCHEMA_VERSION }] } });
  }
  return { firstRun: !(hasSettings && s.onboarded) };
}

// 화면이 쓰는 전체 데이터
export async function load() {
  const all = await readAll();
  const daysMap = {};
  for (const d of all.days) daysMap[d.date] = d;
  const weekPlans = {};
  for (const w of all.weekPlans) weekPlans[w.weekStart] = w;
  const settings = settingsOf(all.settings);
  return { days: daysMap, daysList: all.days, goals: R.sortGoals(all.goals, R.wsoOf(settings)), weekPlans, settings, demo: DEMO };
}

async function getDay(date) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction('days', 'readonly').objectStore('days').get(date);
    r.onsuccess = () => resolve(r.result || R.emptyDay(date));
    r.onerror = () => reject(r.error);
  });
}

// 하루 기록 일부를 바꿔 저장(나머지는 그대로). 날짜당 1건, 다시 저장하면 덮어쓴다.
export async function patchDay(date, patch) {
  const cur = await getDay(date);
  const next = { ...cur, ...patch, date, updatedAt: new Date().toISOString() };
  if (next.status === 'sober') { next.alcoholG = 0; next.drinks = []; next.homeAt = null; next.altNonAlcDone = null; next.occasion = null; next.food = null; }
  await write({ put: { days: [next] } });
  return next;
}

export const saveSober = (date) => patchDay(date, { status: 'sober' });
export const saveDrank = (date, { drinks, homeAt, occasion, altNonAlcDone, memo, food }) =>
  patchDay(date, { status: 'drank', drinks, alcoholG: R.drinksG(drinks), homeAt: homeAt || null, occasion: occasion || null, altNonAlcDone: altNonAlcDone ?? null, ...(memo != null ? { memo } : {}), ...(food !== undefined ? { food: R.normalizeFood(food) } : {}), sources: { alcohol: 'manual', weight: 'manual' } });
// 입력 지우기(계획·컨디션·체중·메모는 남긴다)
export const clearEntry = (date) => patchDay(date, { status: 'none', alcoholG: 0, drinks: [], homeAt: null, altNonAlcDone: null, occasion: null, food: null });

export async function savePlan(date, plan) {
  const cur = await getDay(date);
  return patchDay(date, { plan: { ...plan, createdAt: (cur.plan && cur.plan.createdAt) || new Date().toISOString() } });
}
export const deletePlan = (date) => patchDay(date, { plan: null });

// ---------- 목표 ----------
// 목표를 바꾸면 덮어쓰지 않고 새 줄을 추가한다
// v1.4.1 같은 주에 이미 있던 줄은 새 줄이 대신한다(지움). 다른 주 줄은 그대로
export async function addGoal(goal, wso = 1) {
  const row = { ...R.DEFAULT_GOAL, ...goal, id: newId('goal'), createdAt: new Date().toISOString() };
  const all = await readAll(['goals']);
  await write({ del: { goals: R.sameWeekGoalIds(all.goals, row.effectiveFrom, wso) }, put: { goals: [row] } });
  return row;
}
// 아직 시작하지 않은 단계만 고치거나 지운다
export async function updateFutureGoal(id, goal, today, wso = 1) {
  const all = await readAll(['goals']);
  const cur = all.goals.find((g) => g.id === id);
  if (!cur || R.goalStarted(cur, today, wso)) throw new Error('이미 시작된 목표는 고칠 수 없어요. 새 목표를 추가해 주세요.');
  const row = { ...cur, ...goal, id, createdAt: new Date().toISOString() };
  await write({ del: { goals: R.sameWeekGoalIds(all.goals, row.effectiveFrom, wso, id) }, put: { goals: [row] } });
}
export async function deleteFutureGoal(id, today, wso = 1) {
  const all = await readAll(['goals']);
  const cur = all.goals.find((g) => g.id === id);
  if (!cur || R.goalStarted(cur, today, wso)) throw new Error('이미 시작된 목표는 지울 수 없어요.');
  await write({ del: { goals: [id] } });
}
// 첫 실행에서 프리셋을 고르면 기본 목표를 프리셋으로 바꾼다(아직 기록이 쌓이기 전)
export async function replaceGoals(rows) {
  const now = Date.now();
  const items = rows.map((g, i) => ({ ...R.DEFAULT_GOAL, ...g, id: newId('goal'), createdAt: new Date(now + i).toISOString() }));
  await write({ clear: ['goals'], put: { goals: items } });
}

export async function saveWeekPlan(weekStart, plannedDays, skipped = false) {
  await write({ put: { weekPlans: [{ weekStart, plannedDays: [...plannedDays].sort(), skipped, createdAt: new Date().toISOString() }] } });
}

// v1.4 한 주 시작 바꾸기: 설정과 함께 주간 계획을 새 기준으로 다시 묶는다(한 트랜잭션). 기록·목표는 그대로
export async function setWeekStart(wso) {
  const all = await readAll(['settings', 'weekPlans', 'goals']);
  const s = settingsOf(all.settings);
  const v = wso === 0 ? 0 : 1;
  // 새 기준에서 같은 주가 된 목표 줄도 정리한다(v1.4.1)
  await write({ clear: ['weekPlans'], del: { goals: R.dedupeGoals(all.goals, v).removeIds }, put: { settings: [{ id: 'settings', ...s, weekStartsOn: v }], weekPlans: R.regroupWeekPlans(all.weekPlans, v) } });
}

export async function saveSettings(patch) {
  const all = await readAll(['settings']);
  const s = settingsOf(all.settings);
  await write({ put: { settings: [{ id: 'settings', ...s, ...patch }] } });
}
export const markBackedUp = (iso = new Date().toISOString()) => saveSettings({ lastBackupAt: iso });

// ---------- 백업 ----------
export async function exportData() {
  const all = await readAll();
  return {
    app: R.APP_ID, schemaVersion: R.SCHEMA_VERSION, exportedAt: new Date().toISOString(),
    data: { days: all.days, goals: all.goals, weekPlans: all.weekPlans, settings: settingsOf(all.settings), meta: all.meta },
  };
}

// 형식을 확인한 뒤 모든 저장소를 한 번에 교체한다. 틀리면 아무것도 바꾸지 않는다.
export async function importData(obj, dbName = DB_NAME) {
  const v = R.validateBackup(obj);
  if (!v.ok) return v;
  const d = obj.data;
  const { id, ...s } = d.settings;
  const days = obj.schemaVersion < 2 ? R.migrateDaysV1toV2(d.days) : d.days;
  try {
    await write({
      clear: STORES,
      put: {
        days, goals: R.dedupeGoals(d.goals, R.wsoOf(withDefaults(s))).keep, weekPlans: d.weekPlans,
        settings: [{ id: 'settings', ...withDefaults(s) }],
        meta: [{ id: 'meta', schemaVersion: R.SCHEMA_VERSION }],
      },
    }, dbName);
  } catch (e) {
    return { ok: false, error: `저장하지 못했습니다: ${e.message || e}` };
  }
  return { ok: true };
}

export async function exportCsv() {
  const all = await readAll(['days', 'goals', 'settings']);
  return R.buildCsv(all.days, all.goals, settingsOf(all.settings));
}

// 예시 데이터(별도 저장소 jeolju-demo)에 넣기. tests.html에서 쓴다.
export function writeSampleDb(backupObj) { return importData(backupObj, 'jeolju-demo'); }
