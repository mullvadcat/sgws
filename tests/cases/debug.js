// H03 defines the safe observation surface and the intentionally unsafe legacy references.
function assert(condition, message) { if (!condition) throw new Error(message); }

export default [
  { id: 'H03', name: 'debug snapshots are detached while unsafe references stay explicit', async fn() {
    let createDebugHandle;
    try { ({ createDebugHandle } = await import('../../src/core/debug.js')); }
    catch (error) { throw new Error(`debug API unavailable: ${error.message}`); }

    const game = {
      frame: 10,
      hero: { hp: 200, musou: 45, kos: 7 },
      crowd: { N: 4, st: [0, 1, 10, 4], engaged: 3 },
      musou: { active: true },
    };
    const loop = { paused: true };
    const scene = {};
    const renderer = { info: { render: { calls: 5, triangles: 900 }, memory: { geometries: 12, textures: 3 } } };
    const handle = createDebugHandle({ game, loop, enemies: 300, scene, renderer });

    assert(Object.isFrozen(handle), 'debug handle must be frozen');
    assert(Object.isFrozen(handle.unsafe), 'unsafe wrapper must be frozen');
    assert(handle.unsafe.game === game && handle.unsafe.loop === loop && handle.unsafe.scene === scene && handle.unsafe.renderer === renderer,
      'unsafe must preserve the live references explicitly');

    const first = handle.snapshot();
    assert(Object.isFrozen(first) && Object.isFrozen(first.hero), 'snapshot and nested values must be frozen');
    try { first.hero.hp = 0; } catch (_) { /* frozen in module strict mode */ }
    assert(game.hero.hp === 200, 'snapshot mutation must not change the source game');
    game.hero.hp = 180;
    const second = handle.snapshot();
    assert(first !== second && second.hero.hp === 180, 'each snapshot must be fresh and reflect current state');
    assert(second.frame === 10 && second.paused && second.enemies === 300, 'snapshot header fields');
    assert(second.crowd.capacity === 4 && second.crowd.alive === 2 && second.crowd.engaged === 3, 'crowd fields');
    assert(second.hero.musou === 45 && second.hero.kos === 7 && second.musou.active, 'hero and Musou fields');

    const stats = handle.renderStats();
    assert(Object.isFrozen(stats), 'render stats must be frozen');
    assert(stats.calls === 5 && stats.triangles === 900 && stats.geometries === 12 && stats.textures === 3, 'render stat values');
    assert(stats !== renderer.info && stats !== handle.renderStats(), 'render stats must return fresh plain objects');
    return 'snapshot and render statistics are detached; writes remain available only through unsafe';
  } },
];
