import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUi, type RibbonTab } from '../app/store';
import { useDialogs } from '../documents/store';

/**
 * KeyTips de la cinta (UI, accesibilidad): `Alt` solo muestra una letra sobre cada pestaña; al
 * pulsarla se abre la pestaña y cada botón recibe su propia tecla. `Esc` o `Alt` salen.
 */
const TAB_KEYS: Record<string, RibbonTab> = {
  a: 'file',
  i: 'home',
  n: 'insert',
  d: 'design',
  s: 'layout',
  v: 'view',
  p: 'project',
};
const COMMAND_KEYS = '1234567890abcdefghijklmnopqrstuvwxyz';

interface Tip {
  key: string;
  left: number;
  top: number;
  target: HTMLElement;
}

const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && !(el as HTMLButtonElement).disabled;
};

function tabTips(): Tip[] {
  return Object.entries(TAB_KEYS).flatMap(([key, tab]) => {
    const el = document.querySelector<HTMLElement>(`[data-testid="tab-${tab}"]`);
    if (!el) return [];
    const r = el.getBoundingClientRect();
    return [{ key, left: r.left + r.width / 2, top: r.bottom - 4, target: el }];
  });
}

function commandTips(): Tip[] {
  const buttons = [
    ...document.querySelectorAll<HTMLElement>('.ribbon-body button, .ribbon-body [role="button"]'),
  ].filter(visible);
  return buttons.slice(0, COMMAND_KEYS.length).map((el, i) => {
    const r = el.getBoundingClientRect();
    return { key: COMMAND_KEYS[i]!, left: r.left + r.width / 2, top: r.bottom - 6, target: el };
  });
}

export function KeyTips() {
  const [level, setLevel] = useState<'off' | 'tabs' | 'commands'>('off');
  const [tips, setTips] = useState<Tip[]>([]);
  const levelRef = useRef(level);
  levelRef.current = level;
  const tipsRef = useRef(tips);
  tipsRef.current = tips;

  useEffect(() => {
    let altDown = false;
    let otherKey = false;
    const show = (next: 'off' | 'tabs' | 'commands') => {
      setLevel(next);
      // Tras cambiar de pestaña la cinta se repinta: se miden los botones en el siguiente cuadro.
      requestAnimationFrame(() =>
        setTips(next === 'tabs' ? tabTips() : next === 'commands' ? commandTips() : []),
      );
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        if (!e.repeat) {
          altDown = true;
          otherKey = false;
        }
        return;
      }
      if (altDown) otherKey = true;
      if (levelRef.current === 'off' || useDialogs.getState().current) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return show('off');
      const key = e.key.toLowerCase();
      if (levelRef.current === 'tabs') {
        const tab = TAB_KEYS[key];
        if (!tab) return show('off');
        useUi.getState().set({ ribbonTab: tab, ribbonCollapsed: false });
        return show('commands');
      }
      const tip = tipsRef.current.find((t) => t.key === key);
      show('off');
      tip?.target.click();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      if (altDown && !otherKey && !useDialogs.getState().current)
        show(levelRef.current === 'off' ? 'tabs' : 'off');
      altDown = false;
    };
    const onMouse = () => levelRef.current !== 'off' && show('off');
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('mousedown', onMouse, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('mousedown', onMouse, true);
    };
  }, []);

  if (level === 'off') return null;
  return createPortal(
    <div className="keytips" data-testid="keytips" aria-hidden="true">
      {tips.map((t) => (
        <span
          key={`${t.key}-${t.left}`}
          className="keytip"
          data-testid="keytip"
          data-key={t.key}
          data-for={t.target.getAttribute('data-command') ?? ''}
          style={{ left: t.left, top: t.top }}
        >
          {t.key.toUpperCase()}
        </span>
      ))}
    </div>,
    document.body,
  );
}
