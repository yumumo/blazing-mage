(() => {
  const BUILD_KEY = 'cp-build-id';
  const RELOAD_KEY = 'cp-build-reloading';
  /** 与 build-id.txt / ASSET_VER 同步；用于本地快路径，避免每次卡网络 */
  const EMBEDDED_BUILD = '20260816v';

  const detectMobileUi = () => {
    // Chrome/Edge on Windows 常有 maxTouchPoints>0；笔记本短边 768 也会 ≤820——勿用「屏幕短边」判手机
    if (navigator.userAgentData?.mobile === true) return true;
    if (navigator.userAgentData?.mobile === false) return false;
    if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)) return true;
    const narrow =
      window.matchMedia?.('(max-width: 820px)')?.matches ??
      window.innerWidth <= 820;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    return Boolean(narrow && (coarse || navigator.maxTouchPoints > 0));
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
    const url = new URL(location.href);
    url.searchParams.set('_v', buildId);
    location.replace(url.pathname + url.search + url.hash);
    return true;
  };

  // 不阻塞进游戏：UI 立刻好；版本探针后台跑
  setupUi();
  window.__CP_BOOT = Promise.resolve();

  const prev = localStorage.getItem(BUILD_KEY);
  if (!prev) localStorage.setItem(BUILD_KEY, EMBEDDED_BUILD);

  fetch('build-id.txt?t=' + Date.now(), { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return;
      const buildId = String(await res.text()).trim();
      if (!buildId) return;
      window.__CP_BUILD = buildId;
      const stored = localStorage.getItem(BUILD_KEY);
      if (stored && stored !== buildId) {
        await hardReload(buildId);
        return;
      }
      localStorage.setItem(BUILD_KEY, buildId);
      sessionStorage.removeItem(RELOAD_KEY);
    })
    .catch(() => { /* offline */ });
})();
