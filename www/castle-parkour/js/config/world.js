/**
 * World / prop sprite registry — obstacles, pickups, VFX.
 * 敌对生物中文名 / 立绘 / 运动帧真源：./monsters.js（WORLD_ASSETS 仍为加载与绘制句柄）。
 */
export const WORLD_ASSETS = {
  coin: { src: 'assets/world/coin.png', img: null, ready: false },
  fireball: { src: 'assets/world/fireball.png', img: null, ready: false },
  /** 蝙蝠立绘 — MONSTERS.bat.portrait */
  bat: { src: 'assets/enemies/bat.png', img: null, ready: false },
  /** 蝙蝠运动 — MONSTERS.bat.motion */
  batSheet: {
    src: 'assets/enemies/bat-sheet.png', img: null, ready: false, frames: null, refH: 316, cols: 2, rows: 2,
  },
  /** 魔眼立绘 — MONSTERS.flyer.portrait */
  flyer: { src: 'assets/enemies/flyer.png', img: null, ready: false },
  /** 魔眼运动 — MONSTERS.flyer.motion */
  flyerSheet: {
    src: 'assets/enemies/flyer-sheet.png', img: null, ready: false, frames: null, refH: 264, cols: 2, rows: 2,
  },
  /** 蓝团立绘（单帧兜底）— MONSTERS.blob.portrait */
  monster: { src: 'assets/enemies/monster.png', img: null, ready: false },
  /** 巨人立绘 — MONSTERS.giant.portrait */
  monsterBig: { src: 'assets/enemies/monster-big.png', img: null, ready: false },
  /** 巨人运动 — MONSTERS.giant.motion */
  giantSheet: {
    src: 'assets/enemies/giant-sheet.png', img: null, ready: false, frames: null, refH: 406, cols: 2, rows: 2,
  },
  spike: { src: 'assets/world/spike.png', img: null, ready: false },
  portal: { src: 'assets/world/portal.png', img: null, ready: false },
  puMagnet: { src: 'assets/world/pu-magnet.png', img: null, ready: false },
  puDouble: { src: 'assets/world/pu-double.png', img: null, ready: false },
  puAttack: { src: 'assets/world/pu-attack.png', img: null, ready: false },
  puFly: { src: 'assets/world/pu-fly.png', img: null, ready: false },
  torch: { src: 'assets/world/torch.png', img: null, ready: false },
  firePillar: { src: 'assets/world/fire-pillar.png', img: null, ready: false },
  beam: { src: 'assets/world/beam.png', img: null, ready: false },
  platform: { src: 'assets/world/platform.png', img: null, ready: false },
  bonusBg: { src: 'assets/world/bonus-bg.png', img: null, ready: false },
  /** 蓝团运动帧 — MONSTERS.blob.motion */
  monsterWalk: {
    src: 'assets/enemies/monster-idle-sheet.png',
    img: null,
    ready: false,
    frames: null,
    refH: 280,
    cols: 2,
    rows: 2,
  },
};

export function registerWorldAsset(key, src) {
  if (!key) throw new Error('registerWorldAsset: key required');
  if (WORLD_ASSETS[key]) throw new Error(`registerWorldAsset: duplicate key ${key}`);
  WORLD_ASSETS[key] = { src, img: null, ready: false };
  return key;
}
