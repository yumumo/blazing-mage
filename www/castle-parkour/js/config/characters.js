/**
 * Character registry — add a playable character here.
 *
 * Steps for a new id (example: archer):
 * 1. Add name + portrait + run/roll/jump/atk **sheets** below（运动帧只认 sheet）
 * 2. Drop PNGs into assets/ and refresh sprite-manifest.json
 * 3. Wire unlock/shop UI in game.js if needed
 *
 * 帧数只允许 **4 / 9 / 16**（只补不减）。
 * 散帧调试产物在 `dev/art-raw/singles/`，不进局内加载。
 */
export const ASSET_VER = '20260821mv';

export const CHAR_NAMES = { mage: '法师', warrior: '战士' };

export const PORTRAIT_ASSETS = {
  mage: { src: 'assets/characters/mage/mage-portrait.png', img: null, ready: false },
  warrior: { src: 'assets/characters/warrior/warrior-portrait.png', img: null, ready: false },
};

/**
 * Optional loose frames for mods via `registerCharacter({ frames })`.
 * Built-in roles leave this empty — runtime draws from sheets only.
 */
export const CHAR_SPRITES = {
  mage: {},
  warrior: {},
};

/**
 * 跑步真源：`*-run-sheet.png` **3×3 / 9 帧**（原 8 补 1）。
 * runFootLocalX：脚锚（格内 x）。runLockW：仅兜底无 content 盒时用；有 manifest 时绘制走整格 content，禁止再按 lockW 裁杖尖。
 */
export const CHAR_RUN_SHEETS = {
  mage: {
    src: 'assets/characters/mage/mage-run-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 3, rows: 3, frameCount: 9, runFootLocalX: 256, runLockW: 300,
  },
  warrior: {
    src: 'assets/characters/warrior/warrior-run-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 3, rows: 3, frameCount: 9, runFootLocalX: 256, runLockW: 310,
  },
};

/** 翻滚真源：`*-roll-sheet.png` **3×3 / 9 帧**（首尾跑步尺跳过，播中间 7）。 */
export const CHAR_ROLL_SHEETS = {
  mage: {
    src: 'assets/characters/mage/mage-roll-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 3, rows: 3, frameCount: 9, bookends: true,
  },
  warrior: {
    src: 'assets/characters/warrior/warrior-roll-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 3, rows: 3, frameCount: 9, bookends: true,
  },
};

/**
 * 跳跃真源：`*-jump-sheet.png` **3×3 / 9 帧**（首尾跑步尺 + 7 动作）。
 * 格序：run | ant | jump | rise | peak | fall | recover | land | run
 * 无水平巡航飞姿；起飞道具 / 高空巡航见 CHAR_FLY_SHEETS。
 */
export const CHAR_JUMP_SHEETS = {
  mage: {
    src: 'assets/characters/mage/mage-jump-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 3, rows: 3, frameCount: 9, bookends: true,
    roles: ['jumpAnt', 'jump', 'jumpRise', 'jumpPeak', 'jumpFall', 'jumpRecover', 'jumpLand'],
  },
  warrior: {
    src: 'assets/characters/warrior/warrior-jump-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 3, rows: 3, frameCount: 9, bookends: true,
    roles: ['jumpAnt', 'jump', 'jumpRise', 'jumpPeak', 'jumpFall', 'jumpRecover', 'jumpLand'],
  },
};

/**
 * 飞行真源：`*-fly-sheet.png` **2×2 / 4 帧**（首尾跑步尺 + 巡航/落势）。
 * 格序：run | fly | flyFall | run — skySprint / 起飞道具用。
 */
export const CHAR_FLY_SHEETS = {
  mage: {
    src: 'assets/characters/mage/mage-fly-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 2, rows: 2, frameCount: 4, bookends: true,
    roles: ['fly', 'flyFall'],
  },
  warrior: {
    src: 'assets/characters/warrior/warrior-fly-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 2, rows: 2, frameCount: 4, bookends: true,
    roles: ['fly', 'flyFall'],
  },
};

/**
 * 攻击真源：`*-atk-sheet.png`（首尾跑步尺 + 中间招式）。
 * 法师/战士均可 **3×3 / 9**（贴地跑步攻击，中间换迈步相）。
 * 法师：杖刺；战士：从上往下挥砍（overhead）。格序含 follow/recover，由 peak 过渡回 run。
 *   run | wind | start | rise | atk | peak | follow | recover | run
 */
export const CHAR_ATK_SHEETS = {
  mage: {
    src: 'assets/characters/mage/mage-atk-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 3, rows: 3, frameCount: 9, bookends: true,
    roles: [
      'atkWind', 'atkStart', 'atkRise', 'atk', 'atkPeak', 'atkFollow', 'atkRecover',
    ],
  },
  warrior: {
    src: 'assets/characters/warrior/warrior-atk-sheet.png', img: null, ready: false, frames: null,
    refH: 296, cols: 3, rows: 3, frameCount: 9, bookends: true,
    roles: [
      'atkWind', 'atkStart', 'atkRise', 'atk', 'atkPeak', 'atkFollow', 'atkRecover',
    ],
  },
};

const DEFAULT_REF_H = 296;

/** Optional runtime registration for mods / future hooks */
export function registerCharacter(id, def) {
  if (!id || typeof id !== 'string') throw new Error('registerCharacter: id required');
  if (CHAR_NAMES[id]) throw new Error(`registerCharacter: duplicate id ${id}`);
  if (!def?.runSheet?.src || !def?.rollSheet?.src) {
    throw new Error('registerCharacter: runSheet.src and rollSheet.src required');
  }
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
    refH: def.runSheet.refH ?? DEFAULT_REF_H,
    cols: def.runSheet.cols ?? 3,
    rows: def.runSheet.rows ?? 3,
    frameCount: def.runSheet.frameCount ?? 9,
    runFootLocalX: def.runSheet.runFootLocalX,
    runLockW: def.runSheet.runLockW,
  };
  CHAR_ROLL_SHEETS[id] = {
    src: def.rollSheet.src,
    img: null,
    ready: false,
    frames: null,
    refH: def.rollSheet.refH ?? DEFAULT_REF_H,
    cols: def.rollSheet.cols ?? 3,
    rows: def.rollSheet.rows ?? 3,
    frameCount: def.rollSheet.frameCount ?? 9,
    bookends: def.rollSheet.bookends !== false,
  };
  if (def.jumpSheet) {
    CHAR_JUMP_SHEETS[id] = {
      src: def.jumpSheet.src,
      img: null,
      ready: false,
      frames: null,
      refH: def.jumpSheet.refH ?? DEFAULT_REF_H,
      cols: def.jumpSheet.cols ?? 3,
      rows: def.jumpSheet.rows ?? 3,
      frameCount: def.jumpSheet.frameCount ?? 9,
      bookends: def.jumpSheet.bookends !== false,
      roles: def.jumpSheet.roles || [
        'jumpAnt', 'jump', 'jumpRise', 'jumpPeak', 'jumpFall', 'jumpRecover', 'jumpLand',
      ],
    };
  }
  if (def.flySheet) {
    CHAR_FLY_SHEETS[id] = {
      src: def.flySheet.src,
      img: null,
      ready: false,
      frames: null,
      refH: def.flySheet.refH ?? DEFAULT_REF_H,
      cols: def.flySheet.cols ?? 2,
      rows: def.flySheet.rows ?? 2,
      frameCount: def.flySheet.frameCount ?? 4,
      bookends: def.flySheet.bookends !== false,
      roles: def.flySheet.roles || ['fly', 'flyFall'],
    };
  }
  if (def.atkSheet) {
    CHAR_ATK_SHEETS[id] = {
      src: def.atkSheet.src,
      img: null,
      ready: false,
      frames: null,
      refH: def.atkSheet.refH ?? DEFAULT_REF_H,
      cols: def.atkSheet.cols ?? 2,
      rows: def.atkSheet.rows ?? 2,
      frameCount: def.atkSheet.frameCount ?? 4,
      bookends: def.atkSheet.bookends !== false,
      roles: def.atkSheet.roles || ['atkWind', 'atk'],
    };
  }
  return id;
}

export function listCharacterIds() {
  return Object.keys(CHAR_NAMES);
}
