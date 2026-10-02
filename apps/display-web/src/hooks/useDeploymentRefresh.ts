import { useEffect } from 'react';

const CURRENT_ENTRY = new URL(import.meta.url).pathname;
const CHECK_KEY = 'mosque-display-reloaded-entry';

export function useDeploymentRefresh(deferReload: boolean) {
  useEffect(() => {
    let checking = false;
    const checkForUpdate = async () => {
      if (checking || deferReload || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const response = await fetch(window.location.pathname + '?__version_check=' + Date.now(), {
          cache: 'no-store',
          headers: { Accept: 'text/html' },
        });
        if (!response.ok) return;
        const html = await response.text();
        const page = new DOMParser().parseFromString(html, 'text/html');
        const entry = Array.from(page.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))
          .map(script => new URL(script.src, window.location.origin))
          .find(url => url.origin === window.location.origin);
        if (!entry || entry.pathname === CURRENT_ENTRY) return;

        const marker = CURRENT_ENTRY + '->' + entry.pathname;
        if (sessionStorage.getItem(CHECK_KEY) === marker) return;
        sessionStorage.setItem(CHECK_KEY, marker);
        window.location.reload();
      } catch {
        // A brief network or hosting interruption should not affect the display.
      } finally {
        checking = false;
      }
    };

    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };
    const interval = window.setInterval(() => void checkForUpdate(), 60_000);
    window.addEventListener('focus', checkWhenVisible);
    document.addEventListener('visibilitychange', checkWhenVisible);
    void checkForUpdate();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkWhenVisible);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [deferReload]);
}
