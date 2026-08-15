/**
 * Gameplay tunables — extend here before digging into game.js.
 * Canvas size must match <canvas id="game"> in index.html.
 */
export const VIEW = Object.freeze({ W: 800, H: 500 });

export const U = 40;
export const GROUND = 420;
export const CHAR_X = 120;
export const CHAR_W = 30;
export const CHAR_H_STAND = 2 * U;
export const CHAR_H_DUCK = 1 * U;

export const JUMP_H = 2.6 * U;
export const GRAV = 2000;
export const JUMP_V = Math.sqrt(2 * GRAV * JUMP_H);
export const DOUBLE_JUMP_H = 2.0 * U;
export const DOUBLE_JUMP_V = Math.sqrt(2 * GRAV * DOUBLE_JUMP_H);

export const WALL_H = 1.5 * U;
export const BEAM_BOTTOM = GROUND - 1.5 * U;

export const ATTACK_CD = 0.28;
export const WARRIOR_ATTACK_CD = 0.3;
export const SWORD_SLASH_DUR = 0.22;
export const MAGE_ATK_DUR = 0.38;
export const MAGE_ATK_FIRE_AT = 0.14;
export const FB_SPEED = 700;
export const FB_R = 7;
export const SWORD_BASE_RANGE = 118;
export const MAX_BULLETS = 6;

export const ORBIT_COUNT = 3;
export const ORBIT_R = 42;
export const ORBIT_SHOOT_CD = 0.36;
export const ORBIT_SEEK_RANGE = 280;

export const BAT_W = 42;
export const BAT_H = 32;
export const BAT_EXTRA_VX = 75;
/** 相对角色的额外追击速度（向左飞向 CHAR_X） */
export const BAT_CHASE_VX = 55;
/** 蝙蝠固定第二层高度（画布 Y：二级台顶上方 24px） */
export const BAT_Y = GROUND - 2 * U - 24;

export const ROLL_DUR = 0.55;
export const ROLL_SPEED_BOOST = 200;
export const ROLL_CD = 0.12;
/** 翻滚碰撞相对当前帧显示尺寸的比例（略小于贴图，忽略尾气外扩） */
export const ROLL_HIT_FROM_DRAW = 0.9;
export const FAST_FALL_V = 1200;

export const COIN_R = 14;
export const COIN_VALUE = 5;
export const COIN_DRAW_H = 28;
/** 磁铁吸引：每帧按剩余距离比例追赶（越大越快），另加最低速度 */
export const MAGNET_CATCH_RATE = 28;
export const MAGNET_CATCH_RATE_FLY = 36;
export const MAGNET_PULL_MIN = 1600;
export const MAGNET_PULL_MIN_FLY = 2400;
/** 磁铁吸引半径（普通 / 起飞统一） */
export const MAGNET_PULL_R = 500;

export const PX_PER_METER = 26;
export const KILL_GOLD = 10;
export const METER_PER_GOLD = 5;

export const GAP_W_MIN = 62;
export const GAP_W_MAX = 92;
export const GAP_COOLDOWN = 5;
export const OBSTACLE_MARGIN = 70;
export const POST_GAP_SAFE = 280;
export const GAP_DEPTH = 160;
export const GAP_W_LATE_MIN = 110;
export const GAP_W_LATE_MAX = 150;

export const LAYER_H = U;
export const LAYER2_TOP = 2 * LAYER_H;
/** 二级台脚底离地高（与 LAYER2_TOP 同） */
export const PLATFORM_H = 80;
/** 三级台脚底离地高 = 二级再叠一层（与二级→地面同高差） */
export const PLATFORM_H3 = PLATFORM_H * 2;
/** 二级台长：局内宽一半（VIEW.W=800） */
export const PLATFORM_W_HALF = 400;
/** 二级台长 / 三级台长：局内宽三分之一 */
export const PLATFORM_W_THIRD = 267;
/** 半长二级台末六分之一，三级台叠在这段起点上 */
export const PLATFORM_L2_TAIL = 67;
/**
 * 高台「结构」之间的世界间距（避免同屏两座粘连；也不要隔太久才出一座）。
 * 屏宽 VIEW.W=800。
 */
export const ELEV_STRUCT_MIN_GAP = VIEW.W + 40;
export const ELEV_STRUCT_SOFT_GAP = VIEW.W + 200;
/** 高台怪：最高台终点(x1) 右偏 / 相对台面抬高（真源 gameplay.js） */
export const PLAT_MONSTER_DX = 80;
export const PLAT_MONSTER_ABOVE = 100;

export const SPIKE_H = 0.75 * U;
export const SPIKE_W = 52;

export const FLYER_BASE_Y = GROUND - LAYER2_TOP - 0.35 * U;
export const FLYER_W = 36;
export const FLYER_H = 28;
export const FLYER_AMP = 25;

/** 旋涡约占局内高度 60%；角色靠近自动吸入 */
export const PORTAL_DRAW_H = Math.round(VIEW.H * 0.6);
export const PORTAL_HIT_R = Math.round(PORTAL_DRAW_H * 0.42);
export const PORTAL_SUCK_DUR = 0.55;
/** 角色中心进入旋涡水平范围即触发吸入 */
export const PORTAL_SUCK_X = Math.round(PORTAL_DRAW_H * 0.28);

export const SKY_SPRINT_DUR = 3.0;
export const SKY_SPRINT_FADE = 0.5;
export const SKY_SPRINT_H = 320;
export const SKY_SPRINT_SPEED_MAX = 2800;

export const ENERGY_MAX = 100;
export const ENERGY_COST = 25;
export const ENERGY_REGEN = 30;

export const TUTORIAL_END = 420;
export const TUTORIAL_LEAD_PX = 240;

/** UI / canvas type */
export const CASTLE_FONT = '"Noto Sans SC","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
