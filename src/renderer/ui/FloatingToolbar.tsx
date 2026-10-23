import { useLayoutEffect, useRef, useState } from 'react';
import { useAppSettings } from '../app/settings';
import { useSelectionUi } from '../editor/selection-ui-store';
import { CommandButton } from './CommandButton';

const BUTTONS = ['format.bold', 'format.italic', 'format.strike', 'format.code', 'format.link'];

/** Barra flotante de formato sobre la selección (03). Se puede desactivar en Ajustes › Editor. */
export function FloatingToolbar() {
  const enabled = useAppSettings((s) => s.settings.editor.floatingToolbar);
  const box = useSelectionUi((s) => s.box);
  const root = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!box || !root.current) return setPos(null);
    const w = root.current.offsetWidth;
    const h = root.current.offsetHeight;
    const above = box.top - h - 8;
    setPos({
      top: above < 8 ? box.top + 28 : above,
      left: Math.max(8, Math.min(box.left + box.width / 2 - w / 2, window.innerWidth - w - 8)),
    });
  }, [box]);

  if (!enabled || !box) return null;
  return (
    <div
      ref={root}
      className="floating-toolbar"
      role="toolbar"
      data-testid="floating-toolbar"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {BUTTONS.map((id) => (
        <CommandButton key={id} id={id} />
      ))}
    </div>
  );
}
