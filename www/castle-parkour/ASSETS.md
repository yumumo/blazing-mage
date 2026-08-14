# 局内资源真源（勿用错）

改贴图 / 上传前先对这份清单。运行时只认 `www/castle-parkour/assets/` + `js/config/characters.js` / `world.js` 里登记的路径。

缓存戳：`ASSET_VER`（`js/config/characters.js`）须与下列同步：

- `build-id.txt`（首启自动强刷探针，**改版本必改这一行**）
- `index.html` 里 `boot-mobile.js` / `app.css` / `main.js` 的 `?v=`

发版后玩家下次打开会比对 `build-id.txt`；若与本地不同则清 Cache Storage / SW 并自动重载一次。

## 加载策略

| 阶段 | 等什么 | 用户看到 |
|------|--------|----------|
| 首启 | `sprite-manifest.json` + 两张立绘 | 主菜单可进 |
| 后台 | 出战角色动作 → 世界物 → 另一角色 | 无感预取 |
| 点开始 | 若后台未齐，闪「准备关卡…」 | 齐了再开跑 |

## 角色（`characters.js`）

| 用途 | 法师 | 战士 |
|------|------|------|
| 立绘（菜单） | `mage-portrait.png` | `warrior-portrait.png` |
| 跑步（唯一循环真源） | `mage-run-sheet.png` | `warrior-run-sheet.png` |
| 翻滚 | `mage-roll-sheet.png` | `warrior-roll-sheet.png` |
| 跳 | `*-jump-ant/jump/fly/jump-land.png` | 同左 |
| 攻 | `*-atk-wind.png` / `*-atk.png` | 同左 |

- **禁止**再用 `mage-run0.png`… 散帧（已 gitignore）。
- 跑步脚锚：`runFootLocalX` / `runLockW` 写在 `CHAR_RUN_SHEETS`（改 sheet 后用 manifest content 重算，**禁止**运行时 `getImageData`）。
- 尺寸尺：`refH: 296`（与 manifest / 512×768 格一致）。

## 世界（`world.js`）

`coin` · `fireball` · `bat` · `flyer` · `monster` · `monsterBig` · `monster-idle-sheet`（`monsterWalk`）· `spike` · `portal` · `pu-*` · `torch` · `fire-pillar` · `beam` · `platform` · `bonus-bg`

## 元数据

`assets/sprite-manifest.json` — 散帧 content 盒与 sheet 分格真源；改 PNG 后必须重跑 measure / bake。

## 不入库

`dev/art-raw/`（品红/抠图中间态）· 规则与 skill 在主仓 XRK-AGT，本仓勿复制 `.cursor/`。
