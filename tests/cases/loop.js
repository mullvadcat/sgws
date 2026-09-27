// T16 scheduler determinism: same per-step input script under steady and irregular rAF timing -> same rule snapshot
import { createSimulationForTest, driveRenderSchedule, captureGameplayState, createInput, input, rng, assert, assertEqual } from '../harness.js';
import { vrng } from '../../src/core/rng.js';
import { createFixedLoop } from '../../src/core/loop.js';

const STEPS = 600;

/** A fixed, varied input script indexed by sim step: run, turn, attack strings, charges, jumps, dodges. */
function script(k) {
  const phase = Math.floor(k / 60) % 5;
  const mx = [0, 1, 0, -1, 0.5][phase], my = [1, 0, -1, 0, 0.5][phase];
  const press = [];
  if (k % 9 === 0) press.push('attack');
  if (k % 47 === 0) press.push('charge');
  if (k % 131 === 0) press.push('jump');
  if (k % 173 === 0) press.push('dodge');
  return input({ mx, my, press, orbit: k % 100 < 5 ? 0.02 : 0 });
}

/** Elapsed sequence that yields exactly `steps` sim steps with maxSteps 4 and no dropped backlog. */
function steadySeq(steps) { return Array.from({ length: steps }, () => 1 / 60); }
function irregularSeq(steps) {
  // jittery frames of 1-3 steps' worth (never reaching the 4-step cap), plus a tiny remainder so the count lands exactly
  const out = []; let made = 0, k = 0;
  while (made < steps) {
    const n = Math.min(steps - made, 1 + (k * 7919 % 3)); out.push(n / 60 + 1e-7); made += n; k++;
  }
  return out;
}

function runWith(seq) {
  rng.seed(1);
  const sim = createSimulationForTest({ grunts: 300 });
  const r = driveRenderSchedule(sim, seq, script);
  const snap = captureGameplayState(sim.game);
  sim.dispose();
  return { r, snap };
}

export default [
  { id: 'T16', name: 'steady vs irregular rAF → identical rule snapshot at 600 steps', fn() {
    const a = runWith(steadySeq(STEPS));
    const v0 = vrng.state;
    const b = runWith(irregularSeq(STEPS));
    assertEqual(a.r.steps, STEPS, 'steady steps'); assertEqual(b.r.steps, STEPS, 'irregular steps');
    assert(b.r.log.some((l) => l.steps > 1), 'irregular schedule actually batched steps');
    assertEqual(a.snap, b.snap, 'snapshot');
    assertEqual(vrng.state, v0, 'sim never touched the visual RNG');
    return `hero kos ${a.snap.hero.kos}, hp ${a.snap.hero.hp}, rng ${a.snap.rng}`;
  } },
  { id: 'T16', name: 'at most 4 steps per rAF, backlog dropped', fn() {
    let steps = 0;
    const loop = createFixedLoop({ step: () => steps++, render: () => {}, sampleInput: () => {} });
    loop.tick(0.1);                                      // 6 steps owed
    assertEqual([steps, loop.stats.steps, loop.stats.dropped], [4, 4, true], 'capped');
    loop.tick(0);                                        // backlog was dropped, not carried
    assertEqual(steps, 4, 'no carry-over');
    loop.tick(10);                                       // huge gap clamps to 0.1 s
    assertEqual(steps, 8, 'clamped');
    loop.tick(-5); assertEqual(steps, 8, 'negative elapsed ignored');
  } },
  { id: 'T16', name: 'an edge is consumed once even when a rAF runs several steps', fn() {
    const target = new EventTarget();
    let edges = 0, stepsRun = 0;
    const inp = createInput({ target, getGamepads: () => [] });
    const loop = createFixedLoop({
      step: () => { stepsRun++; if (inp.sample().pressed.attack) edges++; }, render: () => {}, sampleInput: inp.sample,
    });
    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
    loop.tick(3 / 60 + 1e-7);
    assertEqual([stepsRun, edges], [3, 1], 'one edge over three steps');
    inp.dispose();
  } },
  { id: 'T16', name: 'pause clears the backlog and swallows edges; nothing replays on resume', fn() {
    const target = new EventTarget();
    let edges = 0, stepsRun = 0;
    const inp = createInput({ target, getGamepads: () => [] });
    const loop = createFixedLoop({
      step: () => { stepsRun++; if (inp.sample().pressed.attack) edges++; }, render: () => {}, sampleInput: inp.sample,
    });
    loop.setPaused(true);
    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
    loop.tick(0.05); loop.tick(0.05);
    assertEqual(stepsRun, 0, 'no steps while paused');
    loop.setPaused(false);
    loop.tick(2 / 60 + 1e-7);
    assertEqual([stepsRun, edges], [2, 0], 'menu press not replayed');
    inp.dispose();
  } },
];
