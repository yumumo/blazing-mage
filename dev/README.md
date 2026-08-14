# castle-parkour · motion art pipeline

局内真源只在 `www/castle-parkour/assets/`。`dev/art-raw/` 为中间态（**gitignore，不入库**）。

口径：主仓 skill **`castle-parkour-art`** · 规则 `.cursor/rules/castle-parkour-art.mdc`。  
**局内用哪些 PNG**：[`www/castle-parkour/ASSETS.md`](../www/castle-parkour/ASSETS.md)。

## 分区

| 路径 | 入库？ | 内容 |
|------|--------|------|
| `www/castle-parkour/assets/` | ✅ | **局内** PNG + `sprite-manifest.json` |
| `www/castle-parkour/js/` | ✅ | 游戏逻辑与 `config/` |
| `dev/*.py` | ✅ | 对齐 / 入库脚本 |
| `dev/art-sheets/` | ✅ | 跳/攻验收 sheet（不进 Pages） |
| `dev/art-raw/` | ❌ | 品红 / keyed / 调试图 |
| `www/castle-parkour/dev/` | ❌ | 禁止（冒烟） |
| `www/dev/` | ❌ | 禁止（误放） |

## 入库脚本（仅这些）

| 脚本 | 作用 |
|------|------|
| `action_sheet_align.py` | 跑步尺、`sheet_k`、plant、书档表 |
| `import_jump_roll_sheets.py` | 切格 / reconnect / plant 基建 |
| `build_mage_jump_align.py` | 法师跳 |
| `build_mage_atk_align.py` | 法师攻 |
| `build_mage_roll_spin.py` | 法师滚 |
| `build_warrior_jump_align.py` | 战士跳（equal+reconnect） |
| `build_warrior_atk_align.py` | 战士攻 |
| `build_warrior_roll_spin.py` | 战士滚 |
| `build_warrior_roll_align.py` | 兼容入口 → `roll_spin` |
| `bake_motion_align.py` | 头对齐 + manifest |

测尺：主仓 `.cursor/skills/castle-parkour-art/scripts/measure_sprites.py`。

## 标准流程

```bash
python .cursor/skills/immersive-short-video/scripts/chroma_key.py \
  --input core/castle-parkour/dev/art-raw --glob "*-magenta.png"

python core/castle-parkour/dev/build_mage_jump_align.py
python core/castle-parkour/dev/build_mage_atk_align.py
python core/castle-parkour/dev/build_mage_roll_spin.py
python core/castle-parkour/dev/build_warrior_jump_align.py
python core/castle-parkour/dev/build_warrior_atk_align.py
python core/castle-parkour/dev/build_warrior_roll_spin.py

python .cursor/skills/castle-parkour-art/scripts/measure_sprites.py \
  --input core/castle-parkour/www/castle-parkour/assets
python core/castle-parkour/dev/bake_motion_align.py
# bump ASSET_VER → Ctrl+F5
```

## 局内要点

- 绘制倍率 = 跑步 `refH`；散帧脚底锚点；翻滚碰撞 = 显示尺寸 × `ROLL_HIT_FROM_DRAW`
- `ROLL_DUR = 0.55`；散帧画布 **512×768**
- `prep_cell` 勿对已裁角色再 `clear_cell_chrome`
