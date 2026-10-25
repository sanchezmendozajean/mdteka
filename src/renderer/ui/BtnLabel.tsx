import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';

/** Parte un texto de varias palabras en dos líneas lo más parejas posible. */
function splitInTwo(text: string): [string, string] | null {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return null;
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

/**
 * Etiqueta de botón grande: las de varias palabras van siempre en dos líneas, y el ancho se
 * ajusta a la línea más larga (un bloque partido conservaría si no el ancho máximo).
 */
export function BtnLabel({ children, split = true }: { children: ReactNode; split?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.closest('.btn-large')) return;
    const fit = () => {
      el.style.width = '';
      const range = document.createRange();
      range.selectNodeContents(el);
      const widest = Math.max(0, ...Array.from(range.getClientRects(), (r) => r.width));
      // Un píxel de holgura: sin él el redondeo recorta la última letra o el «…».
      if (widest > 0) el.style.width = `${Math.ceil(widest) + 1}px`;
    };
    fit();
    // Si la tipografía termina de cargar después, las medidas cambian.
    let live = true;
    void document.fonts?.ready.then(() => live && fit());
    return () => {
      live = false;
    };
  });
  const lines = split && typeof children === 'string' ? splitInTwo(children) : null;
  return (
    <span className="btn-label" ref={ref}>
      {lines ? (
        <Fragment>
          {lines[0]}
          <br />
          {lines[1]}
        </Fragment>
      ) : (
        children
      )}
    </span>
  );
}
