// 서비스 워커: 앱 파일을 기기에 담아 두고 네트워크 없이도 열리게 한다.
// 앱 파일을 고치면 반드시 VERSION을 올린다(js/version.js의 APP_VERSION과 같게).
const VERSION = 'v1.4.1';
const CACHE = `jeolju-${VERSION}`;
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/main.js',
  'js/repo.js',
  'js/rules.js',
  'js/stats.js',
  'js/charts.js',
  'js/format.js',
  'js/version.js',
  'js/screens/shared.js',
  'js/screens/recordCard.js',
  'js/screens/morningCard.js',
  'js/screens/today.js',
  'js/screens/calendar.js',
  'js/screens/statsScreen.js',
  'js/screens/goals.js',
  'js/screens/goalEdit.js',
  'js/screens/plan.js',
  'js/screens/settings.js',
  'js/screens/welcome.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('jeolju-') && k !== CACHE).map((k) => caches.delete(k)))));
});

// 이 버전의 묶음에 있으면 그것을 쓰고, 없을 때만 네트워크에서 받는다.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scopePath = new URL(self.registration.scope).pathname;
  const isShell = req.mode === 'navigate' && (url.pathname === scopePath || url.pathname === `${scopePath}index.html`);
  const key = isShell ? new URL('index.html', self.registration.scope).href : req;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: isShell });
    if (cached) return cached;
    const res = await fetch(req).catch(() => null);
    if (res && res.ok && res.type === 'basic') {
      event.waitUntil(cache.put(key, res.clone()));
      return res;
    }
    return res || new Response('오프라인입니다. 네트워크에 연결한 뒤 다시 열어 주세요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
