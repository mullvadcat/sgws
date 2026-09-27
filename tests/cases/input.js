// T01 input edges, T02 direction merge / gamepad, T17 ?enemies parsing
import { createInput, assert, assertEqual, assertNear } from '../harness.js';
import { parseEnemyCount } from '../../src/core/config.js';

const key = (type, code, extra = {}) => new KeyboardEvent(type, { code, ...extra });
const ptr = (type, extra = {}) => new PointerEvent(type, { button: 1, ...extra });

function makeInput(pads = []) {
  const target = new EventTarget();
  const inp = createInput({ target, getGamepads: () => pads });
  return { target, inp, fire: (e) => target.dispatchEvent(e) };
}
const pad = (pressed = [], axes = [0, 0, 0, 0]) => ({ axes, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })) });

export default [
  { id: 'T01', name: 'tap between steps is latched once', fn() {
    const { inp, fire } = makeInput();
    fire(key('keydown', 'KeyJ')); fire(key('keyup', 'KeyJ'));
    assertEqual(inp.sample().pressed.attack, true, 'first sample sees the tap');
    assertEqual(inp.sample().pressed.attack, false, 'second sample does not');
    inp.dispose();
  } },
  { id: 'T01', name: 'key repeat does not re-fire', fn() {
    const { inp, fire } = makeInput();
    fire(key('keydown', 'KeyJ')); inp.sample();
    fire(key('keydown', 'KeyJ', { repeat: true }));
    const s = inp.sample();
    assertEqual(s.pressed.attack, false, 'repeat edge'); assertEqual(s.held.attack, true, 'still held');
    inp.dispose();
  } },
  { id: 'T01', name: 'blur during a camera drag stops the orbit', fn() {
    const { inp, fire } = makeInput();
    fire(ptr('pointerdown', { clientX: 100 })); fire(ptr('pointermove', { clientX: 150, buttons: 4 }));
    assert(inp.sample().orbit !== 0, 'drag turns the view');
    fire(new Event('blur'));
    fire(ptr('pointermove', { clientX: 250, buttons: 0 }));
    assertEqual(inp.sample().orbit, 0, 'no orbit after blur');
    fire(ptr('pointerdown', { clientX: 100 })); fire(ptr('pointermove', { clientX: 400, buttons: 0 }));
    assertEqual(inp.sample().orbit, 0, 'button-less move ends a drag whose release was missed');
    inp.dispose();
  } },
  { id: 'T01', name: 'dispose removes listeners', fn() {
    const { inp, fire } = makeInput();
    inp.dispose(); fire(key('keydown', 'KeyJ'));
    assertEqual(inp.sample().pressed.attack, false, 'no edge after dispose');
  } },
  { id: 'T02', name: 'diagonal keys normalise to length 1', fn() {
    const { inp, fire } = makeInput();
    fire(key('keydown', 'KeyW')); fire(key('keydown', 'KeyD'));
    const s = inp.sample();
    assertNear(Math.hypot(s.mx, s.my), 1, 1e-9, 'W+D length');
    inp.dispose();
  } },
  { id: 'T02', name: 'stick dead zone and key+stick sum', fn() {
    const pads = [pad([], [0.1, -0.15, 0.17, 0])];
    const { inp, fire } = makeInput(pads);
    let s = inp.sample();
    assertEqual([s.mx, s.my, s.orbit], [0, 0, 0], 'inside dead zone');
    pads[0] = pad([], [1, -1, 0, 0]); fire(key('keydown', 'KeyW'));
    s = inp.sample();
    assert(Math.hypot(s.mx, s.my) <= 1 + 1e-9, 'combined length <= 1');
    inp.dispose();
  } },
  { id: 'T02', name: 'one action, several bindings: edges are not overwritten', fn() {
    const pads = [pad()];
    const { inp, fire } = makeInput(pads);
    fire(key('keydown', 'KeyL'));
    assertEqual(inp.sample().pressed.dodge, true, 'keyboard dodge survives pad poll');
    pads[0] = pad([5]); assertEqual(inp.sample().pressed.dodge, true, 'R1 edge');
    pads[0] = pad([5, 7]); assertEqual(inp.sample().pressed.dodge, true, 'button 7 edge while R1 held');
    assertEqual(inp.sample().pressed.dodge, false, 'no edge while both held');
    inp.dispose();
  } },
  { id: 'T02', name: 'pad disconnect forgets old button states', fn() {
    const pads = [pad([2])];
    const { inp } = makeInput(pads);
    assertEqual(inp.sample().pressed.attack, true, 'first press');
    assertEqual(inp.sample().pressed.attack, false, 'held');
    pads.length = 0; inp.sample();
    pads.push(pad([2]));
    assertEqual(inp.sample().pressed.attack, true, 'a new device starts clean');
    inp.dispose();
  } },
  { id: 'T02', name: 'pad held through the pause menu does not fire on resume', fn() {
    const pads = [pad()];
    const { inp } = makeInput(pads);
    pads[0] = pad([2]); inp.sample();                  // menu open: main samples every rAF and drops the edge
    assertEqual(inp.sample().pressed.attack, false, 'resume while still held');
    inp.dispose();
  } },
  { id: 'T17', name: '?enemies parsing table (SDD 12.1)', fn() {
    const cases = [[null, 300], ['', 300], ['  ', 300], ['0', 0], ['-5', 0], ['12.9', 12], ['2001', 2000], ['1e9', 2000],
      ['abc', 300], ['NaN', 300], ['Infinity', 300], ['-Infinity', 300], ['300', 300], ['2000', 2000]];
    for (const [raw, want] of cases) assertEqual(parseEnemyCount(raw), want, `enemies=${raw}`);
  } },
];
