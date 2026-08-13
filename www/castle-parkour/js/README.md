# www/castle-parkour 文件分区

静态页游戏（Cloudflare Pages / AGT 挂载），**无构建**；用原生 ES module。

```text
www/castle-parkour/
  index.html              # 壳：DOM + 入口
  css/app.css             # UI 样式
  js/
    boot-mobile.js        # 尽早打 mobile/desktop class（非 module）
    main.js               # module 入口
    game.js               # 玩法 / 渲染 / 音频 / 存档
    config/
      characters.js       # 可玩角色注册表（扩展点）
      world.js            # 世界道具/障碍贴图注册表（扩展点）
      index.js            # barrel
  assets/                 # PNG + sprite-manifest.json
```

## 扩展点（先改配置，再补图）

| 要加什么 | 改哪里 |
|----------|--------|
| 新角色 | `js/config/characters.js`（或 `registerCharacter()`）+ `assets/` + measure |
| 新障碍/道具图 | `js/config/world.js`（或 `registerWorldAsset()`）+ `assets/` |
| 换图刷缓存 | `ASSET_VER`（在 `characters.js`） |
| 玩法逻辑 | `js/game.js` |

品红底原图只放 Core 仓 `dev/art-raw/`（gitignore），不要进 `assets/`。
