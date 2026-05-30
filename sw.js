// ═══════════════════════════════════════════
//  NEXOS ERP — Service Worker PWA v2
// ═══════════════════════════════════════════
const CACHE_NAME = 'nexos-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Instalar — cache dos assets estáticos
self.addEventListener('install', function(e) {
  console.log('[SW] Instalando...');
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function(err) {
        console.warn('[SW] Cache parcial:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativar — limpar caches antigos
self.addEventListener('activate', function(e) {
  console.log('[SW] Ativando...');
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k)   { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first para assets, network-first para API
self.addEventListener('fetch', function(e) {
  const url = new URL(e.request.url);

  // Supabase e MP — sempre rede (dados em tempo real)
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('mercadopago') ||
      url.hostname.includes('mercadolivre')) {
    return; // deixa o browser lidar normalmente
  }

  // Fontes e CDN — cache-first
  if (url.hostname.includes('fonts.googleapis') ||
      url.hostname.includes('fonts.gstatic') ||
      url.hostname.includes('jsdelivr.net')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
          return res;
        });
      })
    );
    return;
  }

  // HTML principal — network-first com fallback cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function(res) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
        return res;
      }).catch(function() {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }
});
