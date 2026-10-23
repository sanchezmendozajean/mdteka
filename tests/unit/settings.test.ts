import { describe, expect, it } from 'vitest';
import '@renderer/commands/builtin';
import {
  conflictFor,
  listCommands,
  setShortcutOverrides,
  shortcutFromEvent,
  shortcutOf,
} from '@renderer/commands/registry';
import { mergeSettings, SettingsSchema } from '@shared/settings';

const defaults = () => SettingsSchema.parse({});
const key = (code: string, key: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
  }) as KeyboardEvent;

describe('[CFG-02] ajustes de la app', () => {
  it('todo tiene un valor de fábrica', () => {
    const s = defaults();
    expect(s.general.language).toBe('es');
    expect(s.appearance).toMatchObject({
      theme: 'light',
      density: 'comfortable',
      lightSheetInDark: true,
    });
    expect(s.editor.autosave).toEqual({ mode: 'off', seconds: 60 });
    expect(s.files.newEol).toBe('lf');
    expect(s.shortcuts).toEqual({});
  });

  it('un archivo antiguo con solo documentDefaults sigue siendo válido', () => {
    const s = SettingsSchema.parse({ documentDefaults: { typography: { size: 12 } } });
    expect(s.documentDefaults).toEqual({ typography: { size: 12 } });
    expect(s.general.language).toBe('es');
  });

  it('un parche funde los objetos y deja intacto el resto', () => {
    const s = mergeSettings(defaults(), { appearance: { theme: 'dark' } });
    expect(s.appearance.theme).toBe('dark');
    expect(s.appearance.accent).toBe('teal');
    expect(s.editor.autosave.mode).toBe('off');
    const t = mergeSettings(s, { editor: { autosave: { mode: 'interval' } } });
    expect(t.editor.autosave).toEqual({ mode: 'interval', seconds: 60 });
  });

  it('los atajos y los valores por defecto del documento se sustituyen enteros', () => {
    const a = mergeSettings(defaults(), {
      shortcuts: { 'format.bold': 'Ctrl+Alt+B', x: 'Ctrl+K' },
    });
    const b = mergeSettings(a, { shortcuts: { 'format.italic': '' } });
    expect(b.shortcuts).toEqual({ 'format.italic': '' });
    const c = mergeSettings(defaults(), { documentDefaults: { theme: 'tecnico' } });
    expect(mergeSettings(c, { documentDefaults: {} }).documentDefaults).toEqual({});
  });

  it('rechaza valores fuera de rango o de tipo', () => {
    expect(() => mergeSettings(defaults(), { appearance: { theme: 'neon' } })).toThrow();
    expect(() => mergeSettings(defaults(), { appearance: { uiScale: 3 } })).toThrow();
    expect(() => mergeSettings(defaults(), { editor: { autosave: { seconds: 1 } } })).toThrow();
  });
});

describe('atajos editables', () => {
  it('shortcutFromEvent normaliza la combinación y descarta los modificadores solos', () => {
    expect(shortcutFromEvent(key('KeyK', 'k', { ctrlKey: true, shiftKey: true }))).toBe(
      'Ctrl+Shift+K',
    );
    expect(shortcutFromEvent(key('Digit3', '3', { ctrlKey: true, altKey: true }))).toBe(
      'Ctrl+Alt+3',
    );
    expect(shortcutFromEvent(key('F11', 'F11'))).toBe('F11');
    expect(shortcutFromEvent(key('ControlLeft', 'Control', { ctrlKey: true }))).toBeNull();
  });

  it('un atajo reasignado sustituye al de fábrica y sus alternativos', () => {
    const bold = listCommands().find((c) => c.id === 'format.bold')!;
    expect(shortcutOf(bold)).toBe('Ctrl+B');
    setShortcutOverrides({ 'format.bold': 'Ctrl+Alt+B', 'format.italic': '' });
    expect(shortcutOf(bold)).toBe('Ctrl+Alt+B');
    expect(shortcutOf(listCommands().find((c) => c.id === 'format.italic')!)).toBeUndefined();
    setShortcutOverrides({});
    expect(shortcutOf(bold)).toBe('Ctrl+B');
  });

  it('detecta conflictos con otros comandos, sin importar el orden de los modificadores', () => {
    setShortcutOverrides({});
    expect(conflictFor('Ctrl+B', 'format.italic')?.id).toBe('format.bold');
    expect(conflictFor('Shift+Ctrl+X', 'format.bold')?.id).toBe('format.strike');
    expect(conflictFor('Ctrl+B', 'format.bold')).toBeUndefined();
    expect(conflictFor('Ctrl+Alt+Shift+Q', 'format.bold')).toBeUndefined();
  });

  it('los atajos de fábrica no chocan entre sí', () => {
    setShortcutOverrides({});
    const seen = new Map<string, string>();
    for (const c of listCommands()) {
      for (const s of [c.shortcut, ...(c.aliases ?? [])]) {
        if (!s) continue;
        const k = s.toLowerCase().split('+').sort().join('+');
        expect(seen.get(k), `${s}: ${c.id} y ${seen.get(k)}`).toBeUndefined();
        seen.set(k, c.id);
      }
    }
  });
});
