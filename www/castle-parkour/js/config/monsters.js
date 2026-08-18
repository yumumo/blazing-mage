/**
 * 敌对生物登记（显示名 + 立绘 + 运动帧）。
 * WORLD_ASSETS 为加载/绘制句柄；本表为真源命名与路径。
 */
export const MONSTERS = {
  bat: {
    id: 'bat',
    name: '蝙蝠',
    portrait: 'assets/enemies/bat.png',
    motion: { src: 'assets/enemies/bat-sheet.png', cols: 2, rows: 2, refH: 316 },
    worldKey: 'batSheet',
  },
  flyer: {
    id: 'flyer',
    name: '魔眼',
    portrait: 'assets/enemies/flyer.png',
    motion: { src: 'assets/enemies/flyer-sheet.png', cols: 2, rows: 2, refH: 264 },
    worldKey: 'flyerSheet',
  },
  giant: {
    id: 'giant',
    name: '巨人',
    portrait: 'assets/enemies/monster-big.png',
    motion: { src: 'assets/enemies/giant-sheet.png', cols: 2, rows: 2, refH: 406 },
    worldKey: 'giantSheet',
  },
  blob: {
    id: 'blob',
    name: '蓝团',
    portrait: 'assets/enemies/monster.png',
    motion: {
      src: 'assets/enemies/monster-idle-sheet.png',
      cols: 2,
      rows: 2,
      refH: 280,
    },
    worldKey: 'monsterWalk',
  },
};

export function monsterName(id) {
  return MONSTERS[id]?.name || id || '?';
}

export function listMonsterIds() {
  return Object.keys(MONSTERS);
}

export function registerMonster(id, def) {
  if (!id || typeof id !== 'string') throw new Error('registerMonster: id required');
  if (MONSTERS[id]) throw new Error(`registerMonster: duplicate id ${id}`);
  MONSTERS[id] = {
    id,
    name: def.name || id,
    portrait: def.portrait,
    motion: def.motion ?? null,
    worldKey: def.worldKey || null,
  };
  return id;
}
