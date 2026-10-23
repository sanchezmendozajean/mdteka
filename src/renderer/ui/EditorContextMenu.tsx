import { BookPlus, SpellCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCommand } from '../commands/registry';
import { ContextMenu, type MenuItem } from './ContextMenu';

interface ContextPayload {
  x: number;
  y: number;
  misspelledWord: string;
  suggestions: string[];
  hasSelection: boolean;
}

/**
 * Menú contextual propio del editor (03), con las sugerencias del corrector. El proceso principal
 * avisa del clic derecho (con las sugerencias de Chromium) y aquí se dibuja el menú con íconos.
 */
export function EditorContextMenu() {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  useEffect(() => {
    return window.mdteca.on('editor:contextMenu', (raw) => {
      const p = raw as ContextPayload;
      const target = document.elementFromPoint(p.x, p.y);
      // Solo dentro de los editores: el resto de la interfaz tiene sus propios menús.
      if (!target?.closest('.ProseMirror, .cm-editor')) return;
      const command = (id: string, extra: Partial<MenuItem> = {}): MenuItem[] => {
        const c = getCommand(id);
        return c ? [{ id, label: t(c.labelKey), icon: c.icon, run: () => c.run(), ...extra }] : [];
      };
      const spelling: MenuItem[] = p.misspelledWord
        ? [
            ...p.suggestions.slice(0, 5).map((word): MenuItem => ({
              id: `spell-${word}`,
              label: word,
              icon: SpellCheck,
              run: () => void window.mdteca.spell.replace(word),
            })),
            {
              id: 'spell-add',
              label: t('editor.addToDictionary', { word: p.misspelledWord }),
              icon: BookPlus,
              run: () => void window.mdteca.spell.addWord(p.misspelledWord),
            },
          ]
        : [];
      setMenu({
        x: p.x,
        y: p.y,
        items: [
          ...spelling,
          ...command('clipboard.cut', { hidden: !p.hasSelection, separator: spelling.length > 0 }),
          ...command('clipboard.copy', { hidden: !p.hasSelection }),
          ...command('clipboard.paste', { separator: !p.hasSelection && spelling.length > 0 }),
          ...command('clipboard.pastePlain'),
          ...command('format.bold', { separator: true }),
          ...command('format.italic'),
          ...command('format.code'),
          ...command('format.link'),
        ],
      });
    });
  }, [t]);

  if (!menu) return null;
  return <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />;
}
