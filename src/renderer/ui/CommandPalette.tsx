import { Command as CommandIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatShortcut, listCommands, shortcutOf, type Command } from '../commands/registry';
import { useDocs } from '../documents/store';
import { Icon } from './Icon';
import { Modal } from './Modal';

/** ¿Se puede ejecutar ahora? Misma regla que los atajos y los botones. */
const enabled = (cmd: Command): boolean =>
  (cmd.global || useDocs.getState().activeId !== null) && (cmd.when ? cmd.when() : true);

/** Paleta de comandos (`Ctrl+Shift+P`): todos los comandos con su ícono y atajo. */
export function CommandPalette({ finish }: { finish: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listCommands()
      .map((cmd) => ({ cmd, name: t(cmd.labelKey), ok: enabled(cmd) }))
      .filter((r) => !needle || r.name.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || a.name.localeCompare(b.name));
  }, [query, t]);
  const run = (i: number) => {
    const row = rows[i];
    if (!row?.ok) return;
    finish();
    // Tras cerrar el diálogo el foco vuelve al editor y entonces se ejecuta.
    setTimeout(() => row.cmd.run(), 0);
  };
  return (
    <Modal title={t('palette.title')} icon={CommandIcon} testId="dialog-palette" onCancel={finish}>
      <input
        className="quick-input"
        autoFocus
        data-testid="palette-input"
        placeholder={t('palette.placeholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex(Math.min(rows.length - 1, index + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex(Math.max(0, index - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(index);
          }
          e.stopPropagation();
        }}
      />
      <div className="quick-list palette-list" role="listbox">
        {rows.length === 0 && <div className="panel-empty">{t('palette.none')}</div>}
        {rows.map((r, i) => {
          const shortcut = shortcutOf(r.cmd);
          return (
            <button
              key={r.cmd.id}
              role="option"
              aria-selected={i === index}
              aria-disabled={!r.ok}
              className={`quick-row${i === index ? ' active' : ''}${r.ok ? '' : ' disabled'}`}
              data-testid="palette-row"
              data-command={r.cmd.id}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(i)}
            >
              <Icon icon={r.cmd.icon} size={16} />
              <span className="quick-title">{r.name}</span>
              {shortcut && <kbd>{formatShortcut(shortcut)}</kbd>}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
