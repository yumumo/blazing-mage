# AGENTS.md — 古堡跑酷（castle-parkour）

独立 git 仓。主仓 XRK-AGT 默认忽略 `core/*`（除 `system-Core`）；规则 / skill 真源在主仓，本仓勿复制。

## 谁用什么

| 谁 | 读什么 | 不读什么 |
|----|--------|----------|
| 浏览器 / Pages | `www/castle-parkour/`（`index.html` · `js/` · `css/` · `assets/`） | `dev/` |
| `js/game.js` | `js/config/*` 登记的 `assets/...` + `sprite-manifest.json` | `Back-castle-parkour/` |
| `js/config/characters.js` | 角色立绘 + run/roll/jump/fly/atk sheet；`ASSET_VER` | — |
| `js/config/world.js` | `assets/world/*` | — |
| `js/config/monsters.js` | `assets/enemies/*` | — |
| `js/config/gameplay.js` | 时长 / 碰撞等数值（无贴图路径） | — |
| `dev/plant_blob_sheet.py` 等 | `Back-castle-parkour/art-raw` 中间态 → 写入 `www/.../assets/` | 勿把 magenta 当局内图 |
| 主仓 skill `castle-parkour-art` | 生图 / 同尺 / 铁律 | 本仓 `.cursor/`（已 ignore） |

## 分区

| 区域 | 路径 | 入库 |
|------|------|:----:|
| 游戏壳 | `www/castle-parkour/` | ✅ |
| 局内贴图 | `www/.../assets/{characters,enemies,world,ui,fonts}/` | ✅ |
| 资源清单 | `www/castle-parkour/ASSETS.md` | ✅ |
| 正式管线 | `dev/*.py` · `dev/PLANT_README.txt` | ✅ |
| 中间态 / 验收表 | `Back-castle-parkour/` | ❌ gitignore |
| 一次性脚本 | `dev/_*.py` · `dev/_archive_*` | ❌ |

挂载 `/castle-parkour`；无构建步骤。改资源后 bump `ASSET_VER`（与 `build-id.txt` / HTML `?v=` / `EMBEDDED_BUILD` 同步）→ **Ctrl+Shift+R**。

## 扩展点（加角色 / 世界物 / 难度）

| 要加什么 | 改哪里 | 资源落哪 |
|----------|--------|----------|
| 新可玩角色 | `js/config/characters.js` → `registerCharacter` | `assets/characters/<id>/` |
| 新世界物 / 道具图 | `js/config/world.js` → `registerWorldAsset` | `assets/world/` |
| 新敌人 | `js/config/monsters.js` → `registerMonster` | `assets/enemies/` |
| 数值 / 难度曲线 | `js/config/gameplay.js`（`DIFF_FLOOR` / `DIFF_CEIL` / `PLATFORM_*`） | 无贴图 |
| 玩法逻辑 | `js/game.js` 只消费上面登记项 | 禁止写死旧扁平 `assets/*.png` |

## 上传前

- 只交 `www/castle-parkour/` + `dev/*.py`（无下划线前缀）+ 根 README / wrangler / AGENTS
- **不要**交 `Back-castle-parkour/`、`dev/art-raw/`、`dev/_*.py`、品红 PNG
- 新管线脚本（`asset_layout.py`、`plant_blob_sheet.py` 等）若仍是未跟踪，需要你自己 `git add`

**AI 贴图**：主仓 `.cursor/rules/castle-parkour-art.mdc` + skill `castle-parkour-art`。
