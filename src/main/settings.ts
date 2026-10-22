import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { DocumentConfigSchema } from '@shared/document-config';

/** Ajustes de la app (09): `userData/settings.json`, validados con zod (CFG-02). */
const SettingsSchema = z.object({
  /** Valores por defecto de documento (origen «app» en el panel Documento). */
  documentDefaults: z.record(z.string(), z.unknown()).default({}),
});
export type Settings = z.infer<typeof SettingsSchema>;

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

export function saveDocumentDefaults(defaults: Record<string, unknown>): Settings {
  const rest = { ...defaults };
  delete rest['version'];
  if (!validDefaults(rest)) throw new Error('Valores por defecto de documento no válidos');
  cache = { ...loadSettings(), documentDefaults: rest };
  mkdirSync(app.getPath('userData'), { recursive: true });
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(cache, null, 2)}\n`);
  renameSync(tmp, file());
  return cache;
}
