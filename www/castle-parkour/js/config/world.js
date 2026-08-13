/**
 * World / prop sprite registry — obstacles, pickups, VFX.
 * Add a key + PNG path; draw sites already go through WORLD_ASSETS.*.
 */
export const WORLD_ASSETS = {
  coin: { src: 'assets/coin.png', img: null, ready: false },
  fireball: { src: 'assets/fireball.png', img: null, ready: false },
  bat: { src: 'assets/bat.png', img: null, ready: false },
  flyer: { src: 'assets/flyer.png', img: null, ready: false },
  monster: { src: 'assets/monster.png', img: null, ready: false },
  monsterBig: { src: 'assets/monster-big.png', img: null, ready: false },
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
};

export function registerWorldAsset(key, src) {
  if (!key) throw new Error('registerWorldAsset: key required');
  if (WORLD_ASSETS[key]) throw new Error(`registerWorldAsset: duplicate key ${key}`);
  WORLD_ASSETS[key] = { src, img: null, ready: false };
  return key;
}
