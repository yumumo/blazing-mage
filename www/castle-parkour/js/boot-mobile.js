(() => {
  const BUILD_KEY = 'cp-build-id';
  const RELOAD_KEY = 'cp-build-reloading';
  const MIRROR_KEY = 'cp-mirror-skip';
  const BASE_KEY = 'cp-asset-base';
  /** 与 build-id.txt / ASSET_VER 同步 */
  const EMBEDDED_BUILD = '20260816x';

  /**
   * 国内可达镜像（GitHub raw via jsDelivr 系）。
   * pages.dev / Cloudflare 在国内常需代理；本地 / AGT 同源不走镜像。
   * 发版后需 push 到 GitHub，镜像才有新资源。
   */
  const GH_ROOT = 'yumumo/castle-parkour@main/www/castle-parkour';
  const MIRRORS = [
    `https://cdn.jsdmirror.com/gh/${GH_ROOT}/`,
    `https://cdn.jsdelivr.net/gh/${GH_ROOT}/`,
    `https://fastly.jsdelivr.net/gh/${GH_ROOT}/`,
    `https://gcore.jsdelivr.net/gh/${GH_ROOT}/`,
  ];

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
    const url = new URL(location.href);
    url.searchParams.set('_v', buildId);
    location.replace(url.pathname + url.search + url.hash);
    return true;
  };

  const isLocalHost = () => {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.local');
  };

  /** Cloudflare Pages 等境外源：国内直连慢 */
  const isSlowOverseasHost = () => {
    const h = location.hostname;
    return (
      h.endsWith('.pages.dev') ||
      h.endsWith('.workers.dev') ||
      h.endsWith('.cloudflare.com') ||
      h.includes('cloudflare')
    );
  };

  const qs = new URLSearchParams(location.search);
  const forceOrigin = qs.get('mirror') === '0' || qs.get('cdn') === '0';
  const forceMirror = qs.get('mirror') === '1' || qs.get('cdn') === '1';

  const probeMs = (url, budget) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), budget);
    const t0 = performance.now();
    return fetch(url, { cache: 'no-cache', mode: 'cors', signal: ctrl.signal })
      .then((res) => {
        clearTimeout(timer);
        if (!res.ok) return Number.POSITIVE_INFINITY;
        return performance.now() - t0;
      })
      .catch(() => {
        clearTimeout(timer);
        return Number.POSITIVE_INFINITY;
      });
  };

  /**
   * 选最快资源根：本地/AGT 用同源 ''；pages.dev 竞速国内镜像。
   * 整站若同源极慢且镜像很快，则一次性跳到镜像站（HTML/JS 也加速）。
   */
  const resolveAssetBase = async () => {
    window.__CP_ASSET_BASE = '';
    if (forceOrigin || isLocalHost()) {
      try { localStorage.removeItem(BASE_KEY); } catch (_) { /* ignore */ }
      return '';
    }

    // 已在镜像站打开：资源同源即可
    if (/jsdelivr\.net|jsdmirror\.com/i.test(location.hostname)) {
      window.__CP_ASSET_BASE = '';
      return '';
    }

    if (!forceMirror && !isSlowOverseasHost()) {
      // 自建域名 / AGT 挂载：同源
      return '';
    }

    const budget = 1600;
    const originUrl = new URL('build-id.txt', location.href).href;
    const candidates = [
      { id: 'origin', base: '', url: originUrl },
      ...MIRRORS.map((base) => ({ id: base, base, url: base + 'build-id.txt' })),
    ];

    const results = await Promise.all(
      candidates.map(async (c) => ({ ...c, ms: await probeMs(c.url, budget) })),
    );
    results.sort((a, b) => a.ms - b.ms);
    const best = results.find((r) => Number.isFinite(r.ms)) || results[0];
    const origin = results.find((r) => r.id === 'origin');

    window.__CP_MIRROR_PROBE = results.map((r) => ({ id: r.id === 'origin' ? 'origin' : r.base, ms: r.ms }));

    // 同源可用且不太慢 → 不折腾
    if (
      !forceMirror &&
      origin &&
      Number.isFinite(origin.ms) &&
      origin.ms <= 1200 &&
      (!best.base || origin.ms <= best.ms * 1.35)
    ) {
      window.__CP_ASSET_BASE = '';
      return '';
    }

    if (!best?.base || !Number.isFinite(best.ms)) {
      window.__CP_ASSET_BASE = '';
      return '';
    }

    // 整站跳转：pages.dev 上 HTML/JS 本身也慢时，只靠换资源根不够
    const alreadyMirrored = /jsdelivr|jsdmirror/i.test(location.hostname);
    const skipRedirect = forceOrigin || sessionStorage.getItem(MIRROR_KEY) === '1' || alreadyMirrored;
    if (!skipRedirect && isSlowOverseasHost() && (forceMirror || (origin && origin.ms > 900))) {
      sessionStorage.setItem(MIRROR_KEY, '1');
      const dest = best.base + (location.search || '') + (location.hash || '');
      location.replace(dest);
      return best.base;
    }

    window.__CP_ASSET_BASE = best.base;
    try { localStorage.setItem(BASE_KEY, best.base); } catch (_) { /* ignore */ }
    return best.base;
  };

  setupUi();

  // 主模块等探针结束再加载（本地立即 resolve，最长约 1.6s）
  window.__CP_BOOT = resolveAssetBase().catch(() => {
    window.__CP_ASSET_BASE = '';
    return '';
  });

  const stored = localStorage.getItem(BUILD_KEY);
  if (!stored) localStorage.setItem(BUILD_KEY, EMBEDDED_BUILD);

  const known = localStorage.getItem(BUILD_KEY) || EMBEDDED_BUILD;
  const suspectUpdate = known !== EMBEDDED_BUILD;

  window.__CP_BOOT.then((assetBase) => {
    const buildUrl = (assetBase || '') + 'build-id.txt';
    return fetch(buildUrl, {
      cache: suspectUpdate ? 'no-store' : 'no-cache',
      mode: assetBase ? 'cors' : 'same-origin',
    });
  })
    .then(async (res) => {
      if (!res?.ok) return;
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
