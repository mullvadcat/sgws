// URL configuration (SDD 12.1). Pure so the rules can be tested without loading the game page.
export const ENEMIES_DEFAULT = 300, ENEMIES_MAX = 2000;

/** Grunt slot capacity from the raw `?enemies=` value: missing, blank or non-finite -> 300; else truncated and
 *  clamped to 0-2000. */
export function parseEnemyCount(raw) {
  if (raw == null || String(raw).trim() === '') return ENEMIES_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return ENEMIES_DEFAULT;
  return Math.max(0, Math.min(ENEMIES_MAX, Math.trunc(n)));
}
