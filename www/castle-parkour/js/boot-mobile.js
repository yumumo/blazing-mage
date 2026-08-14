(() => {
  const BUILD_KEY = 'cp-build-id';
  const RELOAD_KEY = 'cp-build-reloading';
  /** 与 build-id.txt / ASSET_VER 同步；本地嵌入，避免首屏卡在探针 */
  const EMBEDDED_BUILD = '20260816w';

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

  /** 仅在确认有新版本时调用；无更新绝不清缓存 */
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
    // 同一次会话已为该版本刷过 → 不再二次强刷
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

  setupUi();
  window.__CP_BOOT = Promise.resolve();

  const stored = localStorage.getItem(BUILD_KEY);
  if (!stored) localStorage.setItem(BUILD_KEY, EMBEDDED_BUILD);

  // 无更新：不强制绕过缓存。探针用 no-cache（可 304），勿 Date.now() 打爆缓存。
  // 仅当本地已知版本与嵌入不一致时（刚发版、HTML 已新）才用 no-store 确认远端。
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
      // 只有远端版本真的变了才清缓存 + 硬刷新
      if (prev && prev !== buildId) {
        await hardReload(buildId);
        return;
      }
      localStorage.setItem(BUILD_KEY, buildId);
      sessionStorage.removeItem(RELOAD_KEY);
    })
    .catch(() => { /* offline：沿用本地缓存即可 */ });
})();
