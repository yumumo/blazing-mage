(() => {
  const BUILD_KEY = 'cp-build-id';
  const RELOAD_KEY = 'cp-build-reloading';

  const detectMobileUi = () => {
    if (navigator.userAgentData?.mobile === true) return true;
    if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)) return true;
    const narrowTouch = navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) <= 820;
    const coarseSmall = window.matchMedia?.('(pointer: coarse)')?.matches && Math.min(screen.width, screen.height) <= 820;
    return Boolean(narrowTouch || coarseSmall);
  };

  const setupUi = () => {
    const mobileUi = detectMobileUi();
    window.__DEMO_DETECT_MOBILE_UI = detectMobileUi;
    window.__DEMO_MOBILE_UI = mobileUi;
    document.documentElement.classList.add(mobileUi ? 'mobile-ui' : 'desktop-ui');
    document.documentElement.classList.add('assets-pending');
  };

  const clearSiteCaches = async () => {
    try {
      if (typeof caches !== 'undefined' && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) { /* ignore */ }
    try {
      if (navigator.serviceWorker?.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (_) { /* ignore */ }
  };

  const hardReload = async (buildId) => {
    // 防止死循环：同一次更新只强刷一次
    if (sessionStorage.getItem(RELOAD_KEY) === buildId) {
      localStorage.setItem(BUILD_KEY, buildId);
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, buildId);
    localStorage.setItem(BUILD_KEY, buildId);
    await clearSiteCaches();
    const url = new URL(location.href);
    url.searchParams.set('_v', buildId);
    location.replace(url.pathname + url.search + url.hash);
    return true;
  };

  window.__CP_BOOT = (async () => {
    setupUi();
    let buildId = '';
    try {
      const res = await fetch('build-id.txt?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) buildId = String(await res.text()).trim();
    } catch (_) { /* offline / file:// */ }
    if (!buildId) return;
    window.__CP_BUILD = buildId;
    const prev = localStorage.getItem(BUILD_KEY);
    if (prev && prev !== buildId) {
      const reloading = await hardReload(buildId);
      if (reloading) {
        // 挂起后续模块，等页面被替换
        await new Promise(() => {});
      }
      return;
    }
    localStorage.setItem(BUILD_KEY, buildId);
    sessionStorage.removeItem(RELOAD_KEY);
  })();
})();
