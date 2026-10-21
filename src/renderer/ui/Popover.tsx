import { useEffect, useRef, useState, type ReactNode } from 'react';

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

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
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
      {open && (
        <div className="popover" role="menu" onMouseDown={(e) => e.preventDefault()}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
