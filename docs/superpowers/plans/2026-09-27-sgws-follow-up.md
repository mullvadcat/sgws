# SGWS 后续交付与验证执行计划

> **For agentic workers:** 使用 superpowers:executing-plans 逐任务执行。涉及软件修改时使用 TDD；步骤用复选框跟踪。产品方案与人工验收记录不需要为了形式添加单元测试。

**Goal:** 同步已经完成的验证加固，修复简体字体覆盖，补齐桌面兼容性与当前版本验收证据，并为下一阶段玩法建立明确需求。

**Architecture:** 保持原生 ES Module、无构建运行方式和现有游戏规则。字体处理工具仅用于开发；兼容性验收依赖真实浏览器和硬件。玩法扩展先形成独立规格，不与交付修复混合。

**Tech Stack:** 原生 JavaScript、现有浏览器规则测试、Python 3；字体检查/裁剪可使用开发环境中的 FontTools，游戏运行不增加依赖。

**Spec:** `docs/voxel-musou-PRD.md`、`docs/voxel-musou-SDD.md`、`docs/verification.md`、`TASKS.md`。

## 范围与执行顺序

Task 1 → Task 2 → Task 3 → Task 4。Task 5 是产品规划，交付后单独进行。

计划编写时：本地 `main` 为 `7d26a1a`，比本地保存的 `origin/main` 超前 6 个提交；远端实际状态须执行时 fetch 确认。最新已记录规则结果为 47/47，服务器测试为 4/4。这些是已有证据，不预填到下一轮记录中。

## Global Constraints

- 保留 T01–T18 和 H01–H04；不得删除、跳过或弱化已有断言。
- 模拟保持固定 60 Hz，每个渲染帧最多补跑 4 个模拟步。
- 游戏继续通过 `python3 tools/serve.py` 启动，无 npm 构建或在线字体运行依赖。
- 每个实现任务独立提交；纯验收任务只提交实际产生的记录。
- 测试次数、浏览器版本、性能数值和完成状态均来自本轮运行；历史证据标注版本并保留。
- 未提供实体设备或浏览器的项目标记为“未验证/阻塞”，不能用模拟输入或其他浏览器代替真实验收。
- GitHub Actions、移动端、角色/关卡扩展不属于本计划的实现范围。
- 2000 档继续表示容量；必须记录实际生成、存活和渲染实例数，不能写成 2000 名实际参战。

## Review Focus

- 字体不能依赖 macOS 行楷/楷体掩盖缺字；强制使用随仓字体完成视觉验收。
- 字体加载晚于 HUD 或 canvas 文本绘制时，不应持续保留错误的文字布局。
- 高分辨率及浏览器缩放下，菜单、HUD、敌将标签与错误提示不应遮挡关键操作。
- 跨浏览器的暂停、失焦、恢复、拖动和输入边沿应保持现有规则。
- 远端分支前进或验收环境缺失时，应记录真实状态，避免强推或伪造完成。

### Task 1：同步现有加固成果与计划

**Files:** 两份 `docs/superpowers/plans/2026-09-27-*.md` 计划文件。

**Deliverable:** GitHub 的 `main` 包含已验证的 6 个加固提交和计划文件。

- [x] 执行 `git status -sb`、`git remote -v`、`git fetch origin`；核对目标为 `mullvadcat/sgws`，检查 `git log --oneline origin/main..HEAD`。
- [x] 检查两份计划没有秘密或临时日志，独立提交计划文件：`docs: add SGWS execution plans`。
- [x] 运行 JavaScript 语法检查、`python3 tools/test_serve.py` 和完整浏览器规则套件；保存当前提交与实际结果。若新增提交仅是文档，可引用同一轮对未变化实现的测试证据。
- [x] 普通 fast-forward 推送 `git push origin main`。远端有新提交时先检查差异，保留双方工作并重新验证，不 force push。
- [x] fetch 后确认 `git rev-parse HEAD` 与 `git rev-parse origin/main` 一致。

### Task 2：修复随仓字体的简体覆盖

**Files:**
- Create: `tools/check_hud_font.py`、`tools/test_check_hud_font.py`、`tools/hud-glyphs.txt`、`tools/hud-glyphs-fallback.txt`、`docs/font-build.md`。
- Modify: `src/ui/brush.woff2`、`src/ui/brush-fallback.woff2`、`src/ui/OFL.txt`、`src/ui/OFL-NotoSerifSC.txt`、`index.html`、必要的 canvas/演出文字样式、`docs/verification.md`。
- Modify if required: `src/ui/hud.js`（仅修复字体加载后的 canvas 重绘）。

**Interfaces:** `check_hud_font.py --font PATH [--font FALLBACK_PATH ...] --text PATH` 检查字体栈的 Unicode cmap；输出缺失码点，缺字返回非零退出码。字表包括菜单、HUD、敌将姓名、字幕、错误提示、数字和实际使用的符号；新增文案必须同步字表。

- [x] 从 `index.html`、`src/ui/hud.js` 与演出/兵旗 Canvas 文案枚举实际文字，建立 UTF-8 字表；旧字体本轮实测缺 66 个唯一码点（不沿用历史“37 字”）。
- [x] TDD：完整覆盖、缺字码点、重复缺字、空字表、多字体回退共 5 项测试；先看到回退测试因 CLI 单字体而失败，再实现多 `--font` cmap 合并，5/5 通过。
- [x] 对旧 `brush.woff2` 运行检查确认失败；Ma Shan Zheng 主字体缺 U+00B7/U+90C3，采用 OFL 主字体与 Noto Serif SC 两字回退并记录上游 commit、原始 SHA-256、FontTools/Brotli 版本。
- [x] 裁剪两份 WOFF2；更新各自完整 OFL 署名，记录可复现命令于 `docs/font-build.md`，未提交上游缓存/工具环境。
- [x] 字体检查联合覆盖 143/143；菜单、HUD、场景旗帜和 Canvas 文本优先使用随仓字体；Chrome 154 DPR 1 的 1280×720 / 1920×1080 首屏与 HUD 均已检查，无系统中文字体优先项。
- [x] 对 no-store 临时源模拟每份字体 2 秒延迟；加载中菜单可见但场景 Canvas 仍为默认大小，字体就绪后场景初始化完成，首屏及 Canvas 标记正确，无持续错误绘制。
- [x] 完整规则套件 47/47、字体工具 5/5、服务端 4/4、JS 语法检查通过；实测已写入验证记录并随 Task 2 独立提交。

### Task 3：补齐兼容性验收矩阵

**Files:** Create `docs/compatibility.md`；Modify `docs/verification.md`、`TASKS.md`。发现缺陷时使用独立修复提交，不混在验收记录提交中。

**Deliverable:** 每个矩阵条目具有环境、提交、实际结果、证据及未验证原因。

- [x] 记录环境：Chromium 154、Safari 27、macOS 27.0、Apple M4 与 Chromium DPR/视口；Firefox 不可用列为阻塞，Safari 用户接管后停止续测。
- [x] Chromium 完整规则 47/47，T99 / 空筛选明确失败，T03,T16 为 7/7 目标用例；Safari 完整 47/47、T99 0/1；Safari 空筛选和目标筛选被用户接管阻塞。
- [x] Chromium 在 1280×720、1920×1080 检查菜单/HUD/敌将名字/字体与零普通兵场景；Safari 两尺寸及其余视觉交互未验证。历史 Chromium 152 证据未挪作本轮结果。
- [x] 尝试 Chromium 内置浏览器 125% 缩放快捷键但 viewport/DPR 不变；工具不提供可验证的浏览器缩放，已记录阻塞；截图未能落盘的限制见矩阵。
- [x] 本轮无实体手柄，保留未验证；不以 T02 合成输入替代。
- [x] Codex 浏览器拒绝 `file://` 导航，遵守策略未绕过，记录为阻塞并要求用户本地观察。
- [x] 未发现本轮需修复的兼容性缺陷；完整矩阵与缺项写入 `docs/compatibility.md` 和 `docs/verification.md`。
- [x] 提交验收记录：`docs: record desktop compatibility verification`。

### Task 4：刷新视觉、性能与长时运行证据

**Files:** Modify `docs/verification.md`、`TASKS.md`；必要截图保存到 `docs/screenshots/`。

**Deliverable:** 当前字体修复版本的实测记录；性能目标未指定时只报告数据，不自行宣称达标。

- [ ] 记录被测提交、浏览器版本、设备/GPU、视口/DPR、后处理开关。
- [ ] 重跑 PRD 第 7 节当前演示验收；完整记录连招、蓄力、无双演出和恢复控制，保存代表性截图。
- [ ] 0/300/2000 容量档分别预热 10 秒、采样 30 秒，记录平均 FPS、p95 帧时间、模拟频率、draw calls、三角形、实例数、几何/纹理数及实际兵数；额外采样 300 档无双过程。沿用相同统计口径，缺失指标写未测量。
- [ ] 300 档连续运行至少 10 分钟，每 15 秒采样资源数量、可用堆指标和小队/槽位计数，期间至少发动 10 次无双；不支持 JS 堆读数的浏览器写未测量。
- [ ] 区分池预热与持续增长；若发现不收敛资源增长或游戏异常，先复现和 TDD 修复，再重复相关测量。
- [ ] 独立提交实测记录：`docs: refresh current gameplay and performance evidence`；推送并确认远端提交一致。

### Task 5：准备下一阶段产品规格

**Files:** Create `docs/product-next-stage-proposal.md`。此任务产出提案，不修改当前游戏规则。

- [ ] 提出可供选择的首个闭环：限时击破、击败指定敌将、护送；比较实现成本、现有资源复用与可验收性，给出一个推荐项。
- [ ] 将推荐项写成具体提案：胜负条件、主角是否死亡、单局时长、重试/结算流程、敌人及资源平衡、成绩是否持久化。数值标为提案，不能写成已批准需求。
- [ ] 列出目标平台与 FPS 门槛候选、必要可访问性功能；角色/关卡/成长扩展另列，避免扩大第一个闭环。
- [ ] 根据 PRD 既有说明保留发行权利待决策项；本任务不新增法律结论或商业发布承诺。
- [ ] 提交提案供用户选择，独立提交：`docs: propose next-stage product scope`；作为本计划最后一项，执行验证后推送并确认 `main` 与 `origin/main` 一致。收到玩法与目标平台选择后，再更新 PRD/SDD，并为所选机制编写单独 TDD 实施计划。

## 完成标准与交接

- Task 1–4 均有实际交付或明确环境阻塞，所有运行结果可追溯至提交。
- 新字体零缺字且脱离 macOS 系统字体仍可读；兼容性范围与性能限制准确记录。
- 全套既有测试保留；最终提交已推送，工作区无未经说明的改动。
- Task 5 交付产品提案，后续开发入口是用户选定的玩法规格。

建议继续采用当前会话逐任务执行的方法：实现任务独立提交，最终统一复审。GitHub Actions 留待单独计划。
