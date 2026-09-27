// H02 checks the render-side dependency boundary: presentation modules may use visual randomness, not simulation rng.
const RENDER_FILES = [
  '../src/crowd/view.js',
  '../src/musou/view.js',
  '../src/vfx/vfx.js',
  '../src/ui/hud.js',
  '../src/audio/audio.js',
  '../src/post/post.js',
  '../src/camera/camera.js',
  '../src/hero/model.js',
  '../src/hero/secondary.js',
  '../src/world/world.js',
  '../src/world/sky.js',
  '../src/world/terrain.js',
  '../src/world/castle.js',
  '../src/world/dressing.js',
];

function importsSimulationRng(source) {
  const imports = /(?:import|export)\s*\{([^}]+)\}\s*from\s*['"][^'"]*core\/rng\.js['"]/gs;
  for (const match of source.matchAll(imports)) {
    const bindings = match[1].split(',').map((binding) => binding.trim());
    if (bindings.some((binding) => /^rng(?:\s+as\s+[\w$]+)?$/.test(binding))) return true;
  }
  return /import\s+\*\s+as\s+[\w$]+\s+from\s+['"][^'"]*core\/rng\.js['"]/.test(source);
}

const assert = (condition, message) => { if (!condition) throw new Error(message); };

export default [
  { id: 'H02', name: 'render-only modules do not import simulation rng', async fn() {
    assert(importsSimulationRng("import { rng as simRng } from '../core/rng.js';"), 'guard must detect aliased rng imports');
    assert(!importsSimulationRng("import { vrng, hash01, makeRng } from '../core/rng.js';"), 'visual RNG and pure helpers remain allowed');

    for (const path of RENDER_FILES) {
      const response = await fetch(path, { cache: 'no-store' });
      assert(response.ok, `could not inspect ${path}: HTTP ${response.status}`);
      const source = await response.text();
      assert(!importsSimulationRng(source), `${path} imports simulation rng from core/rng.js`);
    }
    return `checked ${RENDER_FILES.length} render-only modules`;
  } },
];
