# Voxel Musou — 项目说明

浏览器体素群战动作演示（赵云）。需求与设计：`docs/voxel-musou-PRD.md`、`docs/voxel-musou-SDD.md`；实测记录：`docs/verification.md`。

## 运行与检查
- 无构建、无 npm 依赖：原生 ES Modules + `vendor/three`（r186）。启动：`python3 tools/serve.py`，打开 `http://127.0.0.1:8000/`。该服务器为多线程请求并发送 `Cache-Control: no-store`。
- 规则测试：浏览器打开 `http://127.0.0.1:8000/tests/index.html`（`?only=T03,T16` 只跑部分），结果在页面和 `window.__testResults`。改动玩法、输入、调度或兵群后必须跑。
- 开发服务器自测：`python3 tools/test_serve.py`；改代码后浏览器无需为该服务强制刷新模块缓存。
- `?debug` 暴露只读句柄 `window.__voxelMusou`，供手动验证；游戏逻辑不得读取它。

## 约束
- 模拟以固定 60 Hz 步进（`src/core/loop.js`）；渲染/VFX/HUD/音频只读模拟状态，不得消耗模拟 `rng`，否则 T16 确定性失败。
- 数值与招式以 `src/hero/moves.js` 等基线数据为准，改动需同步 SDD 并补测试。
- 游戏内文案为简体中文（辅英语）。
