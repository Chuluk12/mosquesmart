import { runtimeConfig } from './runtime-config';

const API_BASE = runtimeConfig.apiUrl || '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('accessToken', token);
  else localStorage.removeItem('accessToken');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as any) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    // Network failure (backend down/unreachable) must produce a clear,
    // catchable error instead of an unhandled rejection that blanks the UI.
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi atau status backend.');
  }

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event('auth:expired'));
    if (!location.pathname.startsWith('/login') && location.pathname !== '/audio-schedule-public' && location.pathname !== '/quote-playlists-public') location.href = '/login';
    throw new ApiError(401, 'Sesi berakhir, silakan login kembali.');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(res.status, (body && (body.message || body.error)) || `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }),
  baseUrl: API_BASE,
};
