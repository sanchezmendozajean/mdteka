import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { docFromSource, sourceFromDoc } from '@renderer/editor/model/doc';
import { applyFormat, detectFormat, splitConfigBlock } from '@renderer/editor/model/text-format';

const DIR = join(process.cwd(), 'tests/fixtures/roundtrip');

function fixtures(dir = DIR): { name: string; raw: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? fixtures(join(dir, e.name)).map((f) => ({ ...f, name: `${e.name}/${f.name}` }))
      : e.name.endsWith('.md')
        ? [{ name: e.name, raw: readFileSync(join(dir, e.name), 'utf8') }]
        : [],
  );
}

/** Ciclo completo de archivo: bytes → modelo interno → bytes. */
function roundTrip(raw: string): string {
  const fmt = detectFormat(raw);
  const { body, configRaw } = splitConfigBlock(fmt.text);
  const doc = docFromSource(body);
  return applyFormat(sourceFromDoc(doc) + configRaw, fmt.eol, fmt.bom);
}

describe('round-trip byte-idéntico', () => {
  const all = fixtures();
  it('el corpus no está vacío e incluye CommonMark, GFM, CRLF, BOM y documento largo', () => {
    const names = all.map((f) => f.name);
    expect(names.filter((n) => n.startsWith('commonmark/')).length).toBeGreaterThan(600);
    expect(names).toEqual(
      expect.arrayContaining(['crlf.md', 'bom.md', 'long-document.md', 'gfm-tables.md']),
    );
  });

  for (const { name, raw } of all) {
    it(`[ED-20] guarda byte-idéntico sin cambios: ${name}`, () => {
      expect(roundTrip(raw)).toBe(raw);
    });
  }

  it('[ED-20] el documento largo equivale a más de 50 páginas', () => {
    const long = all.find((f) => f.name === 'long-document.md')!.raw;
    expect(long.split(/\s+/).length / 500).toBeGreaterThan(50);
  });

  it('[ED-20] CRLF y BOM se detectan y se respetan', () => {
    const crlf = detectFormat(all.find((f) => f.name === 'crlf.md')!.raw);
    expect(crlf.eol).toBe('\r\n');
    expect(crlf.text).not.toContain('\r');
    const bom = detectFormat(all.find((f) => f.name === 'bom.md')!.raw);
    expect(bom.bom).toBe(true);
  });

  it('[DOC-03] el bloque de configuración se aparta del cuerpo y se conserva idéntico', () => {
    const raw = all.find((f) => f.name === 'config-block.md')!.raw;
    const { body, configRaw } = splitConfigBlock(raw);
    expect(body).not.toContain('mdtor:config');
    expect(configRaw.startsWith('<!-- mdtor:config')).toBe(true);
    expect(body + configRaw).toBe(raw);
  });
});
