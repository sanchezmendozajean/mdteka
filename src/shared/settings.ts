import { z } from 'zod';

/**
 * Ajustes de la app (09): `userData/settings.json`. Los comparten el proceso principal (que los
 * valida y escribe) y el renderer (que los aplica). Todo tiene un valor de fábrica.
 */

export const ACCENTS = ['teal', 'blue', 'violet', 'rose', 'amber', 'green'] as const;
export type Accent = (typeof ACCENTS)[number];

/** Límites del ancho del navegador en px (PRJ-20). */
export const NAV_MIN = 200;
export const NAV_MAX = 520;

export const SettingsSchema = z.object({
  /** Valores por defecto de documento (origen «app» en el panel Documento). */
  documentDefaults: z.record(z.string(), z.unknown()).default({}),
  general: z
    .object({
      language: z.enum(['es', 'en']).default('es'),
      openOnStart: z.enum(['welcome', 'lastProject']).default('welcome'),
    })
    .prefault({}),
  editor: z
    .object({
      defaultMode: z.enum(['wysiwyg', 'source']).default('wysiwyg'),
      floatingToolbar: z.boolean().default(true),
      spellcheck: z.boolean().default(true),
      /** Idiomas del corrector (códigos de Chromium, p. ej. `es-ES`). */
      spellLanguages: z.array(z.string().max(16)).max(8).default(['es-ES']),
      autosave: z
        .object({
          mode: z.enum(['off', 'interval', 'blur']).default('off'),
          seconds: z.number().int().min(5).max(3600).default(60),
        })
        .prefault({}),
      typewriter: z.boolean().default(false),
    })
    .prefault({}),
  appearance: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).default('light'),
      accent: z.enum(ACCENTS).default('teal'),
      density: z.enum(['comfortable', 'compact']).default('comfortable'),
      /** En tema oscuro la hoja sigue siendo clara (UI-12). */
      lightSheetInDark: z.boolean().default(true),
      uiScale: z.number().min(0.8).max(1.5).default(1),
    })
    .prefault({}),
  images: z
    .object({
      /** Tamaño a partir del cual pegar como base64 avisa (KB). */
      warnKb: z.number().int().min(50).max(10000).default(300),
    })
    .prefault({}),
  files: z
    .object({
      newEol: z.enum(['lf', 'crlf']).default('lf'),
    })
    .prefault({}),
  /** Disposición de la ventana: se recuerda entre sesiones, no se edita en el diálogo. */
  layout: z
    .object({
      navigatorWidth: z.number().min(NAV_MIN).max(NAV_MAX).catch(260).default(260),
      navigatorOpen: z.boolean().default(true),
      documentPanelOpen: z.boolean().default(true),
    })
    .prefault({}),
  /** Atajos reasignados: id de comando → atajo (`''` = sin atajo). */
  shortcuts: z.record(z.string().max(80), z.string().max(40)).default({}),
});

export type Settings = z.infer<typeof SettingsSchema>;

type Json = Record<string, unknown>;
const plain = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function merge(base: Json, patch: Json, top: boolean): Json {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    // Los atajos y los valores por defecto del documento se sustituyen enteros.
    const whole = top && (key === 'shortcuts' || key === 'documentDefaults');
    out[key] = !whole && plain(value) && plain(current) ? merge(current, value, false) : value;
  }
  return out;
}

/** Mezcla un parche en los ajustes: los objetos se funden; listas y mapas de atajos se sustituyen. */
export const mergeSettings = (base: Settings, patch: Json): Settings =>
  SettingsSchema.parse(merge(base as Json, patch, true));
