import { loadWatches, saveWatches } from './store';
import { checkWatches, dayStamp, notificationText } from './check';

/**
 * Sprawdza zapisane trasy i wysyła powiadomienia (raz na wyjazd).
 * Używane w aplikacji (gdy otwarta) i w service workerze (periodic sync).
 */
export async function runChecks(reg: ServiceWorkerRegistration): Promise<number> {
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return 0;
  const watches = await loadWatches();
  const results = await checkWatches(watches);
  let sent = 0;
  for (const r of results) {
    const stamp = dayStamp(r.departAt);
    if (r.level < r.watch.threshold || r.watch.lastNotified === stamp) continue;
    const { title, body } = notificationText(r);
    await reg.showNotification(title, { body, tag: `pd-${r.watch.id}`, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', data: { url: '/?view=alerts' } });
    r.watch.lastNotified = stamp;
    sent++;
  }
  if (sent) await saveWatches(watches.map((w) => results.find((r) => r.watch.id === w.id)?.watch ?? w));
  return sent;
}
