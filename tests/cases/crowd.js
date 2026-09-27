// T13 attack tokens, T14 slot reuse & reinforcements, T15 capacity
import { createSimulationForTest, createEmptySim, placeEnemy, setReinforcementsForTest, emptyInput, assert, assertEqual } from '../harness.js';
import { ST, CROWD } from '../../src/crowd/crowd.js';
import { MOVES } from '../../src/hero/moves.js';

const NONE = emptyInput();
const aliveGrunts = (c) => { let n = 0; for (let i = 0; i < c.grunts; i++) if (c.st[i] !== ST.OFF) n++; return n; };

export default [
  { id: 'T13', name: 'tokens ≤ 3, wind-ups ≤ 2, token count matches the array', fn() {
    const sim = createSimulationForTest({ grunts: 300 }), c = sim.game.crowd;
    let maxTok = 0, maxWind = 0, strikes = 0;
    sim.on('enemy:attack', () => strikes++);
    for (let s = 0; s < 1800; s++) {
      // the hero swings now and then so tokens also get released by hits
      sim.step(s % 90 === 0 ? { ...NONE, pressed: { ...NONE.pressed, attack: true } } : NONE);
      let tok = 0, wind = 0;
      for (let i = 0; i < c.N; i++) { tok += c.token[i]; if (c.st[i] === ST.ATTACK && c.stT[i] < CROWD.strike) wind++; }
      assertEqual(tok, c.tokensUsed, `frame ${s}: token array vs counter`);
      assert(c.tokensUsed <= CROWD.tokens, `frame ${s}: ${c.tokensUsed} tokens`);
      assert(wind <= CROWD.maxStrikers, `frame ${s}: ${wind} wind-ups`);
      maxTok = Math.max(maxTok, tok); maxWind = Math.max(maxWind, wind);
    }
    assert(strikes > 0, 'the ring attacked at all');
    sim.dispose();
    return `max tokens ${maxTok}, max wind-ups ${maxWind}, strikes ${strikes}`;
  } },
  { id: 'T14', name: 'DEAD → OFF after 210 f; waves off: none; on: slot reused and reset', fn() {
    const sim = createEmptySim({ grunts: 100 }), g = sim.game, c = g.crowd;
    let waves = [];
    sim.on('crowd:wave', (e) => waves.push(e.count));
    placeEnemy(g, 0, 0, 1.5, { hp: 1 });
    g.combat.strike(MOVES.n1.hits[0], 0, 0, 0, 77, false, 'n1');
    assertEqual([c.kod[0], c.lastHit[0]], [1, 77], 'KO marks');
    let deadAt = -1;
    for (let s = 0; s < 600 && c.st[0] !== ST.OFF; s++) { sim.step(NONE); if (deadAt < 0 && c.st[0] === ST.DEAD) deadAt = s; }
    assert(deadAt >= 0, 'died'); assertEqual(c.st[0], ST.OFF, 'recycled');
    sim.run(200);
    assertEqual(waves.length, 0, 'no waves while disabled');
    setReinforcementsForTest(g, true);
    for (let s = 0; s < 300 && !waves.length; s++) sim.step(NONE);
    assert(waves.length === 1, 'a wave arrived');
    assertEqual(aliveGrunts(c), waves[0], 'crowd:wave.count equals soldiers placed');
    assert(c.st[0] !== ST.OFF, 'slot 0 reused');
    assertEqual([c.hp[0] === c.hpMax[0], c.lastHit[0], c.kod[0], c.token[0]], [true, -1, 0, 0], 'fresh life');
    assert(c.hpMax[0] === 30 || c.hpMax[0] === 80, `grunt/captain hp ${c.hpMax[0]}`);
    assertEqual(c.N, 104, 'capacity unchanged');
    sim.dispose();
  } },
  { id: 'T14', name: 'squad table full: no phantom wave, no officer respawn, timer kept', fn() {
    const sim = createEmptySim({ grunts: 100 }), g = sim.game, c = g.crowd;
    const waves = [];
    sim.on('crowd:wave', (e) => waves.push(e));
    for (let q = 0; q < 64; q++) {                    // 64 one-man blocks holding far out (> 55 m: never released)
      const a = q / 64 * Math.PI * 2, x = Math.sin(a) * 58, z = Math.min(Math.cos(a) * 58, 90);
      placeEnemy(g, q, x, z); c.st[q] = ST.IDLE; c.form[q] = 1; c.squad[q] = q; c.aggro[q] = 9;
      c.sq.x[q] = x; c.sq.z[q] = z; c.sq.st[q] = 1; c.sq.t[q] = 0;
    }
    c.sq.n = 64;
    setReinforcementsForTest(g, true);
    sim.run(400);
    assertEqual(waves.length, 0, 'no crowd:wave without a squad slot');
    assertEqual(aliveGrunts(c), 64, 'nobody placed');
    let officers = 0; for (let i = c.grunts; i < c.N; i++) if (c.st[i] !== ST.OFF) officers++;
    assertEqual(officers, 0, 'no officer respawn');
    assert(c.waveT >= CROWD.waveEvery[0], `waveT kept (${c.waveT})`);
    sim.dispose();
  } },
  { id: 'T15', name: 'capacity 0 / 300 / 2000 (seed 1)', fn() {
    const out = [];
    for (const [g, n, spawned, sqn] of [[0, 4, 0, 0], [300, 304, 300, 11], [2000, 2004, 1583, 64]]) {
      const sim = createSimulationForTest({ grunts: g }), c = sim.game.crowd;
      let off = 0; for (let i = c.grunts; i < c.N; i++) if (c.st[i] !== ST.OFF) off++;
      assertEqual([c.N, aliveGrunts(c), off, c.sq.n], [n, spawned, 4, sqn], `grunts=${g}`);
      sim.run(60);
      assertEqual(c.x.length, n, 'arrays not resized');
      out.push(`${g}: N=${c.N} spawned=${spawned} sq=${sqn}`);
      sim.dispose();
    }
    return out.join('; ');
  } },
];
