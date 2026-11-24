import { useCallback, useEffect, useState } from 'react';
import type { Place } from '../types';
import { reverseGeocode } from '../data/geocode';
import { useStored } from './store';

export interface UserLocation extends Place {
  source: 'gps' | 'manual' | 'default';
  accuracy?: number;
}

const DEFAULT: UserLocation = { name: 'Warszawa', label: 'mazowieckie', lat: 52.2297, lon: 21.0122, source: 'default' };

export function useUserLocation() {
  const [loc, setLoc] = useStored<UserLocation>('pd.location', DEFAULT);
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'error'>('idle');

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) { setStatus('error'); return; }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        let name = 'Twoja lokalizacja', label = '';
        try { const r = await reverseGeocode(lat, lon); name = r.name; label = r.label; } catch { /* nazwa opcjonalna */ }
        setLoc({ name, label, lat, lon, accuracy, source: 'gps' });
        setStatus('idle');
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  }, [setLoc]);

  // Przy pierwszym uruchomieniu spróbuj ustalić lokalizację (przeglądarka zapyta o zgodę).
  useEffect(() => {
    if (loc.source === 'default') locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setManual = useCallback((p: Place) => setLoc({ ...p, source: 'manual' }), [setLoc]);
  return { loc, status, locate, setManual };
}
