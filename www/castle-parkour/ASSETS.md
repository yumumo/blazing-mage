# 局内资源真源（Pages / AGT 只认这里）

改贴图前先对清单。运行时只加载 `js/config/characters.js` + `world.js` 登记的路径，外加 `sprite-manifest.json`。

## 分区（上传必读）

| 路径 | 入库 | 进 Pages | 用途 |
|------|:----:|:--------:|------|
| `www/castle-parkour/assets/` | ✅ | ✅ | **局内运行时** PNG + manifest |
| `www/castle-parkour/js/` `css/` `index.html` | ✅ | ✅ | 游戏壳与逻辑 |
| `www/castle-parkour/build-id.txt` `_headers` | ✅ | ✅ | 版本探针 / 缓存头 |
| `dev/*.py` `dev/README.md` | ✅ | ❌ | 美术对齐脚本 |
| `dev/art-sheets/` | ✅ | ❌ | 跳/攻验收 sheet（非局内） |
| `dev/art-raw/` | ❌ | ❌ | 品红 / 抠图中间态 |
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
| `js/config/characters.js` | 角色登记 + `ASSET_VER` |
| `js/config/world.js` | 世界物登记 |
| `js/config/gameplay.js` | 可调数值（平台尺寸 `PLATFORM_*` 等） |
| `js/game.js` | 玩法 / 绘制 / 首启加载 |

扩展：`registerCharacter` / `registerWorldAsset`；改平台尺寸只动 `gameplay.js` 的 `PLATFORM_*`。

## 加载策略

| 阶段 | 等什么 | 用户看到 |
|------|--------|----------|
| 首启 | manifest + 两立绘 + **出战角色** 动作/跑/滚 | 进度条 → 主菜单 |
| 后台 idle | 世界物 + 另一角色 | 无感 |
| 点开始 | `primaryRunSheetReady()` | 未齐则「准备关卡…」 |

## 角色（`characters.js`）

| 用途 | 法师 | 战士 |
|------|------|------|
| 立绘 | `mage-portrait.png` | `warrior-portrait.png` |
| 跑步 | `mage-run-sheet.png` | `warrior-run-sheet.png` |
| 翻滚 | `mage-roll-sheet.png` | `warrior-roll-sheet.png` |
| 跳 | `*-jump-ant/jump/fly/jump-land.png` | 同左 |
| 攻 | `*-atk-wind.png` / `*-atk.png` | 同左 |

- **禁止** `*-run[0-9].png` 散帧。
- 脚锚：`runFootLocalX` / `runLockW` 写在 `CHAR_RUN_SHEETS`（禁运行时 `getImageData` 扫脚）。
- 画格尺：`refH: 296`（512×768）。

## 世界（`world.js`）

`coin` · `fireball` · `bat` · `flyer` · `monster` · `monsterBig` · `monster-idle-sheet`（`monsterWalk`）· `spike` · `portal` · `pu-*` · `torch` · `fire-pillar` · `beam` · `platform` · `bonus-bg`

## 元数据

`assets/sprite-manifest.json` — content 盒与 sheet 分格；改 PNG 后重跑 measure / bake。

## 不进 Pages

| 文件 | 去向 |
|------|------|
| `*-jump-sheet.png` / `*-atk-sheet.png` | `dev/art-sheets/`（验收表） |
| `*-before-scale.png` / `portal-framed` / `monster-walk-sheet` | 已删；勿再放进 `assets/` |
| `dev/art-raw/` | 本机 only |
