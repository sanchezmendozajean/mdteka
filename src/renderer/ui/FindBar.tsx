import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Regex,
  Replace,
  ReplaceAll,
  Search,
  WholeWord,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocs } from '../documents/store';
import { editor } from '../editor/controller';
import { useFind } from '../editor/find-store';
import { Icon } from './Icon';

function Toggle({
  icon,
  label,
  pressed,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  pressed?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      className="btn"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onClick}
    >
      <Icon icon={icon} size={16} />
    </button>
  );
}

/** Barra de búsqueda y reemplazo, común a los dos modos de edición. */
export function FindBar() {
  const { t } = useTranslation();
  const { open, showReplace, opts, replace, info, focusTick, set } = useFind();
  const activeId = useDocs((s) => s.activeId);
  const mode = useDocs((s) => s.docs.find((d) => d.id === s.activeId)?.mode);
  const input = useRef<HTMLInputElement>(null);

  // Enfocar al pedir Ctrl+F / Ctrl+H.
  useEffect(() => {
    if (open) {
      input.current?.focus();
      input.current?.select();
    }
  }, [open, focusTick]);

  // Recalcular al cambiar la consulta, el modo o el documento.
  useEffect(() => {
    set({ info: editor.find(open ? opts : null, replace) });
  }, [open, opts, replace, mode, activeId, set]);

  if (!open || !activeId) return null;

  const close = () => {
    set({ open: false });
    editor.find(null);
    editor.focus();
  };
  const step = (direction: 1 | -1) => set({ info: editor.findStep(opts, direction) });
  const status = info.invalid
    ? t('find.invalidRegex')
    : opts.query
      ? info.count
        ? t('find.count', { current: info.current + 1, count: info.count })
        : t('find.noResults')
      : '';

  return (
    <div className="find-bar" role="search" data-testid="find-bar">
      <div className="find-row">
        <Icon icon={Search} size={16} />
        <input
          ref={input}
          className="find-input"
          value={opts.query}
          placeholder={t('find.find')}
          aria-label={t('find.find')}
          data-testid="find-input"
          aria-invalid={info.invalid}
          onChange={(e) => set({ opts: { ...opts, query: e.target.value } })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
        />
        <span className="find-status" data-testid="find-status" aria-live="polite">
          {status}
        </span>
        <Toggle
          icon={ChevronUp}
          label={t('find.previous')}
          onClick={() => step(-1)}
          testId="find-prev"
        />
        <Toggle
          icon={ChevronDown}
          label={t('find.next')}
          onClick={() => step(1)}
          testId="find-next"
        />
        <Toggle
          icon={CaseSensitive}
          label={t('find.matchCase')}
          pressed={opts.caseSensitive}
          onClick={() => set({ opts: { ...opts, caseSensitive: !opts.caseSensitive } })}
        />
        <Toggle
          icon={WholeWord}
          label={t('find.wholeWord')}
          pressed={opts.wholeWord}
          onClick={() => set({ opts: { ...opts, wholeWord: !opts.wholeWord } })}
        />
        <Toggle
          icon={Regex}
          label={t('find.regex')}
          pressed={opts.regex}
          onClick={() => set({ opts: { ...opts, regex: !opts.regex } })}
        />
        <Toggle
          icon={Replace}
          label={t('find.toggleReplace')}
          pressed={showReplace}
          onClick={() => set({ showReplace: !showReplace })}
        />
        <Toggle icon={X} label={t('find.close')} onClick={close} testId="find-close" />
      </div>
      {showReplace && (
        <div className="find-row">
          <Icon icon={Replace} size={16} />
          <input
            className="find-input"
            value={replace}
            placeholder={t('find.replaceWith')}
            aria-label={t('find.replaceWith')}
            data-testid="replace-input"
            onChange={(e) => set({ replace: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                set({ info: editor.replaceOne(opts, replace) });
              } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
              }
            }}
          />
          <Toggle
            icon={Replace}
            label={t('find.replace')}
            testId="replace-one"
            onClick={() => set({ info: editor.replaceOne(opts, replace) })}
          />
          <Toggle
            icon={ReplaceAll}
            label={t('find.replaceAll')}
            testId="replace-all"
            onClick={() => set({ info: editor.replaceEvery(opts, replace) })}
          />
        </div>
      )}
    </div>
  );
}
