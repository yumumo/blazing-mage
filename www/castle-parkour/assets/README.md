# assets/

透明 PNG。流程见主仓 skill **`castle-parkour-art`**。

**尺寸真源**：根目录 `sprite-manifest.json`（key 仍是文件名）。

## 分区

| 目录 | 内容 |
|------|------|
| `characters/<id>/` | 立绘 + run/jump/fly/atk/roll sheet |
| `enemies/` | 敌对立绘 + 运动 sheet |
| `world/` | 金币 / 火球 / 平台 / 火桩 / 道具等 |
| `ui/` | 菜单石板按钮（`castle-ui-*.png`） |
| `fonts/` | 主标题字标 `castle-display-wordmark.png`；`castle-hud-digits.*` 为管线产物、局内不加载 |

品红底原图只放 `Back-castle-parkour/art-raw/`（gitignore），勿放本目录。

脚本按**文件名**查找：`dev/asset_layout.py` → `find_asset()`。
