(() => {
  const BUILD_KEY = 'cp-build-id';
  const RELOAD_KEY = 'cp-build-reloading';
  /** 与 build-id.txt / ASSET_VER 同步 */
  const EMBEDDED_BUILD = '20260819t';

  const detectMobileUi = () => {
    if (navigator.userAgentData?.mobile === true) return true;
    if (navigator.userAgentData?.mobile === false) return false;
    if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)) return true;
    const narrow =
      window.matchMedia?.('(max-width: 820px)')?.matches ??
      window.innerWidth <= 820;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    return Boolean(narrow && (coarse || navigator.maxTouchPoints > 0));
  };

  /** 去掉地址栏里的 _v（旧破缓存参数），不刷新页面 */
  const stripVersionQuery = () => {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has('_v')) return;
      url.searchParams.delete('_v');
      const q = url.searchParams.toString();
      history.replaceState(null, '', url.pathname + (q ? `?${q}` : '') + url.hash);
    } catch (_) { /* ignore */ }
  };

  const setupUi = () => {
    const mobileUi = detectMobileUi();
    window.__DEMO_DETECT_MOBILE_UI = detectMobileUi;
    window.__DEMO_MOBILE_UI = mobileUi;
    window.__CP_BUILD = EMBEDDED_BUILD;
    document.documentElement.classList.add(mobileUi ? 'mobile-ui' : 'desktop-ui');
    document.documentElement.classList.add('assets-pending');
  };

  const clearSiteCaches = async () => {
    try {
      if (navigator.serviceWorker?.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (_) { /* ignore */ }
    try {
      if (window.caches?.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) { /* ignore */ }
  };

  const hardReload = async (buildId) => {
    if (sessionStorage.getItem(RELOAD_KEY) === buildId) {
      localStorage.setItem(BUILD_KEY, buildId);
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, buildId);
    localStorage.setItem(BUILD_KEY, buildId);
    await clearSiteCaches();
    // 清缓存后直接回干净地址，不再把版本号写进 URL
    const url = new URL(location.href);
    url.searchParams.delete('_v');
    const q = url.searchParams.toString();
    location.replace(url.pathname + (q ? `?${q}` : '') + url.hash);
    return true;
  };

  setupUi();
  stripVersionQuery();
  window.__CP_BOOT = Promise.resolve();
  window.__CP_ASSET_BASE = '';

  const stored = localStorage.getItem(BUILD_KEY);
  if (!stored) localStorage.setItem(BUILD_KEY, EMBEDDED_BUILD);

  const known = localStorage.getItem(BUILD_KEY) || EMBEDDED_BUILD;
  const suspectUpdate = known !== EMBEDDED_BUILD;
  fetch('build-id.txt', {
    cache: suspectUpdate ? 'no-store' : 'no-cache',
  })
    .then(async (res) => {
      if (!res.ok) return;
      const buildId = String(await res.text()).trim();
      if (!buildId) return;
      window.__CP_BUILD = buildId;
      const prev = localStorage.getItem(BUILD_KEY);
      if (prev && prev !== buildId) {
        await hardReload(buildId);
        return;
      }
      localStorage.setItem(BUILD_KEY, buildId);
      sessionStorage.removeItem(RELOAD_KEY);
    })
    .catch(() => { /* offline */ });
})();
