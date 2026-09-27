/** Parse the optional `?only=` filter. `null` means run the complete suite. */
export function parseRequestedIds(search) {
  const params = new URLSearchParams(search);
  if (!params.has('only')) return null;
  return new Set(params.get('only').split(',').map((id) => id.trim()).filter(Boolean));
}

const failureCase = (id, name, message) => ({
  id,
  name,
  fn() { throw new Error(message); },
});

/** Render test output without interpreting test-controlled strings as markup. */
export function createResultRow(document, result) {
  const row = document.createElement('tr');
  const id = document.createElement('td');
  id.textContent = result.id;
  row.appendChild(id);

  const name = document.createElement('td');
  name.textContent = result.name;
  row.appendChild(name);

  const status = document.createElement('td');
  status.className = result.ok ? 'pass' : 'fail';
  status.textContent = `${result.ok ? 'PASS' : 'FAIL'} (${result.ms} ms)`;
  row.appendChild(status);

  const detail = document.createElement('td');
  const pre = document.createElement('pre');
  pre.textContent = result.detail;
  detail.appendChild(pre);
  row.appendChild(detail);
  return row;
}

/** Import every case module, then apply the requested-ID filter without hiding infrastructure failures. */
export async function collectCases(modulePaths, requestedIds, importer = (path) => import(path)) {
  const loaded = [];
  const failures = [];

  for (const path of modulePaths) {
    try {
      const cases = (await importer(path)).default;
      if (!Array.isArray(cases)) throw new TypeError(`module ${path} must export a default array of test cases`);
      loaded.push(...cases);
    } catch (error) {
      failures.push(failureCase(`LOAD:${path}`, 'module load', `Failed to load ${path}: ${error?.message || error}`));
    }
  }

  const selected = requestedIds === null
    ? loaded
    : loaded.filter((testCase) => requestedIds.has(testCase.id));
  const missing = requestedIds === null
    ? []
    : [...requestedIds].filter((id) => !loaded.some((testCase) => testCase.id === id));

  for (const id of missing) {
    failures.push(failureCase(`MISSING:${id}`, 'requested test id not found', `requested test id not found: ${id}`));
  }

  if (!selected.length && !failures.length) {
    failures.push(failureCase('RUNNER:EMPTY', 'no tests selected', 'test suite selected no cases'));
  }

  return [...failures, ...selected];
}
