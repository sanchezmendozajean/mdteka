import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { editor } from '../editor/controller';
import { useSymbols } from '../editor/symbol-store';

/** Símbolos que el teclado no da fácilmente; los nueve primeros se eligen con 1–9. */
export const SYMBOLS: { char: string; key: string }[] = [
  { char: '«', key: 'guillemetOpen' },
  { char: '»', key: 'guillemetClose' },
  { char: '—', key: 'emDash' },
  { char: '–', key: 'enDash' },
  { char: '…', key: 'ellipsis' },
  { char: '“', key: 'quoteOpen' },
  { char: '”', key: 'quoteClose' },
  { char: '‘', key: 'singleOpen' },
  { char: '’', key: 'singleClose' },
  { char: '¿', key: 'questionOpen' },
  { char: '¡', key: 'exclamationOpen' },
  { char: '°', key: 'degree' },
  { char: '•', key: 'bullet' },
  { char: '×', key: 'times' },
  { char: '§', key: 'section' },
  { char: '©', key: 'copyright' },
];

const COLUMNS = 4;

/** Ancla del selector: el botón de la cinta si se ve; si no, el cursor; si no, arriba al centro. */
function anchor(): { top: number; above: number; left: number } {
  const btn = document.querySelector('[data-command="insert.symbol"]');
  if (btn) {
    const r = btn.getBoundingClientRect();
    return { top: r.bottom + 4, above: r.top - 4, left: r.left };
  }
  const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
  const rect = range?.getClientRects()[0] ?? range?.getBoundingClientRect();
  if (rect && (rect.width || rect.height || rect.top)) {
    return { top: rect.bottom + 6, above: rect.top - 6, left: rect.left };
  }
  return { top: 120, above: 120, left: window.innerWidth / 2 - 100 };
}

/** Selector de símbolos: se abre con el botón Insertar › Símbolo o con Ctrl+Shift+.; se maneja con el teclado. */
export function SymbolPicker(): ReactNode {
  const { t } = useTranslation();
  const open = useSymbols((s) => s.open);
  const setOpen = useSymbols((s) => s.setOpen);
  const root = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  const [index, setIndex] = useState(0);

  useLayoutEffect(() => {
    if (!open) return;
    setIndex(0);
    const a = anchor();
    const w = root.current?.offsetWidth ?? 0;
    const h = root.current?.offsetHeight ?? 0;
    // Si no cabe debajo, se abre encima del ancla; en último caso se pega al borde inferior.
    const top =
      a.top + h <= window.innerHeight - 8
        ? a.top
        : Math.max(8, Math.min(a.above - h, window.innerHeight - h - 8));
    setPos({ top, left: Math.max(8, Math.min(a.left, window.innerWidth - w - 8)) });
    root.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      // El botón de la cinta alterna por su cuenta: cerrar aquí lo reabriría en el clic.
      if (!root.current?.contains(target) && !target.closest?.('[data-command="insert.symbol"]')) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open, setOpen]);

  if (!open) return null;

  const choose = (char: string) => {
    setOpen(false);
    editor.insertSymbol(char);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = SYMBOLS.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      setIndex(Math.max(0, Math.min(last, i)));
    };
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        editor.focus();
        return;
      case 'ArrowRight':
        return move(index + 1);
      case 'ArrowLeft':
        return move(index - 1);
      case 'ArrowDown':
        return move(index + COLUMNS);
      case 'ArrowUp':
        return move(index - COLUMNS);
      case 'Home':
        return move(0);
      case 'End':
        return move(last);
      case 'Enter':
      case ' ':
        e.preventDefault();
        return choose(SYMBOLS[index]!.char);
      case 'Tab':
        e.preventDefault();
        setOpen(false);
        editor.focus();
        return;
    }
    if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      choose(SYMBOLS[Number(e.key) - 1]!.char);
    } else if (e.key.length === 1) {
      // Escribir el propio símbolo («, —…) también lo elige.
      const hit = SYMBOLS.find((s) => s.char === e.key);
      if (hit) {
        e.preventDefault();
        choose(hit.char);
      }
    }
    // Que el resto de teclas no lleguen al editor ni a los atajos globales.
    e.stopPropagation();
  };

  return (
    <div
      ref={root}
      className="popover symbol-picker"
      role="listbox"
      tabIndex={-1}
      aria-label={t('symbols.title')}
      aria-activedescendant={`symbol-${index}`}
      data-testid="symbol-picker"
      style={{ top: pos.top, left: pos.left }}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="symbol-grid" style={{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }}>
        {SYMBOLS.map((s, i) => (
          <button
            key={s.char}
            id={`symbol-${i}`}
            role="option"
            aria-selected={i === index}
            className={`symbol-cell${i === index ? ' on' : ''}`}
            title={t(`symbols.${s.key}`)}
            aria-label={t(`symbols.${s.key}`)}
            data-testid={`symbol-${s.key}`}
            tabIndex={-1}
            onMouseEnter={() => setIndex(i)}
            onClick={() => choose(s.char)}
          >
            <span className="symbol-char">{s.char}</span>
            {i < 9 && <kbd>{i + 1}</kbd>}
          </button>
        ))}
      </div>
      <div className="symbol-hint">{t('symbols.hint')}</div>
    </div>
  );
}
