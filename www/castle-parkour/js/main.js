/** App entry (ES module). Waits for auto cache-bust boot. */
const boot = window.__CP_BOOT || Promise.resolve();
await boot;
await import('./game.js');
