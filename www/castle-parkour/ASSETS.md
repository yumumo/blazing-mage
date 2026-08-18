# 局内资源真源（Pages / AGT 只认这里）

改贴图前先对清单。运行时只加载 `js/config/characters.js` + `world.js` / `monsters.js` 登记的路径，外加 `sprite-manifest.json`。


## 资源分区目录

| 目录 | 内容 |
|------|------|
| `assets/characters/<id>/` | 立绘 + 运动 sheet |
| `assets/enemies/` | 敌对立绘 + sheet |
| `assets/world/` | 道具 / 平台 / 场景物 |
| `assets/ui/` | 菜单石板（`castle-ui-*`） |
| `assets/fonts/` | 字标 + HUD 数字（仅字体） |

## 分区（上传必读）

| 路径 | 入库 | 进 Pages | 用途 |
|------|:----:|:--------:|------|
| `www/castle-parkour/assets/` | ✅ | ✅ | **局内运行时** PNG + manifest（**仅 sheet / 立绘 / 世界物**） |
| `www/castle-parkour/js/` `css/` `index.html` | ✅ | ✅ | 游戏壳与逻辑 |
| `www/castle-parkour/build-id.txt` `_headers` | ✅ | ✅ | 版本探针 / 缓存头 |
| `dev/*.py` `dev/README.md` `dev/PLANT_README.txt` | ✅ | ❌ | 美术对齐 / 种入脚本 |
| `Back-castle-parkour/` | ❌ | ❌ | 品红中间态 + 验收表（gitignore，不上传） |
| `www/castle-parkour/dev/` · `dev/art-raw/` · `dev/_*.py` | ❌ | ❌ | 禁止入库 |

缓存戳：`ASSET_VER`（`js/config/characters.js`）须与下列同步：

- `build-id.txt`
- `index.html` 里 `boot-mobile.js` / `app.css` / `main.js` 的 `?v=`
- `boot-mobile.js` 的 `EMBEDDED_BUILD`

发版后比对 `build-id.txt`；**仅版本变化**才清缓存硬刷。资源一律同源（Pages / 本地 / AGT），无第三方镜像。

## 代码分层

| 文件 | 职责 |
|------|------|
| `js/boot-mobile.js` | 双端 UI class、版本探针（无更新不清缓存） |
| `js/main.js` | 入口，加载 `game.js` |
| `js/config/characters.js` | 角色登记 + `ASSET_VER`（跑/滚/跳/攻 **sheet**） |
| `js/config/world.js` | 世界物登记 |
| `js/config/monsters.js` | 敌对中文名 / 立绘 / 运动帧语义 |
| `js/config/gameplay.js` | 可调数值（平台尺寸 `PLATFORM_*` 等） |
| `js/game.js` | 玩法 / 绘制 / 首启加载 |

扩展：`registerCharacter` / `registerWorldAsset` / `registerMonster`；难度乘子 `DIFF_FLOOR` / `DIFF_CEIL`；平台尺寸 `PLATFORM_*`。局内 HUD 用系统字（`drawHudText`），不加载 `castle-hud-digits`。

## 加载策略

| 阶段 | 等什么 | 用户看到 |
|------|--------|----------|
| 首启 | manifest + 两立绘 + **出战角色** 跑/滚/跳/攻 sheet | 进度条 → 主菜单 |
| 后台 idle | 世界物 + 另一角色 sheet | 无感 |
| 点开始 | `primaryRunSheetReady()` | 未齐则「准备关卡…」 |

## 角色（`characters.js` → `assets/characters/<id>/`）

| 用途 | 法师 | 战士 | 布局 |
|------|------|------|------|
| 立绘 | `characters/mage/mage-portrait.png` | `characters/warrior/warrior-portrait.png` | 单图 |
| 跑步 | `…/mage-run-sheet.png` | `…/warrior-run-sheet.png` | **3×3 / 9** |
| 翻滚 | `…/mage-roll-sheet.png` | `…/warrior-roll-sheet.png` | **3×3 / 9**（首尾跑步尺跳过） |
| 跳跃 | `…/mage-jump-sheet.png` | `…/warrior-jump-sheet.png` | **3×3 / 9**（首尾跑步尺 + 7 动作） |
| 起飞 | `…/mage-fly-sheet.png` | `…/warrior-fly-sheet.png` | **2×2 / 4**（书档 + fly/flyFall） |
| 攻击 | `…/mage-atk-sheet.png` | `…/warrior-atk-sheet.png` | **3×3 / 9**（书档 + wind…recover） |

- **运动帧必须 sheet**：禁止局内依赖 `*-jump-ant.png` / `*-atk.png` 等散帧。
- 散帧仅管线调试，放 `Back-castle-parkour/art-raw/singles/`。
- 宫格只许 **2×2 / 3×3 / 4×4**（4 / 9 / 16 帧）；**禁止 1×N 横条**生图或当局内真源。
- 脚锚：`runFootLocalX` / `runLockW` 写在 `CHAR_RUN_SHEETS`（禁运行时 `getImageData` 扫脚）。
- 画格尺：角色格 `512×768`，`refH: 296`。

## 世界（`world.js` → `assets/world/`）· 敌人（`monsters.js` → `assets/enemies/`）

世界：`coin` · `fireball` · `spike` · `portal` · `pu-*` · `torch` · `fire-pillar` · `beam` · `platform` · `bonus-bg`

| id | 名 | 立绘 | 运动帧 |
|----|----|------|--------|
| `bat` | 蝙蝠 | `enemies/bat.png` | `enemies/bat-sheet.png`（**2×2**） |
| `flyer` | 魔眼 | `enemies/flyer.png` | `enemies/flyer-sheet.png`（**2×2**） |
| `giant` | 巨人 | `enemies/monster-big.png` | `enemies/giant-sheet.png`（**2×2**） |
| `blob` | 蓝团 | `enemies/monster.png` | `enemies/monster-idle-sheet.png`（**2×2**） |

运动 sheet：`dev/build_monster_motion_sheets.py` / `dev/pack_motion_grids.py`。精细手绘可直接覆盖同名文件后 measure。

## UI / 字体（Castle Type）

| 文件 | 用途 |
|------|------|
| `assets/fonts/castle-display-wordmark.png` | 主标题「古堡跑酷」 |
| `assets/fonts/castle-hud-digits.png` + `.json` | 管线产物（`compile_castle_hud_font.py`）；局内 HUD 用系统字，不加载 |
| `assets/ui/castle-ui-*.png` | 副标题 / 面板标题 / 开始·退出 等牌匾 |

重编 HUD 数字：`python dev/compile_castle_hud_font.py`（在本 Core 仓根执行）

## 上传注意

- **必须入库**：分区后的 `assets/characters|enemies|world|ui|fonts/` 下 sheet / 立绘 / 世界物 + `sprite-manifest.json`
- **勿入库**：`Back-castle-parkour/`、品红中间态、散帧
- 发版前确认 `ASSET_VER` = `build-id.txt` = HTML `?v=` = `EMBEDDED_BUILD`
- 主仓 skill：`XRK-AGT/.cursor/skills/castle-parkour-art`（本仓不嵌规则副本）

## 元数据

`assets/sprite-manifest.json` — content 盒与 sheet 分格；改 PNG 后重跑 measure / bake。

## 不进 Pages

| 文件 | 去向 |
|------|------|
| `Back-castle-parkour/art-sheets/` | 验收 only（**不是**局内 `www/.../assets/`） |
| `Back-castle-parkour/art-raw/` | 品红 / 散帧 / spun 本机备份 |
