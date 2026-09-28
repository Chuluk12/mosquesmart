import { runtimeConfig } from './runtime-config';

const API_BASE = runtimeConfig.apiUrl || '/api';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export { API_BASE };
