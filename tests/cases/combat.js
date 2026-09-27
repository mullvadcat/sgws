// T06 hit de-dup, T07 hit geometry, T08 resource & KO, T09 hero damage
import { createEmptySim, placeEnemy, input, emptyInput, assert, assertEqual, assertNear } from '../harness.js';
import { MOVES } from '../../src/hero/moves.js';
import { ST } from '../../src/crowd/crowd.js';

const NONE = emptyInput();

function reach(sim, target) {
  const h = sim.game.hero;
  for (let s = 0; s < 800; s++) {
    if (h.move === target) return;
    sim.step(h.state === 'idle' || (h.move && h.moveT === 3) ? input({ press: ['attack'] }) : NONE);
  }
  throw new Error(`never reached ${target}`);
}

function countHits(sim) {
  const byMove = {};
  sim.on('hit', (e) => { byMove[e.move] = (byMove[e.move] || 0) + 1; });
  return byMove;
}

export default [
  { id: 'T06', name: 'N1 single window hits once through its hitstop', fn() {
    const sim = createEmptySim(), g = sim.game;
    placeEnemy(g, 0, 0, 1.6, { hp: 999 });
    const hits = countHits(sim);
    sim.step(input({ press: ['attack'] }));
    let sawStop = false;
    for (let s = 0; s < 40; s++) { sim.step(NONE); if (g.hitstop > 0) sawStop = true; }
    assert(sawStop, 'hitstop happened');
    assertEqual(hits.n1, 1, 'N1 hits');
    assertEqual(g.crowd.hp[0], 999 - MOVES.n1.hits[0].dmg, 'hp');
    sim.dispose();
  } },
  { id: 'T06', name: 'sweep windows hit each target at most once', fn() {
    const sim = createEmptySim(), g = sim.game;
    // five officer-type targets in an arc in front (officers only stagger, so they stay in reach)
    const pts = [[-1.2, 1.4], [-0.5, 1.8], [0.3, 1.9], [1.0, 1.5], [1.5, 0.9]];
    pts.forEach(([x, z], i) => placeEnemy(g, i, x, z, { hp: 9999, officer: true }));
    const per = {};
    sim.on('hit', (e) => { const k = `${e.move}:${e.i}`; per[k] = (per[k] || 0) + 1; });
    reach(sim, 'n2'); reach(sim, 'n4'); reach(sim, 'n5');
    for (const [k, n] of Object.entries(per)) if (/^n[24]:/.test(k)) assert(n === 1, `${k} hit ${n}×`);
    assert(Object.keys(per).some((k) => k.startsWith('n4:')), 'N4 connected');
    sim.dispose();
  } },
  { id: 'T06', name: 'every=10 window (C4) re-hits on its beat', fn() {
    const sim = createEmptySim(), g = sim.game;
    placeEnemy(g, 0, 0, 1.4, { hp: 9999, officer: true });
    const frames = [];
    sim.on('hit', (e) => { if (e.move === 'c4') frames.push(g.hero.moveT); });
    reach(sim, 'n3'); sim.step(input({ press: ['charge'] }));
    for (let s = 0; s < 200 && g.hero.move !== 'n1' && !(g.hero.state === 'idle' && frames.length); s++) sim.step(NONE);
    assertEqual(frames, [24, 34, 44], 'C4 tick frames');
    sim.dispose();
  } },
  { id: 'T07', name: 'line / circle / arc edges, behind, yMax', fn() {
    const sim = createEmptySim(), g = sim.game, cb = g.combat;
    let key = 1;
    const hits = (hit, x, z, y = 0) => {
      placeEnemy(g, 0, x, z, { hp: 9999 }); g.crowd.y[0] = y;
      return cb.strike({ dmg: 1, kb: 'flinch', force: 0, hitstop: 0, ...hit }, 0, 0, 0, key++, false, 'test') === 1;
    };
    const line = { shape: 'line', len: 2, width: 1 };
    assert(hits(line, 0, 2.39), 'line tip in'); assert(!hits(line, 0, 2.41), 'line tip out');
    assert(hits(line, 0.89, 1), 'line side in'); assert(!hits(line, 0.91, 1), 'line side out');
    assert(hits(line, 0, -0.39), 'line back margin in'); assert(!hits(line, 0, -0.41), 'line behind out');
    const circ = { shape: 'circle', range: 2 };
    assert(hits(circ, 0, -2.39), 'circle in (behind too)'); assert(!hits(circ, 2.41, 0), 'circle out');
    const arc = { shape: 'arc', range: 3, ang: 90 };
    const at = (deg, d) => [Math.sin(deg * Math.PI / 180) * d, Math.cos(deg * Math.PI / 180) * d];
    assert(hits(arc, ...at(44, 2)), 'arc 44°'); assert(!hits(arc, ...at(46, 2)), 'arc 46°');
    assert(!hits(arc, 0, -2), 'arc behind'); assert(hits(arc, 0, -0.9), 'arc near-body tolerance');
    assert(hits({ ...arc, dir: 90 }, 2, 0), 'arc dir +90 (left of +Z facing)'); assert(!hits({ ...arc, dir: 90 }, -2, 0), 'arc dir other side');
    assert(!hits(circ, 0, 1, 2.5), 'above default yMax 2.4'); assert(hits({ ...circ, yMax: 3 }, 0, 1, 2.5), 'custom yMax');
    sim.dispose();
  } },
  { id: 'T08', name: 'KO counted once; resource gain outside Musou, capped at 100', fn() {
    const sim = createEmptySim(), g = sim.game, h = g.hero, cb = g.combat;
    const order = [];
    for (const n of ['hit', 'ko', 'hits']) sim.on(n, () => order.push(n));
    const hit = MOVES.n1.hits[0];
    placeEnemy(g, 0, 0, 1.5, { hp: 1 });
    cb.strike(hit, 0, 0, 0, 10, false, 'n1');
    assertEqual(order, ['hit', 'ko', 'hits'], 'event order');
    assertEqual(h.kos, 1, 'KO'); assertNear(h.musou, 0.3 + 0.55, 1e-9, 'hit + KO gain');
    assertEqual(g.crowd.st[0], ST.AIR, 'KO throw');
    cb.strike({ ...hit, shape: 'circle', range: 5, yMax: 9 }, 0, 0, 0, 11, false, 'n1');
    assertEqual(h.kos, 1, 'juggling the KO’d body does not re-count');
    assertNear(h.musou, 0.85 + 0.3, 1e-9, 'juggle hit still gains');
    h.musou = 99.9; placeEnemy(g, 1, 0, 1.5, { hp: 999 });
    cb.strike(hit, 0, 0, 0, 12, false, 'n1');
    assertEqual(h.musou, 100, 'cap');
    sim.dispose();
  } },
  { id: 'T08', name: 'no resource from hits or KOs while in Musou', fn() {
    const sim = createEmptySim(), g = sim.game, h = g.hero, cb = g.combat;
    h.state = 'musou'; h.musou = 10;
    placeEnemy(g, 0, 0, 1.5, { hp: 999 }); placeEnemy(g, 1, 0.5, 1.5, { hp: 1 });
    cb.strike({ shape: 'circle', range: 3, dmg: 12, kb: 'blow', force: 5, lift: 5, hitstop: 0 }, 0, 0, 0, -5, false, 'musou');
    assertEqual(h.musou, 10, 'unchanged'); assertEqual(h.kos, 1, 'KO still counts');
    sim.dispose();
  } },
  { id: 'T09', name: 'hero damage: HP floor 1, i-frames, armour, dodge', fn() {
    const sim = createEmptySim(), g = sim.game, h = g.hero;
    assertEqual(h.hurt(10, 0, 2, false), true, 'grunt hit lands');
    assertEqual([h.hp, h.state, h.iframes], [390, 'hurt', 40], 'hurt state');
    assertNear(h.musou, 1.5, 1e-9, 'musou from damage');
    assertEqual(h.hurt(10, 0, 2, false), false, 'i-frames');
    h.reset(); h.hp = 5; h.hurt(22, 0, 2, true); assertEqual(h.hp, 1, 'officer hit floors at 1');
    h.iframes = 0; h.state = 'idle'; h.hurt(22, 0, 2, true); assertEqual(h.hp, 1, 'stays 1');
    h.reset(); sim.step(input({ press: ['attack'] }));
    h.hurt(10, 0, 2, false); assertEqual([h.hp, h.move], [390, 'n1'], 'grunt hit does not flinch an attack');
    h.hurt(22, 0, 2, true); assertEqual([h.hp, h.state], [368, 'hurt'], 'officer interrupts N1');
    h.reset(); sim.step(input({ press: ['charge'] }));
    h.hurt(22, 0, 2, true); assertEqual([h.hp, h.move], [378, 'c1'], 'C1 armour keeps the move, takes damage');
    h.reset(); sim.step(input({ press: ['dodge'] })); sim.run(20);
    assertEqual(h.state, 'dodge', 'late dodge frame'); assertEqual(h.hurt(10, 0, 2, false), false, 'dodge rejects');
    sim.dispose();
  } },
  { id: 'T09', name: 'enemy strike reach 1.9 m (grunt) / 2.3 m (officer)', fn() {
    const sim = createEmptySim(), g = sim.game, h = g.hero;
    const strike = (i, d, officer) => { h.reset(); placeEnemy(g, i, 0, d, { officer }); g.combat.enemyStrike(i); return 400 - h.hp; };
    assertEqual(strike(0, 1.85, false), 10, 'grunt in reach'); assertEqual(strike(0, 1.95, false), 0, 'grunt out of reach');
    const o = g.crowd.grunts;
    assertEqual(strike(o, 2.25, true), 22, 'officer in reach'); assertEqual(strike(o, 2.35, true), 0, 'officer out of reach');
    sim.dispose();
  } },
];
