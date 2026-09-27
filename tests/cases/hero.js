// T03 combo branches, T04 cancel windows, T05 stale buffer, T10 air / touchdown, T18 dash threshold
import { createEmptySim, input, emptyInput, assert, assertEqual } from '../harness.js';
import { MOVES, AIR_CHAIN_MAX } from '../../src/hero/moves.js';

const NONE = emptyInput();

/** Mash attack until the hero is in move `target` (N-string or given), then return the sim. */
function reach(sim, target, maxSteps = 800) {
  const h = sim.game.hero;
  for (let s = 0; s < maxSteps; s++) {
    if (h.move === target) return;
    const press = h.state === 'idle' || (h.move && h.moveT === 3);
    sim.step(press ? input({ press: ['attack'] }) : NONE);
  }
  throw new Error(`never reached ${target} (at ${h.move})`);
}

/** Step until `pred` or fail. Returns the number of steps. */
function until(sim, pred, max, label, inp = NONE) {
  for (let s = 0; s < max; s++) { if (pred()) return s; sim.step(inp); }
  throw new Error(`timeout: ${label}`);
}

/** From Nk press charge once on local frame 3; return {next, fromT}: the move it switched to and the Nk frame it left. */
function branchFrom(k) {
  const sim = createEmptySim(), h = sim.game.hero;
  reach(sim, `n${k}`);
  until(sim, () => h.moveT === 3, 10, 'moveT 3');
  sim.step(input({ press: ['charge'] }));
  let prev = h.moveT;
  for (let s = 0; s < 80; s++) {
    if (h.move !== `n${k}`) { sim.dispose(); return { next: h.move, fromT: prev }; }
    prev = h.moveT; sim.step(NONE);
  }
  throw new Error(`n${k} never branched`);
}

export default [
  { id: 'T03', name: 'N1 → N6 by mashing attack', fn() {
    const sim = createEmptySim();
    for (let k = 1; k <= 6; k++) reach(sim, `n${k}`);
  } },
  { id: 'T03', name: 'charge in N1–N5 branch windows → C2–C6 on the branch frame', fn() {
    const out = [];
    for (let k = 1; k <= 5; k++) {
      const { next, fromT } = branchFrom(k);
      assertEqual(next, `c${k + 1}`, `N${k} branch`);
      assertEqual(fromT + 1, MOVES[`n${k}`].branch, `N${k} leaves on branch frame`);
      out.push(`N${k}→${next}@${fromT + 1}`);
    }
    return out.join(' ');
  } },
  { id: 'T03', name: 'idle charge → C1; after a string ends attack restarts at N1', fn() {
    const sim = createEmptySim(), h = sim.game.hero;
    sim.step(input({ press: ['charge'] }));
    assertEqual(h.move, 'c1', 'idle charge');
    until(sim, () => h.state === 'idle', 200, 'C1 ends');
    sim.step(input({ press: ['attack'] })); until(sim, () => h.state === 'idle', 200, 'N1 ends');
    sim.step(input({ press: ['attack'] }));
    assertEqual(h.move, 'n1', 'string restarts');
  } },
  { id: 'T04', name: 'dodge: wind-up cancels at once; N1 strike waits until after the hit', fn() {
    let sim = createEmptySim(), h = sim.game.hero;
    sim.step(input({ press: ['attack'] })); sim.step(NONE);
    sim.step(input({ press: ['dodge'] }));
    assertEqual(h.state, 'dodge', 'wind-up dodge');
    sim = createEmptySim(); h = sim.game.hero;
    sim.step(input({ press: ['attack'] }));
    until(sim, () => h.moveT === 8, 20, 'N1 active');
    sim.step(input({ press: ['dodge'] }));
    let last = h.moveT;
    until(sim, () => { if (h.state === 'dodge') return true; last = h.moveT; return false; }, 20, 'dodge after strike');
    assert(last + 1 > MOVES.n1.hits[0].f[1], `left N1 at ${last + 1}, after last active ${MOVES.n1.hits[0].f[1]}`);
  } },
  { id: 'T04', name: 'dodge does not cut an armoured charge between tell and dodgeCancel', fn() {
    const sim = createEmptySim(), h = sim.game.hero;
    sim.step(input({ press: ['charge'] }));
    until(sim, () => h.moveT === MOVES.c1.tell + 1, 40, 'C1 active');
    sim.step(input({ press: ['dodge'] }));
    let last = h.moveT;
    until(sim, () => { if (h.state === 'dodge') return true; last = h.moveT; return false; }, 40, 'dodge');
    assert(last + 1 >= MOVES.c1.dodgeCancel, `left C1 at ${last + 1} < dodgeCancel ${MOVES.c1.dodgeCancel}`);
  } },
  { id: 'T05', name: 'C6: early attack press dropped, late press kept', fn() {
    const run = (pressAt) => {
      const sim = createEmptySim(), h = sim.game.hero;
      reach(sim, 'n5'); until(sim, () => h.moveT === 3, 10, 'n5');
      sim.step(input({ press: ['charge'] }));
      until(sim, () => h.move === 'c6', 60, 'C6');
      until(sim, () => h.moveT === pressAt, 200, `C6 frame ${pressAt}`);
      sim.step(input({ press: ['attack'] }));
      until(sim, () => h.move !== 'c6', 200, 'C6 ends');
      return h.move;
    };
    const early = run(20), late = run(MOVES.c6.cancel - 10);
    assert(early !== 'n1', `early press produced ${early}`);
    assertEqual(late, 'n1', 'late press starts N1');
  } },
  { id: 'T10', name: 'air string capped at AIR_CHAIN_MAX swings per jump', fn() {
    const sim = createEmptySim(), h = sim.game.hero;
    sim.step(input({ press: ['jump'] }));
    let max = 0;
    for (let s = 0; s < 400 && (s < 5 || !h.grounded); s++) {
      sim.step(s % 6 === 0 ? input({ press: ['attack'] }) : NONE);
      max = Math.max(max, h.airN);
    }
    assert(max >= 3, `air string never started (airN ${max})`);
    assert(max <= AIR_CHAIN_MAX, `airN ${max} > ${AIR_CHAIN_MAX}`);
    return `max airN ${max}`;
  } },
  { id: 'T10', name: 'landFrame impacts happen on the ground (jc, C2, C6)', fn() {
    const check = (setup, move) => {
      const sim = createEmptySim(), h = sim.game.hero;
      setup(sim, h);
      until(sim, () => h.move === move, 200, move);
      const lf = MOVES[move].landFrame;
      let seen = false;
      for (let s = 0; s < 400 && h.move === move; s++) {
        if (h.moveT === lf) { assert(h.grounded && h.y === 0, `${move} landFrame airborne y=${h.y}`); seen = true; }
        sim.step(NONE);
      }
      assert(seen, `${move} never reached landFrame ${lf}`);
    };
    check((sim) => { sim.step(input({ press: ['jump'] })); sim.run(4); sim.step(input({ press: ['charge'] })); }, 'jc');
    check((sim, h) => { reach(sim, 'n1'); sim.step(input({ press: ['charge'] })); }, 'c2');
    check((sim, h) => { reach(sim, 'n5'); until(sim, () => h.moveT === 3, 10, 'n5'); sim.step(input({ press: ['charge'] })); }, 'c6');
  } },
  { id: 'T18', name: 'dash threshold runT 13 → N1, 14 → dash; landing keeps runT only with the stick held', fn() {
    const fwd = { my: 1 };
    const afterRun = (n) => {
      const sim = createEmptySim(), h = sim.game.hero;
      sim.run(n, input(fwd));
      assertEqual(h.runT, n, 'runT');
      sim.step(input({ ...fwd, press: ['attack'] }));
      return h.move;
    };
    assertEqual(afterRun(13), 'n1', 'runT 13');
    assertEqual(afterRun(14), 'dash', 'runT 14');
    const land = (holdStick) => {
      const sim = createEmptySim(), h = sim.game.hero;
      sim.run(20, input(fwd));
      sim.step(input({ ...fwd, press: ['jump'] }));
      until(sim, () => h.state === 'land', 120, 'land', input(fwd));
      sim.step(input({ ...(holdStick ? fwd : {}), press: ['attack'] }));
      return h.move;
    };
    assertEqual(land(true), 'dash', 'running jump landing with stick');
    assertEqual(land(false), 'n1', 'landing without stick');
  } },
];
