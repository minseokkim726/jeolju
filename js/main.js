// 앱 시작, 화면 전환(주소의 # 부분), 서비스 워커 등록
import * as repo from './repo.js';
import * as R from './rules.js';
import * as today from './screens/today.js';
import * as cal from './screens/calendar.js';
import * as stats from './screens/statsScreen.js';
import * as goals from './screens/goals.js';
import * as goalEdit from './screens/goalEdit.js';
import * as plan from './screens/plan.js';
import * as settings from './screens/settings.js';
import * as welcome from './screens/welcome.js';

const ROUTES = {
  today: { screen: today, tabs: true },
  cal: { screen: cal, tabs: true },
  stats: { screen: stats, tabs: true },
  goals: { screen: goals, tabs: true },
  goal: { screen: goalEdit, tabs: false },
  plan: { screen: plan, tabs: false },
  settings: { screen: settings, tabs: false },
  welcome: { screen: welcome, tabs: false },
};

const root = document.getElementById('screen');
const tabs = document.getElementById('tabs');
if (repo.DEMO) document.getElementById('demo-band').hidden = false;

function parseHash() {
  const [name, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  const param = rest.length ? decodeURIComponent(rest.join('/')) : null;
  return ROUTES[name] ? { name, param } : { name: 'today', param: null };
}

export function go(path) {
  if (location.hash === `#/${path}`) render();
  else location.hash = `#/${path}`;
}

let renderSeq = 0;
let lastRoute = '';
let renderedDate = null;

async function render() {
  const seq = ++renderSeq;
  const route = parseHash();
  const def = ROUTES[route.name];
  const data = await repo.load();
  if (seq !== renderSeq) return;
  const now = new Date();
  data.now = now;
  data.today = R.logicalToday(now, data.settings.dayCutoffHour);
  renderedDate = data.today;
  tabs.hidden = !def.tabs;
  tabs.querySelectorAll('a').forEach((a) => {
    if (a.dataset.tab === route.name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const key = `${route.name}/${route.param || ''}`;
  const keepScroll = key === lastRoute ? root.scrollTop : 0;
  lastRoute = key;
  root.innerHTML = '';
  root.dataset.screen = route.name;
  def.screen.render(root, data, { param: route.param, go, refresh: render });
  root.scrollTop = keepScroll;
}

// 날짜가 바뀐 뒤 다시 돌아오면 새로 그린다
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  repo.load().then((d) => {
    if (renderedDate && renderedDate !== R.logicalToday(new Date(), d.settings.dayCutoffHour)) render();
  }).catch(() => {});
});

async function start() {
  try {
    const { firstRun } = await repo.init(R.logicalToday(new Date(), R.DEFAULT_SETTINGS.dayCutoffHour));
    const name = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (firstRun && name !== 'welcome' && name !== 'goal') location.hash = '#/welcome/1';
    else if (!ROUTES[name]) location.hash = '#/today';
    window.addEventListener('hashchange', render);
    await render();
  } catch (err) {
    root.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'loading';
    p.textContent = `앱을 열지 못했습니다: ${err && err.message ? err.message : err}`;
    root.appendChild(p);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => reg.update().catch(() => {})).catch(() => {});
  });
}

start();
