import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentConfigSchema } from '@shared/document-config';
import { mergeSettings, SettingsSchema, type Settings } from '@shared/settings';

/** Ajustes de la app (09): `userData/settings.json`, validados con zod (CFG-02). */
export type { Settings };

const file = () => join(app.getPath('userData'), 'settings.json');
let cache: Settings | null = null;

/** Comprueba que los valores por defecto formen una configuración de documento válida. */
function validDefaults(defaults: Record<string, unknown>): boolean {
  return DocumentConfigSchema.safeParse({ ...defaults, version: 1 }).success;
}

export function loadSettings(): Settings {
  if (cache) return cache;
  const path = file();
  if (!existsSync(path)) return (cache = SettingsSchema.parse({}));
  try {
    const parsed = SettingsSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
    if (!validDefaults(parsed.documentDefaults)) throw new Error('documentDefaults inválido');
    return (cache = parsed);
  } catch {
    // Archivo corrupto: se aparta y se parte de los valores de fábrica.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      renameSync(path, join(app.getPath('userData'), `settings.corrupt-${stamp}.json`));
    } catch {
      /* si no se puede renombrar, se sobrescribirá al guardar */
    }
    return (cache = SettingsSchema.parse({}));
  }
}

function write(next: Settings): Settings {
  cache = next;
  mkdirSync(app.getPath('userData'), { recursive: true });
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(tmp, file());
  return next;
}

/** Aplica un parche validado a los ajustes y los guarda. */
export function saveSettings(patch: Record<string, unknown>): Settings {
  const next = mergeSettings(loadSettings(), patch);
  if (!validDefaults(next.documentDefaults))
    throw new Error('Valores por defecto de documento no válidos');
  return write(next);
}

export function saveDocumentDefaults(defaults: Record<string, unknown>): Settings {
  const rest = { ...defaults };
  delete rest['version'];
  return saveSettings({ documentDefaults: rest });
}

/** Vuelve a los valores de fábrica (Ajustes › Avanzado). */
export function resetSettings(): Settings {
  return write(SettingsSchema.parse({}));
}
