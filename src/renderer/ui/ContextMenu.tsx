import { Check, type LucideIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  run: () => void;
  danger?: boolean;
  /** Línea separadora encima de este elemento. */
  separator?: boolean;
  hidden?: boolean;
  /** Opción de elección única: se marca con un check si es la vigente. */
  checked?: boolean;
}

/** Menú contextual con íconos en la posición del puntero. Se cierra con clic fuera, Escape o al elegir. */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  // Ajusta la posición para que el menú no se salga de la ventana.
  useLayoutEffect(() => {
    const box = root.current;
    if (!box) return;
    setPos({
      top: Math.max(8, Math.min(y, window.innerHeight - box.offsetHeight - 8)),
      left: Math.max(8, Math.min(x, window.innerWidth - box.offsetWidth - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="context-menu"
      role="menu"
      ref={root}
      style={pos}
      data-testid="context-menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items
        .filter((i) => !i.hidden)
        .map((item) => (
          <div key={item.id}>
            {item.separator && <div className="context-sep" role="separator" />}
            <button
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={item.checked}
              className={`context-item${item.danger ? ' danger' : ''}`}
              data-testid={`menu-${item.id}`}
              onClick={() => {
                onClose();
                item.run();
              }}
            >
              <Icon icon={item.icon} size={16} />
              <span className="context-label">{item.label}</span>
              {item.checked && <Icon icon={Check} size={16} />}
            </button>
          </div>
        ))}
    </div>,
    document.body,
  );
}
