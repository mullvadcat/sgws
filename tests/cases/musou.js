// T11 Musou activation boundaries, T12 shared dragon path
import { createEmptySim, createSimulationForTest, placeEnemy, input, emptyInput, assert, assertEqual, assertNear } from '../harness.js';
import { MUSOU, dragonAt, dragonArc } from '../../src/musou/musou.js';

const NONE = emptyInput();
const SEG = 100 / 3;

function runMusou(sim) {
  const h = sim.game.hero;
  for (let s = 0; s < 600 && h.state === 'musou'; s++) sim.step(NONE);
  assertEqual(h.state, 'idle', 'Musou ended');
}

export default [
  { id: 'T11', name: 'threshold: just under a segment refuses, a segment (within 1e-6) fires', fn() {
    let sim = createEmptySim(), h = sim.game.hero;
    h.musou = SEG - 2e-6; sim.step(input({ press: ['musou'] })); sim.run(10);
    assert(h.state !== 'musou', 'below threshold');
    sim = createEmptySim(); h = sim.game.hero;
    h.musou = SEG - 5e-7; sim.step(input({ press: ['musou'] }));
    assertEqual(h.state, 'musou', 'at threshold');
  } },
  { id: 'T11', name: 'not in the air, not while hurt', fn() {
    let sim = createEmptySim(), h = sim.game.hero;
    h.musou = 100; sim.step(input({ press: ['jump'] })); sim.run(3);
    sim.step(input({ press: ['musou'] }));
    assert(h.state !== 'musou', 'airborne');
    sim = createEmptySim(); h = sim.game.hero;
    h.musou = 100; h.hurt(10, 0, 2, false);
    sim.step(input({ press: ['musou'] }));
    assert(h.state !== 'musou', 'hurt');
  } },
  { id: 'T11', name: 'one segment spent, i-frames after, control returns', fn() {
    const sim = createSimulationForTest({ grunts: 300 }), h = sim.game.hero;
    h.musou = 50;
    const ev = [];
    for (const n of ['musou:start', 'musou:burst', 'musou:end']) sim.on(n, () => ev.push(n));
    sim.step(input({ press: ['musou'] }));
    assertEqual(h.state, 'musou', 'started');
    let atContact = null;
    for (let s = 0; s < 600 && h.state === 'musou'; s++) { sim.step(NONE); if (sim.game.musou.t === MUSOU.contact) atContact = h.musou; }
    assertEqual(h.state, 'idle', 'ended');
    assertNear(atContact, 50 - SEG, 1e-9, 'drained by contact');
    assertNear(h.musou, 50 - SEG, 1e-9, 'one segment spent');
    assertEqual(ev, ['musou:start', 'musou:burst', 'musou:end'], 'events');
    assert(h.iframes > 0 && h.iframes <= 30, `post-Musou i-frames ${h.iframes}`);
    sim.step(input({ press: ['attack'] }));
    assertEqual(h.move, 'n1', 'control returns');
    sim.dispose();
  } },
  { id: 'T12', name: 'dragon hits ride the shared path; each enemy KO counted once', fn() {
    const sim = createSimulationForTest({ grunts: 300 }), g = sim.game, h = g.hero, mu = g.musou;
    h.musou = SEG;
    const kos = [], dragon = [];
    sim.on('ko', (e) => kos.push(e.i));
    sim.on('musou:hit', (e) => { if (e.stage === 'dragon') dragon.push({ t: mu.t, x: e.x, y: e.y, z: e.z }); });
    sim.step(input({ press: ['musou'] }));
    runMusou(sim);
    assert(dragon.length > 5, `dragon ticks ${dragon.length}`);
    const P = [0, 0, 0], W = [0, 0, 0];
    for (const d of dragon) {
      mu.toWorld(dragonAt(dragonArc((d.t - MUSOU.contact) / 60), P), W);
      assertNear(d.x, W[0], 1e-9, `x @${d.t}`); assertNear(d.y, W[1], 1e-9, `y @${d.t}`); assertNear(d.z, W[2], 1e-9, `z @${d.t}`);
    }
    assertEqual(new Set(kos).size, kos.length, 'no enemy KO’d twice in one life');
    assertEqual(h.kos, kos.length, 'kos counter');
    sim.dispose();
    return `${dragon.length} dragon ticks, ${kos.length} KOs`;
  } },
  { id: 'T12', name: 'the view imports the same path functions', async fn() {
    const src = await (await fetch('../src/musou/view.js')).text();
    assert(/import\s*\{[^}]*\bdragonAt\b[^}]*\bdragonArc\b[^}]*\}\s*from\s*'\.\/musou\.js'/.test(src), 'view imports dragonAt/dragonArc');
    assert(!/function\s+dragon(At|Arc)\b/.test(src), 'view defines no path of its own');
  } },
  { id: 'T12', name: 'repeated Musou with slot reuse keeps KO counting clean', fn() {
    const sim = createSimulationForTest({ grunts: 300, wavesOn: true }), h = sim.game.hero;
    const kos = [];
    sim.on('ko', (e) => { kos.push(e.i); });
    for (let r = 0; r < 4; r++) {
      h.musou = SEG;
      for (let s = 0; s < 120 && h.state !== 'musou'; s++) sim.step(input({ press: ['musou'] }));   // wait out a stagger
      assertEqual(h.state, 'musou', `Musou ${r} started`);
      runMusou(sim);
      sim.run(400);
    }
    assertEqual(h.kos, kos.length, 'kos counter equals ko events');
    sim.dispose();
    return `${kos.length} KOs over 4 Musou`;
  } },
];
