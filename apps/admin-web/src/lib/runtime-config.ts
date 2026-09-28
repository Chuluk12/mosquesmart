declare global {
  interface Window {
    __MOSQUE_CONFIG__?: { apiUrl?: string; socketUrl?: string };
  }
}

export const runtimeConfig = window.__MOSQUE_CONFIG__ ?? {};
