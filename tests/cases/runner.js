// H01 tests for the targeted browser test runner.
async function runnerApi() {
  try { return await import('../runner.js'); }
  catch (e) { throw new Error(`test runner API unavailable: ${e.message}`); }
}

function assert(cond, message) { if (!cond) throw new Error(message); }

export default [
  { id: 'H01', name: 'only retains every matching case and no other ID', async fn() {
    const { collectCases } = await runnerApi();
    const cases = [
      { id: 'T16', name: 'first', fn() {} },
      { id: 'T03', name: 'other', fn() {} },
      { id: 'T16', name: 'second', fn() {} },
    ];
    const selected = await collectCases(['fixture.js'], new Set(['T16']), async () => ({ default: cases }));
    assert(selected.length === 2 && selected.every((t) => t.id === 'T16'), 'both T16 cases must be retained');
  } },
  { id: 'H01', name: 'module import failure is not hidden by only filtering', async fn() {
    const { collectCases } = await runnerApi();
    const selected = await collectCases(['broken.js'], new Set(['T16']), async () => { throw new Error('fixture import failed'); });
    const loadCase = selected.find((t) => t.id === 'LOAD:broken.js');
    assert(!!loadCase, 'expected a LOAD: infrastructure failure');
    let message = '';
    try { await loadCase.fn(); } catch (e) { message = e.message; }
    assert(message.includes('fixture import failed'), `unexpected load error: ${message}`);
  } },
  { id: 'H01', name: 'unknown requested ID produces one failing case', async fn() {
    const { collectCases } = await runnerApi();
    const cases = [{ id: 'T16', name: 'present', fn() {} }];
    const selected = await collectCases(['fixture.js'], new Set(['T99']), async () => ({ default: cases }));
    assert(selected.length === 1, `expected one missing-ID case, got ${selected.length}`);
    assert(selected[0].name === 'requested test id not found', `unexpected name: ${selected[0].name}`);
    let message = '';
    try { await selected[0].fn(); } catch (e) { message = e.message; }
    assert(message.includes('requested test id not found: T99'), `unexpected error: ${message}`);
  } },
  { id: 'H04', name: 'untrusted test labels are rendered as text', async fn() {
    const { createResultRow } = await runnerApi();
    const payload = '<img src=x onerror="window.__injected=true">';
    const row = createResultRow(document, {
      id: `MISSING:${payload}`, name: payload, ok: false, ms: 0, detail: payload,
    });
    assert(!row.querySelector('img'), 'untrusted labels must not create HTML elements');
    assert(row.cells[0].textContent === `MISSING:${payload}`, 'ID must be preserved as plain text');
    assert(row.cells[1].textContent === payload, 'name must be preserved as plain text');
    assert(row.cells[3].textContent === payload, 'detail must be preserved as plain text');
  } },
];
