import { collectCases, parseRequestedIds } from './runner.js';

const MODULES = [
  './cases/input.js', './cases/hero.js', './cases/combat.js', './cases/crowd.js',
  './cases/musou.js', './cases/loop.js', './cases/runner.js',
];
const rows = document.getElementById('rows');
const results = [];
const requestedIds = parseRequestedIds(location.search);
const tests = await collectCases(MODULES, requestedIds);

document.getElementById('env').textContent = navigator.userAgent;

for (const testCase of tests) {
  const result = { id: testCase.id, name: testCase.name, ok: true, detail: '' };
  const started = performance.now();
  try {
    const detail = await testCase.fn();
    if (detail) result.detail = String(detail);
  } catch (error) {
    result.ok = false;
    result.detail = (error && error.stack) || String(error);
  }
  result.ms = Math.round(performance.now() - started);
  results.push(result);

  const row = document.createElement('tr');
  row.innerHTML = `<td>${result.id}</td><td>${result.name}</td><td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? 'PASS' : 'FAIL'} (${result.ms} ms)</td><td><pre></pre></td>`;
  row.querySelector('pre').textContent = result.detail;
  rows.appendChild(row);
}

const failed = results.filter((result) => !result.ok).length;
const missing = results.filter((result) => result.id.startsWith('MISSING:')).map((result) => result.id.slice('MISSING:'.length));
document.getElementById('summary').textContent = `${results.length - failed}/${results.length} passed`;
window.__testResults = {
  passed: results.length - failed,
  failed,
  results,
  requested: requestedIds === null ? [] : [...requestedIds],
  missing,
};
