// File name shown for an uploaded PDF. Pure; IndexedDB lives in manuals.ts.

export function uploadTitle(name: string): string {
  return name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
}
