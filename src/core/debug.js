import { isAlive } from '../crowd/crowd.js';

function freezeDeep(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) freezeDeep(child);
  }
  return Object.freeze(value);
}

/** Safe read snapshots plus explicitly unsafe live references for manual verification. */
export function createDebugHandle({ game, loop, enemies, scene, renderer }) {
  const unsafe = Object.freeze({ game, loop, scene, renderer });

  return Object.freeze({
    snapshot() {
      const crowd = game.crowd;
      let alive = 0;
      for (let i = 0; i < crowd.N; i++) if (isAlive(crowd.st[i])) alive++;
      return freezeDeep({
        frame: game.frame,
        paused: loop.paused,
        enemies,
        hero: { hp: game.hero.hp, musou: game.hero.musou, kos: game.hero.kos },
        crowd: { capacity: crowd.N, alive, engaged: crowd.engaged },
        musou: { active: game.musou.active },
      });
    },
    renderStats() {
      const info = renderer?.info || {};
      return Object.freeze({
        calls: info.render?.calls || 0,
        triangles: info.render?.triangles || 0,
        geometries: info.memory?.geometries || 0,
        textures: info.memory?.textures || 0,
      });
    },
    unsafe,
  });
}
