const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export { API_BASE };
