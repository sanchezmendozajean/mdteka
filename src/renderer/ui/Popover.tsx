import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** Contenido del botón disparador. */
  trigger: ReactNode;
  label: string;
  disabled?: boolean;
  testId?: string;
  children: (close: () => void) => ReactNode;
}

/** Desplegable mínimo: se cierra con clic fuera o Escape y no roba el foco del editor. */
export function Popover({ trigger, label, disabled, testId, children }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // El menú vive en <body> (position: fixed) para que ningún contenedor con scroll lo recorte.
  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const r = root.current.getBoundingClientRect();
    const w = menu.current?.offsetWidth ?? 0;
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener('resize', onScroll);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="popover-root" ref={root}>
      <button
        className="btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        title={label}
        disabled={disabled}
        data-testid={testId}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            className="popover"
            role="menu"
            ref={menu}
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={(e) => {
              // Los campos de texto dentro del menú sí deben poder tomar el foco.
              if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
            }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </div>
  );
}
