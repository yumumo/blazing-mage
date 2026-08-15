# AGENTS.md — 古堡跑酷（castle-parkour）

| 区域 | 路径 |
|------|------|
| 游戏壳 | `www/castle-parkour/`（`index.html` + `js/` + `css/`） |
| 局内贴图真源 | `www/castle-parkour/assets/`（sheet / 立绘 / 世界物） |
| 资源清单 | `www/castle-parkour/ASSETS.md` |
| 美术管线 | `dev/README.md` + `dev/*.py` |
| 散帧调试 | `dev/art-raw/singles/`（局内不加载） |

挂载 `/castle-parkour`；无构建步骤。

**AI 贴图 / 动作帧**：主仓规则 `.cursor/rules/castle-parkour-art.mdc` + skill `castle-parkour-art`（勿在本 Core 内复制规则）。
