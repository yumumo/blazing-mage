/**
 * Character registry — add a playable character here.
 *
 * Steps for a new id (example: archer):
 * 1. Add name + portrait / action frames / run+roll sheets below
 * 2. Drop PNGs into assets/ and refresh sprite-manifest.json
 * 3. Wire unlock/shop UI in game.js if needed
 */
export const ASSET_VER = '20260816z';

export const CHAR_NAMES = { mage: '法师', warrior: '战士' };

export const PORTRAIT_ASSETS = {
  mage: { src: 'assets/mage-portrait.png', img: null, ready: false },
  warrior: { src: 'assets/warrior-portrait.png', img: null, ready: false },
};

/** In-run poses: jump-ant → jump → fly → land; atk-wind → atk（两角色招式可不同） */
export const CHAR_SPRITES = {
  mage: {
    jumpAnt: { src: 'assets/mage-jump-ant.png', img: null, ready: false },
    jump: { src: 'assets/mage-jump.png', img: null, ready: false },
    fly: { src: 'assets/mage-fly.png', img: null, ready: false },
    jumpLand: { src: 'assets/mage-jump-land.png', img: null, ready: false },
    atkWind: { src: 'assets/mage-atk-wind.png', img: null, ready: false },
    atk: { src: 'assets/mage-atk.png', img: null, ready: false },
  },
  warrior: {
    jumpAnt: { src: 'assets/warrior-jump-ant.png', img: null, ready: false },
    jump: { src: 'assets/warrior-jump.png', img: null, ready: false },
    fly: { src: 'assets/warrior-fly.png', img: null, ready: false },
    jumpLand: { src: 'assets/warrior-jump-land.png', img: null, ready: false },
    atkWind: { src: 'assets/warrior-atk-wind.png', img: null, ready: false },
    atk: { src: 'assets/warrior-atk.png', img: null, ready: false },
  },
};

/**
 * 局内跑步真源：仅 *-run-sheet.png（1×N，512×768 格）。
 * runFootLocalX / runLockW 由 manifest content 预计算，运行时禁止 getImageData。
 */
export const CHAR_RUN_SHEETS = {
  mage: {
    src: 'assets/mage-run-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 8, rows: 1, runFootLocalX: 256, runLockW: 205,
  },
  warrior: {
    src: 'assets/warrior-run-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 8, rows: 1, runFootLocalX: 256, runLockW: 239,
  },
};

/** 局内翻滚真源：*-roll-sheet.png（首尾为跑步尺，播放跳过） */
export const CHAR_ROLL_SHEETS = {
  mage: { src: 'assets/mage-roll-sheet.png', img: null, ready: false, frames: null, refH: 296, cols: 11, rows: 1 },
  warrior: { src: 'assets/warrior-roll-sheet.png', img: null, ready: false, frames: null, refH: 296, cols: 11, rows: 1 },
};

/** Optional runtime registration for mods / future hooks */
export function registerCharacter(id, def) {
  if (!id || typeof id !== 'string') throw new Error('registerCharacter: id required');
  if (CHAR_NAMES[id]) throw new Error(`registerCharacter: duplicate id ${id}`);
  CHAR_NAMES[id] = def.name || id;
  PORTRAIT_ASSETS[id] = { src: def.portrait, img: null, ready: false };
  CHAR_SPRITES[id] = Object.fromEntries(
    Object.entries(def.frames || {}).map(([k, src]) => [k, { src, img: null, ready: false }]),
  );
  CHAR_RUN_SHEETS[id] = {
    src: def.runSheet.src,
    img: null,
    ready: false,
    frames: null,
    refH: def.runSheet.refH ?? 280,
    cols: def.runSheet.cols ?? 3,
    rows: def.runSheet.rows ?? 3,
  };
  CHAR_ROLL_SHEETS[id] = {
    src: def.rollSheet.src,
    img: null,
    ready: false,
    frames: null,
    refH: def.rollSheet.refH ?? 260,
    cols: def.rollSheet.cols ?? 3,
    rows: def.rollSheet.rows ?? 1,
  };
  return id;
}

export function listCharacterIds() {
  return Object.keys(CHAR_NAMES);
}
