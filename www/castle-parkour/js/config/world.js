/**
 * World / prop sprite registry — obstacles, pickups, VFX.
 * 敌对生物中文名 / 立绘 / 运动帧真源：./monsters.js（WORLD_ASSETS 仍为加载与绘制句柄）。
 */
export const WORLD_ASSETS = {
  coin: { src: 'assets/coin.png', img: null, ready: false },
  fireball: { src: 'assets/fireball.png', img: null, ready: false },
  /** 蝙蝠立绘 — MONSTERS.bat.portrait */
  bat: { src: 'assets/bat.png', img: null, ready: false },
  /** 蝙蝠运动 — MONSTERS.bat.motion */
  batSheet: {
    src: 'assets/bat-sheet.png', img: null, ready: false, frames: null, refH: 435, cols: 2, rows: 2,
  },
  /** 魔眼立绘 — MONSTERS.flyer.portrait */
  flyer: { src: 'assets/flyer.png', img: null, ready: false },
  /** 魔眼运动 — MONSTERS.flyer.motion */
  flyerSheet: {
    src: 'assets/flyer-sheet.png', img: null, ready: false, frames: null, refH: 250, cols: 2, rows: 2,
  },
  /** 蓝团立绘（单帧兜底）— MONSTERS.blob.portrait */
  monster: { src: 'assets/monster.png', img: null, ready: false },
  /** 巨人立绘 — MONSTERS.giant.portrait */
  monsterBig: { src: 'assets/monster-big.png', img: null, ready: false },
  /** 巨人运动 — MONSTERS.giant.motion */
  giantSheet: {
    src: 'assets/giant-sheet.png', img: null, ready: false, frames: null, refH: 406, cols: 2, rows: 2,
  },
  spike: { src: 'assets/spike.png', img: null, ready: false },
  portal: { src: 'assets/portal.png', img: null, ready: false },
  puMagnet: { src: 'assets/pu-magnet.png', img: null, ready: false },
  puDouble: { src: 'assets/pu-double.png', img: null, ready: false },
  puAttack: { src: 'assets/pu-attack.png', img: null, ready: false },
  puFly: { src: 'assets/pu-fly.png', img: null, ready: false },
  torch: { src: 'assets/torch.png', img: null, ready: false },
  firePillar: { src: 'assets/fire-pillar.png', img: null, ready: false },
  beam: { src: 'assets/beam.png', img: null, ready: false },
  platform: { src: 'assets/platform.png', img: null, ready: false },
  bonusBg: { src: 'assets/bonus-bg.png', img: null, ready: false },
  /** 蓝团运动帧 — MONSTERS.blob.motion */
  monsterWalk: {
    src: 'assets/monster-idle-sheet.png',
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
