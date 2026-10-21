import { describe, expect, it } from 'vitest';
import '@renderer/commands/builtin';
import { listCommands } from '@renderer/commands/registry';
import { es } from '@renderer/i18n/es';
import { en } from '@renderer/i18n/en';

const lookup = (dict: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], dict);

describe('registro de comandos', () => {
  it('[UI-01] todo comando tiene ícono', () => {
    for (const cmd of listCommands()) expect(cmd.icon, cmd.id).toBeTruthy();
  });

  it('[UI-16] todo comando tiene traducción en es y en', () => {
    for (const cmd of listCommands()) {
      const key = cmd.labelKey.replace(/^commands\./, '');
      expect((es.commands as Record<string, string>)[key], `es:${cmd.id}`).toBeTruthy();
      expect((en.commands as Record<string, string>)[key], `en:${cmd.id}`).toBeTruthy();
    }
  });

  it('[UI-01] ids únicos', () => {
    const ids = listCommands().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('i18n', () => {
  it('[UI-16] es y en tienen las mismas claves', () => {
    const keys = (o: unknown, p = ''): string[] =>
      Object.entries(o as object).flatMap(([k, v]) =>
        typeof v === 'string' ? [p + k] : keys(v, `${p}${k}.`),
      );
    expect(keys(en).sort()).toEqual(keys(es).sort());
    expect(lookup(en, 'ribbon.file')).toBe('File');
  });
});

describe('bloque de código → párrafo', () => {
  it('[ED-22] quitar el bloque de código conserva las líneas como párrafos', async () => {
    const { EditorState, TextSelection } = await import('prosemirror-state');
    const { docFromSource, sourceFromDoc } = await import('@renderer/editor/model/doc');
    const { toggleCodeBlock } = await import('@renderer/editor/wysiwyg/commands');
    const doc = docFromSource('```\nLínea 1\nLínea 2\nLínea 3\n```\n');
    let state = EditorState.create({ doc });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)));
    let next = state;
    expect(toggleCodeBlock(state, (tr) => (next = state.apply(tr)))).toBe(true);
    expect(next.doc.childCount).toBe(3);
    expect(sourceFromDoc(next.doc)).toBe('Línea 1\n\nLínea 2\n\nLínea 3\n');
  });
});
