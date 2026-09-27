// Test harness (SDD 13.1): assembles the sim modules in production order without World, renderer, HUD, VFX or Audio.
import { rng } from '../src/core/rng.js';
import { on } from '../src/core/events.js';
import { createInput, ACTIONS } from '../src/core/input.js';
import { createFixedLoop } from '../src/core/loop.js';
import { createHero } from '../src/hero/hero.js';
import { createCrowd } from '../src/crowd/crowd.js';
import { createCombat } from '../src/combat/combat.js';
import { createMusou } from '../src/musou/musou.js';
import { createCamSim } from '../src/camera/camera.js';

export function emptyInput() {
  const pressed = {}, held = {};
  for (const a of ACTIONS) { pressed[a] = false; held[a] = false; }
  return { mx: 0, my: 0, orbit: 0, pressed, held };
}

/** Input with the given presses / stick. */
export function input({ press = [], hold = [], mx = 0, my = 0, orbit = 0 } = {}) {
  const inp = emptyInput();
  for (const a of press) { inp.pressed[a] = true; inp.held[a] = true; }
  for (const a of hold) inp.held[a] = true;
  Object.assign(inp, { mx, my, orbit });
  return inp;
}

const copyInput = (inp) => ({ mx: inp.mx, my: inp.my, orbit: inp.orbit, pressed: { ...inp.pressed }, held: { ...inp.held } });

export function setReinforcementsForTest(game, enabled) {
  game.crowd.wavesOn = !!enabled;
  game.crowd.waveT = 0;
}

export function createSimulationForTest({ grunts = 300, seed = 1, wavesOn = false } = {}) {
  const game = { frame: 0, hitstop: 0, freeze: 0 };
  game.cam = createCamSim();
  game.hero = createHero(game);
  game.crowd = createCrowd(game, grunts);
  game.combat = createCombat(game);
  game.musou = createMusou(game);
  rng.seed(seed);
  game.hero.reset();
  game.crowd.reset(); game.combat.reset(); game.musou.reset(); game.cam.reset(0);
  game.crowd.spawnArmy(grunts);
  setReinforcementsForTest(game, wavesOn);
  const offs = [];
  const sim = {
    game,
    step(inp = emptyInput()) {
      const c = copyInput(inp);
      game.cam.step(game, c);
      game.hero.step(c);
      game.combat.step();
      game.crowd.step();
      game.musou.step();
      game.frame++;
    },
    /** Step n times with the same input (presses only on the first step). */
    run(n, inp = emptyInput()) {
      for (let k = 0; k < n; k++) sim.step(k === 0 ? inp : { ...copyInput(inp), pressed: emptyInput().pressed });
    },
    on(name, fn) { offs.push(on(name, fn)); },
    dispose() { for (const off of offs.splice(0)) off(); },
  };
  return sim;
}

/** Empty field: no soldiers, reinforcements off (targets are placed by the test). */
export function createEmptySim(opts = {}) {
  const sim = createSimulationForTest({ grunts: 64, ...opts });
  sim.game.crowd.clear();
  setReinforcementsForTest(sim.game, false);
  return sim;
}

/** Put enemy slot i at (x, z), alive and standing still. */
export function placeEnemy(game, i, x, z, { hp, officer } = {}) {
  const c = game.crowd;
  const off = officer ?? i >= c.grunts;
  c.st[i] = 3; c.stT[i] = 0; c.x[i] = x; c.z[i] = z; c.y[i] = 0; c.vx[i] = c.vz[i] = c.vy[i] = 0;
  c.type[i] = off ? 1 : 0; c.kind[i] = off ? 4 : 0;
  c.hpMax[i] = c.hp[i] = hp ?? (off ? 520 : 30);
  c.lastHit[i] = -1; c.kod[i] = 0; c.hs[i] = 0; c.token[i] = 0; c.cd[i] = 9999; c.squad[i] = -1; c.form[i] = 0;
  c.yaw[i] = Math.atan2(game.hero.x - x, game.hero.z - z);
  c.rx[i] = c.rxV[i] = c.spinV[i] = 0; c.bounce[i] = 0; c.feint[i] = 0; c.wind[i] = 0;
}

/** Scheduler driven by an artificial rAF time sequence (SDD 13.1). inputScriptByStep(stepIndex) -> InputSnapshot. */
export function driveRenderSchedule(sim, elapsedSequence, inputScriptByStep, { pauseAt = {} } = {}) {
  let stepIndex = 0;
  const log = [];
  const loop = createFixedLoop({
    step: () => { sim.step(inputScriptByStep(stepIndex)); stepIndex++; },
    render: () => {},
    sampleInput: () => {},
  });
  elapsedSequence.forEach((e, k) => {
    if (k in pauseAt) loop.setPaused(pauseAt[k]);
    loop.tick(e);
    log.push({ steps: loop.stats.steps, dropped: loop.stats.dropped });
  });
  return { steps: stepIndex, log, loop };
}

// ---------------------------------------------------------------- snapshot
const SKIP_HERO = new Set(['anim']);
const plain = (v) => (ArrayBuffer.isView(v) ? Array.from(v) : v);

export function captureGameplayState(game) {
  const pick = (o, skip = new Set()) => {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (skip.has(k) || typeof v === 'function') continue;
      if (v && typeof v === 'object' && !ArrayBuffer.isView(v) && !Array.isArray(v)) out[k] = pick(v);
      else out[k] = plain(Array.isArray(v) ? v.slice() : v);
    }
    return out;
  };
  return {
    frame: game.frame, hitstop: game.hitstop, freeze: game.freeze,
    hero: pick(game.hero, SKIP_HERO),
    crowd: pick(game.crowd, new Set(['hitHeavy'])),
    cam: pick(game.cam),
    musou: pick(game.musou),
    rng: rng.state,
  };
}

// ---------------------------------------------------------------- assertions
function deepEqual(a, b, path = '') {
  if (Object.is(a, b)) return null;
  if (typeof a === 'number' && typeof b === 'number') return `${path}: ${a} !== ${b}`;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return `${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array/object mismatch`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { const d = deepEqual(a[k], b[k], `${path}.${k}`); if (d) return d; }
  return null;
}

export function assertEqual(actual, expected, label) {
  const d = deepEqual(actual, expected);
  if (d) throw new Error(`${label}: ${d || ''}`);
}

export function assertNear(actual, expected, epsilon, label) {
  if (!(Math.abs(actual - expected) <= epsilon)) throw new Error(`${label}: ${actual} not within ${epsilon} of ${expected}`);
}

export function assert(cond, label) { if (!cond) throw new Error(label); }

export { createInput, rng };
