import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

export interface SessionUser {
  id: string;
  name: string;
  roles: string[];
}

interface SessionResponse {
  _id: string;
  name: string;
  roles: string[];
  token: string;
}

const USER_KEY = 'mcc_user';

// The access token lives only in memory; the refresh token is an httpOnly
// cookie the browser sends to /api/auth, so script can never read either.
let accessToken: string | null = null;

const api = axios.create({ baseURL: API_URL, withCredentials: true });

export const getStoredUser = (): SessionUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
};

export const startSession = (data: SessionResponse): SessionUser => {
  accessToken = data.token;
  const user = { id: data._id, name: data.name, roles: data.roles };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem('mcc_token'); // from older versions that stored the JWT
  window.dispatchEvent(new Event('mcc-session'));
  return user;
};

export const clearSession = () => {
  accessToken = null;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('mcc_token');
  window.dispatchEvent(new Event('mcc-session'));
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    clearSession();
  }
};

// One refresh at a time, shared by every request that hit a 401
let refreshing: Promise<string | null> | null = null;
const refreshAccessToken = () => {
  refreshing ??= axios
    .post<SessionResponse>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
    .then((res) => startSession(res.data) && res.data.token)
    .catch(() => {
      clearSession();
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

api.interceptors.request.use(async (config) => {
  // After a page load the token is gone: restore it before the request rather
  // than letting it fail with a 401 first
  if (!accessToken && getStoredUser() && !config.url?.startsWith('/auth/')) {
    await refreshAccessToken();
  }
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export const errorMessage = (err: unknown, fallback = 'Something went wrong') =>
  (err as AxiosError<{ message?: string }>)?.response?.data?.message || fallback;

export default api;
