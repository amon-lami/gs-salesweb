// GS Sales - Service Worker
// ネットワークファーストで動作（常に最新データを取得）

const CACHE_NAME = 'gs-sales-v1';

// インストール時：即座にアクティベート
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// フェッチ：ネットワークファースト（失敗時のみキャッシュを使用）
self.addEventListener('fetch', (event) => {
  // Supabase API やフォントなど外部リクエストはキャッシュしない
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // GETリクエストのみキャッシュに保存
        if (event.request.method === 'GET' && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
