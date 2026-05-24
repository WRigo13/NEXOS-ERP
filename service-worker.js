// ═══════════════════════════════════════════
// Nexos ERP — Service Worker
// ═══════════════════════════════════════════
const CACHE_NAME    = 'nexos-v1';
const CACHE_OFFLINE = 'nexos-offline-v1';

// Arquivos essenciais para funcionar offline
const ARQUIVOS_ESSENCIAIS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
];

// ── Instalação — cacheia os arquivos essenciais ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando arquivos essenciais...');
      return cache.addAll(ARQUIVOS_ESSENCIAIS).catch(err => {
        console.warn('[SW] Alguns arquivos não puderam ser cacheados:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Ativação — limpa caches antigos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== CACHE_OFFLINE)
          .map(key => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — estratégia: Network First, fallback para cache ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar requests não-GET e de outros domínios
  if (event.request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin) &&
      !url.hostname.includes('supabase.co')) return;

  // Para o Supabase (API), sempre tenta a rede primeiro
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request)
      )
    );
    return;
  }

  // Para os arquivos do app: Cache First (carrega rápido)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Atualiza o cache em background
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, response.clone())
            );
          }
        }).catch(() => {});
        return cached;
      }

      // Não está em cache, busca na rede
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache =>
          cache.put(event.request, clone)
        );
        return response;
      }).catch(() => {
        // Offline e sem cache — retorna o index.html
        return caches.match('/index.html');
      });
    })
  );
});

// ── Push notifications (futuro) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Nexos', {
    body: data.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
  });
});
