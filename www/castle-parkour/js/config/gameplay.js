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
/**
 * 站立/跑/跳/攻身体碰撞（跨角色锁死）。
 * 绘制可含杖剑羽冠外扩；受击体积不跟贴图 bbox 漂移。
 */
export const BODY_HIT_W = CHAR_W;
export const BODY_HIT_H = CHAR_H_STAND;

export const JUMP_H = 2.6 * U;
export const GRAV = 2000;
export const JUMP_V = Math.sqrt(2 * GRAV * JUMP_H);
export const DOUBLE_JUMP_H = 2.0 * U;
export const DOUBLE_JUMP_V = Math.sqrt(2 * GRAV * DOUBLE_JUMP_H);

export const WALL_H = 1.5 * U;
export const BEAM_BOTTOM = GROUND - 1.5 * U;

export const ATTACK_CD = 0.28;
export const WARRIOR_ATTACK_CD = 0.3;
/**
 * 动作墙钟时长（秒）— 与 sheet 中间帧数无关。
 * 帧变多只加快扫帧；禁止用「帧数×单帧时长」拉长整段动作。
 * 当前中间帧：atk 7 / jump 7 / roll 7 / fly 2。
 */
export const SWORD_SLASH_DUR = 0.22;
/**
 * 战士下劈中间格进度累计 ends（0→1），与 CHAR_ATK_SHEETS.warrior.roles 一一对应。
 * 墙钟仍是 SWORD_SLASH_DUR；只改各格占比：快蓄力 → 出手/命中可读 → 收招略长防抽回。
 * [wind, start, rise, atk, peak, follow, recover]
 */
export const WARRIOR_ATK_ROLE_ENDS = Object.freeze([
  0.08, 0.16, 0.28, 0.42, 0.56, 0.74, 1,
]);
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
/** 落地姿态墙钟（秒）；着地→起身扫 jumpLand/jumpRecover，总时长固定 */
export const LAND_POSE_DUR = 0.34;
export const LAND_POSE_DUR_SHORT = 0.26;
export const ROLL_SPEED_BOOST = 200;
export const ROLL_CD = 0.12;
/**
 * 翻滚成球目标显示直径（局内 px）— 跨角色锁死，不跟贴图 bbox / run0 羽冠漂移。
 * ≈ 法师成球相对站立高的自然比例（约 0.72）。
 */
export const ROLL_BALL_DRAW = CHAR_H_STAND * 0.72;
/** 翻滚碰撞相对成球显示直径的比例（略小于贴图，忽略尾气外扩） */
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
/** 难度相对原曲线：开局 ×1.15，700m 及以后 ×1.50，中间线性 */
export const DIFF_FLOOR = 1.15;
export const DIFF_CEIL = 1.50;
export const DIFF_RAMP_START_M = 100;
export const DIFF_RAMP_END_M = 700;
export const KILL_GOLD = 10;
export const METER_PER_GOLD = 5;

export const GAP_W_MIN = 58;
export const GAP_W_MAX = 86;
export const GAP_COOLDOWN = 6;
export const OBSTACLE_MARGIN = 70;
export const POST_GAP_SAFE = 360;
export const GAP_DEPTH = 240;
/** 掉入坑后离地超过此深度才触发掉坑结算（越大=空中操作窗口越大） */
export const GAP_FALL_KILL = 90;
export const GAP_W_LATE_MIN = 100;
export const GAP_W_LATE_MAX = 140;

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
/** 下一次奖励门距离区间（米）：更稳、更可读 */
export const PORTAL_DIST_MIN = 900;
export const PORTAL_DIST_MAX = 1300;
/** 开局首次奖励门（米） */
export const PORTAL_FIRST_DIST = 700;

export const SKY_SPRINT_DUR = 3.0;
export const SKY_SPRINT_FADE = 0.5;
export const SKY_SPRINT_H = 320;
export const SKY_SPRINT_SPEED_MAX = 2800;

export const ENERGY_MAX = 100;
export const ENERGY_COST = 25;
export const ENERGY_REGEN = 30;

export const TUTORIAL_END = 420;
export const TUTORIAL_LEAD_PX = 240;

/** UI / canvas HUD · Castle Type */
export const CASTLE_FONT = '"Segoe UI","DIN Alternate","Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif';
