/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { runChecks } from './alerts/notify';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Kafelki i style mapy: cache na 30 dni (szybkie ładowanie, praca przy słabym zasięgu)
registerRoute(({ url }) => url.hostname === 'tiles.openfreemap.org',
  new CacheFirst({ cacheName: 'map-tiles', plugins: [new ExpirationPlugin({ maxEntries: 3000, maxAgeSeconds: 30 * 86400 })] }));
// Prognozy: zawsze świeże, a bez sieci ostatnia znana wersja
registerRoute(({ url }) => url.hostname === 'api.open-meteo.com' || url.hostname === 'danepubliczne.imgw.pl',
  new NetworkFirst({ cacheName: 'weather', networkTimeoutSeconds: 8, plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 6 * 3600 })] }));
registerRoute(({ url }) => url.pathname.startsWith(`${import.meta.env.BASE_URL}data/`),
  new StaleWhileRevalidate({ cacheName: 'static-data' }));

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Sprawdzanie tras w tle (Chrome/Edge, zainstalowana aplikacja)
self.addEventListener('periodicsync', (e: Event) => {
  const ev = e as ExtendableEvent & { tag: string };
  if (ev.tag === 'road-check') ev.waitUntil(runChecks(self.registration).catch(() => 0));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || import.meta.env.BASE_URL;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = all.find((x) => 'focus' in x) as WindowClient | undefined;
    if (c) { await c.focus(); c.navigate(url).catch(() => {}); } else await self.clients.openWindow(url);
  })());
});
