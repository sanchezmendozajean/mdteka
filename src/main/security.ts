const EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/** Solo se abren externamente http, https y mailto (02 · Procesos). */
export function isSafeExternalUrl(raw: string): boolean {
  try {
    return EXTERNAL_SCHEMES.has(new URL(raw).protocol);
  } catch {
    return false;
  }
}
