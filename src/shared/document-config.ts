import { z } from 'zod';

/**
 * Configuración por documento (04): esquema, lectura/escritura del bloque `<!-- mdteca:config -->`,
 * herencia y presets. Sin dependencias de Electron ni del DOM: lo usan renderer, main y pruebas.
 */

// ---------------------------------------------------------------------------------------------
// Esquema (versión 1). `looseObject` conserva las claves desconocidas (DOC-03).
// ---------------------------------------------------------------------------------------------

const align = z.enum(['left', 'center', 'right']);
const mm = z.number().min(0).max(500);

const BlockStyleSchema = z.looseObject({
  size: z.number().min(0.25).max(10).optional(),
  weight: z
    .union([
      z.literal(300),
      z.literal(400),
      z.literal(500),
      z.literal(600),
      z.literal(700),
      z.literal(800),
    ])
    .optional(),
  italic: z.boolean().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  spacingBefore: z.number().min(0).max(10).optional(),
  spacingAfter: z.number().min(0).max(10).optional(),
  uppercase: z.boolean().optional(),
  letterSpacing: z.number().min(-0.5).max(2).optional(),
  numbering: z.boolean().optional(),
  background: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  borderLeft: z.string().max(200).optional(),
});

export const STYLE_KEYS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'paragraph',
  'blockquote',
  'code',
  'table',
  'link',
] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];

export const DocumentConfigSchema = z.looseObject({
  version: z.literal(1),
  page: z
    .looseObject({
      size: z
        .union([
          z.enum(['A4', 'A5', 'Letter', 'Legal', 'B5']),
          z.object({ width: z.number().min(50).max(2000), height: z.number().min(50).max(2000) }),
        ])
        .optional(),
      orientation: z.enum(['portrait', 'landscape']).optional(),
      margins: z.object({ top: mm, right: mm, bottom: mm, left: mm }).optional(),
      header: z.looseObject({ text: z.string().optional(), align: align.optional() }).optional(),
      footer: z.looseObject({ text: z.string().optional(), align: align.optional() }).optional(),
      firstPageDifferent: z.boolean().optional(),
    })
    .optional(),
  view: z
    .looseObject({
      default: z.enum(['pages', 'continuous']).optional(),
      continuousWidth: z.number().min(320).max(2400).optional(),
    })
    .optional(),
  typography: z
    .looseObject({
      font: z.string().min(1).max(120).optional(),
      monoFont: z.string().min(1).max(120).optional(),
      size: z.number().min(6).max(48).optional(),
      lineHeight: z.number().min(1).max(3).optional(),
      paragraphSpacing: z.number().min(0).max(4).optional(),
      textAlign: z.enum(['left', 'justify']).optional(),
      hyphenate: z.boolean().optional(),
      language: z.string().max(35).optional(),
    })
    .optional(),
  styles: z
    .looseObject(Object.fromEntries(STYLE_KEYS.map((k) => [k, BlockStyleSchema.optional()])))
    .optional(),
  theme: z.string().max(60).optional(),
  images: z
    .looseObject({
      pasteMode: z.enum(['base64', 'file', 'ask']).optional(),
      maxWidth: z.number().min(16).max(8000).optional(),
    })
    .optional(),
});

export type DocumentConfig = z.infer<typeof DocumentConfigSchema>;
export type BlockStyle = z.infer<typeof BlockStyleSchema>;
type Json = Record<string, unknown>;

/** Orden canónico de claves (04 · DOC-04): el del esquema. Las desconocidas van al final. */
const ORDER: Record<string, string[]> = {
  '': ['version', 'page', 'view', 'typography', 'styles', 'theme', 'images'],
  page: ['size', 'orientation', 'margins', 'header', 'footer', 'firstPageDifferent'],
  'page.margins': ['top', 'right', 'bottom', 'left'],
  'page.size': ['width', 'height'],
  'page.header': ['text', 'align'],
  'page.footer': ['text', 'align'],
  view: ['default', 'continuousWidth'],
  typography: [
    'font',
    'monoFont',
    'size',
    'lineHeight',
    'paragraphSpacing',
    'textAlign',
    'hyphenate',
    'language',
  ],
  styles: [...STYLE_KEYS],
  images: ['pasteMode', 'maxWidth'],
};
const STYLE_ORDER = [
  'size',
  'weight',
  'italic',
  'color',
  'spacingBefore',
  'spacingAfter',
  'uppercase',
  'letterSpacing',
  'numbering',
  'background',
  'borderLeft',
];

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function orderKeys(value: unknown, path: string): unknown {
  if (!isObject(value)) return value;
  const known = path.startsWith('styles.') ? STYLE_ORDER : (ORDER[path] ?? []);
  const keys = Object.keys(value);
  const sorted = [...known.filter((k) => k in value), ...keys.filter((k) => !known.includes(k))];
  const out: Json = {};
  for (const k of sorted) out[k] = orderKeys(value[k], path ? `${path}.${k}` : k);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Lectura y escritura del bloque
// ---------------------------------------------------------------------------------------------

export const CONFIG_START = '<!-- mdteca:config';

export type ConfigStatus = 'none' | 'ok' | 'invalid';
export interface ReadConfig {
  status: ConfigStatus;
  /** Configuración válida (con las claves desconocidas), o null si no hay bloque o es inválido. */
  config: DocumentConfig | null;
  error?: string;
}

/** Interpreta el texto literal del bloque (de `<!-- mdteca:config` a `-->`). */
export function readConfigBlock(raw: string): ReadConfig {
  if (!raw.trim()) return { status: 'none', config: null };
  const start = raw.indexOf(CONFIG_START);
  const end = raw.lastIndexOf('-->');
  if (start < 0 || end < start) return { status: 'invalid', config: null, error: 'bloque abierto' };
  let json: unknown;
  try {
    json = JSON.parse(raw.slice(start + CONFIG_START.length, end));
  } catch (e) {
    return { status: 'invalid', config: null, error: (e as Error).message };
  }
  const parsed = DocumentConfigSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 'invalid',
      config: null,
      error: `${issue?.path.join('.') || 'raíz'}: ${issue?.message ?? ''}`,
    };
  }
  return { status: 'ok', config: parsed.data };
}

/**
 * Texto del bloque con indentación de 2 espacios y claves en orden canónico (DOC-04). La
 * secuencia `--` se escribe como `--` para no cerrar el comentario (DOC-03). `previousRaw`
 * aporta lo que sigue a `-->` (normalmente un salto de línea) para no tocar el final del archivo.
 */
export function writeConfigBlock(config: DocumentConfig, previousRaw = ''): string {
  const json = JSON.stringify(orderKeys(config, ''), null, 2).replace(/--/g, '-\\u002d');
  const end = previousRaw.lastIndexOf('-->');
  const suffix = end >= 0 ? previousRaw.slice(end + 3) : '\n';
  return `${CONFIG_START}\n${json}\n-->${suffix}`;
}

/** Une cuerpo y bloque garantizando una línea en blanco antes del bloque (DOC-01). */
export function joinConfig(body: string, configRaw: string, hadBlock: boolean): string {
  if (!configRaw) return hadBlock ? body.replace(/\n{2,}$/, '\n') : body;
  if (body === '' || body.endsWith('\n\n')) return body + configRaw;
  return body + (body.endsWith('\n') ? '\n' : '\n\n') + configRaw;
}

// ---------------------------------------------------------------------------------------------
// Fusión, herencia y poda
// ---------------------------------------------------------------------------------------------

/** Fusión profunda; un valor `undefined` en `over` elimina la clave. */
export function mergeDeep<T>(base: T, over: unknown): T {
  if (!isObject(over)) return (over === undefined ? base : over) as T;
  const out: Json = isObject(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete out[k];
    else out[k] = isObject(v) ? mergeDeep(out[k], v) : v;
  }
  return out as T;
}

function prune(value: unknown, inherited: unknown): unknown {
  if (!isObject(value))
    return JSON.stringify(value) === JSON.stringify(inherited) ? undefined : value;
  const out: Json = {};
  for (const [k, v] of Object.entries(value)) {
    const kept = prune(v, isObject(inherited) ? inherited[k] : undefined);
    if (kept !== undefined && !(isObject(kept) && Object.keys(kept).length === 0)) out[k] = kept;
  }
  return out;
}

/** Quita lo que coincide con lo heredado (DOC-04). `version` y las claves desconocidas se conservan. */
export function pruneToDiff(config: DocumentConfig, inherited: Json): DocumentConfig {
  const pruned = prune(config, inherited) as Json;
  return { ...pruned, version: 1 } as DocumentConfig;
}

/** ¿Queda algo más que `version`? Si no, el documento no necesita bloque. */
export const isEmptyConfig = (c: DocumentConfig): boolean =>
  Object.keys(c).filter((k) => k !== 'version').length === 0;

// ---------------------------------------------------------------------------------------------
// Valores de fábrica y presets
// ---------------------------------------------------------------------------------------------

export type Resolved = {
  typography: Required<NonNullable<DocumentConfig['typography']>>;
  styles: Record<
    StyleKey,
    Required<Pick<BlockStyle, 'size' | 'weight' | 'spacingBefore' | 'spacingAfter'>> & BlockStyle
  >;
  view: { default: 'pages' | 'continuous'; continuousWidth: number };
  page: NonNullable<DocumentConfig['page']>;
} & Omit<DocumentConfig, 'typography' | 'styles' | 'view' | 'page'>;

export const FACTORY: Json = {
  version: 1,
  page: {
    size: 'A4',
    orientation: 'portrait',
    margins: { top: 25, right: 25, bottom: 25, left: 25 },
    footer: { text: '{page}', align: 'center' },
    firstPageDifferent: false,
  },
  view: { default: 'pages', continuousWidth: 760 },
  typography: {
    font: 'Inter',
    monoFont: 'JetBrains Mono',
    size: 12,
    lineHeight: 1.625,
    paragraphSpacing: 0.75,
    textAlign: 'left',
    hyphenate: false,
    language: 'es',
  },
  styles: {
    h1: { size: 2, weight: 700, spacingBefore: 0, spacingAfter: 0.875 },
    h2: { size: 1.5, weight: 600, spacingBefore: 1.5, spacingAfter: 0.625 },
    h3: { size: 1.25, weight: 600, spacingBefore: 1.25, spacingAfter: 0.5 },
    h4: { size: 1.0625, weight: 600, spacingBefore: 1, spacingAfter: 0.5 },
    h5: { size: 1, weight: 600, spacingBefore: 1, spacingAfter: 0.5 },
    h6: { size: 1, weight: 500, italic: true, spacingBefore: 1, spacingAfter: 0.5 },
  },
  images: { pasteMode: 'ask' },
};

export interface Preset {
  id: string;
  /** Texto de miniatura y nombre (los nombres son propios, no se traducen). */
  name: string;
  config: Json;
}

const numbered = Object.fromEntries(
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((k) => [k, { numbering: true }]),
);

export const PRESETS: Preset[] = [
  {
    id: 'clasico',
    name: 'Clásico',
    config: {
      typography: {
        font: 'Source Serif 4',
        monoFont: 'JetBrains Mono',
        size: 12,
        lineHeight: 1.5,
        paragraphSpacing: 0.6,
        textAlign: 'justify',
      },
      styles: { h1: { size: 2.1, weight: 700 }, h2: { size: 1.5, weight: 600 } },
    },
  },
  {
    id: 'moderno',
    name: 'Moderno',
    config: {
      typography: { font: 'Inter', monoFont: 'JetBrains Mono', size: 11, lineHeight: 1.6 },
      styles: {
        h1: { size: 2.2, weight: 700 },
        h2: { size: 1.6, weight: 700 },
        h3: { weight: 700 },
      },
    },
  },
  {
    id: 'tecnico',
    name: 'Técnico',
    config: {
      typography: { font: 'IBM Plex Sans', monoFont: 'IBM Plex Mono', size: 11, lineHeight: 1.55 },
      styles: numbered,
    },
  },
  {
    id: 'academico',
    name: 'Académico',
    config: {
      typography: {
        font: 'Literata',
        monoFont: 'JetBrains Mono',
        size: 12,
        lineHeight: 1.6,
        paragraphSpacing: 0.8,
        textAlign: 'justify',
      },
      page: { margins: { top: 30, right: 30, bottom: 30, left: 30 } },
    },
  },
  {
    id: 'compacto',
    name: 'Compacto',
    config: {
      typography: {
        font: 'Source Sans 3',
        monoFont: 'JetBrains Mono',
        size: 10.5,
        lineHeight: 1.35,
        paragraphSpacing: 0.4,
      },
      styles: { h1: { size: 1.8 }, h2: { size: 1.35 }, h3: { size: 1.15 } },
    },
  },
];

export const presetById = (id: string | undefined): Preset | undefined =>
  PRESETS.find((p) => p.id === id);

/** Lo que hereda un documento: fábrica ← ajustes de la app ← preset (`theme`). */
export function inheritedConfig(app: Json | null | undefined, theme: string | undefined): Json {
  let out = mergeDeep(FACTORY, app ?? {});
  const preset = presetById(theme);
  if (preset) out = mergeDeep(out, preset.config);
  return out;
}

/** Configuración efectiva del documento: lo heredado ← el bloque. */
export function effectiveConfig(
  doc: DocumentConfig | null,
  app: Json | null | undefined,
): Resolved {
  const merged = mergeDeep(inheritedConfig(app, doc?.theme), doc ?? {});
  return merged as unknown as Resolved;
}

/** Dónde se define un valor (indicador de origen del panel Documento). */
export type Origin = 'document' | 'app' | 'default';

export function originOf(
  path: string[],
  doc: DocumentConfig | null,
  app: Json | null | undefined,
): Origin {
  const get = (root: unknown) =>
    path.reduce<unknown>((acc, k) => (isObject(acc) ? acc[k] : undefined), root);
  if (get(doc) !== undefined) return 'document';
  const preset = presetById(doc?.theme);
  if (preset && get(preset.config) !== undefined) return 'default';
  return get(app) !== undefined ? 'app' : 'default';
}

// ---------------------------------------------------------------------------------------------
// Fuentes (DOC-12, DOC-13)
// ---------------------------------------------------------------------------------------------

export type FontKind = 'sans' | 'serif' | 'mono';
export interface FontInfo {
  name: string;
  /** Familia CSS tal como la declara @fontsource. */
  css: string;
  kind: FontKind;
}

export const BUNDLED_FONTS: FontInfo[] = [
  { name: 'Inter', css: 'Inter Variable', kind: 'sans' },
  { name: 'Source Sans 3', css: 'Source Sans 3 Variable', kind: 'sans' },
  { name: 'IBM Plex Sans', css: 'IBM Plex Sans Variable', kind: 'sans' },
  { name: 'Source Serif 4', css: 'Source Serif 4 Variable', kind: 'serif' },
  { name: 'Literata', css: 'Literata Variable', kind: 'serif' },
  { name: 'Merriweather', css: 'Merriweather Variable', kind: 'serif' },
  { name: 'Lora', css: 'Lora Variable', kind: 'serif' },
  { name: 'IBM Plex Serif', css: 'IBM Plex Serif', kind: 'serif' },
  { name: 'JetBrains Mono', css: 'JetBrains Mono Variable', kind: 'mono' },
  { name: 'IBM Plex Mono', css: 'IBM Plex Mono', kind: 'mono' },
];

const GENERIC: Record<FontKind, string> = {
  sans: 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  mono: "ui-monospace, 'Cascadia Code', Consolas, monospace",
};
const FALLBACK: Record<FontKind, string> = {
  sans: 'Inter',
  serif: 'Source Serif 4',
  mono: 'JetBrains Mono',
};

/** Clase de una fuente: la de las incluidas o, para una del sistema, una estimación por el nombre. */
export function fontKind(name: string, mono = false): FontKind {
  if (mono) return 'mono';
  const own = BUNDLED_FONTS.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (own) return own.kind;
  if (/mono|code|courier|consolas/i.test(name)) return 'mono';
  return /serif|times|georgia|garamond|palatino|cambria|book|minion|caslon/i.test(name) &&
    !/sans/i.test(name)
    ? 'serif'
    : 'sans';
}

export const bundledFont = (name: string): FontInfo | undefined =>
  BUNDLED_FONTS.find((f) => f.name.toLowerCase() === name.toLowerCase());

/**
 * Pila CSS para una fuente. Si es del sistema se intenta primero por su nombre y, si no existe en
 * la máquina, cae a la incluida más parecida (DOC-13) sin tocar el archivo.
 */
export function fontStack(name: string, kind: FontKind): string {
  const own = bundledFont(name);
  const quote = (s: string) => `'${s.replace(/'/g, '')}'`;
  const fallback = bundledFont(FALLBACK[kind])!;
  const parts = own ? [quote(own.css), quote(fallback.css)] : [quote(name), quote(fallback.css)];
  return `${parts.join(', ')}, ${GENERIC[kind]}`;
}

// ---------------------------------------------------------------------------------------------
// Edición: aplicar un cambio del usuario al bloque
// ---------------------------------------------------------------------------------------------

/** Valores compuestos que se escriben y se comparan enteros (no por claves sueltas). */
const ATOMIC = new Set(['margins', 'size']);

function settle(node: Json, patch: Json, inherited: unknown): void {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const inh = isObject(inherited) ? inherited[k] : undefined;
    if (isObject(v) && !ATOMIC.has(k)) {
      const child = node[k];
      if (!isObject(child)) continue;
      settle(child, v, inh);
      if (Object.keys(child).length === 0) delete node[k];
    } else if (JSON.stringify(v) === JSON.stringify(inh)) {
      delete node[k];
    }
  }
}

/**
 * Aplica `patch` (un `undefined` borra la clave, es «volver al heredado») sobre la configuración
 * del documento. Los valores que el parche deja iguales a lo heredado se omiten (DOC-04); el
 * resto del bloque, claves desconocidas incluidas, no se toca.
 */
export function applyPatch(
  base: DocumentConfig | null,
  patch: Json,
  inherited: (theme: string | undefined) => Json,
): DocumentConfig {
  const next = mergeDeep<Json>({ version: 1, ...(base ?? {}) }, patch);
  settle(next, patch, inherited(next['theme'] as string | undefined));
  return { ...next, version: 1 } as DocumentConfig;
}
