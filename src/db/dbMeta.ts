export const CURRENT_SCHEMA_VERSION = 1;

const META_KEY = 'daybook:schemaVersion';

export function getSchemaVersion(): number {
  const raw = localStorage.getItem(META_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function setSchemaVersion(v: number): void {
  localStorage.setItem(META_KEY, String(v));
}
