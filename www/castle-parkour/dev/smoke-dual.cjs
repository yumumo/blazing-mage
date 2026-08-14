const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'smoke-out');
fs.mkdirSync(OUT, { recursive: true });

async function probe(label, contextOptions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console:' + msg.text());
  });
  await page.goto('http://localhost:5173/?_smoke=' + Date.now(), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page
    .waitForFunction(() => {
      const html = document.documentElement;
      return html.classList.contains('assets-ready') || !html.classList.contains('assets-pending');
    }, null, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  const state = await page.evaluate(() => {
    const html = document.documentElement;
    const wrap = document.querySelector('.wrap');
    const boot = document.getElementById('boot-loading');
    const pct = document.getElementById('boot-pct')?.textContent || '';
    const start = document.getElementById('menu-start');
    const controls = document.querySelector('.controls');
    const cs = controls ? getComputedStyle(controls) : null;
    return {
      classes: [...html.classList],
      build: window.__CP_BUILD || null,
      mobileFlag: !!window.__DEMO_MOBILE_UI,
      wrapVis: wrap ? getComputedStyle(wrap).visibility : null,
      bootDisplay: boot ? getComputedStyle(boot).display : null,
      pct,
      startDisabled: start ? !!start.disabled : null,
      controlsDisplay: cs ? cs.display : null,
      render:
        typeof window.render_game_to_text === 'function'
          ? JSON.parse(window.render_game_to_text())
          : null,
    };
  });
  const shot = path.join(OUT, label + '.png');
  await page.screenshot({ path: shot, fullPage: true });
  await browser.close();
  return { label, state, errors, shot };
}

(async () => {
  const desktop = await probe('desktop', { viewport: { width: 1280, height: 800 } });
  const mobile = await probe('mobile', { ...devices['iPhone 13'] });
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
  const deskOk =
    desktop.state.wrapVis === 'visible' &&
    !desktop.state.classes.includes('assets-pending') &&
    desktop.state.classes.includes('desktop-ui') &&
    desktop.state.controlsDisplay === 'none' &&
    desktop.state.startDisabled === false;
  const mobOk =
    mobile.state.wrapVis === 'visible' &&
    !mobile.state.classes.includes('assets-pending') &&
    mobile.state.classes.includes('mobile-ui') &&
    mobile.state.controlsDisplay === 'flex' &&
    mobile.state.startDisabled === false;
  if (!deskOk || !mobOk) {
    console.error('ASSERT_FAIL', { deskOk, mobOk });
    process.exit(2);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
