import { useSyncExternalStore } from 'react';
import type { SessionUser } from './api';

const USER_KEY = 'mcc_user';

// Snapshots must be referentially stable, so parse only when the raw value changes
let cachedRaw: string | null = null;
let cachedUser: SessionUser | null = null;

const readUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedUser = raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
};

const subscribeStorage = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  window.addEventListener('mcc-session', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('mcc-session', onChange);
  };
};

/** The signed-in user (display only; the API enforces permissions). `undefined` while hydrating. */
export const useStoredUser = () =>
  useSyncExternalStore<SessionUser | null | undefined>(subscribeStorage, readUser, () => undefined);

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
