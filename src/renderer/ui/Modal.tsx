import { useEffect, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';

export function Modal({
  title,
  icon,
  onCancel,
  wide,
  persistent,
  children,
  testId,
}: {
  title: string;
  icon: LucideIcon;
  onCancel: () => void;
  wide?: boolean;
  /** No se cierra al hacer clic fuera del cuadro (Escape y los botones sí). */
  persistent?: boolean;
  children: ReactNode;
  testId: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => !persistent && e.target === e.currentTarget && onCancel()}
    >
      <div
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
      >
        <h2 className="modal-title">
          <Icon icon={icon} /> {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
