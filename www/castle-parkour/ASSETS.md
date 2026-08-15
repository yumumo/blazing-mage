# 局内资源真源（Pages / AGT 只认这里）

改贴图前先对清单。运行时只加载 `js/config/characters.js` + `world.js` / `monsters.js` 登记的路径，外加 `sprite-manifest.json`。

## 分区（上传必读）

| 路径 | 入库 | 进 Pages | 用途 |
|------|:----:|:--------:|------|
| `www/castle-parkour/assets/` | ✅ | ✅ | **局内运行时** PNG + manifest（**仅 sheet / 立绘 / 世界物**） |
| `www/castle-parkour/js/` `css/` `index.html` | ✅ | ✅ | 游戏壳与逻辑 |
| `www/castle-parkour/build-id.txt` `_headers` | ✅ | ✅ | 版本探针 / 缓存头 |
| `dev/*.py` `dev/README.md` | ✅ | ❌ | 美术对齐脚本 |
| `dev/art-sheets/` | ✅ | ❌ | 跳/攻验收 sheet（非局内） |
| `dev/art-raw/` | ❌ | ❌ | 品红 / 抠图 / spun 中间态 |
| `dev/art-raw/singles/` | ❌ | ❌ | 跳/攻散帧调试产物（管线输入，**局内不加载**） |
| `www/castle-parkour/dev/` | ❌ | ❌ | 禁止（冒烟勿放这里） |

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

扩展：`registerCharacter` / `registerWorldAsset`；改平台尺寸只动 `gameplay.js` 的 `PLATFORM_*`。

## 加载策略

| 阶段 | 等什么 | 用户看到 |
|------|--------|----------|
| 首启 | manifest + 两立绘 + **出战角色** 跑/滚/跳/攻 sheet | 进度条 → 主菜单 |
| 后台 idle | 世界物 + 另一角色 sheet | 无感 |
| 点开始 | `primaryRunSheetReady()` | 未齐则「准备关卡…」 |

## 角色（`characters.js`）

| 用途 | 法师 | 战士 | 布局 |
|------|------|------|------|
| 立绘 | `mage-portrait.png` | `warrior-portrait.png` | 单图 |
| 跑步 | `mage-run-sheet.png` | `warrior-run-sheet.png` | **3×3 / 9** |
| 翻滚 | `mage-roll-sheet.png` | `warrior-roll-sheet.png` | **3×3 / 9**（首尾跑步尺跳过） |
| 跳跃 | `mage-jump-sheet.png` | `warrior-jump-sheet.png` | **3×3 / 9**（首尾跑步尺 + 7 动作） |
| 攻击 | `mage-atk-sheet.png` | `warrior-atk-sheet.png` | **2×2 / 4**（首尾跑步尺 + wind/atk） |

- **运动帧必须 sheet**：禁止局内依赖 `*-jump-ant.png` / `*-atk.png` 等散帧。
- 散帧仅管线调试，放 `dev/art-raw/singles/`。
- 宫格优先：四 / 九 / 十六宫格；帧少用 2×2，空格透明。
- 脚锚：`runFootLocalX` / `runLockW` 写在 `CHAR_RUN_SHEETS`（禁运行时 `getImageData` 扫脚）。
- 画格尺：角色格 `512×768`，`refH: 296`。

## 世界（`world.js`）

`coin` · `fireball` · `spike` · `portal` · `pu-*` · `torch` · `fire-pillar` · `beam` · `platform` · `bonus-bg`

敌对生物中文名 / 立绘 / 运动帧见 **`js/config/monsters.js`**（`WORLD_ASSETS` 仍是加载句柄）：

| id | 名 | 立绘 | 运动帧 |
|----|----|------|--------|
| `bat` | 蝙蝠 | `bat.png` | `bat-sheet.png`（**2×2**） |
| `flyer` | 魔眼 | `flyer.png` | `flyer-sheet.png`（**2×2**） |
| `giant` | 巨人 | `monster-big.png` | `giant-sheet.png`（**2×2**） |
| `blob` | 蓝团 | `monster.png` | `monster-idle-sheet.png`（**2×2**） |

运动 sheet：`dev/build_monster_motion_sheets.py` / `dev/pack_motion_grids.py`。精细手绘可直接覆盖同名文件后 measure。

## 字体（Castle Type）

| 文件 | 用途 |
|------|------|
| `assets/fonts/castle-display-wordmark.png` | 主标题「古堡跑酷」 |
| `assets/fonts/castle-ui-*.png` | 副标题 / 面板标题 / 开始·退出 等牌匾 |
| `assets/fonts/castle-hud-digits.png` + `.json` | 局内 HUD 数字位图字 |

重编 HUD 数字：`python dev/compile_castle_hud_font.py`（在本 Core 仓根执行）

## 上传注意

- **必须入库**：`*-jump-sheet.png` / `*-atk-sheet.png`（局内运动真源，勿再 ignore）
- **勿入库**：`dev/art-raw/`、`dev/_*.py`、散帧 `mage-run0.png` 等
- 发版前确认 `ASSET_VER` = `build-id.txt` = HTML `?v=` = `EMBEDDED_BUILD`

## 元数据

`assets/sprite-manifest.json` — content 盒与 sheet 分格；改 PNG 后重跑 measure / bake。

## 不进 Pages

| 文件 | 去向 |
|------|------|
| `dev/art-sheets/*` 验收表 | 验收 only（**不是** `www/.../assets/*-jump-sheet.png`） |
| `dev/art-raw/singles/*` | 调试散帧 |
| `dev/art-raw/*-spun.png` / `*-roll-sheet-9.png` | 滚表重建备份 |
| `dev/art-raw/` 其余 | 本机 only |
