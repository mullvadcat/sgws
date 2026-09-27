// Input → actions from keyboard, mouse and gamepad.
// The sim calls sample() exactly once per fixed step; "pressed" edges are latched so a tap
// between two steps is never lost.
export const ACTIONS = ['attack', 'charge', 'jump', 'dodge', 'musou'];

const KEYMAP = {
  KeyJ: 'attack', KeyK: 'charge', Space: 'jump', KeyL: 'dodge',
  ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyI: 'musou',
};
const MOVEKEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
// Gamepad (standard mapping): A/× jump, X/□ attack, Y/△ charge, B/○ musou, R1 dodge.
const PADMAP = { 0: 'jump', 2: 'attack', 3: 'charge', 1: 'musou', 5: 'dodge', 7: 'dodge' };

const defaultPads = () => (navigator.getGamepads ? navigator.getGamepads() : []);

/** target: where the listeners go (window in the game; a plain EventTarget in tests). getGamepads: pad source (tests
 *  pass a stub). dispose() removes every listener. */
export function createInput({ target = window, getGamepads = defaultPads } = {}) {
  const dev = { held: {}, latch: {}, keys: new Set(), orbitPx: 0, pad: {} };
  const out = { mx: 0, my: 0, orbit: 0, pressed: {}, held: {} };
  const subs = [];
  const listen = (name, fn) => { target.addEventListener(name, fn); subs.push([name, fn]); };

  listen('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    dev.keys.add(e.code);
    const a = KEYMAP[e.code];
    if (a && !e.repeat) { dev.held[a] = true; dev.latch[a] = true; }
  });
  listen('keyup', (e) => {
    dev.keys.delete(e.code);
    const a = KEYMAP[e.code];
    if (a) dev.held[a] = false;
  });
  let drag = false, lastX = 0;
  // focus lost: drop everything held, including a camera drag whose button may be released outside the window
  // (otherwise the view keeps turning with a bare pointer move on return)
  listen('blur', () => { dev.keys.clear(); for (const a of ACTIONS) dev.held[a] = false; drag = false; dev.orbitPx = 0; });
  listen('contextmenu', (e) => e.preventDefault());
  listen('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('button,a,input')) return;
    const a = e.button === 0 ? 'attack' : e.button === 2 ? 'charge' : null;
    if (a) { dev.held[a] = true; dev.latch[a] = true; }
    drag = true; lastX = e.clientX;
  });
  listen('pointerup', (e) => {
    const a = e.button === 0 ? 'attack' : e.button === 2 ? 'charge' : null;
    if (a) dev.held[a] = false;
    drag = false;
  });
  listen('pointercancel', () => { drag = false; });
  listen('pointermove', (e) => {
    if (drag && e.buttons === 0) drag = false;           // the release happened where we could not see it
    if (drag) { dev.orbitPx += e.clientX - lastX; lastX = e.clientX; }
  });

  function pollPad() {
    const pads = getGamepads();
    const p = pads && pads[0];
    if (!p) { dev.pad = {}; return null; }                // disconnected: forget the old device's button states
    for (const [btn, a] of Object.entries(PADMAP)) {
      const down = !!(p.buttons[btn] && p.buttons[btn].pressed);
      if (down && !dev.pad[btn]) dev.latch[a] = true;
      dev.pad[btn] = down;
    }
    return p;
  }

  function sample() {
    let mx = 0, my = 0, orbit = 0;
    const pad = pollPad();
    for (const k of dev.keys) { const m = MOVEKEYS[k]; if (m) { mx += m[0]; my += m[1]; } }
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      mx += dz(pad.axes[0] || 0); my -= dz(pad.axes[1] || 0);
      orbit += dz(pad.axes[2] || 0) * 0.05;
    }
    if (dev.keys.has('KeyQ')) orbit += 0.04;
    if (dev.keys.has('KeyE')) orbit -= 0.04;
    orbit -= dev.orbitPx * 0.006; dev.orbitPx = 0;
    for (const a of ACTIONS) {
      out.pressed[a] = !!dev.latch[a];
      out.held[a] = !!dev.held[a];
      dev.latch[a] = false;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    out.mx = mx; out.my = my; out.orbit = orbit;
    return out;
  }

  const dispose = () => { for (const [name, fn] of subs) target.removeEventListener(name, fn); subs.length = 0; };
  return { sample, dispose };
}
