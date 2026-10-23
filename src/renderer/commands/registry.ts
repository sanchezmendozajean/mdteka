import type { LucideIcon } from 'lucide-react';
import type { FormatState } from '../editor/wysiwyg/commands';

/** Comando central: de él se alimentan cinta, menús, paleta y atajos (UI-01). */
export interface Command {
  id: string;
  /** Clave i18n (`commands.<id>`). */
  labelKey: string;
  icon: LucideIcon;
  /** Atajo con formato `Ctrl+Shift+B`. */
  shortcut?: string;
  /** Atajos alternativos (por ejemplo `Ctrl+Shift+=` para «Ctrl +»). */
  aliases?: string[];
  /** El atajo lo gestiona el navegador o el editor (copiar, pegar, deshacer…): solo se muestra. */
  native?: boolean;
  /** Requiere un documento abierto (por defecto sí, salvo `global`). */
  global?: boolean;
  /** Se puede ejecutar con el foco en un campo de texto de la interfaz (búsqueda, diálogos). */
  inFields?: boolean;
  /** Condición adicional para estar disponible. */
  when?: () => boolean;
  /** Estado «pulsado» del botón según la selección. */
  active?: (format: FormatState) => boolean;
  run: () => void;
}

const commands = new Map<string, Command>();

export function registerCommand(cmd: Omit<Command, 'labelKey'> & { labelKey?: string }): void {
  if (commands.has(cmd.id)) throw new Error(`Comando duplicado: ${cmd.id}`);
  commands.set(cmd.id, { ...cmd, labelKey: cmd.labelKey ?? `commands.${cmd.id}` });
}

export const getCommand = (id: string): Command | undefined => commands.get(id);
export const listCommands = (): Command[] => [...commands.values()];

// ---------------------------------------------------------------------------------------------
// Atajos
// ---------------------------------------------------------------------------------------------

const CODE_KEYS: Record<string, string> = {
  Period: '.',
  Comma: ',',
  Slash: '/',
  Equal: '=',
  Minus: '-',
  Enter: 'enter',
  Tab: 'tab',
  F1: 'f1',
  F11: 'f11',
};

/** Tecla física normalizada, independiente de la distribución del teclado y de Shift. */
function eventKey(e: KeyboardEvent): string {
  if (e.code.startsWith('Digit')) return e.code.slice(5);
  if (e.code.startsWith('Key')) return e.code.slice(3).toLowerCase();
  return CODE_KEYS[e.code] ?? e.key.toLowerCase();
}

export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1]!;
  const mods = new Set(parts.slice(0, -1));
  return (
    (e.ctrlKey || e.metaKey) === mods.has('ctrl') &&
    e.shiftKey === mods.has('shift') &&
    e.altKey === mods.has('alt') &&
    eventKey(e) === key
  );
}

// ---------------------------------------------------------------------------------------------
// Atajos reasignados por el usuario (Ajustes › Atajos)
// ---------------------------------------------------------------------------------------------

let overrides: Record<string, string> = {};

/** Fija los atajos reasignados: id de comando → atajo (`''` = sin atajo). */
export function setShortcutOverrides(map: Record<string, string>): void {
  overrides = map;
}

/** Atajo vigente de un comando: el reasignado o el de fábrica. */
export function shortcutOf(cmd: Command): string | undefined {
  return cmd.id in overrides ? overrides[cmd.id] || undefined : cmd.shortcut;
}

/** Atajos con los que se dispara un comando (los alternativos se pierden al reasignar). */
const shortcutsOf = (cmd: Command): string[] =>
  cmd.id in overrides ? [overrides[cmd.id] ?? ''] : [cmd.shortcut ?? '', ...(cmd.aliases ?? [])];

export function findByShortcut(e: KeyboardEvent): Command | undefined {
  return listCommands().find(
    (c) => !c.native && shortcutsOf(c).some((s) => s && matchesShortcut(e, s)),
  );
}

const canon = (s: string) =>
  s
    .toLowerCase()
    .split('+')
    .map((p) => p.trim());

/** Comando que ya usa ese atajo (distinto de `exceptId`), para avisar de conflictos al reasignar. */
export function conflictFor(shortcut: string, exceptId: string): Command | undefined {
  const want = canon(shortcut);
  const same = (s: string) => {
    const parts = canon(s);
    return (
      parts[parts.length - 1] === want[want.length - 1] &&
      [...parts.slice(0, -1)].sort().join() === [...want.slice(0, -1)].sort().join()
    );
  };
  return listCommands().find((c) => c.id !== exceptId && shortcutsOf(c).some((s) => s && same(s)));
}

/** Texto de un atajo en la plataforma actual (`Ctrl` es `Cmd` en macOS). */
export function formatShortcut(shortcut: string): string {
  return navigator.platform.startsWith('Mac')
    ? shortcut.replace(/Ctrl/g, 'Cmd').replace(/Alt/g, 'Option')
    : shortcut;
}

/** Atajo normalizado a partir de un evento de teclado (`Ctrl+Shift+K`), o null si solo hay modificadores. */
export function shortcutFromEvent(e: KeyboardEvent): string | null {
  const key = eventKey(e);
  if (['control', 'shift', 'alt', 'meta', 'dead', 'unidentified'].includes(key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const pretty = key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1);
  parts.push(pretty);
  return parts.join('+');
}
