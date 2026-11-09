import { runtimeConfig } from './runtime-config';

function normalizeApiBase(value: string | undefined): string {
  const configured = (value || '').trim().replace(/\/+$/, '');
  if (!configured) return '/api';
  return configured.endsWith('/api') ? configured : `${configured}/api`;
}

const API_BASE = normalizeApiBase(runtimeConfig.apiUrl);

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export { API_BASE };
