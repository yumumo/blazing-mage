(() => {
  const detectMobileUi = () => {
    if (navigator.userAgentData?.mobile === true) return true;
    if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)) return true;
    const narrowTouch = navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) <= 820;
    const coarseSmall = window.matchMedia?.('(pointer: coarse)')?.matches && Math.min(screen.width, screen.height) <= 820;
    return Boolean(narrowTouch || coarseSmall);
  };
  const mobileUi = detectMobileUi();
  window.__DEMO_DETECT_MOBILE_UI = detectMobileUi;
  window.__DEMO_MOBILE_UI = mobileUi;
  document.documentElement.classList.add(mobileUi ? 'mobile-ui' : 'desktop-ui');
  document.documentElement.classList.add('assets-pending');
})();
