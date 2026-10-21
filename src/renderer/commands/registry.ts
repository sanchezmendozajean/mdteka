import type { LucideIcon } from 'lucide-react';

/** Comando central: de él se alimentan cinta, menús, paleta y atajos (UI-01). */
export interface Command {
  id: string;
  /** Clave i18n (`commands.<id>`). */
  labelKey: string;
  icon: LucideIcon;
  /** Atajo con formato `Ctrl+Shift+B`. */
  shortcut?: string;
  when?: () => boolean;
  run: () => void;
}

const commands = new Map<string, Command>();

export function registerCommand(cmd: Omit<Command, 'labelKey'> & { labelKey?: string }): void {
  if (commands.has(cmd.id)) throw new Error(`Comando duplicado: ${cmd.id}`);
  commands.set(cmd.id, { ...cmd, labelKey: cmd.labelKey ?? `commands.${cmd.id}` });
}

export const getCommand = (id: string): Command | undefined => commands.get(id);
export const listCommands = (): Command[] => [...commands.values()];
