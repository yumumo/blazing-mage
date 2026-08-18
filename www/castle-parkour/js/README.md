# www/castle-parkour 文件分区

静态页游戏（Cloudflare Pages / AGT 挂载），**无构建**；用原生 ES module。

```text
www/castle-parkour/
  index.html              # 壳：DOM + 入口
  css/app.css             # UI 样式
  js/
    boot-mobile.js        # 尽早打 mobile/desktop class（非 module）
    main.js               # module 入口 → game.js
    game.js               # 玩法 / 渲染 / 音频 / 存档 / 商店文案
    config/
      index.js            # barrel（优先从此 import）
      characters.js       # 可玩角色注册表 + ASSET_VER
      world.js            # 世界道具/障碍贴图注册表
      monsters.js         # 敌人名 / 立绘 / 运动帧语义
      gameplay.js         # 数值 + DIFF_FLOOR / DIFF_CEIL
  assets/                 # 局内真源 PNG + sprite-manifest.json
                          # characters / enemies / world / ui / fonts
```

## 扩展点（先改配置，再补图 / 再动 game.js）

| 要加什么 | 改哪里 |
|----------|--------|
| 新角色 | `config/characters.js`（`registerCharacter`）+ `assets/characters/<id>/` |
| 新敌人 | `config/monsters.js`（`registerMonster`）+ `assets/enemies/` |
| 新障碍/道具图 | `config/world.js`（`registerWorldAsset`）+ `assets/world/` |
| 调跳跃/坑/难度 | `config/gameplay.js`（含 `DIFF_*`） |
| 换图刷缓存 | `ASSET_VER`（`characters.js`） |
| 商店文案 / 状态机 | `game.js` |

## 资源分区

| 目录 | 放什么 |
|------|--------|
| `assets/` | 局内加载的透明 PNG + `sprite-manifest.json` |
| `Back-castle-parkour/art-raw/`（gitignore） | 品红原稿与中间态 |

局内运动帧必须是 sheet（run/jump/fly/atk/roll），禁止依赖散帧。品红 `*-magenta` 勿放进 `assets/`。
