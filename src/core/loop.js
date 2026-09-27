// Fixed-step scheduler, split out of main.js so tests can drive it without a DOM (SDD 3.2).
// tick(elapsed) is one rAF: clamp the elapsed wall time, then run up to maxSteps fixed steps and render once. When
// the backlog reaches maxSteps it is dropped, so a slow device falls behind wall time instead of spiralling. While
// paused the accumulator is cleared and input edges are consumed so nothing pressed on the menu replays on resume.
export function createFixedLoop({ step, render, sampleInput, maxSteps = 4, dt = 1 / 60, maxElapsed = 0.1 }) {
  let acc = 0;
  const loop = {
    paused: false,
    stats: { steps: 0, dropped: false },
    setPaused(v) { loop.paused = !!v; acc = 0; },
    tick(elapsed) {
      acc += Math.min(maxElapsed, Math.max(0, elapsed || 0));
      if (loop.paused) {
        acc = 0; sampleInput();
        loop.stats.steps = 0; loop.stats.dropped = false;
        return;
      }
      let n = 0;
      while (acc >= dt && n < maxSteps) { step(); acc -= dt; n++; }
      loop.stats.steps = n; loop.stats.dropped = n === maxSteps;
      if (n === maxSteps) acc = 0;
      render();
    },
  };
  return loop;
}
