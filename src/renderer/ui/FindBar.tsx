import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Move,
  Regex,
  Replace,
  ReplaceAll,
  WholeWord,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocs } from '../documents/store';
import { editor } from '../editor/controller';
import { useFind, type FindCorner } from '../editor/find-store';
import { Icon } from './Icon';
import { Popover } from './Popover';

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

const CORNERS: { id: FindCorner; icon: LucideIcon; key: string }[] = [
  { id: 'tl', icon: ArrowUpLeft, key: 'cornerTl' },
  { id: 'tr', icon: ArrowUpRight, key: 'cornerTr' },
  { id: 'bl', icon: ArrowDownLeft, key: 'cornerBl' },
  { id: 'br', icon: ArrowDownRight, key: 'cornerBr' },
];

/** Caja flotante de búsqueda y reemplazo, común a los dos modos de edición. */
export function FindBar() {
  const { t } = useTranslation();
  const { open, showReplace, opts, replace, info, corner, focusTick, set, setCorner } = useFind();
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

  // Recalcular al cambiar la consulta, el modo o el documento; el cursor salta a la coincidencia.
  useEffect(() => {
    const found = editor.find(open ? opts : null, replace);
    set({ info: open && opts.query && found.count ? editor.findReveal(opts) : found });
    // El texto de reemplazo no mueve el cursor: queda fuera de las dependencias a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, opts, mode, activeId, set]);
  useEffect(() => {
    if (open) editor.find(opts, replace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replace]);

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
  const doReplace = () => set({ info: editor.replaceOne(opts, replace) });

  return (
    <div className={`find-bar find-${corner}`} role="search" data-testid="find-bar">
      <div className="find-row">
        <button
          className="btn find-expand"
          title={t('find.toggleReplace')}
          aria-label={t('find.toggleReplace')}
          aria-expanded={showReplace}
          data-testid="find-toggle-replace"
          onClick={() => set({ showReplace: !showReplace })}
        >
          <Icon icon={showReplace ? ChevronDown : ChevronRight} size={16} />
        </button>
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
      </div>
      {showReplace && (
        <div className="find-row">
          <span className="find-expand" aria-hidden="true" />
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
                doReplace();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
              }
            }}
          />
        </div>
      )}
      <div className="find-row find-buttons">
        <div className="find-group">
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
          <Popover
            label={t('find.corner')}
            testId="find-corner"
            trigger={<Icon icon={Move} size={16} />}
          >
            {(closeMenu) => (
              <div className="find-corners" role="group" aria-label={t('find.corner')}>
                {CORNERS.map((c) => (
                  <button
                    key={c.id}
                    className="btn"
                    aria-pressed={corner === c.id}
                    title={t(`find.${c.key}`)}
                    aria-label={t(`find.${c.key}`)}
                    data-testid={`find-corner-${c.id}`}
                    onClick={() => {
                      setCorner(c.id);
                      closeMenu();
                    }}
                  >
                    <Icon icon={c.icon} size={16} />
                  </button>
                ))}
              </div>
            )}
          </Popover>
        </div>
        <div className="find-group">
          <Toggle
            icon={ChevronUp}
            label={t('find.previous')}
            onClick={() => step(-1)}
            testId="find-prev"
          />
          <span className="find-status" data-testid="find-status" aria-live="polite">
            {status}
          </span>
          <Toggle
            icon={ChevronDown}
            label={t('find.next')}
            onClick={() => step(1)}
            testId="find-next"
          />
          <Toggle icon={X} label={t('find.close')} onClick={close} testId="find-close" />
        </div>
      </div>
      {showReplace && (
        <div className="find-row">
          <Toggle
            icon={Replace}
            label={t('find.replace')}
            testId="replace-one"
            onClick={doReplace}
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
