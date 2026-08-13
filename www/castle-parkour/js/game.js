import {
  ASSET_VER,
  CHAR_NAMES,
  PORTRAIT_ASSETS,
  CHAR_SPRITES,
  CHAR_RUN_SHEETS,
  CHAR_ROLL_SHEETS,
} from './config/characters.js';
import { WORLD_ASSETS } from './config/world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const hudGoldEl = document.getElementById('hud-gold');
const hudScoreEl = document.getElementById('hud-score');
const startBtn = document.getElementById('start');
const homeBtn = document.getElementById('home');
const hudCache = { m: -1, g: -1, s: -1 };

// ===================== 音频系统（Web Audio API 程序化生成） =====================
let audioCtx = null;
let bgmGain = null;
let bgmTimer = null;
let muted = false;
let bgmVolume = Number(localStorage.getItem('castle-parkour-vol-bgm') ?? 0.8);
let sfxVolume = Number(localStorage.getItem('castle-parkour-vol-sfx') ?? 0.9);

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = bgmVolume * 0.15;
    bgmGain.connect(audioCtx.destination);
  } catch (e) { audioCtx = null; }
}

function setBgmVolume(v) {
  bgmVolume = v;
  localStorage.setItem('castle-parkour-vol-bgm', String(v));
  if (bgmGain) bgmGain.gain.value = v * 0.15;
}

function setSfxVolume(v) {
  sfxVolume = v;
  localStorage.setItem('castle-parkour-vol-sfx', String(v));
}

// BGM：月夜城墙——偏暗小调琶音，节奏略慢
const BGM_MELODY = [
  392, 466, 523, 466, 392, 349, 392, 466,
  523, 587, 523, 466, 392, 349, 330, 392,
];
const BGM_BASS = [196, 196, 233, 233, 175, 175, 196, 233];
let bgmIdx = 0;

function playBgmNote() {
  if (!audioCtx || muted) { bgmTimer = null; return; }
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = BGM_MELODY[bgmIdx % BGM_MELODY.length];
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.01, t + 0.36);
  osc.connect(g); g.connect(bgmGain);
  osc.start(t); osc.stop(t + 0.4);
  if (bgmIdx % 2 === 0) {
    const bosc = audioCtx.createOscillator();
    const bg = audioCtx.createGain();
    bosc.type = 'sine';
    bosc.frequency.value = BGM_BASS[(bgmIdx / 2) % BGM_BASS.length];
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(0.12, t + 0.03);
    bg.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    bosc.connect(bg); bg.connect(bgmGain);
    bosc.start(t); bosc.stop(t + 0.65);
  }
  bgmIdx++;
  bgmTimer = setTimeout(playBgmNote, 280);
}

function startBGM() {
  if (!audioCtx) initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (bgmTimer) return;
  bgmIdx = 0;
  playBgmNote();
}

function stopBGM() {
  if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
}

function toggleMute() {
  muted = !muted;
  if (muted) stopBGM();
  else if (running) startBGM();
}

// SFX helpers
function sfxGain(v) {
  return Math.max(0.0001, v * sfxVolume);
}

function sfxTone({ type = 'sine', f0, f1, dur = 0.12, vol = 0.12, delay = 0, curve = 'exp' }) {
  if (!audioCtx || muted) return;
  const t = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 != null && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(sfxGain(vol), t + 0.012);
  if (curve === 'lin') g.gain.linearRampToValueAtTime(0.0001, t + dur);
  else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function sfxNoise({ dur = 0.08, vol = 0.1, freq = 1400, delay = 0 }) {
  if (!audioCtx || muted) return;
  const t = audioCtx.currentTime + delay;
  const n = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const f = audioCtx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 0.8;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(sfxGain(vol), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + dur + 0.02);
}

function sfxJump() {
  sfxTone({ type: 'triangle', f0: 280, f1: 620, dur: 0.11, vol: 0.09 });
  sfxTone({ type: 'sine', f0: 420, f1: 780, dur: 0.08, vol: 0.05, delay: 0.02 });
}

function sfxAttack() {
  sfxNoise({ dur: 0.06, vol: 0.07, freq: 900 });
  sfxTone({ type: 'sawtooth', f0: 520, f1: 180, dur: 0.09, vol: 0.07 });
  sfxTone({ type: 'triangle', f0: 880, f1: 340, dur: 0.12, vol: 0.08, delay: 0.03 });
  sfxNoise({ dur: 0.05, vol: 0.05, freq: 1800, delay: 0.04 });
}

function sfxOrbitReady() {
  sfxTone({ type: 'sine', f0: 660, f1: 990, dur: 0.1, vol: 0.06 });
  sfxTone({ type: 'triangle', f0: 990, f1: 1320, dur: 0.12, vol: 0.04, delay: 0.04 });
}

function sfxOrbitLaunch() {
  sfxTone({ type: 'sawtooth', f0: 420, f1: 980, dur: 0.1, vol: 0.07 });
  sfxNoise({ dur: 0.07, vol: 0.06, freq: 1200 });
}

function sfxHit() {
  sfxNoise({ dur: 0.07, vol: 0.14, freq: 700 });
  sfxTone({ type: 'square', f0: 220, f1: 90, dur: 0.08, vol: 0.06 });
}

function sfxKill() {
  sfxTone({ type: 'sine', f0: 740, f1: 980, dur: 0.08, vol: 0.07 });
  sfxTone({ type: 'sine', f0: 980, f1: 1240, dur: 0.09, vol: 0.06, delay: 0.05 });
  sfxTone({ type: 'triangle', f0: 1240, f1: 1560, dur: 0.1, vol: 0.05, delay: 0.1 });
  sfxNoise({ dur: 0.06, vol: 0.05, freq: 1600, delay: 0.02 });
}

function sfxSprint() {
  sfxNoise({ dur: 0.18, vol: 0.08, freq: 600 });
  sfxTone({ type: 'sawtooth', f0: 180, f1: 980, dur: 0.28, vol: 0.1 });
  sfxTone({ type: 'triangle', f0: 360, f1: 1400, dur: 0.22, vol: 0.05, delay: 0.04 });
}

function sfxCoin() {
  sfxTone({ type: 'sine', f0: 1046, f1: 1318, dur: 0.07, vol: 0.08 });
  sfxTone({ type: 'triangle', f0: 1318, f1: 1760, dur: 0.1, vol: 0.06, delay: 0.045 });
}

function sfxHurt() {
  sfxNoise({ dur: 0.12, vol: 0.12, freq: 400 });
  sfxTone({ type: 'square', f0: 360, f1: 90, dur: 0.18, vol: 0.1 });
}

function sfxRoll() {
  sfxNoise({ dur: 0.1, vol: 0.06, freq: 500 });
  sfxTone({ type: 'triangle', f0: 200, f1: 140, dur: 0.12, vol: 0.05 });
}

// ===================== 常量 =====================
const W = canvas.width;
const H = canvas.height;
const U = 40;
const GROUND = 420;
const CHAR_X = 120;
const CHAR_W = 30;
const CHAR_H_STAND = 2 * U;
const CHAR_H_DUCK = 1 * U;
const JUMP_H = 2.6 * U;
const GRAV = 2000;
const JUMP_V = Math.sqrt(2 * GRAV * JUMP_H);
const WALL_H = 1.5 * U;
const BEAM_BOTTOM = GROUND - 1.5 * U;
const ATTACK_CD = 0.28;
const WARRIOR_ATTACK_CD = 0.3;
const SWORD_SLASH_DUR = 0.22;
const MAGE_ATK_DUR = 0.38;     // 法师攻击整段动作时长
const MAGE_ATK_FIRE_AT = 0.14; // 前摇后出火球
const FB_SPEED = 700;
const FB_R = 7;
const SWORD_BASE_RANGE = 92;
const WARRIOR_BUY_COST = 800;
const TALENT_UNLOCK_COST = 500;
const TALENT_UP_COST = (lv) => 200 + lv * 150;
const MAGE_HP_MAX = 3;
const MAGE_SHD_MAX = 1;
const MAGE_ATK_MAX = 4;
const MAGE_ATK_PWR_MAX = 3;
const MAGE_EN_MAX = 5;
const WARRIOR_HP_MAX = 5;
const WARRIOR_HP_MIN = 3;
const WARRIOR_SHD_MAX = 2;
const WARRIOR_SHD_MIN = 1;
const WARRIOR_ATK_MAX = 4;
const WARRIOR_ATK_PWR_MAX = 5;
const WARRIOR_ATK_PWR_MIN = 3;
const TALENT_MAX = 5;
const SHELTER_CD = [90, 80, 70, 60, 60];
const SHELTER_FLY_DUR = 5.0;
const UP_COST_MAGE_HP = (lv) => lv * 80;
const UP_COST_MAGE_SHD = () => 120;
const UP_COST_MAGE_ATK = (lv) => 90 + lv * 70;
const UP_COST_MAGE_EN = (lv) => lv * 60;
const UP_COST_WARRIOR_HP = (hp) => (hp - WARRIOR_HP_MIN + 1) * 100;
const UP_COST_WARRIOR_SHD = () => 180;
const UP_COST_WARRIOR_ATK = (lv) => 110 + lv * 80;
const MAX_BULLETS = 6;
const ORBIT_COUNT = 3;
const ORBIT_R = 42;
const ORBIT_SHOOT_CD = 0.36;
const ORBIT_SEEK_RANGE = 280;
const BAT_W = 34;
const BAT_H = 26;
const BAT_EXTRA_VX = 180;
const fbSpeed = () => FB_SPEED;
const energyRegen = () => ENERGY_REGEN * (1 + (charData.mage.en - 1) * 0.2);
const swordRange = () => SWORD_BASE_RANGE;
const mageAtkPower = () => Math.min(MAGE_ATK_PWR_MAX, charData.mage.atk);
const mageOrbitUnlocked = () => charData.mage.atk >= MAGE_ATK_MAX;
const warriorAtkPower = () => Math.min(WARRIOR_ATK_PWR_MAX, WARRIOR_ATK_PWR_MIN + charData.warrior.atk - 1);
const warriorParryUnlocked = () => charData.warrior.atk >= WARRIOR_ATK_MAX;
const mageAtkDesc = (lv) => {
  if (lv >= MAGE_ATK_MAX) return '无怪攻击蓄球，有怪时自动索敌';
  if (lv >= MAGE_ATK_PWR_MAX) return '下一级解锁环绕火球';
  return `攻击力 ${lv}（火球伤害）`;
};
const warriorAtkDesc = (lv) => {
  if (lv >= WARRIOR_ATK_MAX) return '挥剑时可格挡伤害';
  if (lv >= 3) return '攻击力 5，下一级解锁格挡';
  return `攻击力 ${WARRIOR_ATK_PWR_MIN + lv - 1}`;
};
const isMage = () => selectedChar === 'mage';
const isWarrior = () => selectedChar === 'warrior';
function charMaxHpSlots() {
  return isWarrior() ? charData.warrior.hp : charData.mage.hp;
}
function charMaxShdSlots() {
  return isWarrior() ? charData.warrior.shd : charData.mage.shd;
}
function shelterMaxStacks() {
  return charData.warrior.talent >= TALENT_MAX ? 2 : 1;
}
function shelterCdSec() {
  const lv = charData.warrior.talent;
  if (lv < 1) return 9999;
  return SHELTER_CD[Math.min(lv, TALENT_MAX) - 1];
}

// 起飞（原天空冲刺：永久护盾破碎 / 护盾道具充能救场 / 地图起飞道具）
const SKY_SPRINT_DUR = 3.0;       // 总时长 3 秒
const SKY_SPRINT_FADE = 0.5;      // 淡入淡出时长
const SKY_SPRINT_H = 320;         // 起飞高度
const SKY_SPRINT_SPEED_MAX = 2800; // 最大速度 px/s（3秒内覆盖约300m）

// 新手教程：提示可早出现；时停延后到障碍靠近后再触发（单次跳/滚即可过）
const TUTORIAL_END = 420;
const TUTORIAL_STEPS = [
  { m: 12,  type: 'info',    title: '基本操作', text: 'W/↑/空格 跳跃 · S/↓ 翻滚 · J/鼠标左键 攻击', wait: 2.8 },
  { m: 55,  type: 'wall',    title: '跳跃躲避', text: '靠近火桩时按 W 或空格跳过去！', action: 'jump', freezeAt: 100 },
  { m: 110, type: 'beam',    title: '翻滚穿越', text: '靠近横梁时按 S 翻滚穿过！', action: 'duck', freezeAt: 95 },
  { m: 165, type: 'gap',     title: '跨越坑洞', text: '靠近坑边按 W 跳过去！', action: 'jump', freezeAt: 105 },
  { m: 220, type: 'monster', title: '火球攻击', text: '按 J 发射火球击败怪物！', action: 'attack', freezeAt: 160 },
  { m: 270, type: 'info',    title: '受伤机制', text: '碰障碍扣血；永久护盾破碎、护盾道具救场都会触发起飞', wait: 3 },
  { m: 320, type: 'coins',   title: '收集金币', text: '收集金币获得额外奖励！', action: 'coin', freeze: false },
  { m: 370, type: 'info',    title: '速度提升', text: '距离越远速度越快，做好准备！', wait: 2.5 },
  { m: 410, type: 'info',    title: '教程完成', text: '祝你好运，开始冒险吧！', wait: 2.5 },
];
// 障碍生成前置：提示更早；真正时停由 freezeAt 控制
const TUTORIAL_LEAD_PX = 240;

// 能量系统（限制子弹滥用）
const ENERGY_MAX = 100;
const ENERGY_COST = 25;        // 每发消耗 25 能量（从 30 降低，可发 4 连射）
const ENERGY_REGEN = 30;       // 每秒恢复 30 能量（从 22 提升，更快回能）

// 二段跳
const DOUBLE_JUMP_H = 2.0 * U;
const DOUBLE_JUMP_V = Math.sqrt(2 * GRAV * DOUBLE_JUMP_H);

// 翻滚（一键动作，短暂加速穿过障碍）
const ROLL_DUR = 0.55;         // 翻滚持续秒数
const ROLL_SPEED_BOOST = 200;  // 翻滚时额外世界速度 px/s
const ROLL_CD = 0.15;          // 翻滚冷却（防连按）
const FAST_FALL_V = 1200;      // 空中下蹲快速落地速度

// 金币拾取
const COIN_R = 10;
const COIN_VALUE = 5;
const COIN_PICKUP_R = 38;      // 拾取半径（从 32 提升至 38，高速时更容易拾取）

// 计分（统一口径：worldX 为唯一真源）
const PX_PER_METER = 26;       // 260px/s = 10m/s
const KILL_GOLD = 10;
const METER_PER_GOLD = 5;      // 每 5m 产 1 金币（距离收入翻倍，跑酷更有回报感）

// 缺口生成（加宽，确保高速时可掉入）
const GAP_W_MIN = 80;
const GAP_W_MAX = 120;
const GAP_COOLDOWN = 5;
const OBSTACLE_MARGIN = 60;
const POST_GAP_SAFE = 140;

// 高台平台（多层平台机制）
const PLATFORM_H = 85;         // 高台离地高度（≈2.1U，跳跃可达）
const PLATFORM_W_MIN = 90;     // 高台最小宽度
const PLATFORM_W_MAX = 160;    // 高台最大宽度

// 地刺（地面陷阱）
const SPIKE_H = 0.7 * U;       // 地刺高度（28px，需跳跃避开）
const SPIKE_W = 48;            // 地刺宽度

// 飞行障碍（空中敌人）
const FLYER_BASE_Y = GROUND - 2.3 * U;  // 飞行基准高度（需蹲伏或站高台避开）
const FLYER_W = 36;
const FLYER_H = 28;
const FLYER_AMP = 25;          // 上下振幅

// 后期坑洞参数（加宽，确保高速时可掉入）
const GAP_W_LATE_MIN = 130;    // 600m后坑宽下限
const GAP_W_LATE_MAX = 180;    // 600m后坑宽上限

// ===================== 持久化 =====================
const LS = {
  best: 'castle-parkour-best', plays: 'castle-parkour-plays', time: 'castle-parkour-time',
  gold: 'castle-parkour-gold', tut: 'castle-parkour-tut-done',
  score: 'castle-parkour-best-score', items: 'castle-parkour-items',
  char: 'castle-parkour-char', chars: 'castle-parkour-chars',
};
// 兼容旧版存档键
(() => {
  const pairs = [
    ['castle-parkour-best', 'demo-rush-best'],
    ['castle-parkour-plays', 'demo-rush-plays'],
    ['castle-parkour-time', 'demo-rush-time'],
    ['castle-parkour-gold', 'demo-rush-gold'],
    ['castle-parkour-tut-done', 'demo-rush-tut-done'],
    ['castle-parkour-best-score', 'demo-rush-best-score'],
    ['castle-parkour-items', 'demo-rush-items'],
    ['castle-parkour-char', 'castle-run-char'],
    ['castle-parkour-chars', 'castle-run-chars'],
    ['castle-parkour-vol-bgm', 'demo-rush-vol-bgm'],
    ['castle-parkour-vol-sfx', 'demo-rush-vol-sfx'],
    ['castle-parkour-lv-hp', 'demo-rush-lv-hp'],
    ['castle-parkour-lv-fb', 'demo-rush-lv-fb'],
    ['castle-parkour-lv-shd', 'demo-rush-lv-shd'],
    ['castle-parkour-lv-en', 'demo-rush-lv-en'],
  ];
  for (const [dest, src] of pairs) {
    if (localStorage.getItem(dest) != null) continue;
    const v = localStorage.getItem(src);
    if (v != null) localStorage.setItem(dest, v);
  }
})();
const load = (k, d) => Number(localStorage.getItem(k) ?? d);
const save = (k, v) => localStorage.setItem(k, String(v));

const CHAR_DEFAULTS = {
  mage: { hp: 1, atk: 1, shd: 0, en: 1 },
  warrior: { unlocked: false, hp: WARRIOR_HP_MIN, shd: WARRIOR_SHD_MIN, atk: 1, talent: 0 },
};

function loadCharData() {
  let data;
  try {
    const raw = localStorage.getItem(LS.chars);
    data = raw ? JSON.parse(raw) : null;
  } catch { data = null; }
  if (!data?.mage || !data?.warrior) {
    data = {
      mage: { ...CHAR_DEFAULTS.mage },
      warrior: { ...CHAR_DEFAULTS.warrior },
    };
    if (localStorage.getItem('castle-parkour-lv-hp') != null) {
      data.mage.hp = Math.min(MAGE_HP_MAX, Math.max(1, load('castle-parkour-lv-hp', 1)));
      data.mage.atk = Math.min(MAGE_ATK_MAX, Math.max(1, load('castle-parkour-lv-fb', 1)));
      data.mage.shd = Math.min(MAGE_SHD_MAX, Math.max(0, load('castle-parkour-lv-shd', 0)));
      data.mage.en = Math.min(MAGE_EN_MAX, Math.max(1, load('castle-parkour-lv-en', 1)));
    }
  }
  if (data.mage.fb != null && data.mage.atk == null) {
    data.mage.atk = Math.min(MAGE_ATK_MAX, Math.max(1, data.mage.fb));
    delete data.mage.fb;
  }
  if (data.warrior.range != null && data.warrior.atk == null) {
    data.warrior.atk = Math.min(WARRIOR_ATK_MAX, Math.max(1, data.warrior.range));
    delete data.warrior.range;
  }
  data.mage.hp = Math.min(MAGE_HP_MAX, Math.max(1, data.mage.hp));
  data.mage.atk = Math.min(MAGE_ATK_MAX, Math.max(1, data.mage.atk ?? 1));
  data.mage.shd = Math.min(MAGE_SHD_MAX, Math.max(0, data.mage.shd));
  data.mage.en = Math.min(MAGE_EN_MAX, Math.max(1, data.mage.en));
  data.warrior.hp = Math.min(WARRIOR_HP_MAX, Math.max(WARRIOR_HP_MIN, data.warrior.hp));
  data.warrior.shd = Math.min(WARRIOR_SHD_MAX, Math.max(WARRIOR_SHD_MIN, data.warrior.shd));
  data.warrior.atk = Math.min(WARRIOR_ATK_MAX, Math.max(1, data.warrior.atk ?? 1));
  data.warrior.talent = Math.min(TALENT_MAX, Math.max(0, data.warrior.talent | 0));
  return data;
}

function saveCharData() {
  localStorage.setItem(LS.chars, JSON.stringify(charData));
}

let charData = loadCharData();
let selectedChar = localStorage.getItem(LS.char) || 'mage';
if (selectedChar === 'warrior' && !charData.warrior.unlocked) selectedChar = 'mage';
let uiCharView = selectedChar;

// ===================== 道具定义 =====================
const ITEMS = {
  magnet: { name: '磁铁', desc: '10秒内吸引附近金币', price: 100, dur: 10, icon: '🧲' },
  shield: { name: '护盾', desc: '获得1层充能，受致命伤或掉坑时触发起飞', price: 150, dur: 0, icon: '🛡' },
  double: { name: '双倍金币', desc: '本局金币拾取翻倍', price: 250, dur: 0, icon: '💰' },
  revive: { name: '复活币', desc: '死亡后原地复活，恢复满血', price: 400, dur: 0, icon: '❤' },
};
const ITEM_KEYS = ['magnet', 'shield', 'double', 'revive'];
const loadItems = () => {
  try { return JSON.parse(localStorage.getItem(LS.items)) || { magnet: 0, shield: 0, double: 0, revive: 0 }; }
  catch (e) { return { magnet: 0, shield: 0, double: 0, revive: 0 }; }
};
const saveItems = (obj) => localStorage.setItem(LS.items, JSON.stringify(obj));

// ===================== 局内道具拾取（地图随机刷新） =====================
const PU = {
  magnet: { color: '#845ec2', glow: '#b39ddb', dur: 10, name: '磁铁' },
  double: { color: '#ffd93d', glow: '#fff3c4', dur: 15, name: '双倍金币' },
  attack: { color: '#ff6b35', glow: '#ffb088', dur: 10, name: '攻击强化' },
  fly:    { color: '#00c9a7', glow: '#7fefde', dur: 0,  name: '起飞' }, // 拾取即触发起飞
};
const PU_KEYS = ['magnet', 'double', 'attack']; // fly 拾取即起飞，不走计时器
const PU_SPAWN_INTERVAL = 333;  // 每 ~333m 刷一个（≈3个/1000m）
const PU_R = 16;               // 道具拾取半径

// ===================== 状态 =====================
let running = false;
let over = false;
let worldX = 0;             // 世界累计位移（px）—— 计分唯一真源
let px = 0;                 // 角色脚底离地高度
let vy = 0;
let ducking = false;
let rollTimer = 0;           // 翻滚剩余时间
let rollCdTimer = 0;         // 翻滚冷却
let duckPressed = false;     // 蹲伏按键（单次触发）
let fastFalling = false;     // 空中快速下落中
let atkCd = 0;
let attackFx = 0;
let invincible = 0;
let runTime = 0;
let killCount = 0;
let energy = ENERGY_MAX;     // 能量（子弹资源）
let canDoubleJump = false;   // 二段跳可用
let lastMilestone = 0;       // 上次里程碑距离
let milestoneFx = 0;         // 里程碑特效计时
let milestoneText = '';      // 里程碑文字
let coinPickups = 0;         // 本局拾取金币数
let powerups = [];           // 局内道具实体 {x, y, type, phase}
let puSpawnNextM = 350;      // 下个道具刷新距离（m，教程结束后开始）
let puTimers = { magnet: 0, double: 0, attack: 0 }; // 道具效果计时器

let best = load(LS.best, 0);
let bestScore = load(LS.score, 0);
let gold = load(LS.gold, 0);
let tutorialDone = load(LS.tut, 0);
let hp = 1;
let shield = 0;
let itemShield = 0;
let knightShelter = 0;
let knightShelterCdTimer = 0;
let knightShelterCdActive = false;
let swordSwings = [];
let warriorSlashT = 0;
let orbitAngle = 0;
let orbitShootCd = 0;
let orbitOrbs = [];          // { slot, appear } 环绕蓄球
let pendingMageShot = null;  // { delay, fy, fbs }
let mageMuzzleFx = 0;
let skySprintDurActive = SKY_SPRINT_DUR;

// ===================== 奖励空间（传送门）状态 =====================
let bonusActive = false;       // 是否在奖励空间中
let bonusDist = 0;             // 奖励空间已跑距离
const BONUS_DIST_MAX = 300;    // 奖励空间长度 300m（缩短，控制金币总量）
let nextPortalDist = 1500 + Math.random() * 1500; // 下次传送门距离
let portal = null;             // 传送门实体 { x, y, phase }
let bonusReturnDist = 0;       // 进入奖励空间前的世界距离
let transitionFx = 0;          // 过渡特效计时
let bonusFinaleSpawned = false; // 奖励空间收尾金币是否已生成

// ===================== 道具状态 =====================
let ownedItems = loadItems();                                        // 持久化库存
let activeItems = { double: false, revive: false }; // 局内激活（磁铁走 itemTimers，护盾走 itemShield）
let itemTimers = { magnet: 0 };
let equippedItems = { magnet: false, shield: false, double: false, revive: false };

// 起飞状态（内部仍用 skySprint* 变量名）
let skySprintTime = 0;         // 起飞已用时间 (s)
let skySprintActive = false;
// 起飞速度倍率（淡入→满速→淡出）
const skySprintMul = () => {
  if (!skySprintActive) return 0;
  const t = skySprintTime;
  const dur = skySprintDurActive;
  if (t < SKY_SPRINT_FADE) return 0.3 + 0.7 * (t / SKY_SPRINT_FADE);
  if (t > dur - SKY_SPRINT_FADE) return 0.3 + 0.7 * ((dur - t) / SKY_SPRINT_FADE);
  return 1;
};
const skySprintSpeed = () => SKY_SPRINT_SPEED_MAX * skySprintMul();

// 新手教程状态
let tutorialActive = false;
let tutorialStep = 0;
let tutorialShown = false;       // 当前步骤是否正在显示
let tutorialActionDone = false;  // 当前步骤动作是否完成
let tutorialWaitTimer = 0;       // info步骤等待计时器
let tutorialSpawned = new Set(); // 已生成的教程场景索引

let platforms = [];
let gaps = [];
let walls = [];
let beams = [];
let monsters = [];
let fireballs = [];
let floats = [];
let coins = [];
let elevatedPlatforms = [];  // 高台 {x0, x1, y}
let spikes = [];             // 地刺 {x, w}
let flyers = [];             // 飞行障碍 {x, baseY, phase, w}
let bats = [];               // 敌对蝙蝠 {x, y, phase, hp}
let onPlatformY = 0;         // 当前站立高台高度（0=地面）
let genX = 0;
let gapCooldown = 0;
let featureCooldown = 0;      // 障碍物冷却（连续段路面无障碍）
let duckObsCd = 0;            // 蹲伏类障碍冷却（防止连续横梁/飞行物）
let jumpObsCd = 0;            // 跳跃类障碍冷却（防止连续墙壁/怪物）
let platformAfterGap = 0;     // 距上次坑过了几段路面
let animT = 0;
let lastTs = 0;
let jumpPressed = false;
const keys = new Set();

// ===================== 派生值 =====================
// 距离驱动速度倍率：100-300m→1.25x，500-700m→1.5x
function speedMul() {
  const d = distanceM();
  if (d < 100) return 1;
  if (d < 300) return 1 + (d - 100) / 200 * 0.25;
  if (d < 500) return 1.25;
  if (d < 700) return 1.25 + (d - 500) / 200 * 0.25;
  return 1.5;
}
const baseSpeed = () => 260 * speedMul();
const speed = () => skySprintActive ? skySprintSpeed() : baseSpeed() + (rollTimer > 0 ? ROLL_SPEED_BOOST : 0);
const distanceM = () => worldX / PX_PER_METER;
const scoreM = () => Math.floor(distanceM());
const goldEarned = () => Math.floor(distanceM() / METER_PER_GOLD) + killCount * KILL_GOLD + coinPickups * COIN_VALUE;
const scoreVal = () => scoreM() * 10 + killCount * 50 + coinPickups * 20;
const currentTutorialStep = () => tutorialActive && tutorialStep < TUTORIAL_STEPS.length ? TUTORIAL_STEPS[tutorialStep] : null;
function tutorialHazardX(step) {
  if (!step) return null;
  if (step.type === 'wall') return walls.length ? walls.reduce((a, w) => (a == null || w.x < a ? w.x : a), null) : null;
  if (step.type === 'beam') return beams.length ? beams.reduce((a, b) => (a == null || b.x < a ? b.x : a), null) : null;
  if (step.type === 'gap') return gaps.length ? gaps.reduce((a, g) => (a == null || g.x < a ? g.x : a), null) : null;
  if (step.type === 'monster') return monsters.length ? monsters.reduce((a, m) => (a == null || m.x < a ? m.x : a), null) : null;
  return null;
}
const tutorialActionFreezing = () => {
  const step = currentTutorialStep();
  // 收集类不冻屏；跳跃/翻滚等延后到障碍靠近再时停，保证单次操作就能过
  if (!tutorialShown || !step?.action || tutorialActionDone) return false;
  if (step.freeze === false) return false;
  const hx = tutorialHazardX(step);
  if (hx == null) return false;
  const dist = hx - CHAR_X;
  const freezeAt = step.freezeAt ?? 100;
  return dist <= freezeAt && dist > -40;
};
const wallH = (w) => (w && w.h != null ? w.h : WALL_H);

// ===================== UI 切换 =====================
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  if (id === 'screen-menu') refreshMainMenu();
  if (id === 'screen-char') {
    uiCharView = selectedChar;
    try { refreshCharScreen(); } catch (err) { console.error('refreshCharScreen', err); }
  }
}

// ===================== 地面判定 =====================
function groundAt(x) {
  return platforms.some((p) => x >= p.x0 && x <= p.x1);
}

// ===================== 碰撞检测 =====================
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// 检查 x 范围 [cx, cx+cw] 是否与现有实体冲突（含安全间距 pad）
function isRangeFree(cx, cw, pad) {
  pad = pad || 50;
  for (const w of walls) if (cx < w.x + w.w + pad && cx + cw + pad > w.x) return false;
  for (const b of beams) if (cx < b.x + b.w + pad && cx + cw + pad > b.x) return false;
  for (const m of monsters) {
    const mw = m.big ? 46 : 28;
    if (cx < m.x + mw + pad && cx + cw + pad > m.x) return false;
  }
  for (const s of spikes) if (cx < s.x + s.w + pad && cx + cw + pad > s.x) return false;
  for (const f of flyers) if (cx < f.x + f.w + pad && cx + cw + pad > f.x) return false;
  for (const p of elevatedPlatforms) if (cx < p.x1 + pad && cx + cw + pad > p.x0) return false;
  for (const g of gaps) if (cx < g.x + g.w + pad && cx + cw + pad > g.x) return false;
  for (const p of powerups) if (cx < p.x + PU_R + pad && cx + cw + pad > p.x - PU_R) return false;
  for (const c of coins) if (!c.taken && cx < c.x + COIN_R + pad && cx + cw + pad > c.x - COIN_R) return false;
  return true;
}

// 在 [availStart, availEnd] 范围内尝试放置实体，最多 6 次随机尝试
// make(x) 可返回 false 表示该点业务拒绝（如跳/蹲冲突），将继续尝试
function tryPlace(make, availStart, availEnd, w) {
  if (availEnd - availStart < w) return false;
  const span = availEnd - availStart - w;
  // 先试段内均匀格点，再随机，减少空段与硬塞
  const probes = [];
  for (let i = 0; i < 3; i++) probes.push(availStart + span * ((i + 1) / 4));
  for (let t = 0; t < 4; t++) probes.push(availStart + Math.random() * Math.max(1, span));
  for (const x of probes) {
    if (!isRangeFree(x, w)) continue;
    if (make(x) === false) continue;
    return true;
  }
  return false;
}

// 跳跃类 ↔ 蹲伏类：段冷却交叉 + 像素间距，避免「刚跳完立刻蹲 / 刚蹲完立刻跳」
// 段冷却取 2：既防连招，又不把前期内容下限压得过空
const ACTION_SEG_CD = 2;
const ACTION_CROSS_CD = 2;
const ACTION_SEP_PX = 340;
function markJumpAction() {
  jumpObsCd = Math.max(jumpObsCd, ACTION_SEG_CD);
  duckObsCd = Math.max(duckObsCd, ACTION_CROSS_CD);
}
function markDuckAction() {
  duckObsCd = Math.max(duckObsCd, ACTION_SEG_CD);
  jumpObsCd = Math.max(jumpObsCd, ACTION_CROSS_CD);
}
function nearJumpHazards(cx, cw, pad) {
  pad = pad ?? ACTION_SEP_PX;
  for (const w of walls) if (cx < w.x + w.w + pad && cx + cw + pad > w.x) return true;
  for (const s of spikes) if (cx < s.x + s.w + pad && cx + cw + pad > s.x) return true;
  for (const m of monsters) {
    const mw = m.big ? 46 : 28;
    if (cx < m.x + mw + pad && cx + cw + pad > m.x) return true;
  }
  for (const p of elevatedPlatforms) if (cx < p.x1 + pad && cx + cw + pad > p.x0) return true;
  for (const g of gaps) if (cx < g.x + g.w + pad && cx + cw + pad > g.x) return true;
  return false;
}
function nearDuckHazards(cx, cw, pad) {
  pad = pad ?? ACTION_SEP_PX;
  for (const b of beams) if (cx < b.x + b.w + pad && cx + cw + pad > b.x) return true;
  for (const f of flyers) if (cx < f.x + f.w + pad && cx + cw + pad > f.x) return true;
  return false;
}

// 原地清理：避免每帧多次 filter 创建新数组（减少 GC 压力）
function cullInPlace(arr, pred) {
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    if (pred(arr[r])) arr[w++] = arr[r];
  }
  arr.length = w;
}

/** 清除角色前方 [CHAR_X, safeEnd] 内的危险实体，并铺一段安全地面 */
function clearAhead(safeEnd, opts = {}) {
  const padLeft = opts.padLeft ?? 40;
  const padRight = opts.padRight ?? 40;
  platforms.push({ x0: CHAR_X - padLeft, x1: safeEnd + padRight });
  cullInPlace(walls, (w) => w.x > safeEnd);
  cullInPlace(beams, (b) => b.x > safeEnd);
  cullInPlace(monsters, (m) => m.x > safeEnd);
  cullInPlace(spikes, (s) => s.x > safeEnd);
  cullInPlace(flyers, (f) => f.x > safeEnd);
  cullInPlace(gaps, (g) => g.x > safeEnd);
  cullInPlace(elevatedPlatforms, (p) => p.x0 > safeEnd);
  if (opts.featureCd != null) featureCooldown = Math.max(featureCooldown, opts.featureCd);
  if (opts.gapCd != null) gapCooldown = Math.max(gapCooldown, opts.gapCd);
}

function obstacleSpawnChance(d) {
  if (d < 25) return 0.30;
  if (d < 80) return 0.38;
  if (d < 200) return 0.48;
  return Math.min(0.55, 0.48 + (d - 200) / 4000);
}

function spawnSegmentCoins(x0, x1, d) {
  const coinChance = d < 200 ? 0.58 : Math.max(0.48, 0.58 - (d - 200) / 2800);
  if (Math.random() >= coinChance) return;
  const span = (x1 - x0) - 2 * OBSTACLE_MARGIN;
  if (span < 80) return;
  const isSafe = (cx) => {
    if (!isRangeFree(cx, 1, 40)) return false;
    for (const b of beams) {
      if (cx > b.x - 20 && cx < b.x + b.w + 20) return false;
    }
    return true;
  };
  const spacing = 44;
  let n = 3 + Math.floor(Math.random() * 3);
  let totalW = (n - 1) * spacing;
  while (n > 2 && totalW > span - 20) { n--; totalW = (n - 1) * spacing; }
  // 优先段落前段固定相位，形成可读跳跃弧；失败再随机
  let startX = -1;
  const prefer = x0 + OBSTACLE_MARGIN + Math.max(0, (span - totalW) * 0.22);
  const candidates = [prefer];
  for (let a = 0; a < 12; a++) {
    candidates.push(x0 + OBSTACLE_MARGIN + Math.random() * Math.max(1, span - totalW - 10));
  }
  for (const testX of candidates) {
    let allSafe = true;
    for (let i = 0; i < n; i++) {
      if (!isSafe(testX + i * spacing)) { allSafe = false; break; }
    }
    if (allSafe && testX + totalW < x1 - OBSTACLE_MARGIN) { startX = testX; break; }
  }
  if (startX < 0) return;
  const baseY = GROUND - 50;
  const amp = 32;
  // 70% 弧 / 20% 平 / 10% 轻之字
  const pattern = Math.random();
  for (let i = 0; i < n; i++) {
    const cx = startX + i * spacing;
    if (cx > x1 - OBSTACLE_MARGIN) break;
    let cy;
    const t = n > 1 ? i / (n - 1) : 0;
    if (pattern < 0.70) cy = baseY - Math.sin(t * Math.PI) * amp;
    else if (pattern < 0.90) cy = baseY;
    else cy = i % 2 === 0 ? baseY : baseY - 18;
    coins.push({ x: cx, y: cy, bob: i * 0.5, taken: false });
  }
}

function trySpawnObstacle(x0, x1, d) {
  if (gapCooldown <= 1) return;

  if (featureCooldown > 0) {
    featureCooldown--;
    return;
  }

  const segLen = x1 - x0;
  if (segLen < 110) return;

  if (Math.random() > obstacleSpawnChance(d)) return;

  const availStart = x0 + OBSTACLE_MARGIN;
  const availEnd = x1 - OBSTACLE_MARGIN;
  if (availEnd - availStart < 48) return;

  const pool = [];
  if (jumpObsCd <= 0) {
    pool.push({
      w: 24, minW: 36,
      run(x) {
        if (nearDuckHazards(x, 36)) return false;
        walls.push({ x, w: 36 });
        markJumpAction();
        return true;
      },
    });
    pool.push({
      w: 28, minW: 28,
      run(x) {
        const big = Math.random() < (d > 250 ? 0.3 : 0.18);
        const mw = big ? 46 : 28;
        if (nearDuckHazards(x, mw)) return false;
        monsters.push({ x, big, hp: big ? 2 : 1, phase: Math.random() * 6.28 });
        markJumpAction();
        return true;
      },
    });
    if (d > 70) {
      pool.push({
        w: 14, minW: SPIKE_W,
        run(x) {
          if (nearDuckHazards(x, SPIKE_W)) return false;
          spikes.push({ x, w: SPIKE_W });
          markJumpAction();
          return true;
        },
      });
    }
  }
  if (duckObsCd <= 0) {
    pool.push({
      w: 24, minW: 150,
      run(x) {
        const bw = 100 + Math.random() * 50;
        if (x + bw > availEnd) return false;
        if (nearJumpHazards(x, bw)) return false;
        beams.push({ x, w: bw });
        markDuckAction();
        return true;
      },
    });
    if (d > 90) {
      pool.push({
        w: 14, minW: FLYER_W,
        run(x) {
          if (nearJumpHazards(x, FLYER_W)) return false;
          flyers.push({ x, baseY: FLYER_BASE_Y, phase: Math.random() * 6.28, w: FLYER_W });
          markDuckAction();
          return true;
        },
      });
    }
  }
  if (pool.length === 0) return;

  const totalW = pool.reduce((s, p) => s + p.w, 0);
  let pick = Math.random() * totalW;
  let chosen = pool.length - 1;
  for (let i = 0; i < pool.length; i++) {
    pick -= pool[i].w;
    if (pick <= 0) { chosen = i; break; }
  }
  const order = [chosen];
  for (let i = 0; i < pool.length; i++) if (i !== chosen) order.push(i);

  for (const idx of order) {
    const ent = pool[idx];
    const placed = tryPlace((x) => ent.run(x), availStart, availEnd, ent.minW);
    if (placed) {
      featureCooldown = 2 + Math.floor(d / 400);
      return;
    }
  }
}

function trySpawnBat(d) {
  if (d <= 60 || bonusActive || Math.random() >= 0.09) return;
  const by = GROUND - 65 - Math.random() * 110;
  bats.push({ x: W + 36, y: by, phase: Math.random() * 6.28, hp: 1 });
}

// ===================== 世界生成 =====================
function spawnFeature(x0, x1, afterGap) {
  // ---- 局内道具刷新（≈3个/1000m，在金币之前生成避免冲突）----
  // 放在 bonus/tutorial 检查之前，确保奖励空间内也能刷新道具
  if (!tutorialActive && !afterGap && distanceM() >= puSpawnNextM) {
    const puSpan = (x1 - x0) - 2 * OBSTACLE_MARGIN;
    if (puSpan >= 60) {
      for (let t = 0; t < 6; t++) {
        const puX = x0 + OBSTACLE_MARGIN + Math.random() * Math.max(1, puSpan - 40);
        if (isRangeFree(puX, 30, 20)) {
          const r = Math.random();
          // 奖励空间内只刷磁铁和双倍金币（攻击/起飞在安全区无意义）
          const type = bonusActive
            ? (r < 0.55 ? 'magnet' : 'double')
            : (r < 0.30 ? 'magnet' : r < 0.60 ? 'double' : r < 0.85 ? 'attack' : 'fly');
          powerups.push({ x: puX, y: GROUND - 60, type, phase: Math.random() * 6.28 });
          break;
        }
      }
    }
    // 奖励空间内道具刷新更频繁（每150-250m）
    puSpawnNextM = distanceM() + (bonusActive ? 150 + Math.random() * 100 : 120 + Math.random() * 140);
  }

  // 奖励空间：只生成金币，无障碍无怪物
  if (bonusActive) {
    const span = (x1 - x0) - 2 * OBSTACLE_MARGIN;
    if (span >= 60) {
      const n = 4 + Math.floor(Math.random() * 3);
      const spacing = 40;
      const startX = x0 + OBSTACLE_MARGIN + Math.max(0, (span - (n - 1) * spacing) * 0.2);
      for (let i = 0; i < n; i++) {
        const cx = startX + i * spacing;
        if (cx > x1 - OBSTACLE_MARGIN) break;
        const t = n > 1 ? i / (n - 1) : 0;
        const cy = GROUND - 52 - Math.sin(t * Math.PI) * 42;
        coins.push({ x: cx, y: cy, bob: i * 0.5, taken: false });
      }
    }
    return;
  }

  // 教程模式：不在 spawnFeature 中生成障碍物（教程物品在 update 循环中基于距离精确生成）
  if (tutorialActive) return;

  const d = distanceM();
  spawnSegmentCoins(x0, x1, d);

  if (!afterGap) {
  if (duckObsCd > 0) duckObsCd--;
  if (jumpObsCd > 0) jumpObsCd--;
    trySpawnObstacle(x0, x1, d);
    trySpawnBat(d);
  }

  // ---- 传送门生成 ----
  if (!bonusActive && !portal && distanceM() >= nextPortalDist) {
    // 在当前段面生成传送门
    const px2 = x0 + OBSTACLE_MARGIN + Math.random() * Math.max(1, (x1 - x0) - 2 * OBSTACLE_MARGIN - 60);
    if (isRangeFree(px2, 50, 30)) {
      portal = { x: px2, y: GROUND - 80, phase: 0 };
    }
  }
}

function genStep() {
  const d = distanceM();

  // 教程模式：脚本化生成
  if (tutorialActive) {
    // 检查教程坑洞：基于距离触发，坑洞在 genX 处生成
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      if (tutorialSpawned.has(i)) continue;
      const ts = TUTORIAL_STEPS[i];
      if (ts.type !== 'gap') continue;
      // 屏幕坐标：坑洞到达角色时距离 = ts.m + 前置量(给玩家反应时间)
      const screenX = CHAR_X + (ts.m - distanceM()) * PX_PER_METER + TUTORIAL_LEAD_PX;
      if (screenX <= genX + 10) {
        tutorialSpawned.add(i);
        // 填补 genX 到坑洞位置之间的空隙（如果有）
        if (screenX > genX) {
          platforms.push({ x0: genX, x1: screenX });
          spawnFeature(genX, screenX, false);
          genX = screenX;
        }
        const gapW = 68; // 单次跳跃可过（过宽会逼出二段跳）
        gaps.push({ x: genX, w: gapW });
        genX += gapW;
        gapCooldown = 3;
        platformAfterGap = 0;
        return;
      }
    }
    // 无教程坑洞：生成常规段路面
    const len = 200 + Math.random() * 80;
    platforms.push({ x0: genX, x1: genX + len });
    spawnFeature(genX, genX + len, platformAfterGap === 0);
    genX += len;
    gapCooldown = Math.max(0, gapCooldown - 1);
    platformAfterGap++;
    return;
  }

  // 奖励空间：只生成平地（无坑洞、无高台），spawnFeature 生成金币
  if (bonusActive) {
    const len = 200 + Math.random() * 80;
    platforms.push({ x0: genX, x1: genX + len });
    spawnFeature(genX, genX + len, false);
    genX += len;
    return;
  }

  const gapChance = d < 40 ? 0.08 : Math.min(0.20, 0.10 + d / 14000);
  const isGap = gapCooldown <= 0 && jumpObsCd <= 0 && duckObsCd <= 0 && Math.random() < gapChance;
  if (isGap) {
    // 后期坑洞加宽：300m 开始渐增，600m 后达到 130-180px
    let w;
    if (d < 300) {
      w = GAP_W_MIN + Math.random() * (GAP_W_MAX - GAP_W_MIN);           // 80-120px
    } else if (d < 600) {
      const t = (d - 300) / 300;                                         // 0→1
      const minW = GAP_W_MIN + t * (GAP_W_LATE_MIN - GAP_W_MIN);
      const maxW = GAP_W_MAX + t * (GAP_W_LATE_MAX - GAP_W_MAX);
      w = minW + Math.random() * (maxW - minW);
    } else {
      w = GAP_W_LATE_MIN + Math.random() * (GAP_W_LATE_MAX - GAP_W_LATE_MIN); // 130-180px
    }
    gaps.push({ x: genX, w });
    genX += w;
    gapCooldown = GAP_COOLDOWN;
    platformAfterGap = 0;
    markJumpAction();
    return;
  }

  // 坑后首段路面更长 + 安全区；远距离段面缩短增加密度
  const dLen = Math.max(0, (500 - Math.min(500, d)) / 500); // 1→0 随距离递减
  let len;
  if (platformAfterGap === 0) {
    len = 260 + dLen * 20 + Math.random() * (120 + dLen * 20);  // 着陆缓冲段：280-420px → 260-380px
  } else {
    len = 170 + dLen * 20 + Math.random() * (140 + dLen * 20);  // 常规段：190-350px → 170-310px
  }
  platforms.push({ x0: genX, x1: genX + len });
  spawnFeature(genX, genX + len, platformAfterGap === 0);
  genX += len;

  // 高台：需跳跃；且不得紧贴横梁/飞物（否则跳上高台后立刻要蹲）
  if (d > 120 && platformAfterGap >= 2 && jumpObsCd <= 0 && duckObsCd <= 0 && gapCooldown > 1 && Math.random() < 0.14) {
    const pw = PLATFORM_W_MIN + Math.random() * (PLATFORM_W_MAX - PLATFORM_W_MIN);
    const segStart = genX - len;
    for (let t = 0; t < 6; t++) {
      const px0 = segStart + OBSTACLE_MARGIN + Math.random() * Math.max(1, len - pw - 2 * OBSTACLE_MARGIN);
      if (isRangeFree(px0, pw) && !nearDuckHazards(px0, pw)) {
        elevatedPlatforms.push({ x0: px0, x1: px0 + pw, y: PLATFORM_H });
        markJumpAction();
        break;
      }
    }
  }

  gapCooldown = Math.max(0, gapCooldown - 1);
  platformAfterGap++;
}

function ensureGen() {
  while (genX < W + 400) genStep();
}

// ===================== 奖励空间金币生成 =====================
function spawnBonusCoins() {
  // 奖励空间：以可读弧线为主，减少杂乱之字
  for (let batch = 0; batch < 6; batch++) {
    const baseX = genX + batch * 220 + Math.random() * 60;
    const roll = Math.random();
    const pattern = roll < 0.72 ? 1 : (roll < 0.90 ? 0 : 2);
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const cx = baseX + i * 40;
      const t = n > 1 ? i / (n - 1) : 0;
      let cy;
      if (pattern === 1) cy = GROUND - 55 - Math.sin(t * Math.PI) * 55;
      else if (pattern === 0) cy = GROUND - 48;
      else cy = i % 2 === 0 ? GROUND - 42 : GROUND - 95;
      coins.push({ x: cx, y: cy, bob: i * 0.5, taken: false });
    }
  }
}

// 奖励空间收尾金币爆发（最后 50m 生成大金币弧）
function spawnBonusFinale() {
  const baseX = genX;
  const n = 12;
  for (let i = 0; i < n; i++) {
    const cx = baseX + i * 35;
    const t = n > 1 ? i / (n - 1) : 0;
    const cy = GROUND - 40 - Math.sin(t * Math.PI) * 100;
    coins.push({ x: cx, y: cy, bob: i * 0.3, taken: false });
  }
}

// ===================== 游戏控制 =====================
function reset() {
  if (!assetsReady) return;
  platforms = []; gaps = []; walls = []; beams = [];
  monsters = []; fireballs = []; floats = []; coins = [];
  elevatedPlatforms = []; spikes = []; flyers = []; bats = [];
  px = 0; vy = 0; ducking = false; rollTimer = 0; rollCdTimer = 0; fastFalling = false; atkCd = 0; attackFx = 0;
  worldX = 0; killCount = 0; runTime = 0;
  genX = 0; gapCooldown = 3; invincible = 0;
  energy = ENERGY_MAX; canDoubleJump = false;
  lastMilestone = 0; milestoneFx = 0; milestoneText = '';
  coinPickups = 0; featureCooldown = 0; duckObsCd = 0; jumpObsCd = 0; platformAfterGap = 0;
  powerups = []; puSpawnNextM = tutorialActive ? 280 : 80; puTimers = { magnet: 0, double: 0, attack: 0 };
  onPlatformY = 0;
  skySprintTime = 0; skySprintActive = false; skySprintDurActive = SKY_SPRINT_DUR;
  swordSwings = [];
  warriorSlashT = 0;
  orbitAngle = 0;
  orbitShootCd = 0;
  orbitOrbs = [];
  pendingMageShot = null;
  mageMuzzleFx = 0;
  knightShelter = 0; knightShelterCdTimer = 0; knightShelterCdActive = false;
  tutorialActive = !tutorialDone;
  tutorialStep = 0;
  tutorialShown = false;
  tutorialActionDone = false;
  tutorialWaitTimer = 0;
  tutorialSpawned.clear();
  // 初始安全区：200px 地面（缩短真空期，首段 genStep 自动追加缓冲段）
  platforms.push({ x0: -20, x1: 200 });
  genX = 200;
  ensureGen();
  hp = charMaxHpSlots();
  shield = charMaxShdSlots();
  itemShield = 0;
  if (isWarrior() && charData.warrior.talent > 0) {
    knightShelter = 1;
    knightShelterCdActive = false;
    knightShelterCdTimer = 0;
  }
  // 奖励空间重置
  bonusActive = false; bonusDist = 0;
  nextPortalDist = 1500 + Math.random() * 1500;
  portal = null; transitionFx = 0; bonusReturnDist = 0;
  bonusFinaleSpawned = false;
  // 道具状态重置 + 从 ownedItems 装备选中的道具
  activeItems = { double: false, revive: false };
  itemTimers = { magnet: 0 };
  if (equippedItems.revive && ownedItems.revive > 0) { activeItems.revive = true; ownedItems.revive--; }
  if (equippedItems.double && ownedItems.double > 0) { activeItems.double = true; ownedItems.double--; }
  if (equippedItems.shield && ownedItems.shield > 0) { itemShield++; ownedItems.shield--; }
  // 磁铁为主动道具，不自动装备；游戏内按 1 手动使用
  saveItems(ownedItems);
  equippedItems = { magnet: false, shield: false, double: false, revive: false };
  refreshItemEquip();
  over = false;
  lastTs = performance.now();
  running = true;
  hudCache.m = hudCache.g = hudCache.s = -1;
  document.getElementById('screen-game').classList.add('is-playing');
  startBtn.textContent = '重新开始';
  startBtn.disabled = true;
  homeBtn.style.display = 'none';
  initAudio();
  startBGM();
  startFrameLoop();
}

function backToMenu() {
  running = false;
  document.getElementById('screen-game').classList.remove('is-playing');
  stopBGM();
  homeBtn.style.display = 'none';
  startBtn.textContent = '开始游戏';
  startBtn.disabled = !assetsReady;
  // 退出全屏（横版布局在重新进入游戏画面时由 applyMobileLayout 重新应用）
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  document.getElementById('screen-game').classList.remove('game-landscape');
  landscapeMode = false;
  landscapeBtn.textContent = isMobile() ? '全屏' : '横屏模式';
  show('screen-menu');
}

function gameOver() {
  // 复活币：自动使用；必须拉回地面，否则掉坑死亡会下一帧再次触发秒死
  if (activeItems.revive) {
    activeItems.revive = false;
    hp = charMaxHpSlots();
    invincible = 2;
    px = 0;
    vy = 0;
    onPlatformY = 0;
    ducking = false;
    rollTimer = 0;
    fastFalling = false;
    running = true;
    over = false;
    clearAhead(CHAR_X + 500, { featureCd: 3, gapCd: 3 });
    floats.push({ x: CHAR_X, y: GROUND - 260, t: 1.5, text: '复活!' });
    sfxSprint();
    return;
  }
  running = false;
  over = true;
  document.getElementById('screen-game').classList.remove('is-playing');
  stopBGM();
  save(LS.plays, load(LS.plays, 0) + 1);
  save(LS.time, load(LS.time, 0) + Math.floor(runTime));
  const earned = goldEarned();
  gold += earned;
  save(LS.gold, gold);
  if (scoreM() > best) {
    best = scoreM();
    save(LS.best, best);
    bestEl.textContent = best;
  }
  // 最高分保存
  const sv = scoreVal();
  if (sv > bestScore) {
    bestScore = sv;
    save(LS.score, bestScore);
  }
  startBtn.textContent = `再来一局（本局 +${earned} 金币）`;
  startBtn.disabled = false;
  homeBtn.style.display = 'inline-block';
  refreshItemEquip();
  draw();
}

function hurtPlayer(dmg) {
  if (invincible > 0 || skySprintActive) return;
  if (isWarrior() && warriorParryUnlocked() && warriorSlashT > 0) {
    floats.push({ x: CHAR_X, y: GROUND - px - U - 20, t: 0.9, shield: true, text: '格挡!' });
    sfxHit();
    return;
  }
  if (isWarrior() && knightShelter > 0 && charData.warrior.talent > 0) {
    knightShelter--;
    triggerSkySprint(SHELTER_FLY_DUR);
    knightShelterCdActive = true;
    knightShelterCdTimer = 0;
    floats.push({ x: CHAR_X, y: GROUND - 260, t: 1.5, shield: true, text: '庇护!' });
    return;
  }
  if (shield > 0) {
    shield--;
    triggerSkySprint();
    return;
  }
  if (itemShield > 0 && hp - dmg <= 0) {
    itemShield--;
    triggerSkySprint();
    return;
  }
  hp = Math.max(0, hp - dmg);
  invincible = 1.2;
  sfxHurt();
  if (hp <= 0) gameOver();
}

function triggerSkySprint(dur) {
  skySprintDurActive = dur ?? SKY_SPRINT_DUR;
  skySprintActive = true;
  skySprintTime = 0;
  invincible = 999;
  px = SKY_SPRINT_H;
  vy = 0;
  ducking = false;
  sfxSprint();
  floats.push({ x: CHAR_X, y: GROUND - 260, t: 1.5, shield: true, text: '起飞!' });
}

function escapePit() {
  if (window.testCheat) { px = 0; vy = 0; return; }
  if (isWarrior() && knightShelter > 0 && charData.warrior.talent > 0) {
    knightShelter--;
    triggerSkySprint(SHELTER_FLY_DUR);
    knightShelterCdActive = true;
    knightShelterCdTimer = 0;
  } else if (itemShield > 0) {
    itemShield--;
    triggerSkySprint();
  } else if (shield > 0) {
    shield--;
    triggerSkySprint();
  } else {
    hp = 0;
    gameOver();
  }
}

function triggerRoll() {
  if (rollCdTimer > 0) return;
  rollTimer = ROLL_DUR;
  rollCdTimer = ROLL_DUR + ROLL_CD;
  invincible = Math.max(invincible, ROLL_DUR * 0.8);
  sfxRoll();
}

function damageMonster(mo, dmg) {
  mo.hp -= dmg;
  if (mo.hp <= 0) {
    const mh = mo.big ? 2 * U : 1 * U;
    const mw = mo.big ? 46 : 28;
    const idx = monsters.indexOf(mo);
    if (idx >= 0) monsters.splice(idx, 1);
    killCount++;
    sfxKill();
    floats.push({ x: mo.x + mw / 2, y: GROUND - mh - 16, t: 0.9, text: `+${KILL_GOLD}` });
    return true;
  }
  sfxHit();
  return false;
}

function damageBat(bat, dmg) {
  bat.hp -= dmg;
  if (bat.hp <= 0) {
    const idx = bats.indexOf(bat);
    if (idx >= 0) bats.splice(idx, 1);
    killCount++;
    sfxKill();
    floats.push({ x: bat.x + BAT_W / 2, y: bat.y - 12, t: 0.9, text: `+${KILL_GOLD}` });
    return true;
  }
  sfxHit();
  return false;
}

function meleeHitInRange(range) {
  const fy = GROUND - px - U * (ducking ? 0.5 : 1);
  const box = { x: CHAR_X + CHAR_W / 2, y: fy - 36, w: range, h: 48 };
  const dmg = isWarrior() ? warriorAtkPower() : 1;
  for (let i = monsters.length - 1; i >= 0; i--) {
    const mo = monsters[i];
    const mh = mo.big ? 2 * U : 1 * U;
    const mw = mo.big ? 46 : 28;
    const mb = { x: mo.x, y: GROUND - mh, w: mw, h: mh };
    if (!overlap(box, mb)) continue;
    if (damageMonster(mo, dmg)) continue;
  }
  for (let j = flyers.length - 1; j >= 0; j--) {
    const f = flyers[j];
    const ffy = f.baseY + Math.sin(animT * 2 + f.phase) * FLYER_AMP;
    const fb = { x: f.x, y: ffy - FLYER_H / 2, w: f.w, h: FLYER_H };
    if (overlap(box, fb)) {
      flyers.splice(j, 1);
      killCount++;
      sfxKill();
      floats.push({ x: f.x + f.w / 2, y: ffy - 20, t: 0.9, text: `+${KILL_GOLD}` });
    }
  }
  for (let k = bats.length - 1; k >= 0; k--) {
    const bat = bats[k];
    const bb = { x: bat.x, y: bat.y - BAT_H / 2, w: BAT_W, h: BAT_H };
    if (overlap(box, bb)) damageBat(bat, dmg);
  }
}

function attack() {
  if (atkCd > 0) return;
  const atkBoost = puTimers.attack > 0;
  if (isWarrior()) {
    attackFx = SWORD_SLASH_DUR;
    atkCd = atkBoost ? WARRIOR_ATTACK_CD * 0.7 : WARRIOR_ATTACK_CD;
    const range = swordRange() * (atkBoost ? 1.2 : 1);
    warriorSlashT = SWORD_SLASH_DUR;
    swordSwings.push({ t: SWORD_SLASH_DUR, dur: SWORD_SLASH_DUR, range });
    meleeHitInRange(range);
    sfxAttack();
  } else {
    const cost = atkBoost ? ENERGY_COST * 0.5 : ENERGY_COST;
    if (energy < cost || fireballs.length >= MAX_BULLETS) return;
    atkCd = atkBoost ? ATTACK_CD * 0.55 : ATTACK_CD;
    energy -= cost;
    attackFx = MAGE_ATK_DUR;
    const fy = GROUND - px - U * (ducking ? 0.55 : 1.05);
    const fbs = atkBoost ? fbSpeed() * 1.45 : fbSpeed();
    pendingMageShot = { delay: MAGE_ATK_FIRE_AT, fy, fbs };
    tryChargeOrbitOrb();
    sfxAttack();
  }
  if (tutorialShown && tutorialStep < TUTORIAL_STEPS.length && TUTORIAL_STEPS[tutorialStep].action === 'attack') tutorialActionDone = true;
}

function mageStaffTip() {
  return {
    x: CHAR_X + CHAR_W / 2 + 16,
    y: GROUND - px - U * (ducking ? 0.55 : 1.05),
  };
}

function releasePendingMageShot() {
  if (!pendingMageShot) return;
  const tip = mageStaffTip();
  const fy = pendingMageShot.fy ?? tip.y;
  const fbs = pendingMageShot.fbs;
  fireballs.push({
    x: tip.x,
    y: fy,
    vx: fbs * 0.45 + speed() * 0.6,
    vy: -28,
    accel: fbs * 2.4,
    birth: 0.12,
    life: 2.2,
  });
  mageMuzzleFx = 0.12;
  pendingMageShot = null;
}

function findNearestHostile(maxX) {
  let best = null;
  let bestDist = maxX;
  for (const mo of monsters) {
    const dx = mo.x - CHAR_X;
    if (dx < 12 || dx > maxX) continue;
    if (dx < bestDist) {
      bestDist = dx;
      const mh = mo.big ? 2 * U : 1 * U;
      best = { x: mo.x + (mo.big ? 23 : 14), y: GROUND - mh * 0.6 };
    }
  }
  for (const bat of bats) {
    const dx = bat.x - CHAR_X;
    if (dx < 12 || dx > maxX) continue;
    if (dx < bestDist) {
      bestDist = dx;
      best = { x: bat.x + BAT_W / 2, y: bat.y };
    }
  }
  for (const f of flyers) {
    const fy = f.baseY + Math.sin(animT * 2 + f.phase) * FLYER_AMP;
    const dx = f.x - CHAR_X;
    if (dx < 12 || dx > maxX) continue;
    if (dx < bestDist) {
      bestDist = dx;
      best = { x: f.x + f.w / 2, y: fy };
    }
  }
  return best;
}

function mageOrbitCenterY() {
  return GROUND - px - (ducking ? CHAR_H_DUCK * 0.55 : U);
}

function orbitSlotPos(slot) {
  const a = orbitAngle + slot * (Math.PI * 2 / ORBIT_COUNT);
  return {
    x: CHAR_X + Math.cos(a) * ORBIT_R,
    y: mageOrbitCenterY() + Math.sin(a) * ORBIT_R * 0.58,
  };
}

/** 无怪时攻击：蓄一颗环绕火球 */
function tryChargeOrbitOrb() {
  if (!mageOrbitUnlocked()) return;
  if (findNearestHostile(ORBIT_SEEK_RANGE)) return;
  const used = new Set(orbitOrbs.map((o) => o.slot));
  for (let s = 0; s < ORBIT_COUNT; s++) {
    if (used.has(s)) continue;
    orbitOrbs.push({ slot: s, appear: 0 });
    sfxOrbitReady();
    return;
  }
}

/** 有怪时：环绕球依次飞出索敌，命中后消失 */
function updateOrbitOrbs(dt) {
  if (!running || !isMage() || !mageOrbitUnlocked()) {
    orbitOrbs = [];
    return;
  }
  orbitAngle += dt * 2.85;
  for (const o of orbitOrbs) o.appear = Math.min(1, (o.appear || 0) + dt * 5);
  orbitShootCd = Math.max(0, orbitShootCd - dt);
  if (orbitShootCd > 0 || !orbitOrbs.length || fireballs.length >= MAX_BULLETS) return;
  const target = findNearestHostile(ORBIT_SEEK_RANGE);
  if (!target) return;

  let bestI = 0;
  let bestX = -1e9;
  for (let i = 0; i < orbitOrbs.length; i++) {
    const p = orbitSlotPos(orbitOrbs[i].slot);
    if (p.x > bestX) { bestX = p.x; bestI = i; }
  }
  const orb = orbitOrbs.splice(bestI, 1)[0];
  const p = orbitSlotPos(orb.slot);
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const spd = fbSpeed() * 1.4;
  fireballs.push({
    x: p.x,
    y: p.y,
    vx: (dx / len) * spd * 0.75 + speed() * 0.45,
    vy: (dy / len) * spd * 0.75,
    homeSpd: spd,
    homing: true,
    life: 1.4,
    orbit: true,
    birth: 0.05,
  });
  orbitShootCd = ORBIT_SHOOT_CD;
  sfxOrbitLaunch();
}

// ===================== 主更新循环 =====================
function update(dt) {
  // 测试模式：无敌+防掉坑
  if (window.testCheat) { invincible = 999; hp = Math.max(hp, 1); if (px < 0) { px = 0; vy = 0; } }
  const tutFreeze = tutorialActionFreezing();
  // 动作提示冻结世界时，不消耗翻滚/冷却（否则提示期间翻滚已结束，恢复滚动必撞梁）
  if (!tutFreeze) {
    rollTimer = Math.max(0, rollTimer - dt);
    rollCdTimer = Math.max(0, rollCdTimer - dt);
  }
  let spd = speed();
  atkCd = Math.max(0, atkCd - dt);
  attackFx = Math.max(0, attackFx - dt);
  invincible = Math.max(0, invincible - dt);
  runTime += dt;
  for (let i = swordSwings.length - 1; i >= 0; i--) {
    swordSwings[i].t -= dt;
    if (swordSwings[i].t <= 0) swordSwings.splice(i, 1);
  }
  warriorSlashT = Math.max(0, warriorSlashT - dt);
  if (pendingMageShot) {
    pendingMageShot.delay -= dt;
    if (pendingMageShot.delay <= 0) releasePendingMageShot();
  }
  mageMuzzleFx = Math.max(0, mageMuzzleFx - dt);
  updateOrbitOrbs(dt);
  if (running && isWarrior() && charData.warrior.talent > 0 && knightShelterCdActive) {
    knightShelterCdTimer += dt;
    const maxS = shelterMaxStacks();
    if (knightShelterCdTimer >= shelterCdSec()) {
      if (knightShelter < maxS) {
        knightShelter++;
        knightShelterCdTimer = 0;
        if (knightShelter >= maxS) knightShelterCdActive = false;
      } else knightShelterCdActive = false;
    }
  }
  // 道具计时器
  if (itemTimers.magnet > 0) itemTimers.magnet = Math.max(0, itemTimers.magnet - dt);
  for (const k of PU_KEYS) if (puTimers[k] > 0) puTimers[k] = Math.max(0, puTimers[k] - dt);
  // 过渡特效计时
  if (transitionFx > 0) transitionFx = Math.max(0, transitionFx - dt * 2.5);

  // 能量回复（仅法师）
  if (isMage()) energy = Math.min(ENERGY_MAX, energy + energyRegen() * dt);

  // 里程碑检测（每 100m 通知）
  milestoneFx = Math.max(0, milestoneFx - dt);
  const ms = Math.floor(scoreM() / 100) * 100;
  if (ms > 0 && ms > lastMilestone) {
    lastMilestone = ms;
    milestoneFx = 2.0;
    milestoneText = ms + 'm!';
  }

  // 教程进度推进（交互式：动作完成或等待结束才推进）
  if (tutorialActive) {
    const d = distanceM();
    if (!tutorialShown && tutorialStep < TUTORIAL_STEPS.length) {
      const step = TUTORIAL_STEPS[tutorialStep];
      if (d >= step.m) {
        tutorialShown = true;
        tutorialActionDone = false;
        tutorialWaitTimer = step.wait || 0;
      }
    }
    if (tutorialShown && tutorialStep < TUTORIAL_STEPS.length) {
      const step = TUTORIAL_STEPS[tutorialStep];
      if (step.action) {
        if (tutorialActionDone) {
          tutorialStep++;
          tutorialShown = false;
        }
      } else {
        tutorialWaitTimer -= dt;
        if (tutorialWaitTimer <= 0) {
          tutorialStep++;
          tutorialShown = false;
        }
      }
    }
    if (tutorialStep >= TUTORIAL_STEPS.length && !tutorialShown) {
      tutorialActive = false;
      tutorialDone = 1;
      save(LS.tut, 1);
    }
  }

  // 教程动作提示期间暂停世界滚动，避免怪物/障碍离屏后教程步骤永久卡住。
  if (tutFreeze) spd = 0;

  // 世界位移
  worldX += spd * dt;

  // 奖励空间距离追踪
  if (bonusActive) {
    bonusDist += spd * dt / PX_PER_METER;
    // 最后 50m 触发收尾金币弧（仅触发一次）
    if (bonusDist >= BONUS_DIST_MAX - 50 && !bonusFinaleSpawned) {
      bonusFinaleSpawned = true;
      spawnBonusFinale();
    }
    if (bonusDist >= BONUS_DIST_MAX) {
      // 奖励空间结束
      bonusActive = false;
      nextPortalDist = distanceM() + 1500 + Math.random() * 1500;
      transitionFx = 1.0;
      // 清除残留金币，恢复正常世界
      coins = [];
      featureCooldown = 2;
      gapCooldown = 3;
    }
  }

  // 传送门碰撞检测
  if (portal && !bonusActive) {
    const pcx = CHAR_X + CHAR_W / 2;
    const pcy = GROUND - px - U;
    const dx = portal.x - pcx;
    const dy = portal.y - pcy;
    if (dx * dx + dy * dy < 50 * 50) {
      // 进入奖励空间
      bonusReturnDist = distanceM();
      bonusActive = true;
      bonusDist = 0;
      bonusFinaleSpawned = false;
      transitionFx = 1.0;
      portal = null;
      // 清空所有障碍物、怪物（保留金币机制由奖励空间生成覆盖）
      walls = []; beams = []; monsters = []; spikes = []; flyers = []; bats = []; elevatedPlatforms = []; gaps = [];
      // 保留局内道具实体和已激活的道具效果，让磁铁/双倍在奖励空间继续生效
      // 确保连续地面（填补可能的坑洞）
      platforms.push({ x0: CHAR_X - 40, x1: CHAR_X + 1200 });
      // 生成奖励空间专用金币（大量，多种排列）
      spawnBonusCoins();
    }
  }

  // 实体左移（含金币、高台、地刺、飞行障碍）
  for (const arr of [platforms, gaps, walls, beams, monsters, elevatedPlatforms, spikes]) {
    for (const o of arr) {
      if (o.x0 !== undefined) { o.x0 -= spd * dt; o.x1 -= spd * dt; }
      else if (o.x !== undefined) o.x -= spd * dt;
    }
  }
  for (const f of flyers) f.x -= spd * dt;
  for (const b of bats) {
    b.x -= (spd + BAT_EXTRA_VX) * dt;
    b.y += Math.sin(animT * 4 + b.phase) * 28 * dt;
  }
  for (const c of coins) c.x -= spd * dt;
  for (const p of powerups) p.x -= spd * dt;
  if (portal) portal.x -= spd * dt;
  genX -= spd * dt;

  // 清理离屏实体（原地清理，避免 GC 压力）
  cullInPlace(platforms, (p) => p.x1 > -60);
  cullInPlace(gaps, (g) => g.x + g.w > -60);
  cullInPlace(walls, (w) => w.x + w.w > -60);
  cullInPlace(beams, (b) => b.x + b.w > -60);
  cullInPlace(monsters, (m) => m.x > -80);
  cullInPlace(elevatedPlatforms, (p) => p.x1 > -60);
  cullInPlace(spikes, (s) => s.x + s.w > -60);
  cullInPlace(flyers, (f) => f.x > -80);
  cullInPlace(bats, (b) => b.x > -80 && b.y > 20 && b.y < H - 20);
  cullInPlace(coins, (c) => c.x > -40 && !c.taken);
  cullInPlace(powerups, (p) => p.x > -40);
  // 传送门离屏清理
  if (portal && portal.x < -60) portal = null;

  ensureGen();

  // 教程物品生成（基于距离触发，放置在正确屏幕坐标，物品到达角色时距离 = ts.m + 前置量）
  if (tutorialActive) {
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      if (tutorialSpawned.has(i)) continue;
      const ts = TUTORIAL_STEPS[i];
      if (ts.type === 'info' || ts.type === 'gap') continue;
      const screenX = CHAR_X + (ts.m - distanceM()) * PX_PER_METER + TUTORIAL_LEAD_PX;
      if (screenX < CHAR_X - 50) { tutorialSpawned.add(i); continue; } // 已错过，标记跳过
      if (screenX > W + 300) continue; // 还没到时间，等下一帧再检查
      tutorialSpawned.add(i);
      if (ts.type === 'wall') walls.push({ x: screenX, w: 28, h: 44 }); // 火桩，一跳可过
      else if (ts.type === 'beam') beams.push({ x: screenX, w: 88 });
      else if (ts.type === 'monster') {
        // 教程小怪刷两只，防止提前打死导致教程卡住
        monsters.push({ x: screenX, big: false, hp: 1, phase: Math.random() * 6.28 });
        monsters.push({ x: screenX + 100, big: false, hp: 1, phase: Math.random() * 6.28 });
      }
      else if (ts.type === 'coins') {
        for (let j = 0; j < 4; j++)
          coins.push({ x: screenX + j * 44, y: GROUND - 55, bob: j * 0.5, taken: false });
      }
    }
  }

  // 玩家物理
  if (skySprintActive) {
    skySprintTime += dt;
    px = SKY_SPRINT_H;
    vy = 0;
    ducking = false; rollTimer = 0;
    if (skySprintTime >= skySprintDurActive) {
      skySprintActive = false;
      invincible = 2.0;
      px = 0;
      // 着陆安全区：30m（780px）内无障碍无怪物
      clearAhead(CHAR_X + 780, { featureCd: 4, gapCd: 4 });
    }
  } else {
    // 翻滚触发：单次按下，地面时启动
    if (duckPressed && px <= 0.5 + onPlatformY) triggerRoll();
    ducking = rollTimer > 0;
    if (ducking && tutorialShown && tutorialStep < TUTORIAL_STEPS.length && TUTORIAL_STEPS[tutorialStep].action === 'duck') tutorialActionDone = true;
    const wantJump = keys.has('KeyW') || keys.has('ArrowUp') || keys.has('Space');

    // 检查是否还在高台上（走出了高台边缘就掉落）
    if (onPlatformY > 0) {
      const onPlat = elevatedPlatforms.some((p) =>
        CHAR_X >= p.x0 && CHAR_X <= p.x1 && p.y === onPlatformY
      );
      if (!onPlat) onPlatformY = 0;
    }

    const currentGround = onPlatformY;
    const grounded = px <= currentGround + 0.5 && vy <= 0 && (currentGround > 0 || groundAt(CHAR_X));

    // 空中按下蹲伏 → 快速落地（教程冻结时不触发，避免提前落地）
    if (!tutFreeze && duckPressed && !grounded && !fastFalling) {
      vy = -FAST_FALL_V;
      fastFalling = true;
    }

    if (grounded && wantJump) {
      vy = JUMP_V;
      px = currentGround + 0.1;
      canDoubleJump = true;
      sfxJump();
      if (tutorialShown && tutorialStep < TUTORIAL_STEPS.length && TUTORIAL_STEPS[tutorialStep].action === 'jump') tutorialActionDone = true;
    } else if (!tutFreeze && !grounded && jumpPressed && canDoubleJump) {
      // 二段跳：稍弱的主跳
      vy = Math.max(vy, 0) + DOUBLE_JUMP_V;
      canDoubleJump = false;
      fastFalling = false;
    }

    if (tutFreeze) {
      // 冻结期间起跳可升到最高点后悬停，恢复滚动后仍能越过墙/坑
      if (!grounded && vy !== 0) {
        px += vy * dt;
        vy -= GRAV * dt;
        if (vy < 0) vy = 0;
      }
    } else if (!grounded || vy > 0) {
      const g = fastFalling ? GRAV * 2.5 : GRAV;
      vy -= g * dt;
      const oldPx = px;
      px += vy * dt;
      if (vy < 0) {
        for (const p of elevatedPlatforms) {
          if (CHAR_X >= p.x0 && CHAR_X <= p.x1 && oldPx > p.y && px <= p.y) {
            px = p.y;
            vy = 0;
            onPlatformY = p.y;
            canDoubleJump = false;
            if (fastFalling) { fastFalling = false; triggerRoll(); }
            break;
          }
        }
      }
    }
    // 地面着陆检测
    if (!tutFreeze && onPlatformY === 0 && vy <= 0 && px <= 0 && groundAt(CHAR_X)) {
      px = 0;
      vy = 0;
      canDoubleJump = false;
      if (fastFalling) { fastFalling = false; triggerRoll(); }
    }
  }
  jumpPressed = false;
  duckPressed = false;

  const chH = ducking ? CHAR_H_DUCK : CHAR_H_STAND;

  // 掉坑判定（阈值 -25，确保高速时能掉入坑洞；起飞中跳过）
  if (px < -25 && !skySprintActive) {
    escapePit();
    if (!running) return;
  }

  const charBox = { x: CHAR_X - CHAR_W / 2, y: GROUND - px - chH, w: CHAR_W, h: chH };

  // 攻击
  if (keys.has('KeyJ')) attack();

  // 火球（子步进碰撞检测，防止高速穿透）
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fb = fireballs[i];
    if (fb.life != null) {
      fb.life -= dt;
      if (fb.life <= 0) { fireballs.splice(i, 1); continue; }
    }
    if (fb.birth != null && fb.birth > 0) fb.birth -= dt;
    if (fb.accel) {
      const cap = (fb.homeSpd || fbSpeed()) + speed() * 0.55;
      fb.vx += fb.accel * dt;
      if (fb.vx > cap) { fb.vx = cap; fb.accel = 0; }
    }
    if (fb.homing) {
      const t = findNearestHostile(360);
      if (t) {
        const dx = t.x - fb.x;
        const dy = t.y - fb.y;
        const len = Math.hypot(dx, dy) || 1;
        const spd = fb.homeSpd || fbSpeed();
        const wantVx = (dx / len) * spd + speed() * 0.5;
        const wantVy = (dy / len) * spd * 0.95;
        const k = Math.min(1, dt * 14);
        fb.vx += (wantVx - fb.vx) * k;
        fb.vy = (fb.vy || 0) + (wantVy - (fb.vy || 0)) * k;
      } else {
        fb.vx = Math.max(fb.vx, speed() + 220);
        fb.vy = (fb.vy || 0) * 0.9;
      }
    }
    const oldX = fb.x;
    const oldY = fb.y;
    fb.x += fb.vx * dt;
    fb.y += (fb.vy || 0) * dt;
    if (fb.y > GROUND - 8) { fb.y = GROUND - 8; fb.vy = Math.min(0, fb.vy || 0); }
    if (fb.y < 24) { fb.y = 24; fb.vy = Math.max(0, fb.vy || 0); }
    if (fb.x > W + 40 || fb.x < -50) { fireballs.splice(i, 1); continue; }
    // 子步进：在旧位置和新位置之间均匀采样检测
    const travel = Math.hypot(fb.x - oldX, fb.y - oldY);
    const subSteps = Math.max(1, Math.ceil(travel / 14));
    let hit = false;
    for (let s = 0; s <= subSteps && !hit; s++) {
      const u = s / subSteps;
      const checkX = oldX + (fb.x - oldX) * u;
      const checkY = oldY + (fb.y - oldY) * u;
      for (let j = monsters.length - 1; j >= 0; j--) {
        const mo = monsters[j];
        const mh = mo.big ? 2 * U : 1 * U;
        const mw = mo.big ? 46 : 28;
        const mb = { x: mo.x, y: GROUND - mh, w: mw, h: mh };
        const fbb = { x: checkX - FB_R, y: checkY - 15, w: FB_R * 2, h: 30 };
        if (overlap(fbb, mb)) {
          mo.hp -= mageAtkPower();
          hit = true;
          sfxHit();
          floats.push({ x: mo.x + mw / 2, y: GROUND - mh - 16, t: 0.7, text: `-${mageAtkPower()}` });
          if (mo.hp <= 0) {
            monsters.splice(j, 1);
            killCount++;
            sfxKill();
            floats.push({ x: mo.x + mw / 2, y: GROUND - mh - 34, t: 0.9, text: `+${KILL_GOLD}` });
          }
          break;
        }
      }
      if (!hit) {
        for (let j = flyers.length - 1; j >= 0; j--) {
          const f = flyers[j];
          const fy = f.baseY + Math.sin(animT * 2 + f.phase) * FLYER_AMP;
          const fb2 = { x: checkX - FB_R, y: checkY - 15, w: FB_R * 2, h: 30 };
          const fbox = { x: f.x, y: fy - FLYER_H / 2, w: f.w, h: FLYER_H };
          if (overlap(fb2, fbox)) {
            flyers.splice(j, 1);
            killCount++;
            sfxKill();
            hit = true;
            floats.push({ x: f.x + f.w / 2, y: fy - 20, t: 0.9, text: `+${KILL_GOLD}` });
            break;
          }
        }
      }
      if (!hit) {
        for (let j = bats.length - 1; j >= 0; j--) {
          const bat = bats[j];
          const fb2 = { x: checkX - FB_R, y: checkY - 15, w: FB_R * 2, h: 30 };
          const bbox = { x: bat.x, y: bat.y - BAT_H / 2, w: BAT_W, h: BAT_H };
          if (overlap(fb2, bbox)) {
            damageBat(bat, mageAtkPower());
            hit = true;
            break;
          }
        }
      }
    }
    if (hit) fireballs.splice(i, 1);
  }

  // 碰撞（起飞中免疫）
  if (!skySprintActive) {
    for (const wE of walls) {
      const wh = wallH(wE);
      const wb = { x: wE.x, y: GROUND - wh, w: wE.w, h: wh };
      if (overlap(charBox, wb)) hurtPlayer(1);
    }
    for (const bE of beams) {
      const bb = { x: bE.x, y: 0, w: bE.w, h: BEAM_BOTTOM };
      if (overlap(charBox, bb) && charBox.y < BEAM_BOTTOM) hurtPlayer(1);
    }
    // 地刺（仅地面层有效，高台上安全）
    for (const s of spikes) {
      const sb = { x: s.x, y: GROUND - SPIKE_H, w: s.w, h: SPIKE_H };
      if (overlap(charBox, sb)) hurtPlayer(1);
    }
    // 飞行障碍（上下浮动，需蹲伏或站高台避开）
    for (const f of flyers) {
      const fy = f.baseY + Math.sin(animT * 2 + f.phase) * FLYER_AMP;
      const fb = { x: f.x, y: fy - FLYER_H / 2, w: f.w, h: FLYER_H };
      if (overlap(charBox, fb)) hurtPlayer(1);
    }
    for (let bi = bats.length - 1; bi >= 0; bi--) {
      const bat = bats[bi];
      const bb = { x: bat.x, y: bat.y - BAT_H / 2, w: BAT_W, h: BAT_H };
      if (overlap(charBox, bb)) {
        hurtPlayer(1);
        bats.splice(bi, 1);
      }
    }
    for (let i = monsters.length - 1; i >= 0; i--) {
      const mo = monsters[i];
      const mh = mo.big ? 2 * U : 1 * U;
      const mw = mo.big ? 46 : 28;
      const mb = { x: mo.x, y: GROUND - mh, w: mw, h: mh };
      if (overlap(charBox, mb)) {
        const dmg = mo.hp;
        mo.hp = 0;
        monsters.splice(i, 1);
        floats.push({ x: mo.x, y: GROUND - mh - 16, t: 0.9, heart: true, text: `-${dmg}` });
        hurtPlayer(dmg);
        if (!running) return;
      }
    }
  }

  // 金币拾取
  // 起飞时自动附带磁铁效果（高空无法正常拾取）
  const magnetActive = itemTimers.magnet > 0 || puTimers.magnet > 0 || skySprintActive;
  const flying = skySprintActive;
  // 飞行时角色在高空(y≈240/120)，金币在地面(y≈360-440)，垂直差距大
  // 需要大幅扩大吸引范围和拉力速度，确保高速滚动时也能吸上来
  const magnetRange = flying ? 400 : 140;
  const pickupR = magnetActive ? (flying ? 180 : 120) : COIN_PICKUP_R;
  const pullSpeed = (flying ? 700 : 450) * dt;
  const cx = CHAR_X + CHAR_W / 2;
  const cy = GROUND - px - U;
  for (const c of coins) {
    if (c.taken) continue;
    // 起飞速度极快(2800px/s)，磁铁吸不动，直接收集屏幕内所有金币
    if (skySprintActive && c.x > -20 && c.x < W + 20) {
      c.taken = true;
      if (activeItems.double || puTimers.double > 0) { coinPickups += 2; floats.push({ x: c.x, y: c.y - 10, t: 0.6, text: `+${COIN_VALUE * 2}` }); }
      else { coinPickups++; floats.push({ x: c.x, y: c.y - 10, t: 0.6, text: `+${COIN_VALUE}` }); }
      continue;
    }
    let dx = c.x - cx;
    let dy = c.y - cy;
    // 磁铁吸引：将附近金币向角色移动
    if (magnetActive && dx * dx + dy * dy < magnetRange * magnetRange) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        c.x -= (dx / dist) * pullSpeed;
        c.y -= (dy / dist) * pullSpeed;
        // 重新计算距离用于拾取检测
        dx = c.x - cx;
        dy = c.y - cy;
      }
    }
    if (dx * dx + dy * dy < pickupR * pickupR) {
      c.taken = true;
      if (activeItems.double || puTimers.double > 0) { coinPickups += 2; floats.push({ x: c.x, y: c.y - 10, t: 0.6, text: `+${COIN_VALUE * 2}` }); }
      else { coinPickups++; floats.push({ x: c.x, y: c.y - 10, t: 0.6, text: `+${COIN_VALUE}` }); }
      sfxCoin();
      if (tutorialShown && tutorialStep < TUTORIAL_STEPS.length && TUTORIAL_STEPS[tutorialStep].action === 'coin') tutorialActionDone = true;
    }
  }

  // 道具拾取
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    const dx = p.x - cx;
    const dy = p.y - cy;
    if (dx * dx + dy * dy < 40 * 40) {
      if (p.type === 'fly') {
        sfxCoin();
        floats.push({ x: p.x, y: p.y - 10, t: 0.8, text: '起飞!' });
        powerups.splice(i, 1);
        triggerSkySprint();
      } else {
        puTimers[p.type] = PU[p.type].dur;
        sfxCoin();
        floats.push({ x: p.x, y: p.y - 10, t: 0.8, text: PU[p.type].name + '!' });
        powerups.splice(i, 1);
      }
    }
  }

  // 漂浮文字
  for (const f of floats) f.t -= dt;
  cullInPlace(floats, (f) => f.t > 0);

  // HUD 更新（值变化才写 DOM，减少强制布局）
  const sm = scoreM();
  const ge = goldEarned();
  const sv = scoreVal();
  if (sm !== hudCache.m) { hudCache.m = sm; scoreEl.textContent = sm; }
  if (ge !== hudCache.g) { hudCache.g = ge; hudGoldEl.textContent = ge; }
  if (sv !== hudCache.s) { hudCache.s = sv; hudScoreEl.textContent = sv; }
}

// ===================== 背景动画系统 =====================
// 多层视差 + 呼吸效果
const bgShapes = [];
const SHAPE_COLORS = ['#ff9a6b', '#c4a0ff', '#ffd4a8', '#8ec5ff', '#ffb088'];

// 星空
for (let i = 0; i < 90; i++) {
  bgShapes.push({
    x: (i * 47.3) % (W + 40), y: ((i * 31.7) % 360),
    size: 1 + (i % 3) * 0.7, speed: 0.04,
    color: i % 5 === 0 ? '#ffe8b0' : '#e8eeff', type: 'dot', phase: (i % 7) * 0.9,
  });
}
// 浮游光尘 / 余烬
for (let i = 0; i < 36; i++) {
  bgShapes.push({
    x: (i * 31.5) % (W + 20), y: ((i * 67.3) % 420) + 40,
    size: 2 + (i % 4) * 1.5, speed: 0.45,
    color: SHAPE_COLORS[i % 5],
    type: 'particle', phase: (i % 6) * 1.0, vy: 8 + (i % 5) * 3,
  });
}


// 缓存背景渐变（每 3 帧更新一次，大幅减少 createGradient 调用）
let _bgCacheFrame = 0;
let _bgGrad = null;
let _bgGlow1 = null;
let _bgGlow2 = null;
let _groundGrad = null;
let _groundTheme = null;

let _hudLayout = { buffTop: 88, buffRightX: W - 122 };

function drawStoneHudPanel(x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(28,24,38,${alpha ?? 0.88})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(220,190,120,0.65)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = 'rgba(255,230,180,0.07)';
  ctx.fillRect(x + 3, y + 3, w - 6, 3);
}

function drawHudText(text, x, y, opts = {}) {
  const {
    fill = '#fffaf0',
    font: fontIn = 'bold 14px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    align = 'left',
    stroke = 4,
    baseline = 'alphabetic',
  } = opts;
  const font = /PingFang|YaHei|Microsoft/.test(fontIn)
    ? fontIn
    : fontIn.replace(/system-ui/g, '"Segoe UI","PingFang SC","Microsoft YaHei",system-ui');
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  if (stroke > 0) {
    ctx.strokeStyle = 'rgba(8,6,12,0.88)';
    ctx.lineWidth = stroke;
    ctx.strokeText(text, x, y);
  }
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawTorch(x, y, flip, worldId) {
  const flicker = 0.86 + Math.sin(animT * 6.2 + (worldId || 0) * 1.7) * 0.1
    + Math.sin(animT * 11 + (worldId || 0)) * 0.04;
  ctx.save();
  if (flip) { ctx.translate(x, y); ctx.scale(-1, 1); ctx.translate(-x, -y); }

  // 光晕
  const bloom = ctx.createRadialGradient(x, y - 6, 2, x, y - 2, 78);
  bloom.addColorStop(0, `rgba(255,210,120,${0.42 * flicker})`);
  bloom.addColorStop(0.35, `rgba(255,140,60,${0.16 * flicker})`);
  bloom.addColorStop(1, 'rgba(255,100,40,0)');
  ctx.fillStyle = bloom;
  ctx.beginPath(); ctx.arc(x, y - 4, 78, 0, Math.PI * 2); ctx.fill();

  if (typeof WORLD_ASSETS !== 'undefined' && drawWorldSprite(WORLD_ASSETS.torch, x, y - 2, 46, 'center')) {
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#3a322c';
  ctx.fillRect(x - 3, y + 2, 6, 20);
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.moveTo(x - 9, y + 18);
  ctx.lineTo(x + 9, y + 18);
  ctx.lineTo(x + 7, y + 24);
  ctx.lineTo(x - 7, y + 24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(255,120,40,${0.55 * flicker})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.quadraticCurveTo(x + 9, y - 4, x + 2, y + 4);
  ctx.quadraticCurveTo(x, y - 2, x - 2, y + 4);
  ctx.quadraticCurveTo(x - 9, y - 4, x, y - 18);
  ctx.fill();
  ctx.fillStyle = `rgba(255,230,140,${0.9 * flicker})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.quadraticCurveTo(x + 4, y - 2, x, y + 2);
  ctx.quadraticCurveTo(x - 4, y - 2, x, y - 12);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,240,${0.75 * flicker})`;
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 2.2, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 室内/室外按路段交替；交界处用拱门过渡（scroll 空间）
const BG_SEG_LEN = 400;
const BG_DOOR_W = 92;

function bgSegIndex(scrollPos) {
  return Math.floor(scrollPos / BG_SEG_LEN);
}

function bgSegIndoor(seg) {
  return ((seg % 2) + 2) % 2 === 0;
}

// 0=室外 · 1=室内（角色所处路段，门口柔和过渡，供天空/星月用）
function bgEnclosure(atM = distanceM()) {
  const scroll = atM * PX_PER_METER * 0.2;
  const local = ((scroll % BG_SEG_LEN) + BG_SEG_LEN) % BG_SEG_LEN;
  const indoor = bgSegIndoor(bgSegIndex(scroll));
  const half = BG_DOOR_W * 0.5;
  if (local < half) {
    const t = local / half;
    return indoor ? t : 1 - t;
  }
  if (local > BG_SEG_LEN - half) {
    const t = (BG_SEG_LEN - local) / half;
    return indoor ? t : 1 - t;
  }
  return indoor ? 1 : 0;
}

function withBgClip(x0, x1, fn) {
  const left = Math.max(-2, x0);
  const right = Math.min(W + 2, x1);
  if (right - left < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, 0, right - left, GROUND + 4);
  ctx.clip();
  fn();
  ctx.restore();
}

function drawWallBricks(wallY, wallH, scroll, rows, stepX, stepY) {
  for (let row = 0; row < rows; row++) {
    const y = wallY + 10 + row * stepY;
    if (y + stepY > GROUND - 6) break;
    const rowShift = (row & 1) ? stepX * 0.5 : 0;
    const deep = row / Math.max(1, rows - 1);
    const col0 = Math.floor((scroll - rowShift) / stepX) - 1;
    const col1 = Math.ceil((scroll - rowShift + W) / stepX) + 1;
    for (let col = col0; col <= col1; col++) {
      const x = col * stepX + rowShift - scroll;
      const t = brickShade(col, row + 31);
      const bw = stepX - 5 - (t > 0.7 ? 8 : 0);
      const bh = stepY - 5;
      const lum = 48 + t * 16 - deep * 6;
      ctx.fillStyle = `rgb(${(lum * 0.95) | 0},${(lum * 0.88) | 0},${(lum * 1.02) | 0})`;
      ctx.fillRect(x + 2, y, bw, bh);
      ctx.fillStyle = 'rgba(255,240,220,0.06)';
      ctx.fillRect(x + 2, y, bw, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 2, y + bh - 3, bw, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + 2, y + 3, 3, bh - 6);
      if (t > 0.82) {
        ctx.strokeStyle = 'rgba(20,14,28,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + bw * 0.35, y + 6);
        ctx.lineTo(x + bw * 0.42, y + bh * 0.55);
        ctx.stroke();
      } else if (t < 0.18) {
        ctx.fillStyle = 'rgba(60,90,70,0.16)';
        ctx.fillRect(x + bw * 0.55, y + bh * 0.35, 10, 6);
      }
    }
  }
}

function drawMerlons(wallY, scroll, period) {
  const m0 = Math.floor(scroll / period) - 1;
  const m1 = Math.ceil((scroll + W) / period) + 1;
  for (let m = m0; m <= m1; m++) {
    const x = m * period - scroll;
    ctx.fillStyle = '#2e2838';
    ctx.fillRect(x + 6, wallY - 28, 30, 28);
    ctx.fillRect(x + 44, wallY - 16, 18, 16);
    ctx.fillStyle = '#221c2a';
    ctx.fillRect(x + 36, wallY - 28, 5, 28);
    ctx.fillRect(x + 62, wallY - 16, 4, 16);
    ctx.fillStyle = 'rgba(200,210,255,0.12)';
    ctx.fillRect(x + 6, wallY - 28, 30, 3);
  }
}

function drawIndoorHall(scroll) {
  const wallY = GROUND - 218;
  const wallH = GROUND - wallY;
  const wallGrad = ctx.createLinearGradient(0, wallY, 0, GROUND);
  wallGrad.addColorStop(0, '#3a3348');
  wallGrad.addColorStop(0.45, '#342c3c');
  wallGrad.addColorStop(1, '#2c2432');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, wallY, W, wallH);

  const rim = ctx.createLinearGradient(0, wallY, 0, wallY + 36);
  rim.addColorStop(0, 'rgba(180,200,255,0.14)');
  rim.addColorStop(1, 'rgba(180,200,255,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, wallY, W, 36);

  drawWallBricks(wallY, wallH, scroll, 5, 72, 34);
  drawMerlons(wallY, scroll, 78);

  const merlon = 78;
  const m0 = Math.floor(scroll / merlon) - 1;
  const m1 = Math.ceil((scroll + W) / merlon) + 1;
  ctx.strokeStyle = 'rgba(70,110,80,0.35)';
  ctx.lineWidth = 2;
  for (let m = m0; m <= m1; m++) {
    if (brickShade(m, 9) < 0.55) continue;
    const x = m * merlon + 20 - scroll;
    ctx.beginPath();
    ctx.moveTo(x, wallY + 20);
    ctx.bezierCurveTo(x + 8, wallY + 50, x - 6, wallY + 90, x + 10, wallY + 130);
    ctx.stroke();
    ctx.fillStyle = 'rgba(70,110,80,0.28)';
    ctx.beginPath(); ctx.ellipse(x + 4, wallY + 48, 5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - 2, wallY + 86, 4, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
  }

  const nicheGap = 220;
  const n0 = Math.floor(scroll / nicheGap) - 1;
  const n1 = Math.ceil((scroll + W) / nicheGap) + 1;
  for (let ni = n0; ni <= n1; ni++) {
    const nx = ni * nicheGap + 48 - scroll;
    if (nx < -60 || nx > W + 60) continue;
    const nw = 40;
    const nh = 64;
    const ny = wallY + 48;
    const cx = nx + nw / 2;
    const ty = ny + nh - 22;

    ctx.fillStyle = '#141018';
    ctx.beginPath();
    ctx.moveTo(nx, ny + nh);
    ctx.lineTo(nx, ny + 18);
    ctx.quadraticCurveTo(cx, ny - 8, nx + nw, ny + 18);
    ctx.lineTo(nx + nw, ny + nh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,170,0.08)';
    ctx.fillRect(nx + 3, ny + nh - 8, nw - 6, 5);

    const flick = 0.88 + Math.sin(animT * 5 + ni) * 0.08;
    const wash = ctx.createRadialGradient(cx, ty, 3, cx, ty + 8, 78);
    wash.addColorStop(0, `rgba(255,150,70,${0.28 * flick})`);
    wash.addColorStop(0.45, `rgba(255,120,50,${0.1 * flick})`);
    wash.addColorStop(1, 'rgba(255,100,40,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(cx - 80, wallY, 160, wallH);

    drawTorch(cx, ty, false, ni);
    ctx.fillStyle = `rgba(255,170,80,${0.1 + 0.05 * Math.sin(animT * 4 + ni)})`;
    ctx.beginPath();
    ctx.ellipse(cx, GROUND - 5, 48, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const mist = ctx.createLinearGradient(0, GROUND - 70, 0, GROUND);
  mist.addColorStop(0, 'rgba(30,28,48,0)');
  mist.addColorStop(1, 'rgba(20,16,32,0.4)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, GROUND - 70, W, 70);
}

function drawOutdoorRampart(scroll) {
  const hillScroll = scroll * 0.55;
  ctx.fillStyle = 'rgba(18,22,40,0.55)';
  for (let i = -1; i < 6; i++) {
    const hx = i * 180 - (hillScroll % 180);
    ctx.beginPath();
    ctx.moveTo(hx, GROUND - 20);
    ctx.quadraticCurveTo(hx + 50, GROUND - 70 - (i % 3) * 10, hx + 110, GROUND - 24);
    ctx.quadraticCurveTo(hx + 150, GROUND - 48, hx + 190, GROUND - 18);
    ctx.lineTo(hx + 190, GROUND);
    ctx.lineTo(hx, GROUND);
    ctx.closePath();
    ctx.fill();
  }

  const wallY = GROUND - 78;
  const wallH = GROUND - wallY;
  const wallGrad = ctx.createLinearGradient(0, wallY, 0, GROUND);
  wallGrad.addColorStop(0, '#3a3348');
  wallGrad.addColorStop(1, '#2a2432');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, wallY, W, wallH);
  drawWallBricks(wallY, wallH, scroll, 2, 72, 30);
  drawMerlons(wallY, scroll, 78);

  const postGap = 260;
  const p0 = Math.floor(scroll / postGap) - 1;
  const p1 = Math.ceil((scroll + W) / postGap) + 1;
  for (let pi = p0; pi <= p1; pi++) {
    if (brickShade(pi, 3) < 0.4) continue;
    const px = pi * postGap + 30 - scroll;
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(px, wallY - 52, 8, 52);
    ctx.fillStyle = '#c45c4a';
    ctx.beginPath();
    ctx.moveTo(px + 8, wallY - 50);
    ctx.lineTo(px + 28, wallY - 44);
    ctx.lineTo(px + 8, wallY - 38);
    ctx.closePath();
    ctx.fill();
  }

  const mist = ctx.createLinearGradient(0, GROUND - 90, 0, GROUND);
  mist.addColorStop(0, 'rgba(40,50,90,0)');
  mist.addColorStop(1, 'rgba(20,24,48,0.28)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, GROUND - 90, W, 90);
}

// 室内↔室外交界拱门：中间开口，两侧石柱
function drawTransitionGate(sx, toOutdoor) {
  if (sx < -80 || sx > W + 80) return;
  const wallY = GROUND - 218;
  const archW = 70;
  const x0 = sx - archW / 2;
  const x1 = sx + archW / 2;
  const yTop = wallY + 12;
  const yBot = GROUND;

  // 门洞里透出另一侧氛围
  if (toOutdoor) {
    const sky = ctx.createLinearGradient(sx, yTop, sx, yBot);
    sky.addColorStop(0, 'rgba(40,50,90,0.85)');
    sky.addColorStop(0.55, 'rgba(60,55,80,0.55)');
    sky.addColorStop(1, 'rgba(30,28,40,0.35)');
    ctx.fillStyle = sky;
    ctx.beginPath();
    ctx.moveTo(x0 + 6, yBot);
    ctx.lineTo(x0 + 6, yTop + 36);
    ctx.quadraticCurveTo(sx, yTop - 4, x1 - 6, yTop + 36);
    ctx.lineTo(x1 - 6, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,248,220,0.22)';
    ctx.beginPath();
    ctx.arc(sx + 10, yTop + 48, 10, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const warm = ctx.createLinearGradient(sx, yTop, sx, yBot);
    warm.addColorStop(0, 'rgba(40,30,36,0.9)');
    warm.addColorStop(0.5, 'rgba(60,40,30,0.7)');
    warm.addColorStop(1, 'rgba(80,50,30,0.45)');
    ctx.fillStyle = warm;
    ctx.beginPath();
    ctx.moveTo(x0 + 6, yBot);
    ctx.lineTo(x0 + 6, yTop + 36);
    ctx.quadraticCurveTo(sx, yTop - 4, x1 - 6, yTop + 36);
    ctx.lineTo(x1 - 6, yBot);
    ctx.closePath();
    ctx.fill();
    const glow = ctx.createRadialGradient(sx, GROUND - 40, 4, sx, GROUND - 30, 50);
    glow.addColorStop(0, 'rgba(255,160,70,0.28)');
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 50, wallY, 100, GROUND - wallY);
  }

  // 石柱
  const pillarW = 16;
  for (const side of [-1, 1]) {
    const px = side < 0 ? x0 - 2 : x1 - pillarW + 2;
    ctx.fillStyle = '#3a3344';
    ctx.fillRect(px, yTop, pillarW, yBot - yTop);
    ctx.fillStyle = 'rgba(255,230,190,0.1)';
    ctx.fillRect(px + 2, yTop, 3, yBot - yTop);
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(px - 2, yTop - 8, pillarW + 4, 12);
    ctx.fillRect(px - 3, yBot - 10, pillarW + 6, 10);
  }

  // 拱券
  ctx.strokeStyle = '#4a4250';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(x0 + 4, yTop + 40);
  ctx.quadraticCurveTo(sx, yTop - 8, x1 - 4, yTop + 40);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(196,164,104,0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x0 + 6, yTop + 38);
  ctx.quadraticCurveTo(sx, yTop - 2, x1 - 6, yTop + 38);
  ctx.stroke();

  // 半开木门扇（贴两侧，中间通路）
  ctx.fillStyle = '#5a3a28';
  ctx.fillRect(x0 + 8, yTop + 48, 12, yBot - yTop - 52);
  ctx.fillRect(x1 - 20, yTop + 48, 12, yBot - yTop - 52);
  ctx.fillStyle = 'rgba(196,164,104,0.35)';
  ctx.fillRect(x0 + 10, GROUND - 70, 3, 8);
  ctx.fillRect(x1 - 14, GROUND - 70, 3, 8);

  // 门楣题饰
  ctx.fillStyle = '#342c38';
  ctx.fillRect(sx - 28, yTop - 6, 56, 14);
  ctx.fillStyle = 'rgba(220,190,120,0.35)';
  ctx.fillRect(sx - 24, yTop - 2, 48, 3);
}

function drawCastleCorridor() {
  const e = bgEnclosure();
  const outA = 1 - e;
  const scroll = worldX * 0.2;
  const halfDoor = BG_DOOR_W * 0.5;

  drawCastleLayer(0.05, GROUND - 48, 0.16 + outA * 0.2, '#16122a');
  drawCastleLayer(0.1, GROUND - 28, 0.2 + outA * 0.24, '#1e1832');
  drawCastleLayer(0.15, GROUND - 6, 0.26 + outA * 0.3, '#2a2238');

  // 全宽地平线垫底，门缝/塔缝不再透出黑条
  const baseBand = ctx.createLinearGradient(0, GROUND - 56, 0, GROUND);
  baseBand.addColorStop(0, 'rgba(42,36,52,0)');
  baseBand.addColorStop(0.35, 'rgba(42,36,52,0.75)');
  baseBand.addColorStop(1, 'rgba(36,30,44,0.95)');
  ctx.fillStyle = baseBand;
  ctx.fillRect(0, GROUND - 56, W, 56);

  const s0 = scroll - halfDoor - 20;
  const s1 = scroll + W + halfDoor + 20;
  const seg0 = bgSegIndex(s0);
  const seg1 = bgSegIndex(s1);

  for (let seg = seg0; seg <= seg1; seg++) {
    const segStart = seg * BG_SEG_LEN;
    const segEnd = segStart + BG_SEG_LEN;
    const indoor = bgSegIndoor(seg);
    const stripL = segStart + halfDoor - scroll;
    const stripR = segEnd - halfDoor - scroll;
    withBgClip(stripL, stripR, () => {
      if (indoor) drawIndoorHall(scroll);
      else drawOutdoorRampart(scroll);
    });
  }

  for (let seg = seg0; seg <= seg1; seg++) {
    const doorScroll = (seg + 1) * BG_SEG_LEN;
    const sx = doorScroll - scroll;
    const nextIndoor = bgSegIndoor(seg + 1);
    drawTransitionGate(sx, !nextIndoor);
  }
}

function drawCastleLayer(parallax, baseY, alpha, fill) {
  const period = 480;
  const off = -((worldX * parallax) % period);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  // 连续地平线底座，避免塔楼之间透出黑缝
  for (let bx = off - period; bx < W + period; bx += period) {
    ctx.fillRect(bx, baseY - 18, period + 2, 22);
  }
  for (let bx = off - period; bx < W + period; bx += period) {
    ctx.fillRect(bx + 24, baseY - 88, 42, 88);
    ctx.fillRect(bx + 18, baseY - 98, 10, 10);
    ctx.fillRect(bx + 34, baseY - 98, 10, 10);
    ctx.fillRect(bx + 50, baseY - 98, 10, 10);
    ctx.fillRect(bx + 100, baseY - 124, 52, 124);
    ctx.beginPath();
    ctx.moveTo(bx + 96, baseY - 124);
    ctx.lineTo(bx + 126, baseY - 158);
    ctx.lineTo(bx + 156, baseY - 124);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(bx + 98, baseY - 134, 12, 10);
    ctx.fillRect(bx + 120, baseY - 134, 12, 10);
    ctx.fillRect(bx + 142, baseY - 134, 12, 10);
    ctx.fillRect(bx + 178, baseY - 70, 34, 70);
    ctx.fillRect(bx + 174, baseY - 78, 8, 8);
    ctx.fillRect(bx + 190, baseY - 78, 8, 8);
    ctx.fillRect(bx + 206, baseY - 78, 8, 8);
    // 塔间火桩填缝
    ctx.fillRect(bx + 66, baseY - 36, 34, 36);
    ctx.fillRect(bx + 152, baseY - 28, 26, 28);
    ctx.fillRect(bx + 212, baseY - 24, period - 212, 24);
    ctx.fillStyle = 'rgba(255,170,90,0.12)';
    ctx.fillRect(bx + 118, baseY - 70, 8, 14);
    ctx.fillRect(bx + 136, baseY - 70, 8, 14);
    ctx.fillStyle = fill;
  }
  ctx.restore();
}

function drawBackground() {
  if (_bgCacheFrame % 3 === 0 || bonusActive) {
    const hueShift = Math.sin(animT * 0.25) * 0.5 + 0.5;
    _bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (bonusActive) {
      _bgGrad.addColorStop(0, `hsl(${270 + hueShift * 10}, 70%, 42%)`);
      _bgGrad.addColorStop(0.35, `hsl(${300 + hueShift * 8}, 75%, 55%)`);
      _bgGrad.addColorStop(0.65, `hsl(${45 + hueShift * 6}, 85%, 62%)`);
      _bgGrad.addColorStop(1, `hsl(${200 + hueShift * 5}, 60%, 48%)`);
      const glowA = 0.45 + 0.25 * Math.sin(animT * 0.8);
      _bgGlow1 = ctx.createRadialGradient(W * 0.5, 120, 10, W * 0.5, 120, 320);
      _bgGlow1.addColorStop(0, `rgba(255,255,200,${glowA})`);
      _bgGlow1.addColorStop(1, 'rgba(255,255,200,0)');
      const glowB = 0.35 + 0.2 * Math.sin(animT * 0.6 + 1.2);
      _bgGlow2 = ctx.createRadialGradient(W * 0.2, GROUND - 60, 10, W * 0.2, GROUND - 60, 280);
      _bgGlow2.addColorStop(0, `rgba(180,120,255,${glowB})`);
      _bgGlow2.addColorStop(1, 'rgba(180,120,255,0)');
    } else {
      // 月夜户外天空
      _bgGrad.addColorStop(0, '#1a2040');
      _bgGrad.addColorStop(0.35, '#2a3358');
      _bgGrad.addColorStop(0.7, '#3d3550');
      _bgGrad.addColorStop(1, '#3a3348');
      _bgGlow1 = ctx.createRadialGradient(W * 0.78, 70, 8, W * 0.78, 90, 220);
      _bgGlow1.addColorStop(0, 'rgba(255,245,210,0.35)');
      _bgGlow1.addColorStop(0.5, 'rgba(200,210,255,0.08)');
      _bgGlow1.addColorStop(1, 'rgba(200,210,255,0)');
      _bgGlow2 = ctx.createRadialGradient(W * 0.35, GROUND - 30, 10, W * 0.35, GROUND - 10, 280);
      _bgGlow2.addColorStop(0, 'rgba(255,150,70,0.14)');
      _bgGlow2.addColorStop(1, 'rgba(255,150,70,0)');
    }
  }
  _bgCacheFrame++;

  ctx.fillStyle = _bgGrad;
  ctx.fillRect(0, 0, W, H);
  if (_bgGlow1) {
    ctx.fillStyle = _bgGlow1;
    ctx.fillRect(0, 0, W, bonusActive ? 400 : GROUND);
  }
  if (!bonusActive) {
    const outOpen = 1 - bgEnclosure();
    // 星点（室内时淡出）
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 18; i++) {
      const sx = ((i * 97 + worldX * 0.02) % W + W) % W;
      const sy = 18 + (i * 37) % 120;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(animT * 1.4 + i));
      ctx.globalAlpha = tw * 0.7 * (0.25 + 0.75 * outOpen);
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    // 月亮
    const moonX = W * 0.78;
    const moonY = 68;
    ctx.globalAlpha = 0.35 + 0.65 * outOpen;
    ctx.fillStyle = 'rgba(255,248,220,0.9)';
    ctx.beginPath(); ctx.arc(moonX, moonY, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(26,32,64,0.55)';
    ctx.beginPath(); ctx.arc(moonX - 8, moonY - 4, 18, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // 奖励空间：天空光柱，不落在跑道上（避免地面椭圆遮挡）
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const bx = (i * 180 - (worldX * 0.05) % 180) % (W + 180) - 40;
      const cx = bx + 60;
      const top = 24;
      const bot = GROUND - 110;
      const beam = ctx.createLinearGradient(cx, top, cx, bot);
      beam.addColorStop(0, 'rgba(255,255,255,0.28)');
      beam.addColorStop(0.55, 'rgba(255,255,255,0.08)');
      beam.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(cx - 7, top, 14, bot - top);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(155,123,255,0.18)' : 'rgba(255,179,71,0.18)';
      ctx.beginPath();
      ctx.ellipse(cx, 88 + (i % 3) * 36, 36, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (_bgGlow2) {
    ctx.fillStyle = _bgGlow2;
    ctx.fillRect(0, GROUND - 180, W, 200);
  }

  if (!bonusActive) {
    drawCastleCorridor();
  } else {
    const moonX = W * 0.76 + Math.sin(animT * 0.15) * 6;
    const moonY = 72 + Math.cos(animT * 0.12) * 4;
    ctx.fillStyle = 'rgba(255,248,220,0.92)';
    ctx.beginPath(); ctx.arc(moonX, moonY, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,210,240,0.35)';
    ctx.beginPath(); ctx.arc(moonX - 10, moonY - 6, 24, 0, Math.PI * 2); ctx.fill();
  }

  for (const s of bgShapes) {
    if (!bonusActive) continue;
    let sx = s.x - ((worldX * s.speed) % (W + 80));
    if (sx < -60) sx += W + 80;
    if (sx > W + 60) sx -= W + 80;

    if (s.type === 'dot') {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(animT * 1.5 + s.phase));
      ctx.globalAlpha = tw;
      ctx.fillStyle = s.color;
      ctx.fillRect(sx, s.y, s.size, s.size);
    } else if (s.type === 'particle') {
      let py = s.y - ((animT * s.vy) % (H + 20));
      if (py < -10) py += H + 20;
      const al = 0.2 + 0.55 * Math.abs(Math.sin(animT * 1.4 + s.phase));
      ctx.globalAlpha = al;
      ctx.fillStyle = s.color;
      const breathe = 0.85 + 0.15 * Math.sin(animT * 1.2 + s.phase);
      ctx.beginPath();
      ctx.arc(sx, py, s.size * breathe, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ===================== 实体渲染 =====================
// 地面砖与世界同速滚动
const GROUND_BRICK_W = 54;
const GROUND_BRICK_H = 20;
const GROUND_MORTAR = 3;

function brickShade(col, row) {
  // 稳定伪随机：同块砖颜色恒定，滚动时不闪
  const n = ((col * 73856093) ^ (row * 19349663)) >>> 0;
  return (n % 1000) / 1000;
}

function drawBrickFace(x, y, w, h, tone) {
  // tone 0..1 → 略深/略浅的石砖（提亮，避免看起来像黑块）
  const base = 68 + tone * 22;
  const r = (base * 0.92) | 0;
  const g = (base * 0.86) | 0;
  const b = (base * 0.9) | 0;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, w, h);
  // 顶沿亮、底沿暗
  ctx.fillStyle = `rgba(210,190,170,${0.10 + tone * 0.06})`;
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + w - 2, y + 2, 2, h - 4);
  // 轻微磨损点
  if (tone > 0.55) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + w * 0.3, y + h * 0.45, 3, 2);
  }
}

function drawGround() {
  // 灰缝底色（略提亮，避免整条黑带）
  ctx.fillStyle = '#2a2430';
  ctx.fillRect(0, GROUND, W, H - GROUND);

  const scroll = worldX;
  const stepX = GROUND_BRICK_W;
  const stepY = GROUND_BRICK_H;
  const bw = GROUND_BRICK_W - GROUND_MORTAR;
  const bh = GROUND_BRICK_H - GROUND_MORTAR;

  ctx.save();
  ctx.rect(0, GROUND, W, H - GROUND);
  ctx.clip();

  const rows = Math.ceil((H - GROUND) / stepY) + 1;
  for (let row = 0; row < rows; row++) {
    const y = GROUND + GROUND_MORTAR + row * stepY;
    const rowShift = (row & 1) ? stepX * 0.5 : 0;
    const col0 = Math.floor((scroll - rowShift) / stepX) - 1;
    const col1 = Math.ceil((scroll - rowShift + W) / stepX) + 1;
    for (let col = col0; col <= col1; col++) {
      const worldLeft = col * stepX + rowShift;
      const x = worldLeft - scroll;
      if (x > W + stepX || x < -stepX) continue;
      drawBrickFace(x, y, bw, bh, brickShade(col, row));
    }
  }
  ctx.restore();

  // 顶沿线
  ctx.fillStyle = 'rgba(180,160,130,0.22)';
  ctx.fillRect(0, GROUND, W, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, GROUND + 2, W, 2);
}

function drawGaps() {
  for (const g of gaps) {
    const pitGrad = ctx.createLinearGradient(g.x, GROUND, g.x, H);
    pitGrad.addColorStop(0, '#0a0610');
    pitGrad.addColorStop(0.4, '#140c1a');
    pitGrad.addColorStop(1, '#000');
    ctx.fillStyle = pitGrad;
    ctx.fillRect(g.x, GROUND, g.w, H - GROUND);
  }
}

function drawStoneBlock(x, y, w, h, base) {
  ctx.fillStyle = base || '#5a4f58';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x + 3, y + 3, w - 6, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let dx = 8; dx < w - 4; dx += 12) {
    for (let dy = 10; dy < h - 4; dy += 12) {
      ctx.fillRect(x + dx, y + dy, 2, 2);
    }
  }
}

function drawFirePillar(x, y, w, h) {
  // 贴图缺失时的火桩：石座 + 铁桩 + 火焰
  const baseH = Math.max(10, h * 0.22);
  const stakeW = Math.max(4, w * 0.18);
  const cx = x + w / 2;
  ctx.fillStyle = '#3a3344';
  ctx.fillRect(x + w * 0.12, y + h - baseH, w * 0.76, baseH);
  ctx.fillStyle = '#2a2430';
  ctx.fillRect(x + w * 0.08, y + h - 5, w * 0.84, 5);
  ctx.fillStyle = '#c4a468';
  ctx.fillRect(x + w * 0.14, y + h - baseH, w * 0.72, 2);
  ctx.fillStyle = '#1a1520';
  ctx.fillRect(cx - stakeW / 2, y + h * 0.28, stakeW, h - baseH - h * 0.28);
  const flicker = 0.85 + 0.15 * Math.sin(animT * 14 + x * 0.05);
  const fh = (h - baseH) * 0.72 * flicker;
  const fw = w * 0.78 * flicker;
  const fy = y + h - baseH - fh;
  ctx.fillStyle = '#ff4a1a';
  ctx.beginPath();
  ctx.moveTo(cx, fy);
  ctx.quadraticCurveTo(cx + fw * 0.55, fy + fh * 0.35, cx + fw * 0.28, fy + fh);
  ctx.lineTo(cx - fw * 0.28, fy + fh);
  ctx.quadraticCurveTo(cx - fw * 0.55, fy + fh * 0.35, cx, fy);
  ctx.fill();
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.moveTo(cx, fy + fh * 0.18);
  ctx.quadraticCurveTo(cx + fw * 0.28, fy + fh * 0.45, cx + fw * 0.12, fy + fh * 0.85);
  ctx.lineTo(cx - fw * 0.12, fy + fh * 0.85);
  ctx.quadraticCurveTo(cx - fw * 0.28, fy + fh * 0.45, cx, fy + fh * 0.18);
  ctx.fill();
  ctx.fillStyle = '#ffe8a0';
  ctx.beginPath();
  ctx.moveTo(cx, fy + fh * 0.35);
  ctx.quadraticCurveTo(cx + fw * 0.12, fy + fh * 0.55, cx, fy + fh * 0.78);
  ctx.quadraticCurveTo(cx - fw * 0.12, fy + fh * 0.55, cx, fy + fh * 0.35);
  ctx.fill();
}

function drawWalls() {
  for (const wE of walls) {
    const wh = wallH(wE);
    const cx = wE.x + wE.w / 2;
    // 火桩贴图：脚底锚定，按高度缩放，避免硬拉变形
    if (drawWorldSprite(WORLD_ASSETS.firePillar, cx, GROUND, wh + 14, 'feet')) continue;
    drawFirePillar(wE.x, GROUND - wh, wE.w, wh);
  }
}

function drawBeams() {
  for (const bE of beams) {
    if (drawWorldSpriteBox(WORLD_ASSETS.beam, bE.x - 2, -4, bE.w + 4, BEAM_BOTTOM + 6)) continue;
    drawStoneBlock(bE.x, 0, bE.w, BEAM_BOTTOM, '#3d353c');
    ctx.fillStyle = '#2a2228';
    for (let bx = bE.x + 6; bx < bE.x + bE.w - 6; bx += 14) {
      ctx.fillRect(bx, 4, 6, BEAM_BOTTOM - 8);
    }
    ctx.strokeStyle = 'rgba(196,164,104,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bE.x, BEAM_BOTTOM - 2);
    ctx.lineTo(bE.x + bE.w, BEAM_BOTTOM - 2);
    ctx.stroke();
  }
}

function drawElevatedPlatforms() {
  for (const p of elevatedPlatforms) {
    const py = GROUND - p.y;
    const pw = p.x1 - p.x0;
    if (drawWorldSpriteBox(WORLD_ASSETS.platform, p.x0 - 2, py - 4, pw + 4, 22)) continue;
    drawStoneBlock(p.x0, py, pw, 14, '#524a52');
    ctx.fillStyle = 'rgba(196,164,104,0.4)';
    ctx.fillRect(p.x0, py, pw, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let sx = p.x0 + 10; sx < p.x1 - 10; sx += 22) {
      ctx.beginPath();
      ctx.moveTo(sx, py + 14);
      ctx.lineTo(sx + 6, GROUND);
      ctx.stroke();
    }
  }
}

function drawSpikes() {
  for (const s of spikes) {
    drawStoneBlock(s.x, GROUND - 8, s.w, 8, '#3d353c');
    const spikeCount = Math.max(1, Math.floor(s.w / 12));
    const spikeH = SPIKE_H;
    for (let i = 0; i < spikeCount; i++) {
      const sx = s.x + 4 + i * 12 + 5;
      if (drawWorldSprite(WORLD_ASSETS.spike, sx, GROUND - 8, spikeH, 'feet')) continue;
      const base = s.x + 4 + i * 12;
      ctx.fillStyle = '#8a9098';
      ctx.strokeStyle = '#2a2228';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(base, GROUND - 8);
      ctx.lineTo(base + 5, GROUND - 8 - spikeH);
      ctx.lineTo(base + 10, GROUND - 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawFlyers() {
  for (const f of flyers) {
    const fy = f.baseY + Math.sin(animT * 2 + f.phase) * FLYER_AMP;
    const cx = f.x + f.w / 2;
    if (drawWorldSprite(WORLD_ASSETS.flyer, cx, fy, Math.max(f.w, FLYER_H), 'center')) continue;
    const wingFlap = Math.sin(animT * 12 + f.phase) * 8;
    ctx.fillStyle = 'rgba(132,94,194,0.7)';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - f.w / 2, fy);
    ctx.quadraticCurveTo(cx - f.w / 2 - 12, fy - 6 - wingFlap, cx - f.w / 2 - 4, fy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + f.w / 2, fy);
    ctx.quadraticCurveTo(cx + f.w / 2 + 12, fy - 6 - wingFlap, cx + f.w / 2 + 4, fy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#845ec2';
    ctx.beginPath();
    ctx.ellipse(cx, fy, f.w / 2, FLYER_H / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff3030';
    ctx.beginPath();
    ctx.arc(cx - 5, fy - 2, 3, 0, Math.PI * 2);
    ctx.arc(cx + 5, fy - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBats() {
  for (const bat of bats) {
    const cx = bat.x + BAT_W / 2;
    const cy = bat.y;
    if (drawWorldSprite(WORLD_ASSETS.bat, cx, cy, Math.max(BAT_W, BAT_H), 'center')) continue;
    const wingFlap = Math.sin(animT * 16 + bat.phase) * 10;
    ctx.fillStyle = 'rgba(30,20,40,0.85)';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - BAT_W / 2, cy);
    ctx.quadraticCurveTo(cx - BAT_W / 2 - 14, cy - 8 - wingFlap, cx - 6, cy + 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + BAT_W / 2, cy);
    ctx.quadraticCurveTo(cx + BAT_W / 2 + 14, cy - 8 - wingFlap, cx + 6, cy + 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2d1f3d';
    ctx.beginPath();
    ctx.ellipse(cx, cy, BAT_W / 2 - 2, BAT_H / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 2, 2.8, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 2, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOrbitOrbs() {
  if (!running || !isMage() || !mageOrbitUnlocked() || !orbitOrbs.length) return;
  for (const orb of orbitOrbs) {
    const p = orbitSlotPos(orb.slot);
    const appear = orb.appear ?? 1;
    const pulse = 0.82 + Math.sin(animT * 7 + orb.slot) * 0.18;
    const r = (6.5 + appear * 2.5) * pulse;
    ctx.save();
    ctx.globalAlpha = 0.35 + appear * 0.65;
    ctx.fillStyle = 'rgba(255,140,50,0.28)';
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.7, 0, Math.PI * 2); ctx.fill();
    if (!drawWorldSprite(WORLD_ASSETS.fireball, p.x, p.y, r * 3.4, 'center')) {
      ctx.fillStyle = '#ff8c00';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff5c0';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.42, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawMonsters() {
  for (const mo of monsters) {
    const mh = mo.big ? 2 * U : 1 * U;
    const mw = mo.big ? 46 : 28;
    const cx = mo.x + mw / 2;
    const bob = Math.abs(Math.sin(animT * 2.5 + mo.phase)) * 4;
    const cy = GROUND - mh / 2 - bob;
    const asset = mo.big ? WORLD_ASSETS.monsterBig : WORLD_ASSETS.monster;
    const drew = drawWorldSprite(asset, cx, GROUND - bob, mh, 'feet');
    if (!drew) {
      if (mo.big) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(cx, GROUND - 2, mw / 2 + 2, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6b3fa0'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy + 10);
        ctx.bezierCurveTo(cx - 26, cy - 8, cx - 18, cy - 30, cx, cy - 34);
        ctx.bezierCurveTo(cx + 18, cy - 30, cx + 26, cy - 8, cx + 20, cy + 10);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath(); ctx.arc(cx - 8, cy - 16, 4.5, 0, Math.PI * 2); ctx.arc(cx + 8, cy - 16, 4.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(cx, GROUND - 2, mw / 2 + 1, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3d7ea6'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, mw / 2 + 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd93d';
        ctx.beginPath(); ctx.arc(cx - 5, cy - 2, 3.2, 0, Math.PI * 2); ctx.arc(cx + 5, cy - 2, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    const bw = mo.big ? 34 : 24;
    const maxHp = mo.big ? 2 : 1;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - bw / 2 - 1, cy - mh / 2 - 17, bw + 2, 7);
    ctx.fillStyle = '#ff6b9d';
    ctx.fillRect(cx - bw / 2, cy - mh / 2 - 16, bw * (mo.hp / maxHp), 5);
  }
}

function drawSwordSwings() {
  if (!isWarrior()) return;
  const fy = GROUND - px - U * (ducking ? 0.5 : 1);
  const ax = CHAR_X + CHAR_W / 2 + 6;
  const ay = fy - 22;
  const slashP = warriorSlashT > 0 ? (1 - warriorSlashT / SWORD_SLASH_DUR) : 0;
  for (const sw of swordSwings) {
    const dur = sw.dur || SWORD_SLASH_DUR;
    const p = 1 - sw.t / dur;
    const alpha = Math.min(1, sw.t / dur) * 0.95;
    const arcR = sw.range * 0.72;
    const startA = -1.15 + p * 0.25;
    const endA = 0.15 + p * 1.05;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#e8f4ff';
    ctx.lineWidth = 5 + p * 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ax, ay, arcR, startA, endA);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + p * 0.45})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, arcR * 0.88, startA + 0.1, endA - 0.05);
    ctx.stroke();
    ctx.fillStyle = `rgba(180,210,255,${0.12 + p * 0.2})`;
    ctx.beginPath();
    ctx.arc(ax, ay, arcR * 0.82, startA, endA);
    ctx.lineTo(ax, ay);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  if (slashP > 0.05) {
    ctx.save();
    ctx.globalAlpha = 0.5 * Math.sin(slashP * Math.PI);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax + 4, ay - 4);
    ctx.lineTo(ax + (swordSwings[0]?.range || swordRange()) * 0.55 * slashP, ay - 18 - slashP * 10);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFireballs() {
  if (mageMuzzleFx > 0 && isMage()) {
    const tip = mageStaffTip();
    const a = Math.min(1, mageMuzzleFx / 0.12);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,230,140,0.95)';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, FB_R * (1.2 + (1 - a) * 1.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const fb of fireballs) {
    const birth = fb.birth != null && fb.birth > 0 ? fb.birth : 0;
    const scale = birth > 0 ? (1 - birth / 0.14) * 0.55 + 0.45 : 1;
    const size = FB_R * 3.2 * scale * (fb.orbit ? 0.92 : 1);
    if (drawWorldSprite(WORLD_ASSETS.fireball, fb.x, fb.y, size, 'center')) continue;
    ctx.fillStyle = 'rgba(255,120,40,0.35)';
    ctx.beginPath();
    ctx.arc(fb.x, fb.y, (FB_R + 4) * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.arc(fb.x, fb.y, (FB_R + 1) * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8d6';
    ctx.beginPath();
    ctx.arc(fb.x, fb.y, FB_R * 0.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPowerups() {
  const PU_SPRITE = {
    magnet: WORLD_ASSETS.puMagnet,
    double: WORLD_ASSETS.puDouble,
    attack: WORLD_ASSETS.puAttack,
    fly: WORLD_ASSETS.puFly,
  };
  for (const p of powerups) {
    const bob = Math.sin(animT * 2.5 + p.phase) * 6;
    const py = p.y + bob;
    const def = PU[p.type];
    const pulse = 0.85 + Math.sin(animT * 4 + p.phase) * 0.15;
    const asset = PU_SPRITE[p.type];
    ctx.save();
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = 14 * pulse;
    if (asset && drawWorldSprite(asset, p.x, py, PU_R * 2.4, 'center')) {
      ctx.shadowBlur = 0;
      ctx.restore();
      continue;
    }
    ctx.fillStyle = def.color;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, py, PU_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(p.x - 4, py - 4, PU_R * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCoins() {
  for (const c of coins) {
    if (c.taken) continue;
    const bob = Math.sin(animT * 3 + c.bob) * 4;
    const cy = c.y + bob;
    if (drawWorldSprite(WORLD_ASSETS.coin, c.x, cy, COIN_R * 2.2, 'center')) continue;
    const spin = Math.abs(Math.cos(animT * 4 + c.bob));
    const rx = COIN_R * (0.3 + spin * 0.7);
    ctx.fillStyle = '#ffd93d';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(c.x, cy, rx, COIN_R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.ellipse(c.x, cy, rx * 0.5, COIN_R * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- canvas helpers (auras / roll fallback) ----------
const CHAR_INK = '#1a1a1a';

function artCircle(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
}

function artFillCircle(c, x, y, r, color) {
  c.fillStyle = color;
  artCircle(c, x, y, r);
  c.fill();
}

function artFillStrokeCircle(c, x, y, r, fill, stroke, lw) {
  c.fillStyle = fill;
  c.strokeStyle = stroke;
  c.lineWidth = lw;
  artCircle(c, x, y, r);
  c.fill();
  c.stroke();
}

function playerInvincibleFlicker(alpha) {
  if (invincible > 0 && Math.floor(animT * 12) % 2 === 0) ctx.globalAlpha = alpha;
}

function charBodyScale(charId) {
  const run = CHAR_RUN_SHEETS[charId];
  const refH = run?.refH || SPRITE_REF_H[charId] || 290;
  return CHAR_H_STAND / refH;
}

function ensureSheetFrames(sheet) {
  if (sheet.frames?.length) return sheet.frames;
  const cols = sheet.cols || 3;
  const rows = sheet.rows || 1;
  const img = sheet.img;
  if (!img?.width || !img?.height) return null;
  const cw = Math.floor(img.width / cols);
  const ch = Math.floor(img.height / rows);
  const frames = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * cw;
      const top = row * ch;
      frames.push({ left, top, w: cw, h: ch, cellW: cw, cellH: ch, index: frames.length });
    }
  }
  sheet.frames = frames;
  if (!sheet.refH) sheet.refH = ch;
  return frames;
}

function pickRollSheet(charId) {
  const sheet = CHAR_ROLL_SHEETS[charId];
  if (!sheet?.ready || !sheet.img) return null;
  const frames = ensureSheetFrames(sheet);
  if (!frames?.length) return null;
  const n = frames.length;
  const progress = 1 - Math.max(0, Math.min(1, rollTimer / ROLL_DUR));
  const idx = Math.min(n - 1, Math.floor(progress * n));
  return { sheet, frame: frames[idx], charId, frameIndex: idx, progress };
}

function drawRollSheetSprite(cx, cy, pick) {
  const { sheet, frame, charId } = pick;
  const img = sheet.img;
  if (!img || !frame) return false;
  // 与跑步同一比例尺，脚底贴地；翻滚姿势本身可变矮
  let scale = charBodyScale(charId);
  let dw = frame.w * scale;
  let dh = frame.h * scale;
  const maxH = CHAR_H_STAND * 1.06;
  if (dh > maxH) {
    const k = maxH / dh;
    scale *= k;
    dw *= k;
    dh = maxH;
  }
  ctx.save();
  playerInvincibleFlicker(0.55);
  ctx.drawImage(img, frame.left, frame.top, frame.w, frame.h, cx - dw / 2, cy - dh, dw, dh);
  ctx.restore();
  ctx.globalAlpha = 1;
  return true;
}

function drawPlayerRoll(cx, cy) {
  const charId = isWarrior() ? 'warrior' : 'mage';
  const pick = pickRollSheet(charId);
  if (pick && drawRollSheetSprite(cx, cy, pick)) return;
  // no geometric placeholder while sheet missing
}

function drawPlayerBuffAuras(cx, cy, bob) {
  if (puTimers.magnet > 0 || itemTimers.magnet > 0 || skySprintActive) {
    artFillCircle(ctx, cx, cy - 32 + bob, 48 + Math.sin(animT * 5) * 4, 'rgba(132,94,194,0.15)');
  }
  if (puTimers.double > 0) {
    artFillCircle(ctx, cx, cy - 32 + bob, 44, 'rgba(255,217,61,0.12)');
  }
  if (puTimers.attack > 0) {
    artFillCircle(ctx, cx, cy - 32 + bob, 42, `rgba(255,107,53,${0.12 + Math.sin(animT * 8) * 0.06})`);
  }
  if (itemShield > 0) {
    ctx.fillStyle = 'rgba(132,94,194,0.2)';
    for (let i = 0; i < 5; i++) {
      const a = animT * 2.8 + i * 1.25;
      artCircle(ctx, cx + Math.cos(a) * 34, cy - 34 + bob + Math.sin(a * 1.3) * 12, 3.5);
      ctx.fill();
    }
  }
}

function drawPlayer() {
  const cx = CHAR_X;
  const cy = GROUND - px;

  if (rollTimer > 0) {
    drawPlayerRoll(cx, cy);
    return;
  }

  const bob = ducking ? 0 : Math.sin(animT * 10) * 2;
  const hMul = ducking ? 0.52 : 1;

  drawPlayerBuffAuras(cx, cy, bob);

  const sprite = pickCharSprite(isWarrior() ? 'warrior' : 'mage');
  if (sprite && drawCharSprite(cx, cy, bob, hMul, sprite)) return;

  // sprites not ready: no vector fallback
  ctx.globalAlpha = 1;
}

function drawFloats() {
  for (const f of floats) {
    const a = Math.max(0.55, Math.min(1, f.t * 1.15));
    ctx.save();
    ctx.globalAlpha = a;
    const fx = f.x;
    const fy = f.y - (0.9 - f.t) * 34;
    if (f.heart) {
      ctx.fillStyle = '#ff6b9d';
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      const hs = 8;
      ctx.beginPath();
      ctx.moveTo(fx - 14, fy);
      ctx.bezierCurveTo(fx - 14, fy - hs, fx - 14 - hs, fy - hs, fx - 14, fy);
      ctx.bezierCurveTo(fx - 14, fy + hs * 0.6, fx - 14, fy + hs, fx - 14, fy + hs * 1.2);
      ctx.bezierCurveTo(fx - 14, fy + hs, fx - 14 + hs, fy + hs * 0.6, fx - 14, fy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (f.shield) {
      ctx.fillStyle = '#00c9a7';
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      const ss = 10;
      ctx.beginPath();
      ctx.moveTo(fx - 20, fy - ss);
      ctx.lineTo(fx - 20 + ss, fy - ss * 0.5);
      ctx.lineTo(fx - 20 + ss * 0.8, fy + ss * 0.5);
      ctx.lineTo(fx - 20, fy + ss);
      ctx.lineTo(fx - 20 - ss * 0.8, fy + ss * 0.5);
      ctx.lineTo(fx - 20 - ss, fy - ss * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    drawHudText(f.text, fx + (f.heart ? 8 : 0), fy + 5, {
      fill: f.text.startsWith('+') ? '#ffe8a0' : '#ffb0b0',
      font: 'bold 17px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
      align: 'center',
      stroke: 4.5,
    });
    ctx.restore();
  }
}

function drawEnergyBar(x, y, w = 96, h = 14) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.strokeStyle = 'rgba(196,164,104,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
  const ratio = energy / ENERGY_MAX;
  ctx.fillStyle = ratio > 0.6 ? '#5a9a8a' : ratio > 0.3 ? '#c4a468' : '#c45c4a';
  ctx.fillRect(x, y, w * ratio, h);
  drawHudText('魔力', x + w / 2, y + h / 2 + 1, {
    fill: '#fffaf0',
    font: 'bold 11px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    align: 'center',
    baseline: 'middle',
    stroke: 3,
  });
}

function drawHUD() {
  const panelX = 10;
  const hudX = 22;
  const hpY = 18;
  const iconSize = 16;
  const iconGap = iconSize + 6;
  const shieldY = hpY + iconGap;
  const energyY = shieldY + iconGap;
  const leftPanelH = isMage() ? 84 : 58;
  drawStoneHudPanel(panelX, 8, 118, leftPanelH);

  for (let i = 0; i < charMaxHpSlots(); i++) {
    const x = hudX + i * iconGap;
    const y = hpY;
    ctx.save();
    ctx.globalAlpha = i < hp ? 1 : 0.28;
    ctx.fillStyle = '#c45c6a';
    ctx.strokeStyle = 'rgba(196,164,104,0.6)';
    ctx.lineWidth = 1.5;
    const s = iconSize / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.3);
    ctx.bezierCurveTo(x - s, y + s * 0.6, x, y + s, x, y + s * 1.1);
    ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.6, x + s, y + s * 0.3);
    ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < charMaxShdSlots(); i++) {
    const x = hudX + i * iconGap;
    const y = shieldY;
    ctx.save();
    ctx.globalAlpha = i < shield ? 1 : 0.28;
    ctx.fillStyle = '#5a8a9a';
    ctx.strokeStyle = 'rgba(196,164,104,0.6)';
    ctx.lineWidth = 1.5;
    const s = iconSize / 2;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y - s * 0.5);
    ctx.lineTo(x + s * 0.8, y + s * 0.5);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.8, y + s * 0.5);
    ctx.lineTo(x - s, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (isWarrior() && charData.warrior.talent > 0 && knightShelter > 0) {
    const kx = hudX + charMaxShdSlots() * iconGap;
    const ky = shieldY;
    drawHudText('庇' + knightShelter, kx - 2, ky + 4, { fill: '#ffe08a', font: 'bold 11px system-ui,sans-serif', stroke: 3 });
  }

  if (isMage()) drawEnergyBar(hudX - 4, energyY);

  const isLandscapeHud = document.getElementById('screen-game').classList.contains('game-landscape');
  if (isLandscapeHud) {
    const scoreW = 168;
    const scoreX = W / 2 - scoreW / 2;
    const scoreH = bonusActive ? 52 : 38;
    drawStoneHudPanel(scoreX, 6, scoreW, scoreH);
    if (bonusActive) {
      const remain = Math.max(0, BONUS_DIST_MAX - bonusDist);
      drawHudText('奖励空间 ' + remain.toFixed(0) + 'm', W / 2, 18, {
        fill: '#ffe08a', font: 'bold 11px system-ui,sans-serif', align: 'center', stroke: 2.5,
      });
      drawHudText('' + scoreVal(), W / 2, 40, {
        fill: '#fffaf0', font: 'bold 18px system-ui,sans-serif', align: 'center', stroke: 3.5,
      });
    } else {
      drawHudText('得分', W / 2, 18, { fill: '#ffe08a', font: 'bold 10px system-ui,sans-serif', align: 'center', stroke: 2.5 });
      drawHudText('' + scoreVal(), W / 2, 35, { fill: '#fffaf0', font: 'bold 18px system-ui,sans-serif', align: 'center', stroke: 3.5 });
    }
  }

  const rightX = W - 128;
  const mul = speedMul();
  if (isLandscapeHud) {
    drawStoneHudPanel(rightX, 6, 118, 68);
    drawHudText('SPEED', W - 16, 18, { fill: 'rgba(255,248,232,0.75)', font: 'bold 9px system-ui,sans-serif', align: 'right', stroke: 2 });
    drawHudText(mul.toFixed(1) + 'x', W - 16, 34, {
      fill: mul >= 2.5 ? '#ff8a50' : mul >= 1.5 ? '#ffe08a' : '#8fd0a8',
      font: 'bold 17px system-ui,sans-serif', align: 'right', stroke: 3.5,
    });
    drawHudText('金币 ' + coinPickups, W - 16, 50, { fill: '#ffe08a', font: 'bold 12px system-ui,sans-serif', align: 'right', stroke: 3 });
    drawHudText('距离 ' + scoreM() + 'm', W - 16, 66, { fill: '#fffaf0', font: 'bold 12px system-ui,sans-serif', align: 'right', stroke: 3 });
    _hudLayout.buffTop = H - 118;
    _hudLayout.buffRightX = rightX;
  } else {
    drawStoneHudPanel(rightX + 20, 6, 72, 28);
    drawHudText(mul.toFixed(1) + 'x', W - 10, 25, {
      fill: mul >= 2.5 ? '#ff8a50' : mul >= 1.5 ? '#ffe08a' : '#8fd0a8',
      font: 'bold 14px system-ui,sans-serif', align: 'right', stroke: 3.5,
    });
    _hudLayout.buffTop = H - 100;
    _hudLayout.buffRightX = W - 118;
  }
  _hudLayout.buffColW = 96;
  ctx.textAlign = 'left';
}

function drawMilestone() {
  if (milestoneFx <= 0) return;
  const alpha = Math.min(1, milestoneFx);
  const scale = 1 + Math.min(0.35, (2.0 - milestoneFx) * 0.22);
  ctx.save();
  ctx.globalAlpha = Math.max(0.55, alpha);
  ctx.translate(W / 2, 150);
  ctx.scale(scale, scale);
  drawHudText(milestoneText, 0, 0, {
    fill: '#ffe8a0',
    font: 'bold 36px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    align: 'center',
    stroke: 7,
  });
  ctx.restore();
}

function drawSkySprint() {
  if (!skySprintActive) return;
  const mul = skySprintMul(); // 0.3→1→0.3，用于淡入淡出
  const alpha = Math.max(0.15, mul); // 视觉alpha跟随速度倍率
  // 起飞速度线（密集，alpha淡入淡出）
  ctx.strokeStyle = `rgba(255,217,61,${0.5 * alpha})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const yy = 20 + i * 28;
    const ll = 40 + (i % 4) * 20;
    const off = (animT * 800 + i * 60) % W;
    ctx.beginPath();
    ctx.moveTo(W - off, yy);
    ctx.lineTo(W - off + ll, yy - 6);
    ctx.stroke();
  }
  const remain = Math.max(0, SKY_SPRINT_DUR - skySprintTime);
  ctx.fillStyle = `rgba(0,0,0,${0.72 * alpha})`;
  ctx.fillRect(W / 2 - 100, 14, 200, 40);
  ctx.save();
  ctx.globalAlpha = alpha;
  drawHudText(`起飞 ${remain.toFixed(1)}s`, W / 2, 32, {
    fill: '#ffe08a', font: 'bold 15px system-ui,sans-serif', align: 'center', stroke: 3.5,
  });
  drawHudText('无敌冲刺中', W / 2, 48, {
    fill: '#fff3c4', font: 'bold 11px system-ui,sans-serif', align: 'center', stroke: 2.5,
  });
  ctx.restore();
  // 起飞进度条
  const pct = skySprintTime / SKY_SPRINT_DUR;
  ctx.fillStyle = `rgba(0,0,0,${0.5 * alpha})`;
  ctx.fillRect(W / 2 - 80, 52, 160, 6);
  ctx.fillStyle = `rgba(255,140,60,${alpha})`;
  ctx.fillRect(W / 2 - 80, 52, 160 * pct, 6);
}

function drawTutorial() {
  if (!tutorialActive || !tutorialShown || tutorialStep >= TUTORIAL_STEPS.length) return;
  const step = TUTORIAL_STEPS[tutorialStep];
  const boxW = 360;
  const boxH = step.action ? 70 : 56;
  const bx = W / 2 - boxW / 2;
  const by = 60;
  ctx.fillStyle = 'rgba(18,14,24,0.92)';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#ffe08a';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(bx, by, boxW, boxH);
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + 20, by);
  ctx.lineTo(bx, by + 20);
  ctx.closePath();
  ctx.fill();
  drawHudText(`【教程】${step.title}`, W / 2, by + 22, {
    fill: '#ffe08a', font: 'bold 14px system-ui,sans-serif', align: 'center', stroke: 3,
  });
  drawHudText(step.text, W / 2, by + 42, {
    fill: '#fffaf0', font: 'bold 13px system-ui,sans-serif', align: 'center', stroke: 3,
  });
  if (step.action) {
    const blink = Math.sin(animT * 6) > 0;
    drawHudText('▼ 时间暂停中，请完成操作', W / 2, by + 60, {
      fill: blink ? '#7ef0d0' : 'rgba(126,240,208,0.45)',
      font: 'bold 12px system-ui,sans-serif', align: 'center', stroke: 2.5,
    });
  }
  ctx.textAlign = 'left';
  // 步骤进度
  const dotY = by + boxH + 14;
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    const dx = W / 2 - (TUTORIAL_STEPS.length - 1) * 7 + i * 14;
    ctx.fillStyle = i < tutorialStep ? '#00c9a7' : (i === tutorialStep ? '#ffd93d' : 'rgba(255,255,255,0.3)');
    ctx.beginPath();
    ctx.arc(dx, dotY, i === tutorialStep ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===================== 传送门 / 奖励空间 / 道具渲染 =====================
function drawPortal() {
  if (!portal) return;
  const px2 = portal.x;
  const py2 = portal.y;
  const glowA = 0.25 + 0.15 * Math.sin(animT * 4);
  ctx.fillStyle = `rgba(255,217,61,${glowA})`;
  ctx.beginPath();
  ctx.arc(px2, py2, 44, 0, Math.PI * 2);
  ctx.fill();
  if (drawWorldSprite(WORLD_ASSETS.portal, px2, py2, 78, 'center')) {
    ctx.save();
    ctx.translate(px2, py2);
    ctx.rotate(animT * 2);
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2);
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 28, Math.sin(a) * 28, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(px2, py2);
  ctx.strokeStyle = '#ffd93d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(132,94,194,0.6)';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBonusTint() {
  if (!bonusActive) return;
  ctx.fillStyle = 'rgba(255,240,180,0.1)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.22 + Math.sin(animT * 2) * 0.06;
  for (let i = 0; i < 8; i++) {
    const px = (i * 110 + animT * 40) % (W + 80) - 40;
    const py = 70 + (i % 3) * 70;
    if (py > GROUND - 120) continue;
    ctx.fillStyle = ['#ffe066', '#c77dff', '#7ae582'][i % 3];
    ctx.beginPath();
    ctx.arc(px, py, 4 + (i % 2) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBonusHud() {
  if (!bonusActive) return;
  const isLandscapeHud = document.getElementById('screen-game').classList.contains('game-landscape');
  // 横屏时并入中央得分板，避免与得分/里程碑抢位
  if (isLandscapeHud) return;
  ctx.fillStyle = 'rgba(12,10,18,0.72)';
  ctx.fillRect(W / 2 - 100, 14, 200, 32);
  const remain = Math.max(0, BONUS_DIST_MAX - bonusDist);
  drawHudText(`奖励空间 ${remain.toFixed(0)}m`, W / 2, 35, {
    fill: '#ffe8a0', font: 'bold 14px system-ui,sans-serif', align: 'center', stroke: 4,
  });
  const activeList = [];
  if (puTimers.magnet > 0 || itemTimers.magnet > 0 || skySprintActive) activeList.push('磁铁');
  if (puTimers.double > 0 || activeItems.double) activeList.push('双倍');
  if (puTimers.attack > 0) activeList.push('攻击强化');
  if (skySprintActive) activeList.push('起飞');
  if (itemShield > 0) activeList.push('护盾充能');
  if (activeList.length > 0) {
    ctx.fillStyle = 'rgba(12,10,18,0.82)';
    ctx.fillRect(W / 2 - 120, 50, 240, 22);
    drawHudText('生效: ' + activeList.join(' · '), W / 2, 65, {
      fill: '#e0d0ff', font: 'bold 12px system-ui,sans-serif', align: 'center', stroke: 3,
    });
  }
}

function drawPortalHint() {
  if (!portal || bonusActive) return;
  if (portal.x > W) {
    const dist = portal.x - W;
    const alpha = Math.min(0.9, 1 - dist / 400);
    if (alpha > 0) {
      const pulse = 0.75 + Math.sin(animT * 5) * 0.25;
      ctx.save();
      ctx.globalAlpha = alpha * pulse;
      drawHudText('→ 传送门', W - 12, 78, {
        fill: '#e0d0ff', font: 'bold 13px system-ui,sans-serif', align: 'right', stroke: 3.5,
      });
      ctx.restore();
    }
  }
}

function drawTransitionFx() {
  if (transitionFx <= 0) return;
  ctx.fillStyle = `rgba(255,255,255,${transitionFx * 0.6})`;
  ctx.fillRect(0, 0, W, H);
}

function drawBuffTimerRow(x, y, w, label, remain, total, color, glow) {
  drawStoneHudPanel(x, y, w, 24, 0.86);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.42;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * (remain / total)), 20);
  ctx.globalAlpha = 1;
  drawHudText(label, x + 6, y + 16, {
    fill: '#fffaf0', font: 'bold 12px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', stroke: 3,
  });
  drawHudText(remain.toFixed(1) + 's', x + w - 6, y + 16, {
    fill: glow || '#ffe08a',
    font: 'bold 12px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    align: 'right', stroke: 3,
  });
}

function drawItems() {
  let puY = _hudLayout.buffTop;
  const puX = _hudLayout.buffRightX;
  const barW = _hudLayout.buffColW;

  if (itemShield > 0) {
    const sx = 10;
    const sy = isMage() ? 96 : 70;
    drawStoneHudPanel(sx, sy, 108, 20, 0.82);
    drawHudText('起飞充能 ×' + itemShield, sx + 6, sy + 14, {
      fill: '#e8d8ff', font: 'bold 11px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', stroke: 3,
    });
  }

  if (itemTimers.magnet > 0) {
    drawBuffTimerRow(puX, puY, barW, '磁铁', itemTimers.magnet, 10, '#7a5cb0', '#e0d0ff');
    puY += 28;
  }
  if (activeItems.double && puTimers.double <= 0) {
    drawStoneHudPanel(puX, puY, barW, 24, 0.86);
    drawHudText('双倍金币(装备)', puX + 6, puY + 16, {
      fill: '#ffe08a', font: 'bold 12px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', stroke: 3,
    });
    puY += 28;
  }
  if (activeItems.revive) {
    drawStoneHudPanel(puX, puY, barW, 24, 0.86);
    drawHudText('复活就绪', puX + 6, puY + 16, {
      fill: '#ffb0b8', font: 'bold 12px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', stroke: 3,
    });
    puY += 28;
  }

  for (const k of PU_KEYS) {
    if (puTimers[k] > 0) {
      const def = PU[k];
      const label = k === 'magnet' ? '磁铁' : k === 'double' ? '双倍' : '攻击强化';
      drawBuffTimerRow(puX, puY, barW, label, puTimers[k], def.dur, def.color, def.glow);
      puY += 28;
    }
  }
}

function drawOverlay() {
  if (!running) {
    ctx.fillStyle = 'rgba(0,0,0,.62)';
    ctx.fillRect(0, 0, W, H);
    drawHudText(over ? '游戏结束' : '古堡跑酷', W / 2, H / 2 - 30, {
      fill: '#fffaf0', font: 'bold 32px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', align: 'center', stroke: 6,
    });
    if (over) {
      drawHudText(`距离 ${scoreM()}m · 最高 ${best}m · 金币 +${goldEarned()}`, W / 2, H / 2 + 4, {
        fill: '#f0e8d8', font: 'bold 15px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', align: 'center', stroke: 4,
      });
      drawHudText(`分数 ${scoreVal()} · 最高分 ${bestScore}`, W / 2, H / 2 + 30, {
        fill: '#ffe8a0', font: 'bold 18px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', align: 'center', stroke: 4,
      });
      const distGold = Math.floor(distanceM() / METER_PER_GOLD);
      const killGold = killCount * KILL_GOLD;
      const coinGold = coinPickups * COIN_VALUE;
      drawHudText(`距离 ${distGold} · 击杀 ${killGold} · 拾取 ${coinGold}`, W / 2, H / 2 + 52, {
        fill: '#e0d6c4', font: 'bold 13px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', align: 'center', stroke: 3.5,
      });
    } else {
      drawHudText('点“开始游戏”或按空格键开始', W / 2, H / 2 + 18, {
        fill: '#f0e8d8', font: 'bold 16px "Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', align: 'center', stroke: 4,
      });
    }
  }
}

// ===================== 主渲染 =====================
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawBonusTint();
  drawGround();
  drawGaps();
  drawElevatedPlatforms();
  drawWalls();
  drawBeams();
  drawSpikes();
  // 高速速度线（速度倍率 ≥1.5）
  if (speedMul() >= 1.5) {
    const intensity = Math.min(0.4, (speedMul() - 1) * 0.2);
    ctx.strokeStyle = `rgba(255,217,61,${intensity})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const yy = 20 + i * 36;
      const ll = 30 + (i % 3) * 18;
      ctx.beginPath();
      ctx.moveTo(W - ll, yy);
      ctx.lineTo(W, yy - 8);
      ctx.stroke();
    }
  }
  drawMonsters();
  drawFlyers();
  drawBats();
  drawPowerups();
  drawCoins();
  drawPortal();
  drawFireballs();
  drawSwordSwings();
  drawOrbitOrbs();
  drawPlayer();
  drawSkySprint();
  drawFloats();
  drawHUD();
  drawBonusHud();
  drawItems();
  drawPortalHint();
  drawMilestone();
  drawTutorial();
  drawTransitionFx();
  drawOverlay();
}

// ===================== 性能监控 =====================
const PERF_WINDOW = 60;
const perfFrames = new Float64Array(PERF_WINDOW);
let perfFrameCount = 0;
let perfFrameIdx = 0;
let perfFrameSum = 0;
let perfLastTs = 0;
let perfFps = 60;
let perfFrameTime = 16.7;
let perfUpdateMs = 0;
let perfDrawMs = 0;
let perfEntities = 0;
let perfSlowCount = 0;     // 掉帧计数（>20ms）
let perfShowOverlay = false;
let frameLoopActive = false;

function perfTick(ts) {
  const ft = perfLastTs > 0 ? ts - perfLastTs : 16.7;
  perfLastTs = ts;
  if (perfFrameCount < PERF_WINDOW) {
    perfFrames[perfFrameIdx] = ft;
    perfFrameSum += ft;
    perfFrameCount++;
    perfFrameIdx = (perfFrameIdx + 1) % PERF_WINDOW;
  } else {
    perfFrameSum -= perfFrames[perfFrameIdx];
    perfFrames[perfFrameIdx] = ft;
    perfFrameSum += ft;
    perfFrameIdx = (perfFrameIdx + 1) % PERF_WINDOW;
  }
  if (ft > 20) perfSlowCount++;
  perfFrameTime = perfFrameSum / perfFrameCount;
  perfFps = Math.round(1000 / perfFrameTime);
}

// ===================== 动画帧 =====================
function startFrameLoop() {
  if (frameLoopActive) return;
  frameLoopActive = true;
  lastTs = performance.now();
  requestAnimationFrame(frame);
}

function frame(ts) {
  perfTick(ts);
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  animT += dt;

  if (running) {
    const t0 = performance.now();
    update(dt);
    perfUpdateMs = performance.now() - t0;
  }
  const t1 = performance.now();
  draw();
  perfDrawMs = performance.now() - t1;

  // P 键切换性能叠层
  if (perfShowOverlay) drawPerfOverlay();
  if (running) requestAnimationFrame(frame);
  else frameLoopActive = false;
}

function drawPerfOverlay() {
  perfEntities = platforms.length + gaps.length + walls.length + beams.length + monsters.length + coins.length + fireballs.length + floats.length + elevatedPlatforms.length + spikes.length + flyers.length;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(W - 130, H - 88, 124, 78);
  ctx.fillStyle = perfFps < 50 ? '#ff6b35' : perfFps < 55 ? '#ffd93d' : '#00c9a7';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`FPS: ${perfFps}`, W - 122, H - 72);
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText(`Frame: ${perfFrameTime.toFixed(1)}ms`, W - 122, H - 58);
  ctx.fillText(`Update: ${perfUpdateMs.toFixed(1)}ms`, W - 122, H - 45);
  ctx.fillText(`Draw: ${perfDrawMs.toFixed(1)}ms`, W - 122, H - 32);
  ctx.fillText(`Entities: ${perfEntities}`, W - 122, H - 19);
  ctx.fillText(`Slow: ${perfSlowCount}`, W - 122, H - 6);
}

// ===================== 输入处理 =====================
const gameScreen = document.getElementById('screen-game');
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (gameScreen.classList.contains('active')) backToMenu();
    return;
  }
  if (e.code === 'KeyF') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
    return;
  }
  if (e.code === 'KeyP') {
    perfShowOverlay = !perfShowOverlay;
    perfSlowCount = 0;
    return;
  }
  if (e.code === 'KeyM') {
    toggleMute();
    return;
  }
  if (e.code === 'Enter') {
    e.preventDefault();
    if (gameScreen.classList.contains('active') && !running) reset();
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    // 未开局 / 结束后：空格开始或重开；局内：当作跳跃
    if (gameScreen.classList.contains('active') && !running) {
      reset();
      return;
    }
  }
  // 数字键 1-4：道具装备（局前）/ 使用（局内）
  if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
    const idx = parseInt(e.code.slice(-1)) - 1;
    const key = ITEM_KEYS[idx];
    if (gameScreen.classList.contains('active')) {
      if (!running) toggleEquip(key);
      else useItem(key);
    }
    return;
  }
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'Space') e.preventDefault();
  // 检测新跳跃按键（用于二段跳）
  if ((e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') && !keys.has(e.code)) {
    jumpPressed = true;
  }
  // 检测新蹲伏按键（用于翻滚）
  if ((e.code === 'KeyS' || e.code === 'ArrowDown') && !keys.has(e.code)) {
    duckPressed = true;
  }
  keys.add(e.code);
});
document.addEventListener('keyup', (e) => keys.delete(e.code));

// 触屏
let touchY = 0;
canvas.addEventListener('touchstart', (e) => {
  touchY = e.touches[0].clientY;
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  const dy = e.touches[0].clientY - touchY;
  if (dy < -18) {
    if (!keys.has('KeyW')) jumpPressed = true;
    keys.add('KeyW');
  }
  if (dy > 18 && !keys.has('KeyS')) {
    duckPressed = true;
    keys.add('KeyS');
  }
  touchY = e.touches[0].clientY;
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  touchY = 0;
  keys.delete('KeyW');
  keys.delete('KeyS');
  e.preventDefault();
}, { passive: false });

// PC：鼠标左键攻击（仅点在画布上，避免误触 UI）
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (!gameScreen.classList.contains('active') || !running || over) return;
  e.preventDefault();
  attack();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ===================== 屏幕按键控制 =====================
function bindCtrlBtn(btnId, keyCode) {
  const btn = document.getElementById(btnId);
  const press = (e) => {
    e.preventDefault();
    if (keyCode === 'KeyW' && !keys.has(keyCode)) jumpPressed = true;
    if (keyCode === 'KeyS' && !keys.has(keyCode)) duckPressed = true;
    keys.add(keyCode);
    btn.classList.add('pressed');
  };
  const release = (e) => {
    e.preventDefault();
    keys.delete(keyCode);
    btn.classList.remove('pressed');
  };
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('mouseleave', release);
  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
}
bindCtrlBtn('btn-jump', 'KeyW');
bindCtrlBtn('btn-duck', 'KeyS');
bindCtrlBtn('btn-atk', 'KeyJ');

// ===================== 角色界面 =====================
function lvDots(lv, maxLv) {
  const dots = [];
  for (let i = 1; i <= maxLv; i++) {
    dots.push(i <= lv ? '<span>●</span>' : '<span class="off">●</span>');
  }
  return dots.join('');
}

function talentDesc(lv) {
  if (lv < 1) return '解锁后：抵挡伤害触发起飞 5 秒，充能 CD 90 秒（仅挡伤后重充）';
  const cd = SHELTER_CD[Math.min(lv, TALENT_MAX) - 1];
  const stack = lv >= TALENT_MAX ? '，可叠 2 层' : '';
  return `挡伤后起飞 5 秒 · 充能 ${cd}s${stack}`;
}

// character / world tables: ./config/characters.js + ./config/world.js


function loadImageAsset(a, onReady) {
  if (a.img) return;
  const img = new Image();
  img.onload = () => {
    a.ready = true;
    applyManifestMeta(a);
    onReady?.();
  };
  img.onerror = () => { a.ready = false; a.failed = true; onReady?.(); };
  const src = a.src || '';
  img.src = src + (src.includes('?') ? '&' : '?') + 'v=' + ASSET_VER;
  a.img = img;
}

/** 美术尺寸真源：assets/sprite-manifest.json（生图后必须 measure 更新） */
let SPRITE_MANIFEST = null;
const SPRITE_REF_H = { mage: 500, warrior: 500 };

function applyManifestMeta(asset) {
  const file = String(asset.src || '').split('/').pop();
  const entry = SPRITE_MANIFEST?.sprites?.[file];
  if (!entry?.content) {
    asset.meta = null;
    return;
  }
  const c = entry.content;
  asset.meta = {
    left: c.left,
    top: c.top,
    bot: c.bottom,
    right: c.right,
    w: c.w,
    h: c.h,
    plant: !!entry.plant,
    footGap: entry.footGap ?? 0,
    canvasW: entry.canvasW,
    canvasH: entry.canvasH,
    char: entry.char,
    role: entry.role,
    anchor: entry.anchor || null,
  };
}

function ensureSpriteMeta(asset) {
  if (asset.meta) return asset.meta;
  applyManifestMeta(asset);
  if (asset.meta) return asset.meta;
  // 清单缺失时的兜底扫描（不应常态依赖）
  const img = asset.img;
  if (!img?.width) return null;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const { data } = g.getImageData(0, 0, img.width, img.height);
  let top = img.height;
  let bot = -1;
  let left = img.width;
  let right = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] > 12) {
        if (y < top) top = y;
        if (y > bot) bot = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  asset.meta = bot < 0
    ? { top: 0, bot: img.height - 1, left: 0, right: img.width - 1, w: img.width, h: img.height }
    : { top, bot, left, right, w: right - left + 1, h: bot - top + 1 };
  return asset.meta;
}

function loadSpriteManifest() {
  return fetch('assets/sprite-manifest.json?v=' + ASSET_VER, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data?.sprites) return;
      SPRITE_MANIFEST = data;
      if (data.refH) {
        if (data.refH.mage) SPRITE_REF_H.mage = data.refH.mage;
        if (data.refH.warrior) SPRITE_REF_H.warrior = data.refH.warrior;
      }
      for (const id of ['mage', 'warrior']) {
        applyManifestMeta(PORTRAIT_ASSETS[id]);
        for (const frame of Object.values(CHAR_SPRITES[id])) applyManifestMeta(frame);
      }
      for (const frame of Object.values(WORLD_ASSETS)) applyManifestMeta(frame);
      for (const id of ['mage', 'warrior']) {
        for (const sheet of [CHAR_RUN_SHEETS[id], CHAR_ROLL_SHEETS[id]]) {
          const file = String(sheet.src).split('/').pop();
          const entry = SPRITE_MANIFEST?.sprites?.[file];
          if (entry?.frames) {
            sheet.frames = entry.frames;
            if (entry.refH) sheet.refH = entry.refH;
            sheet.cols = entry.cols || sheet.cols || 3;
            sheet.rows = entry.rows || sheet.rows || 1;
          }
          applyManifestMeta(sheet);
        }
      }
    })
    .catch(() => {});
}

let assetsReady = false;
let assetsPending = 0;
let assetsFinished = 0;

function setStartButtonsEnabled(on) {
  for (const id of ['menu-start', 'start']) {
    const el = document.getElementById(id);
    if (el) el.disabled = !on;
  }
}

function finishBootLoading() {
  if (assetsReady) return;
  assetsReady = true;
  document.documentElement.classList.remove('assets-pending');
  document.documentElement.classList.add('assets-ready');
  const boot = document.getElementById('boot-loading');
  if (boot) {
    boot.classList.add('is-done');
    boot.setAttribute('aria-busy', 'false');
    window.setTimeout(() => { boot.hidden = true; }, 300);
  }
  setStartButtonsEnabled(true);
  refreshMainMenu();
  if (document.getElementById('screen-char')?.classList.contains('active')) refreshCharScreen();
}

function noteAssetSettled() {
  assetsFinished += 1;
  const bootText = document.querySelector('.boot-loading-text');
  if (bootText && assetsPending > 0) {
    const pct = Math.min(100, Math.round((assetsFinished / assetsPending) * 100));
    bootText.textContent = '加载中… ' + pct + '%';
  }
  if (assetsFinished >= assetsPending) finishBootLoading();
}

function trackImageAsset(a) {
  assetsPending += 1;
  loadImageAsset(a, () => {
    noteAssetSettled();
    if (!assetsReady) {
      refreshMainMenu();
      if (document.getElementById('screen-char')?.classList.contains('active')) refreshCharScreen();
    }
  });
}

function loadPortraitAssets() {
  setStartButtonsEnabled(false);
  assetsPending = 0;
  assetsFinished = 0;
  loadSpriteManifest().finally(() => {
    for (const id of ['mage', 'warrior']) {
      trackImageAsset(PORTRAIT_ASSETS[id]);
      for (const frame of Object.values(CHAR_SPRITES[id])) trackImageAsset(frame);
      trackImageAsset(CHAR_RUN_SHEETS[id]);
      trackImageAsset(CHAR_ROLL_SHEETS[id]);
    }
    for (const frame of Object.values(WORLD_ASSETS)) trackImageAsset(frame);
    if (assetsPending === 0) finishBootLoading();
  });
}

/** 世界精灵整图绘制：anchor 'center' | 'feet'；尺寸来自 manifest content 盒 */
function drawWorldSprite(asset, cx, cy, drawH, anchor) {
  if (!asset?.ready || !asset.img) return false;
  const m = ensureSpriteMeta(asset);
  if (!m || !m.h) return false;
  const scale = drawH / m.h;
  const dw = m.w * scale;
  const dh = m.h * scale;
  const dx = cx - dw / 2;
  const dy = anchor === 'feet' ? (cy - dh) : (cy - dh / 2);
  ctx.drawImage(asset.img, m.left, m.top, m.w, m.h, dx, dy, dw, dh);
  return true;
}

/** 拉伸铺满矩形（障碍墙/吊梁/平台） */
function drawWorldSpriteBox(asset, x, y, w, h) {
  if (!asset?.ready || !asset.img) return false;
  const m = ensureSpriteMeta(asset);
  if (!m || !m.h) return false;
  ctx.drawImage(asset.img, m.left, m.top, m.w, m.h, x, y, w, h);
  return true;
}

function firstReadySprite(...assets) {
  for (const a of assets) {
    if (a?.ready) return a;
  }
  return null;
}

function pickRunSheet(charId) {
  const sheet = CHAR_RUN_SHEETS[charId];
  if (!sheet?.ready || !sheet.img) return null;
  const frames = ensureSheetFrames(sheet);
  if (!frames?.length) return null;
  const n = frames.length;
  const RUN_FPS = 38;
  const idx = Math.floor(animT * RUN_FPS) % n;
  const frame = frames[idx];
  return { kind: 'runSheet', sheet, frame, charId, frameIndex: idx };
}

function pickCharSprite(charId) {
  const frames = CHAR_SPRITES[charId];
  if (!frames) return null;

  const atkActive = (charId === 'warrior' && warriorSlashT > 0)
    || (charId === 'mage' && attackFx > 0);
  if (atkActive) {
    if (charId === 'warrior') {
      const windFrac = warriorSlashT / SWORD_SLASH_DUR;
      if (windFrac > 0.55) return firstReadySprite(frames.atkWind, frames.atk);
      return firstReadySprite(frames.atk, frames.atkWind);
    }
    const p = 1 - Math.max(0, Math.min(1, attackFx / MAGE_ATK_DUR));
    if (p < 0.36) return firstReadySprite(frames.atkWind, frames.atk);
    if (p < 0.78) return firstReadySprite(frames.atk, frames.atkWind);
    return firstReadySprite(frames.atkWind, frames.atk);
  }

  if (skySprintActive) {
    return firstReadySprite(frames.fly, frames.jump, frames.jumpAnt);
  }

  if (px > 10) {
    if (typeof vy === 'number' && vy > 40 && px < 55) {
      return firstReadySprite(frames.jumpAnt, frames.jump);
    }
    return firstReadySprite(frames.jump, frames.jumpAnt);
  }

  return pickRunSheet(charId);
}

function drawRunSheetSprite(cx, cy, bob, hMul, pick) {
  const { sheet, frame, charId } = pick;
  const img = sheet.img;
  if (!img || !frame) return false;
  // 用每格 content 盒，避免整格透明边参与缩放；脚底贴 GROUND
  const srcL = frame.left;
  const srcT = frame.top;
  const srcW = frame.w;
  const srcH = frame.h;
  if (!srcW || !srcH) return false;
  const scale = charBodyScale(charId);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const yBob = px > 10 ? bob : 0;
  ctx.save();
  playerInvincibleFlicker(0.45);
  ctx.translate(cx, cy + yBob);
  ctx.scale(1, hMul);
  const dy = -dh;
  ctx.drawImage(img, srcL, srcT, srcW, srcH, -dw / 2, dy, dw, dh);
  ctx.restore();
  ctx.globalAlpha = 1;
  return true;
}

function drawCharSprite(cx, cy, bob, hMul, asset) {
  if (asset?.kind === 'runSheet') {
    return drawRunSheetSprite(cx, cy, bob, hMul, asset);
  }
  const img = asset.img;
  if (!img || !img.width) return false;
  const m = ensureSpriteMeta(asset);
  if (!m) return false;
  const cid = m.char || (isWarrior() ? 'warrior' : 'mage');
  const refH = SPRITE_REF_H[cid] || m.h || 500;
  const scale = CHAR_H_STAND / refH;
  const dw = m.w * scale;
  const dh = m.h * scale;
  const yBob = px > 10 ? bob : 0;
  ctx.save();
  playerInvincibleFlicker(0.45);
  ctx.translate(cx, cy + yBob);
  ctx.scale(1, hMul);
  const dy = -dh;
  ctx.drawImage(img, m.left, m.top, m.w, m.h, -dw / 2, dy, dw, dh);
  ctx.restore();
  ctx.globalAlpha = 1;
  return true;
}

function drawPortraitImage(pctx, asset, w, h) {
  const img = asset.img;
  if (!img?.width) return;
  // 用清单 content 盒，整只角色（含帽尖）缩进画布，禁止底对齐裁头顶
  const m = ensureSpriteMeta(asset) || {
    left: 0, top: 0, w: img.width, h: img.height,
  };
  const padX = w * 0.06;
  const padTop = h * 0.05;
  const padBot = h * 0.04;
  const maxW = Math.max(8, w - padX * 2);
  const maxH = Math.max(8, h - padTop - padBot);
  const scale = Math.min(maxW / m.w, maxH / m.h);
  const dw = m.w * scale;
  const dh = m.h * scale;
  const dx = (w - dw) / 2;
  let dy = h - padBot - dh;
  if (dy < padTop) dy = padTop;
  pctx.drawImage(img, m.left, m.top, m.w, m.h, dx, dy, dw, dh);
}

function drawPortraitBg(pctx, w, h, charId) {
  // 古堡石壁 + 地面，避免立绘透明区露出大块黑底
  const wallH = Math.floor(h * 0.72);
  const wallGrad = pctx.createLinearGradient(0, 0, 0, wallH);
  if (charId === 'warrior') {
    wallGrad.addColorStop(0, '#3a4558');
    wallGrad.addColorStop(1, '#2a3040');
  } else {
    wallGrad.addColorStop(0, '#3a3348');
    wallGrad.addColorStop(1, '#2a2435');
  }
  pctx.fillStyle = wallGrad;
  pctx.fillRect(0, 0, w, wallH);

  const bw = Math.max(18, (w / 6) | 0);
  const bh = Math.max(12, (h / 16) | 0);
  for (let row = 0; row < Math.ceil(wallH / bh) + 1; row++) {
    const y = row * bh;
    const shift = (row & 1) ? bw * 0.5 : 0;
    for (let col = -1; col < Math.ceil(w / bw) + 1; col++) {
      const x = col * bw + shift;
      const shade = 48 + ((col * 17 + row * 13) % 18);
      pctx.fillStyle = `rgb(${(shade * 0.92) | 0},${(shade * 0.88) | 0},${(shade * 1.02) | 0})`;
      pctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      pctx.fillStyle = 'rgba(255,240,220,0.06)';
      pctx.fillRect(x + 1, y + 1, bw - 2, 2);
    }
  }

  const floorGrad = pctx.createLinearGradient(0, wallH, 0, h);
  floorGrad.addColorStop(0, '#3a342c');
  floorGrad.addColorStop(1, '#1e1a18');
  pctx.fillStyle = floorGrad;
  pctx.fillRect(0, wallH, w, h - wallH);
  const fw = Math.max(16, (w / 5) | 0);
  const fh = Math.max(10, ((h - wallH) / 3) | 0);
  for (let row = 0; row < 4; row++) {
    const y = wallH + 4 + row * fh;
    const shift = (row & 1) ? fw * 0.5 : 0;
    for (let col = -1; col < 8; col++) {
      const x = col * fw + shift;
      const shade = 58 + ((col * 11 + row * 7) % 16);
      pctx.fillStyle = `rgb(${(shade * 0.95) | 0},${(shade * 0.88) | 0},${(shade * 0.8) | 0})`;
      pctx.fillRect(x + 1, y, fw - 2, fh - 2);
    }
  }
  pctx.fillStyle = 'rgba(196,164,104,0.25)';
  pctx.fillRect(0, wallH, w, 2);

  const spot = pctx.createRadialGradient(w * 0.5, h * 0.42, 8, w * 0.5, h * 0.5, w * 0.55);
  spot.addColorStop(0, 'rgba(255,220,160,0.14)');
  spot.addColorStop(1, 'rgba(0,0,0,0)');
  pctx.fillStyle = spot;
  pctx.fillRect(0, 0, w, h);
}

function drawCanvasSpinner(pctx, cx, cy, r) {
  pctx.save();
  pctx.translate(cx, cy);
  pctx.rotate((performance.now() / 180) % (Math.PI * 2));
  pctx.strokeStyle = 'rgba(250,246,236,0.18)';
  pctx.lineWidth = 3;
  pctx.beginPath();
  pctx.arc(0, 0, r, 0, Math.PI * 2);
  pctx.stroke();
  pctx.strokeStyle = '#f0d080';
  pctx.lineCap = 'round';
  pctx.beginPath();
  pctx.arc(0, 0, r, -Math.PI / 2, Math.PI * 0.4);
  pctx.stroke();
  pctx.restore();
}

function drawPortraitIllustration(pctx, charId, w, h) {
  const asset = PORTRAIT_ASSETS[charId];
  if (asset?.ready && asset.img?.width) {
    drawPortraitBg(pctx, w, h, charId);
    drawPortraitImage(pctx, asset, w, h);
    return;
  }
  // loading / failed: plain fill + spinner — no geometric brick placeholder
  pctx.fillStyle = '#1a1520';
  pctx.fillRect(0, 0, w, h);
  if (asset?.failed) {
    pctx.fillStyle = 'rgba(250,246,236,0.55)';
    pctx.font = '600 13px "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
    pctx.textAlign = 'center';
    pctx.textBaseline = 'middle';
    pctx.fillText('立绘未加载', w / 2, h * 0.46);
    return;
  }
  drawCanvasSpinner(pctx, w / 2, h * 0.46, Math.min(w, h) * 0.08);
}

function drawCharPortrait(charId, canvasId) {
  const el = document.getElementById(canvasId || 'char-portrait');
  if (!el) return;
  drawPortraitIllustration(el.getContext('2d'), charId, el.width, el.height);
}

function refreshMainMenu() {
  const goldEl = document.getElementById('menu-gold');
  if (goldEl) goldEl.textContent = Math.floor(gold);
  const nameEl = document.getElementById('menu-char-name');
  if (nameEl) nameEl.textContent = CHAR_NAMES[selectedChar] || '法师';
  drawCharPortrait(selectedChar, 'menu-portrait');
}

function buildUpgradeRow(name, desc, lv, maxLv, cost, btnId, canBuy) {
  const maxed = lv >= maxLv;
  const btnText = maxed ? '已满级' : `升级 ${cost} 金`;
  return `<div class="upgrade" data-up="${btnId}">
    <div class="meta"><div class="name">${name}</div><div class="desc">${desc}</div></div>
    <div class="lv">${lvDots(lv, maxLv)}</div>
    <button type="button" data-buy="${btnId}" ${maxed || !canBuy ? 'disabled' : ''}>${btnText}</button>
  </div>`;
}

function refreshCharScreen() {
  const goldEl = document.getElementById('char-gold');
  if (!goldEl) return;
  goldEl.textContent = Math.floor(gold);
  const tabMage = document.getElementById('tab-mage');
  const tabWar = document.getElementById('tab-warrior');
  if (tabMage) tabMage.classList.toggle('active', uiCharView === 'mage');
  if (tabWar) {
    tabWar.classList.toggle('active', uiCharView === 'warrior');
    tabWar.classList.toggle('locked', !charData.warrior.unlocked);
  }
  const buyBanner = document.getElementById('char-buy-warrior');
  if (buyBanner) buyBanner.hidden = uiCharView !== 'warrior' || charData.warrior.unlocked;
  const buyBtn = document.getElementById('buy-warrior-char');
  if (buyBtn) buyBtn.disabled = Math.floor(gold) < WARRIOR_BUY_COST;
  const equipBtn = document.getElementById('char-equip-btn');
  if (equipBtn) {
    equipBtn.textContent = selectedChar === uiCharView ? '当前出战' : '选为出战角色';
    equipBtn.disabled = selectedChar === uiCharView
      || (uiCharView === 'warrior' && !charData.warrior.unlocked);
  }
  drawCharPortrait(uiCharView, 'char-portrait');
  const box = document.getElementById('char-upgrades');
  if (!box) return;
  box.innerHTML = '';
  const g = Math.floor(gold);
  if (uiCharView === 'mage') {
    const m = charData.mage;
    box.innerHTML = [
      buildUpgradeRow('生命值', '上限 3 点', m.hp, MAGE_HP_MAX, UP_COST_MAGE_HP(m.hp), 'mage-hp', g >= UP_COST_MAGE_HP(m.hp)),
      buildUpgradeRow('攻击力', mageAtkDesc(m.atk), m.atk, MAGE_ATK_MAX, UP_COST_MAGE_ATK(m.atk), 'mage-atk', g >= UP_COST_MAGE_ATK(m.atk)),
      buildUpgradeRow('护盾', '破碎触发起飞', m.shd, MAGE_SHD_MAX, UP_COST_MAGE_SHD(), 'mage-shd', g >= UP_COST_MAGE_SHD()),
      buildUpgradeRow('回能速度', '每级 +20%', m.en, MAGE_EN_MAX, UP_COST_MAGE_EN(m.en), 'mage-en', g >= UP_COST_MAGE_EN(m.en)),
    ].join('');
  } else if (charData.warrior.unlocked) {
    const w = charData.warrior;
    const tCost = w.talent < 1 ? TALENT_UNLOCK_COST : TALENT_UP_COST(w.talent);
    box.innerHTML = [
      buildUpgradeRow('生命值', '上限 5 点', w.hp, WARRIOR_HP_MAX, UP_COST_WARRIOR_HP(w.hp), 'war-hp', g >= UP_COST_WARRIOR_HP(w.hp)),
      buildUpgradeRow('护盾', '上限 2 层', w.shd, WARRIOR_SHD_MAX, UP_COST_WARRIOR_SHD(), 'war-shd', g >= UP_COST_WARRIOR_SHD()),
      buildUpgradeRow('攻击力', warriorAtkDesc(w.atk), w.atk, WARRIOR_ATK_MAX, UP_COST_WARRIOR_ATK(w.atk), 'war-atk', g >= UP_COST_WARRIOR_ATK(w.atk)),
      buildUpgradeRow('骑士庇护', talentDesc(w.talent), w.talent, TALENT_MAX, tCost, 'war-talent', g >= tCost),
    ].join('');
  }
  box.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => buyCharUpgrade(btn.getAttribute('data-buy')));
  });
}

function buyCharUpgrade(key) {
  const g = Math.floor(gold);
  if (key === 'mage-hp') {
    const m = charData.mage;
    const c = UP_COST_MAGE_HP(m.hp);
    if (m.hp >= MAGE_HP_MAX || g < c) return;
    gold -= c; m.hp++;
  } else if (key === 'mage-atk') {
    const m = charData.mage; const c = UP_COST_MAGE_ATK(m.atk);
    if (m.atk >= MAGE_ATK_MAX || g < c) return;
    gold -= c; m.atk++;
  } else if (key === 'mage-shd') {
    const m = charData.mage; const c = UP_COST_MAGE_SHD();
    if (m.shd >= MAGE_SHD_MAX || g < c) return;
    gold -= c; m.shd++;
  } else if (key === 'mage-en') {
    const m = charData.mage; const c = UP_COST_MAGE_EN(m.en);
    if (m.en >= MAGE_EN_MAX || g < c) return;
    gold -= c; m.en++;
  } else if (key === 'war-hp') {
    const w = charData.warrior; const c = UP_COST_WARRIOR_HP(w.hp);
    if (w.hp >= WARRIOR_HP_MAX || g < c) return;
    gold -= c; w.hp++;
  } else if (key === 'war-shd') {
    const w = charData.warrior; const c = UP_COST_WARRIOR_SHD();
    if (w.shd >= WARRIOR_SHD_MAX || g < c) return;
    gold -= c; w.shd++;
  } else if (key === 'war-atk') {
    const w = charData.warrior; const c = UP_COST_WARRIOR_ATK(w.atk);
    if (w.atk >= WARRIOR_ATK_MAX || g < c) return;
    gold -= c; w.atk++;
  } else if (key === 'war-talent') {
    const w = charData.warrior;
    const c = w.talent < 1 ? TALENT_UNLOCK_COST : TALENT_UP_COST(w.talent);
    if (w.talent >= TALENT_MAX || g < c) return;
    gold -= c; w.talent++;
  } else return;
  save(LS.gold, gold);
  saveCharData();
  refreshCharScreen();
  refreshMainMenu();
}

function buyWarriorChar() {
  if (charData.warrior.unlocked || Math.floor(gold) < WARRIOR_BUY_COST) return;
  gold -= WARRIOR_BUY_COST;
  charData.warrior.unlocked = true;
  save(LS.gold, gold);
  saveCharData();
  refreshCharScreen();
  refreshMainMenu();
}

function equipUiChar() {
  if (uiCharView === 'warrior' && !charData.warrior.unlocked) return;
  selectedChar = uiCharView;
  localStorage.setItem(LS.char, selectedChar);
  refreshCharScreen();
  refreshMainMenu();
  updateAttackButtonIcon();
}

function updateAttackButtonIcon() {
  const btn = document.getElementById('btn-atk');
  if (btn) btn.querySelector('.icon').textContent = isWarrior() ? '⚔' : '🔥';
}

// ===================== 道具商店 / 装备 =====================
function refreshShop() {
  document.getElementById('shop-gold').textContent = Math.floor(gold);
  for (const key of ITEM_KEYS) {
    document.getElementById('shop-owned-' + key).textContent = ownedItems[key];
    const btn = document.getElementById('buy-' + key);
    btn.textContent = `购买 ${ITEMS[key].price} 金`;
    btn.disabled = Math.floor(gold) < ITEMS[key].price;
  }
}

function buyItem(key) {
  const price = ITEMS[key].price;
  if (Math.floor(gold) < price) return;
  gold -= price;
  ownedItems[key]++;
  save(LS.gold, gold);
  saveItems(ownedItems);
  refreshShop();
}

function refreshItemEquip() {
  const container = document.getElementById('item-equip');
  container.innerHTML = '';
  for (let i = 0; i < ITEM_KEYS.length; i++) {
    const key = ITEM_KEYS[i];
    const count = ownedItems[key];
    const div = document.createElement('div');
    div.className = 'item-slot' + (equippedItems[key] ? ' equipped' : '') + (count <= 0 ? ' disabled' : '');
    if (key === 'magnet') {
      // 磁铁为主动道具，未开局时只提示，开局后点击可使用
      div.innerHTML = `<span class="key-num">${i + 1}</span><span class="item-icon">${ITEMS[key].icon}</span><span>${ITEMS[key].name}</span><span class="item-count">${count > 0 ? (running ? `x${count}` : '游戏中使用') : 'x0'}</span>`;
    } else {
      div.innerHTML = `<span class="key-num">${i + 1}</span><span class="item-icon">${ITEMS[key].icon}</span><span>${ITEMS[key].name}</span><span class="item-count">x${count}</span>`;
    }
    if (count > 0) {
      div.addEventListener('click', () => {
        if (running) useItem(key);
        else toggleEquip(key);
      });
    }
    container.appendChild(div);
  }
}

function toggleEquip(key) {
  if (ownedItems[key] <= 0) return;
  if (key === 'magnet') return; // 磁铁仅游戏内使用，不支持装备
  equippedItems[key] = !equippedItems[key];
  refreshItemEquip();
}

function useItem(key) {
  if (!running || over) return;
  if (ownedItems[key] <= 0) return;
  if (key === 'magnet') {
    if (itemTimers.magnet > 0) return; // 已激活
    itemTimers.magnet = ITEMS.magnet.dur;
    ownedItems.magnet--;
    saveItems(ownedItems);
    floats.push({ x: CHAR_X, y: GROUND - 120, t: 1.0, text: '磁铁!' });
  } else if (key === 'shield') {
    itemShield++;
    ownedItems.shield--;
    saveItems(ownedItems);
    floats.push({ x: CHAR_X, y: GROUND - 120, t: 1.0, text: '护盾充能!' });
  } else if (key === 'double') {
    if (activeItems.double) return; // 已激活
    activeItems.double = true;
    ownedItems.double--;
    saveItems(ownedItems);
    floats.push({ x: CHAR_X, y: GROUND - 120, t: 1.0, text: '双倍金币!' });
  } else if (key === 'revive') {
    if (activeItems.revive) return; // 已激活
    activeItems.revive = true;
    ownedItems.revive--;
    saveItems(ownedItems);
    floats.push({ x: CHAR_X, y: GROUND - 120, t: 1.0, text: '复活就绪!' });
  }
  refreshItemEquip();
}

// ===================== UI 事件绑定 =====================
// 横屏状态（提前声明，供 applyMobileLayout 使用）
const landscapeBtn = document.getElementById('btn-landscape');
const menuLandscapeBtn = document.getElementById('menu-landscape');
let landscapeMode = false;
// 移动端检测：优先复用 head 阶段结果，避免首屏先显示 PC UI
const refreshMobileUiMode = () => {
  const mobile = window.__DEMO_DETECT_MOBILE_UI ? window.__DEMO_DETECT_MOBILE_UI() : false;
  window.__DEMO_MOBILE_UI = mobile;
  document.documentElement.classList.toggle('mobile-ui', mobile);
  document.documentElement.classList.toggle('desktop-ui', !mobile);
  return mobile;
};
const isMobile = () => {
  return window.__DEMO_MOBILE_UI === true;
};
function updateMobileLandscapeButtons() {
  const mobile = refreshMobileUiMode();
  const label = document.fullscreenElement ? '退出全屏' : '全屏横屏';
  menuLandscapeBtn.style.display = mobile ? 'block' : 'none';
  landscapeBtn.style.display = 'none';
  menuLandscapeBtn.textContent = label;
  landscapeBtn.textContent = label;
  if (!mobile) {
    document.getElementById('screen-game').classList.remove('game-landscape', 'force-landscape-rotate');
    landscapeMode = false;
  }
}
function isPortraitViewport() {
  return window.innerHeight > window.innerWidth;
}
function updateLandscapeFallback() {
  const gameScreen = document.getElementById('screen-game');
  gameScreen.classList.toggle(
    'force-landscape-rotate',
    isMobile() && gameScreen.classList.contains('game-landscape') && isPortraitViewport()
  );
}
function enterGameScreenForMobileLandscape() {
  refreshItemEquip();
  if (!running) {
    startBtn.textContent = over ? '再来一局' : '开始游戏';
    startBtn.disabled = false;
  }
  homeBtn.style.display = over ? 'inline-block' : 'none';
  show('screen-game');
  applyMobileLayout();
  updateLandscapeFallback();
  draw();
}
async function requestGameFullscreen(gameScreen) {
  if (document.fullscreenElement) return true;
  try {
    if (gameScreen.requestFullscreen) await gameScreen.requestFullscreen();
    else await document.documentElement.requestFullscreen();
    return true;
  } catch(e) {
    return false;
  }
}
async function lockLandscapeOrientation() {
  if (!screen.orientation || !screen.orientation.lock) return false;
  try {
    await screen.orientation.lock('landscape-primary');
    return true;
  } catch(e) {
    try {
      await screen.orientation.lock('landscape');
      return true;
    } catch(e2) {
      return false;
    }
  }
}
// 移动端自动横版布局
function applyMobileLayout() {
  if (!isMobile()) return;
  const gameScreen = document.getElementById('screen-game');
  if (!gameScreen.classList.contains('game-landscape')) {
    gameScreen.classList.add('game-landscape');
    landscapeMode = true;
    updateMobileLandscapeButtons();
  }
}
async function toggleMobileFullscreenLandscape() {
  if (!isMobile()) return;
  const gameScreen = document.getElementById('screen-game');
  if (!gameScreen.classList.contains('active')) enterGameScreenForMobileLandscape();
  gameScreen.classList.add('game-landscape');
  landscapeMode = true;
  updateLandscapeFallback();
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch(e) {}
  } else {
    await requestGameFullscreen(gameScreen);
    await lockLandscapeOrientation();
    window.setTimeout(() => {
      updateLandscapeFallback();
      draw();
    }, 250);
  }
  updateMobileLandscapeButtons();
  updateLandscapeFallback();
  draw();
}

document.getElementById('menu-start').addEventListener('click', () => {
  refreshItemEquip();
  if (isMobile()) {
    enterGameScreenForMobileLandscape();
  } else {
    if (!running) {
      startBtn.textContent = over ? '再来一局' : '开始游戏';
      startBtn.disabled = false;
    }
    homeBtn.style.display = over ? 'inline-block' : 'none';
    show('screen-game');
    draw();
  }
});
menuLandscapeBtn.addEventListener('click', toggleMobileFullscreenLandscape);
document.getElementById('menu-stats').addEventListener('click', () => {
  document.getElementById('st-best').textContent = best;
  document.getElementById('st-plays').textContent = load(LS.plays, 0);
  document.getElementById('st-time').textContent = `${load(LS.time, 0)} 秒`;
  show('screen-stats');
});
document.getElementById('stats-back').addEventListener('click', () => show('screen-menu'));
document.getElementById('menu-char').addEventListener('click', () => show('screen-char'));
document.getElementById('char-back').addEventListener('click', () => show('screen-menu'));
document.getElementById('tab-mage').addEventListener('click', () => { uiCharView = 'mage'; refreshCharScreen(); });
document.getElementById('tab-warrior').addEventListener('click', () => { uiCharView = 'warrior'; refreshCharScreen(); });
document.getElementById('buy-warrior-char').addEventListener('click', buyWarriorChar);
document.getElementById('char-equip-btn').addEventListener('click', equipUiChar);
document.getElementById('menu-exit').addEventListener('click', () => show('screen-exit'));
document.getElementById('exit-back').addEventListener('click', () => show('screen-menu'));
// 设置页面
const volBgmSlider = document.getElementById('vol-bgm');
const volBgmVal = document.getElementById('vol-bgm-val');
const volSfxSlider = document.getElementById('vol-sfx');
const volSfxVal = document.getElementById('vol-sfx-val');
volBgmSlider.value = Math.round(bgmVolume * 100);
volBgmVal.textContent = volBgmSlider.value;
volSfxSlider.value = Math.round(sfxVolume * 100);
volSfxVal.textContent = volSfxSlider.value;
document.getElementById('menu-settings').addEventListener('click', () => show('screen-settings'));
document.getElementById('settings-back').addEventListener('click', () => show('screen-menu'));
// 道具商店
document.getElementById('menu-shop').addEventListener('click', () => { refreshShop(); show('screen-shop'); });
document.getElementById('shop-back').addEventListener('click', () => show('screen-menu'));
document.getElementById('buy-magnet').addEventListener('click', () => buyItem('magnet'));
document.getElementById('buy-shield').addEventListener('click', () => buyItem('shield'));
document.getElementById('buy-double').addEventListener('click', () => buyItem('double'));
document.getElementById('buy-revive').addEventListener('click', () => buyItem('revive'));
volBgmSlider.addEventListener('input', () => {
  volBgmVal.textContent = volBgmSlider.value;
  setBgmVolume(volBgmSlider.value / 100);
  if (!muted && !bgmTimer && running) startBGM();
});
volSfxSlider.addEventListener('input', () => {
  volSfxVal.textContent = volSfxSlider.value;
  setSfxVolume(volSfxSlider.value / 100);
  sfxJump(); // 预览音效
});
startBtn.addEventListener('click', () => { if (!running) reset(); });
homeBtn.addEventListener('click', () => backToMenu());

// ===================== 横屏切换 =====================
async function toggleLandscape() {
  await toggleMobileFullscreenLandscape();
}
landscapeBtn.addEventListener('click', toggleLandscape);
document.addEventListener('fullscreenchange', () => {
  updateMobileLandscapeButtons();
  updateLandscapeFallback();
  if (isMobile() && document.getElementById('screen-game').classList.contains('active')) {
    applyMobileLayout();
    draw();
  }
});
window.addEventListener('resize', () => {
  updateMobileLandscapeButtons();
  updateLandscapeFallback();
});
updateMobileLandscapeButtons();

// ===================== 测试钩子 =====================
window.testCheat = false;
window.startTestGame = function() {
  window.testCheat = true;
  tutorialDone = 1; save(LS.tut, 1);
  show('screen-game');
  reset();
};
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) {
    animT += 1 / 60;
    if (window.testCheat && running) { invincible = 999; hp = Math.max(hp, 1); if (px < 0) { px = 0; vy = 0; } }
    if (running) update(1 / 60);
  }
  lastTs = performance.now();
  draw();
};

window.render_game_to_text = () => JSON.stringify({
  note: '坐标系：左上角原点，y 向下；GROUND=420；Canvas 800x500 横版；角色固定 x=120；距离单位 m',
  mode: over ? 'over' : running ? 'playing' : 'menu',
  player: {
    char: selectedChar,
    x: CHAR_X, feetY: Math.round(GROUND - px), vy: Math.round(vy),
    ducking, rollTimer: +rollTimer.toFixed(2), hp, shield, itemShield, knightShelter, onPlatformY,
    invincible: +invincible.toFixed(1),
    canDoubleJump, energy: Math.round(energy),
    skySprintActive, skySprintTime: +skySprintTime.toFixed(2),
  },
  tutorial: { active: tutorialActive, step: tutorialStep, shown: tutorialShown, actionDone: tutorialActionDone, freezing: tutorialActionFreezing() },
  gaps: gaps.map((g) => ({ x: Math.round(g.x), w: Math.round(g.w) })),
  walls: walls.map((w) => ({ x: Math.round(w.x), w: w.w })),
  beams: beams.map((b) => ({ x: Math.round(b.x), w: b.w })),
  monsters: monsters.map((m) => ({ x: Math.round(m.x), big: m.big, hp: m.hp })),
  spikes: spikes.map((s) => ({ x: Math.round(s.x), w: s.w })),
  flyers: flyers.map((f) => ({ x: Math.round(f.x), y: Math.round(f.baseY + Math.sin(animT * 2 + f.phase) * FLYER_AMP) })),
  elevatedPlatforms: elevatedPlatforms.map((p) => ({ x0: Math.round(p.x0), x1: Math.round(p.x1), y: p.y })),
  fireballs: fireballs.map((f) => ({ x: Math.round(f.x) })),
  coins: coins.filter((c) => !c.taken).map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })),
  portal: portal ? { x: Math.round(portal.x), y: Math.round(portal.y) } : null,
  speedMul: +speedMul().toFixed(2),
  scoreMeters: scoreM(),
  goldEarned: goldEarned(),
  coinPickups,
  goldTotal: Math.floor(gold),
  best: Math.floor(best),
  score: scoreVal(),
  bestScore,
  bonusActive,
  bonusDist: +bonusDist.toFixed(1),
  activeItems,
  itemTimers: { magnet: +itemTimers.magnet.toFixed(1) },
  powerups: powerups.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), type: p.type })),
  puTimers: { magnet: +puTimers.magnet.toFixed(1), double: +puTimers.double.toFixed(1), attack: +puTimers.attack.toFixed(1) },
  skySprintActive,
  itemShield,
});

// ===================== 初始化 =====================
bestEl.textContent = best;
hudGoldEl.textContent = 0;
hudScoreEl.textContent = 0;
saveCharData();
updateAttackButtonIcon();
loadPortraitAssets();
refreshMainMenu();
