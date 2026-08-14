/** 等国内镜像探针结束再进游戏；本地几乎立刻 */
const boot = window.__CP_BOOT || Promise.resolve();
boot.finally(() => {
  import('./game.js').catch((err) => {
    console.error('[castle-parkour] failed to load game.js', err);
  });
});
