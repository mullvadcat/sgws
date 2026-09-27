# SGWS Verification Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate false-green browser test results, strengthen the determinism evidence, make local reproduction reliable, and make the debug API's mutability explicit.

**Architecture:** Keep the game runtime and native-ES-module delivery unchanged. Extract the browser test discovery logic into a small pure module, extend the existing fixed-loop harness instead of creating a second simulator, and add a dependency-free threaded Python server as the canonical local entrypoint. Preserve mutable verification access only behind an explicitly named `unsafe` property while making the normal debug surface snapshot-based.

**Tech Stack:** Native ES modules, browser DOM APIs, Python 3 standard library, Three.js r186, existing in-browser rule test harness.

**Spec:** `docs/voxel-musou-PRD.md`, `docs/voxel-musou-SDD.md`, `docs/verification.md`

## Global Constraints

- The shipped game remains build-free and must not require npm or downloaded runtime dependencies.
- Simulation remains fixed at 60 Hz with at most four simulation steps per rendered frame.
- Rendering, VFX, HUD, and audio must not import or consume the simulation `rng` or mutate rule state.
- Existing T01-T18 behavior and the `?enemies=0..2000` parsing contract must remain unchanged.
- A requested test ID that did not execute is a failure; `0/0 passed` is never a successful result.
- Module-load failures are infrastructure failures and must never be hidden by `?only=` filtering.
- Full-suite counts in documentation may be updated only from a freshly observed browser run.

## Review Focus

- Unknown or misspelled `?only=` IDs must produce a visible failure and `failed > 0`.
- A rejected test-module import must remain a failure even when a different ID was requested.
- A cold browser load with many parallel module requests must complete without connection resets or stale cache reuse.
- Different render schedules may consume different amounts of visual RNG while producing identical rule snapshots and simulation RNG.
- Normal debug snapshots must not expose live mutable rule objects; intentional mutation must be visibly marked `unsafe`.

---

### Task 1: Make targeted test execution fail closed

**Files:**
- Create: `tests/runner.js`
- Create: `tests/cases/runner.js`
- Create: `tests/index.js`
- Modify: `tests/index.html:20-46`
- Modify: `docs/voxel-musou-SDD.md:727-745`

**Interfaces:**
- Produces: `parseRequestedIds(search: string) -> Set<string> | null`.
- Produces: `collectCases(modulePaths: string[], requestedIds: Set<string> | null, importer?: Function) -> Promise<Array<TestCase>>`.
- `TestCase` remains `{ id: string, name: string, fn: () => unknown | Promise<unknown> }`.
- Import failures produce infrastructure cases with IDs of the form `LOAD:<module path>` and are never filtered.
- Each requested ID absent from all successfully loaded cases produces one failing case named `requested test id not found`.

- [ ] **Step 1: Write failing runner contract tests in `tests/cases/runner.js`**

  Add three cases under ID `H01`:

  1. Requesting `T16` retains all and only the supplied `T16` cases.
  2. An injected importer rejection creates a `LOAD:` failure even when `T16` is the only requested ID.
  3. Requesting `T99` creates exactly one failing placeholder whose error contains `requested test id not found: T99`.

- [ ] **Step 2: Run the existing page and demonstrate the pre-fix failure**

  Run the current server, open `tests/index.html?only=T99`, and record the expected pre-fix result: `0/0 passed`, `failed: 0`.

- [ ] **Step 3: Implement `tests/runner.js`**

  Implement the two interfaces above. Load every module first, retain all import failures, filter successful cases second, and synthesize missing-ID failures last. Trim comma-separated IDs and ignore duplicate requested IDs.

- [ ] **Step 4: Move the DOM runner to `tests/index.js`**

  Keep rendering and `window.__testResults` behavior compatible. Add `requested` and `missing` arrays to `window.__testResults`; do not remove `passed`, `failed`, or `results`. Add `./cases/runner.js` to the module list.

- [ ] **Step 5: Replace the inline module script**

  In `tests/index.html`, replace the inline runner with `<script type="module" src="./index.js"></script>` and change `lang` to `zh-Hans`.

- [ ] **Step 6: Verify targeted and full execution**

  Open the following URLs and inspect `window.__testResults`:

  - `tests/index.html?only=T99` — expected: `passed: 0`, `failed: 1`.
  - `tests/index.html?only=T03,T16` — expected: every result ID is T03 or T16, no missing IDs, seven existing gameplay cases pass.
  - `tests/index.html` — expected: all prior 41 cases plus the new H01 cases pass.

- [ ] **Step 7: Update the SDD test-harness contract**

  State explicitly that load failures bypass filtering, requested IDs must be observed, and an empty selected suite fails.

- [ ] **Step 8: Commit**

  ```bash
  git add tests/index.html tests/index.js tests/runner.js tests/cases/runner.js docs/voxel-musou-SDD.md
  git commit -m "test: make targeted browser runs fail closed"
  ```

---

### Task 2: Strengthen the render-schedule determinism evidence

**Files:**
- Create: `tests/cases/architecture.js`
- Modify: `tests/harness.js:88-103`
- Modify: `tests/cases/loop.js:31-50`
- Modify: `tests/index.js`
- Modify: `docs/voxel-musou-SDD.md:725-745`

**Interfaces:**
- Extends: `driveRenderSchedule(sim, elapsedSequence, inputScriptByStep, { pauseAt = {}, render = () => {} } = {})`.
- The injected `render` callback is called exactly once for every `loop.tick`, matching `createFixedLoop` behavior when unpaused.
- Produces: architecture case ID `H02`, which checks the render-only source dependency boundary.

- [ ] **Step 1: Write a failing render-callback test**

  Extend T16 so the steady and irregular schedules use a render callback that calls `vrng.next()`. Assert:

  - both schedules execute exactly 600 simulation steps;
  - their captured gameplay snapshots, including simulation `rng.state`, are identical;
  - their final `vrng.state` values differ because the number of render frames differs.

  Remove the current assertion that the headless simulation never touched visual RNG; it does not represent the production render path.

- [ ] **Step 2: Run T16 and verify the new assertion fails**

  Open `tests/index.html?only=T16`. Expected before the harness change: the render callback is not invoked or the expected visual-RNG divergence is absent.

- [ ] **Step 3: Add the optional render callback to `driveRenderSchedule`**

  Pass the callback directly to `createFixedLoop`. Do not move input sampling or simulation stepping into the callback.

- [ ] **Step 4: Add the H02 render dependency guard**

  Fetch the following source files from the test page and fail if an import from `core/rng.js` includes the named export `rng` (including aliases):

  - `src/crowd/view.js`
  - `src/musou/view.js`
  - `src/vfx/vfx.js`
  - `src/ui/hud.js`
  - `src/audio/audio.js`
  - `src/post/post.js`
  - all JavaScript files under `src/world/` listed explicitly in the test

  Imports of `vrng`, `hash01`, or locally constructed `makeRng()` instances remain allowed. Keep the list explicit so adding a new render module requires a conscious test update.

- [ ] **Step 5: Register H02 and run focused verification**

  Open `tests/index.html?only=T16,H02`. Expected: all selected cases pass; the result detail reports different visual RNG states but the same simulation snapshot.

- [ ] **Step 6: Update the SDD wording**

  Describe the two-part guarantee accurately: scheduler tests compare rule snapshots under different render counts, while H02 enforces the import boundary. Do not claim that the headless harness executes Three.js rendering.

- [ ] **Step 7: Commit**

  ```bash
  git add tests/harness.js tests/cases/loop.js tests/cases/architecture.js tests/index.js docs/voxel-musou-SDD.md
  git commit -m "test: strengthen render determinism guards"
  ```

---

### Task 3: Provide a reliable dependency-free development server

**Files:**
- Create: `tools/serve.py`
- Create: `tools/test_serve.py`
- Modify: `CLAUDE.md:5-9`
- Modify: `README.md:36-44`
- Modify: `README.zh-CN.md:36-44`
- Modify: `README.ja.md:36-44`
- Modify: `docs/voxel-musou-SDD.md:33-39`
- Modify: `docs/verification.md:6-24,103-107`
- Modify: `TASKS.md:46`

**Interfaces:**
- Produces: `create_server(bind: str, port: int, directory: str) -> ThreadingHTTPServer` in `tools/serve.py`.
- CLI: `python3 tools/serve.py [--bind 127.0.0.1] [--port 8000] [--directory .]`.
- Every response includes `Cache-Control: no-store`.
- Server uses daemon request threads, `allow_reuse_address = True`, and `request_queue_size = 64`.

- [ ] **Step 1: Write failing standard-library server tests**

  In `tools/test_serve.py`, start the server on port 0 in a background thread and assert:

  - a repository file returns HTTP 200;
  - the response contains `Cache-Control: no-store`;
  - 32 concurrent requests all return HTTP 200;
  - shutdown and `server_close()` terminate cleanly.

- [ ] **Step 2: Run the server tests and verify they fail**

  Run: `python3 tools/test_serve.py`

  Expected: FAIL because `tools/serve.py` or `create_server` does not exist.

- [ ] **Step 3: Implement the server**

  Use only `argparse`, `functools`, `http.server`, and `socketserver`/standard-library concurrency. Resolve the served directory once at startup and print the game and rule-test URLs.

- [ ] **Step 4: Run the server tests**

  Run: `python3 tools/test_serve.py`

  Expected: all tests pass with no resource warnings or live background thread.

- [ ] **Step 5: Make it the canonical documented command**

  Replace every recommended `python3 -m http.server 8000` command with `python3 tools/serve.py`. Keep `python3 -m http.server` only as a clearly labelled fallback with its cache/queue limitation, if mentioned at all.

- [ ] **Step 6: Cold-load the game and test page**

  Start `python3 tools/serve.py`, then load the game and full test page in a fresh browser context. Expected: no module `ERR_CONNECTION_RESET`, no stale module reuse, and the full suite completes.

- [ ] **Step 7: Commit**

  ```bash
  git add tools/serve.py tools/test_serve.py CLAUDE.md README.md README.zh-CN.md README.ja.md docs/voxel-musou-SDD.md docs/verification.md TASKS.md
  git commit -m "dev: add reliable no-store static server"
  ```

---

### Task 4: Separate safe debug observation from intentional mutation

**Files:**
- Create: `src/core/debug.js`
- Create: `tests/cases/debug.js`
- Modify: `src/main.js:101-111`
- Modify: `tests/index.js`
- Modify: `CLAUDE.md:9`
- Modify: `docs/verification.md:22`

**Interfaces:**
- Produces: `createDebugHandle({ game, loop, enemies, scene, renderer }) -> Readonly<DebugHandle>`.
- `DebugHandle.snapshot() -> frozen plain object` containing frame, pause state, configured enemy capacity, hero HP/resource/KOs, crowd capacity/alive/engaged counts, and Musou active state.
- `DebugHandle.renderStats() -> frozen plain object` containing renderer calls, triangles, geometries, and textures.
- `DebugHandle.unsafe` explicitly contains the legacy live references `{ game, loop, scene, renderer }` for setup-heavy manual verification.
- The handle and the `unsafe` wrapper are frozen; freezing does not claim that the objects inside `unsafe` are immutable.

- [ ] **Step 1: Write failing H03 debug-contract tests**

  With stub game/loop/renderer objects, assert:

  - `Object.isFrozen(handle)` and `Object.isFrozen(handle.unsafe)` are true;
  - mutating a value returned by `snapshot()` cannot change the source game;
  - two calls to `snapshot()` return different objects reflecting the current source state;
  - `renderStats()` returns copies, not `renderer.info` references;
  - `handle.unsafe.game === game` so intentional legacy verification remains possible.

- [ ] **Step 2: Run H03 and verify it fails**

  Open `tests/index.html?only=H03`. Expected: missing module or missing `createDebugHandle`.

- [ ] **Step 3: Implement `createDebugHandle` and wire `main.js`**

  Only create and publish the handle when the URL contains `debug`. Nothing in gameplay may read `window.__voxelMusou`.

- [ ] **Step 4: Update verification scripts and documentation**

  Use `snapshot()` and `renderStats()` for observation. Use `.unsafe` only in scenarios that intentionally arrange HP, resource, or crowd state. Replace every unqualified “read-only handle” statement with this distinction.

- [ ] **Step 5: Run focused browser verification**

  Load `?debug&enemies=0`, start the game, and assert:

  - `window.__voxelMusou.snapshot().frame` advances;
  - changing a returned snapshot does not change the following snapshot;
  - no debug global exists without `?debug`;
  - H03 passes.

- [ ] **Step 6: Commit**

  ```bash
  git add src/core/debug.js src/main.js tests/cases/debug.js tests/index.js CLAUDE.md docs/verification.md
  git commit -m "refactor: make debug observation snapshot based"
  ```

---

### Task 5: Final regression and evidence update

**Files:**
- Modify: `docs/verification.md`

**Interfaces:**
- Consumes: the fail-closed runner, strengthened T16/H02 guards, canonical server, and debug snapshot API from Tasks 1-4.
- Produces: a fresh verification record tied to the implementation commit.

- [ ] **Step 1: Run static syntax verification**

  Run:

  ```bash
  find src tests -name '*.js' -print0 | xargs -0 -n1 node --check
  python3 tools/test_serve.py
  ```

  Expected: both commands exit 0.

- [ ] **Step 2: Run the complete browser suite from a cold context**

  Start `python3 tools/serve.py`, open `tests/index.html`, and wait for `window.__testResults`. Expected: `failed === 0`; record the observed passed count rather than assuming it.

- [ ] **Step 3: Re-run the regression URLs**

  - `?only=T99` must fail with one missing-ID result.
  - `?only=T03,T16` must run exactly the requested gameplay IDs.
  - `?only=H01,H02,H03` must pass all infrastructure guards.

- [ ] **Step 4: Run game smoke checks**

  Verify the normal URL and `?debug&enemies=0`: boot menu, Enter start, Esc pause/resume, frame advancement, and absence of module-load errors.

- [ ] **Step 5: Update `docs/verification.md` from observed results**

  Record browser version, final commit, total test count, targeted-filter regression, server concurrency test, and remaining known limitations. Keep Firefox, Safari, real gamepad, simplified-font coverage, and full visual combat replay marked unverified unless they were actually run.

- [ ] **Step 6: Confirm a clean diff and commit**

  Run `git status --short` and inspect `git diff --check`.

  ```bash
  git add docs/verification.md
  git commit -m "docs: record verification hardening results"
  ```

## Deferred Work

- Replacing `src/ui/brush.woff2` with a verified simplified-Chinese OFL subset is a separate visual/licensing task; do not mix a binary font change into this verification hardening branch.
- GitHub Actions browser automation requires a deliberate decision about adding Playwright as a development dependency. After this plan lands, create a separate CI plan so the build-free runtime promise and CI tooling remain clearly separated.

## Self-Review Result

- PRD/SDD gameplay rules are unchanged; all changes are verification, tooling, or debug-surface hardening.
- Every review-focus item has a named automated or browser check.
- Task 1 is independently useful and should be reviewed before later test-count changes.
- Task 2 depends only on Task 1's runner registration; Task 3 is independent; Task 4 depends on Task 1 for H03 registration.
- No step requires npm, a build system, or a new runtime dependency.
