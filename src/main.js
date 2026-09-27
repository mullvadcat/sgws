// Boot + fixed 60 Hz loop. Sim modules (hero, combat, crowd, musou, camera control yaw) advance only in step();
// render-side modules read sim state in render() and never write it.
import * as THREE from 'three';
import { rng, vrng } from './core/rng.js';
import { emit } from './core/events.js';
import { createInput } from './core/input.js';
import { createPost } from './post/post.js';
import { createWorld } from './world/world.js';
import { createHero, createHeroView } from './hero/hero.js';
import { createCrowd } from './crowd/crowd.js';
import { createCrowdView } from './crowd/view.js';
import { createCombat } from './combat/combat.js';
import { createMusou } from './musou/musou.js';
import { createMusouView } from './musou/view.js';
import { createCamSim, createCameraRig } from './camera/camera.js';
import { createVfx } from './vfx/vfx.js';
import { createHud } from './ui/hud.js';
import { createAudio } from './audio/audio.js';
import { createFixedLoop } from './core/loop.js';
import { parseEnemyCount } from './core/config.js';

const params = new URLSearchParams(location.search);
const ENEMIES = parseEnemyCount(params.get('enemies'));

const canvas = document.getElementById('c');
let vw = innerWidth, vh = innerHeight;

const post = createPost({ canvas, width: vw, height: vh });
const scene = new THREE.Scene();
const world = createWorld(scene);

// ---- sim
const game = { frame: 0, hitstop: 0, freeze: 0 };
game.cam = createCamSim();
game.hero = createHero(game);
game.crowd = createCrowd(game, ENEMIES);
game.combat = createCombat(game);
game.musou = createMusou(game);
const input = createInput();

// ---- render side
const heroView = createHeroView(scene, game.hero);
const crowdView = createCrowdView(scene, game);
const camRig = createCameraRig(game, vw, vh);
const vfx = createVfx(scene, game, world);
const musouView = createMusouView(scene, game, camRig.camera);   // musou part: grade, dragon, cut-in (render-only)
// hud part: camera passed so officer name/HP tags can be projected over their heads (read-only)
const hud = createHud(document.getElementById('hud'), game, { camera: camRig.camera });
createAudio(game);

function step() {
  const inp = input.sample();
  game.cam.step(game, inp);
  game.hero.step(inp);
  game.combat.step();
  game.crowd.step();
  game.musou.step();
  game.frame++;
  vfx.afterStep();
}

let lastRenderFrame = 0;
function render() {
  const dt = Math.min(10, Math.max(0, (game.frame - lastRenderFrame) / 60));
  lastRenderFrame = game.frame;
  heroView.update(Math.min(dt, 0.1));
  crowdView.update(dt);
  vfx.update(dt);
  camRig.update(dt);
  world.update(dt, camRig.focus);
  musouView.update(dt);
  post.flash(vfx.flash);
  post.render(scene, camRig.camera, game.frame / 60, camRig.focus, world.sunDir);   // post-fx: DoF focus + haze sun
  hud.update();
}

function start() {
  rng.seed(1); vrng.seed(7936);
  game.hero.reset();
  game.crowd.reset(); game.combat.reset(); game.musou.reset(); game.cam.reset(0);
  heroView.reset();
  game.crowd.spawnArmy(Math.min(ENEMIES, game.crowd.grunts));
  emit('scenario', { name: 'arena' });
}

addEventListener('resize', () => {
  vw = innerWidth; vh = innerHeight;
  post.setSize(vw, vh);
  camRig.resize(vw, vh);
  render();
});

// ---- start / pause menu (index.html #menu): the sim waits while it is open
const menu = document.getElementById('menu'), go = document.getElementById('go'), hudEl = document.getElementById('hud');
const loop = createFixedLoop({ step, render, sampleInput: input.sample });
const setPaused = (v) => { loop.setPaused(v); menu.hidden = !v; hudEl.hidden = v; input.sample(); };   // sample(): drop keys pressed on the menu
go.addEventListener('click', () => setPaused(false));
addEventListener('keydown', (e) => {
  if (e.code === 'Escape') setPaused(!loop.paused);
  else if (loop.paused && (e.code === 'Enter' || e.code === 'NumpadEnter')) setPaused(false);
});
addEventListener('blur', () => setPaused(true));

// ---- loop
let last = performance.now();
const frame = (now) => {
  requestAnimationFrame(frame);
  // the loop clamps at 0 too: the first rAF timestamp can precede the performance.now() taken at module init
  loop.tick((now - last) / 1000);
  last = now;
};

start();
setPaused(true);
render();
requestAnimationFrame(frame);
