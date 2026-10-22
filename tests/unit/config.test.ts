import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  applyPatch,
  DocumentConfigSchema,
  effectiveConfig,
  fontStack,
  inheritedConfig,
  isEmptyConfig,
  joinConfig,
  mergeDeep,
  originOf,
  PRESETS,
  pruneToDiff,
  readConfigBlock,
  writeConfigBlock,
  type DocumentConfig,
} from '../../src/shared/document-config';
import { splitConfigBlock } from '../../src/renderer/editor/model/text-format';

const BLOCK = `<!-- mdteca:config
{
  "version": 1,
  "typography": {
    "font": "Lora",
    "size": 11
  },
  "x-futuro": {
    "a": [
      1,
      2
    ]
  }
}
-->
`;

const read = (raw: string) => readConfigBlock(raw).config!;

describe('[DOC-03] lectura del bloque', () => {
  it('lee un bloque válido', () => {
    const r = readConfigBlock(BLOCK);
    expect(r.status).toBe('ok');
    expect(r.config?.typography?.font).toBe('Lora');
  });

  it('sin bloque → none', () => {
    expect(readConfigBlock('').status).toBe('none');
  });

  it('JSON inválido → se ignora y se avisa', () => {
    const r = readConfigBlock('<!-- mdteca:config\n{ roto\n-->\n');
    expect(r.status).toBe('invalid');
    expect(r.config).toBeNull();
    expect(r.error).toBeTruthy();
  });

  it('valores fuera del esquema → inválido', () => {
    expect(
      readConfigBlock('<!-- mdteca:config\n{"version":1,"typography":{"size":999}}\n-->\n').status,
    ).toBe('invalid');
    expect(readConfigBlock('<!-- mdteca:config\n{"version":2}\n-->\n').status).toBe('invalid');
  });

  it('se busca el último bloque al final y solo ahí', () => {
    const text = `uno\n\n${BLOCK}`;
    expect(splitConfigBlock(text).configRaw).toBe(BLOCK);
    const middle = `uno\n\n${BLOCK}\ndespués\n`;
    expect(splitConfigBlock(middle).configRaw).toBe('');
  });
});

describe('[DOC-03][DOC-04] escritura', () => {
  it('conserva claves desconocidas al reescribir', () => {
    const cfg = mergeDeep(read(BLOCK), { typography: { size: 12 } });
    const out = writeConfigBlock(cfg, BLOCK);
    expect(out).toContain('"x-futuro"');
    expect(readConfigBlock(out).config).toMatchObject({ 'x-futuro': { a: [1, 2] } });
  });

  it('cambiar el tamaño modifica una sola línea del bloque', () => {
    const cfg = mergeDeep(read(BLOCK), { typography: { size: 14 } });
    const out = writeConfigBlock(cfg, BLOCK);
    const before = BLOCK.split('\n');
    const after = out.split('\n');
    expect(after.length).toBe(before.length);
    const changed = after.filter((l, i) => l !== before[i]);
    expect(changed).toEqual(['    "size": 14']);
  });

  it('orden canónico, 2 espacios y claves desconocidas al final', () => {
    const cfg = {
      'x-extra': 1,
      theme: 'clasico',
      typography: { size: 12, font: 'Lora' },
      version: 1,
    } as unknown as DocumentConfig;
    const out = writeConfigBlock(cfg);
    expect(out).toBe(
      '<!-- mdteca:config\n{\n  "version": 1,\n  "typography": {\n    "font": "Lora",\n    "size": 12\n  },\n  "theme": "clasico",\n  "x-extra": 1\n}\n-->\n',
    );
  });

  it('escapa la secuencia -- para no cerrar el comentario', () => {
    const cfg = { version: 1, page: { header: { text: 'a -- b --> c' } } } as DocumentConfig;
    const out = writeConfigBlock(cfg);
    const body = out.slice(out.indexOf('{'), out.lastIndexOf('-->'));
    expect(body).not.toContain('--');
    expect(read(out).page?.header?.text).toBe('a -- b --> c');
  });

  it('solo guarda las claves que difieren de lo heredado', () => {
    const inherited = inheritedConfig(null, undefined);
    const cfg = pruneToDiff(
      { version: 1, typography: { font: 'Inter', size: 14 } } as DocumentConfig,
      inherited,
    );
    expect(cfg).toEqual({ version: 1, typography: { size: 14 } });
    expect(
      isEmptyConfig(
        pruneToDiff({ version: 1, typography: { size: 12 } } as DocumentConfig, inherited),
      ),
    ).toBe(true);
  });

  it('un documento sin cambios de configuración no recibe bloque', () => {
    expect(joinConfig('hola\n', '', false)).toBe('hola\n');
  });

  it('el bloque nuevo queda precedido de una línea en blanco', () => {
    expect(joinConfig('hola\n', 'B', false)).toBe('hola\n\nB');
    expect(joinConfig('hola', 'B', false)).toBe('hola\n\nB');
    expect(joinConfig('hola\n\n', 'B', true)).toBe('hola\n\nB');
  });

  it('restablecer elimina el bloque y la línea en blanco que lo precedía', () => {
    expect(joinConfig('hola\n\n', '', true)).toBe('hola\n');
  });
});

describe('herencia (04)', () => {
  it('fábrica ← app ← preset ← documento', () => {
    const app = { typography: { size: 13 } };
    const eff = effectiveConfig({ version: 1, theme: 'clasico', typography: { size: 9 } }, app);
    expect(eff.typography.size).toBe(9); // documento
    expect(eff.typography.font).toBe('Source Serif 4'); // preset
    expect(eff.typography.language).toBe('es'); // fábrica
    expect(effectiveConfig(null, app).typography.size).toBe(13); // app
  });

  it('indica el origen de cada valor', () => {
    const doc = { version: 1, typography: { size: 9 } } as DocumentConfig;
    const app = { typography: { lineHeight: 1.4 } };
    expect(originOf(['typography', 'size'], doc, app)).toBe('document');
    expect(originOf(['typography', 'lineHeight'], doc, app)).toBe('app');
    expect(originOf(['typography', 'font'], doc, app)).toBe('default');
  });

  it('los presets son configuraciones válidas', () => {
    for (const p of PRESETS) {
      expect(DocumentConfigSchema.safeParse({ version: 1, ...p.config }).success, p.id).toBe(true);
    }
  });
});

describe('[DOC-13] fuentes', () => {
  it('una fuente ausente cae a la incluida más parecida', () => {
    expect(fontStack('Fuente Rara', 'serif')).toContain("'Source Serif 4 Variable'");
    expect(fontStack('Fuente Rara', 'mono')).toContain("'JetBrains Mono Variable'");
    expect(fontStack('Lora', 'serif').startsWith("'Lora Variable'")).toBe(true);
  });
});

describe('JSON Schema publicado', () => {
  it('specs/schemas/document-config.schema.json está al día', () => {
    const schema = z.toJSONSchema(DocumentConfigSchema, { io: 'input' });
    const text = `${JSON.stringify({ $id: 'https://mdteca.app/schemas/document-config.schema.json', title: 'DocumentConfig', ...schema }, null, 2)}\n`;
    const file = resolve(__dirname, '../../specs/schemas/document-config.schema.json');
    if (process.env['UPDATE_SCHEMA'] === '1' || !existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
    expect(readFileSync(file, 'utf8')).toBe(text);
  });
});

describe('[DOC-04] applyPatch', () => {
  const inh = (theme: string | undefined) => inheritedConfig(null, theme);

  it('un valor distinto de lo heredado se escribe y uno igual se omite', () => {
    const a = applyPatch(null, { typography: { size: 14 } }, inh);
    expect(a).toEqual({ version: 1, typography: { size: 14 } });
    const b = applyPatch(a, { typography: { size: 12 } }, inh);
    expect(isEmptyConfig(b)).toBe(true);
  });

  it('undefined vuelve al valor heredado y conserva lo demás', () => {
    const base = read(BLOCK);
    const out = applyPatch(base, { typography: { size: undefined } }, inh);
    expect(out.typography).toEqual({ font: 'Lora' });
    expect(out).toMatchObject({ 'x-futuro': { a: [1, 2] } });
  });

  it('un preset define lo heredado: lo igual al preset no se escribe', () => {
    const out = applyPatch(null, { theme: 'clasico', typography: { font: 'Source Serif 4' } }, inh);
    expect(out).toEqual({ version: 1, theme: 'clasico' });
  });

  it('fijar todo no se deshace al editar otro valor', () => {
    const pinned = { version: 1, typography: { font: 'Inter', size: 12 } } as DocumentConfig;
    const out = applyPatch(pinned, { typography: { lineHeight: 2 } }, inh);
    expect(out.typography).toEqual({ font: 'Inter', size: 12, lineHeight: 2 });
  });
});
