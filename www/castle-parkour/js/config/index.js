/** Config barrel — import from here in game code. */
export {
  ASSET_VER,
  CHAR_NAMES,
  PORTRAIT_ASSETS,
  CHAR_SPRITES,
  CHAR_RUN_SHEETS,
  CHAR_ROLL_SHEETS,
  CHAR_JUMP_SHEETS,
  CHAR_ATK_SHEETS,
  registerCharacter,
  listCharacterIds,
} from './characters.js';

export { WORLD_ASSETS, registerWorldAsset } from './world.js';

export {
  MONSTERS,
  monsterName,
  listMonsterIds,
  registerMonster,
} from './monsters.js';

export * from './gameplay.js';
