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

export function findByShortcut(e: KeyboardEvent): Command | undefined {
  return listCommands().find(
    (c) => !c.native && [c.shortcut, ...(c.aliases ?? [])].some((s) => s && matchesShortcut(e, s)),
  );
}
