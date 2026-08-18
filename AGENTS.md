# AGENTS.md — 古堡跑酷（castle-parkour）

详见更完整的分区与「谁用什么」：[dev/AGENTS.md](dev/AGENTS.md)。

| 区域 | 路径 |
|------|------|
| 游戏壳 | `www/castle-parkour/` |
| 局内贴图 | `www/castle-parkour/assets/{characters,enemies,world,ui,fonts}/` |
| 资源清单 | `www/castle-parkour/ASSETS.md` |
| 正式管线 | `dev/*.py`（见 `dev/PLANT_README.txt`） |
| 中间态 | `Back-castle-parkour/art-raw/`（gitignore，不上传） |

**Skill / 规则真源**：主仓 XRK-AGT 的 `castle-parkour-art`（勿在本仓复制 `.cursor/rules`）。

上传：只交游戏壳与正式 `dev/*.py`；`Back-castle-parkour/` 已 gitignore。扩展点见 [dev/AGENTS.md](dev/AGENTS.md)。
