import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PX_PER_MM, type PageGeometry } from '@shared/page';
import { useUi } from '../app/store';
import { updateActiveConfig } from '../documents/config';

const HEIGHT = 22;

interface Props {
  g: PageGeometry;
  zoom: number;
}

/** Regla horizontal de la vista de páginas con los márgenes arrastrables (VW-03). */
export function Ruler({ g, zoom }: Props) {
  const { t } = useTranslation();
  const preview = useUi((s) => s.rulerPreview);
  const drag = useRef<{ side: 'left' | 'right'; startX: number; start: number } | null>(null);
  const [active, setActive] = useState<'left' | 'right' | null>(null);

  const mm = (px: number) => Math.round((px / PX_PER_MM) * 10) / 10;
  const left = preview?.left ?? mm(g.margins.left);
  const right = preview?.right ?? mm(g.margins.right);
  const width = g.widthMm;
  const scale = PX_PER_MM * zoom; // px de pantalla por mm

  const down = (side: 'left' | 'right') => (e: ReactPointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { side, startX: e.clientX, start: side === 'left' ? left : right };
    setActive(side);
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / scale;
    const sign = d.side === 'left' ? 1 : -1;
    const other = d.side === 'left' ? right : left;
    // Deja al menos 30 mm de texto.
    const max = Math.max(0, width - other - 30);
    const value = Math.min(max, Math.max(0, Math.round((d.start + sign * delta) * 10) / 10));
    useUi.getState().set({
      rulerPreview: {
        left: d.side === 'left' ? value : left,
        right: d.side === 'right' ? value : right,
      },
    });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    setActive(null);
    const p = useUi.getState().rulerPreview;
    useUi.getState().set({ rulerPreview: null });
    if (!d || !p) return;
    updateActiveConfig({
      page: {
        margins: {
          top: Math.round(mm(g.margins.top) * 10) / 10,
          right: p.right,
          bottom: Math.round(mm(g.margins.bottom) * 10) / 10,
          left: p.left,
        },
      },
    });
  };

  const ticks: React.JSX.Element[] = [];
  for (let i = 0; i <= Math.floor(width); i++) {
    const major = i % 10 === 0;
    const mid = i % 5 === 0;
    ticks.push(
      <line
        key={i}
        x1={i}
        x2={i}
        y1={HEIGHT}
        y2={HEIGHT - (major ? 9 : mid ? 6 : 3)}
        stroke="var(--ink-3)"
        strokeWidth={0.18}
      />,
    );
    if (major && i > 0 && i < width - 5) {
      ticks.push(
        <text key={`t${i}`} x={i} y={9} fontSize={3.2} textAnchor="middle" fill="var(--ink-3)">
          {i / 10}
        </text>,
      );
    }
  }

  return (
    <div className="ruler-row" data-testid="ruler">
      <div className="ruler" style={{ width: g.width * zoom, height: HEIGHT }}>
        <svg
          width={g.width * zoom}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect x={0} y={0} width={width} height={HEIGHT} fill="var(--paper)" />
          <rect x={0} y={0} width={left} height={HEIGHT} fill="var(--code-bg)" />
          <rect x={width - right} y={0} width={right} height={HEIGHT} fill="var(--code-bg)" />
          {ticks}
        </svg>
        <button
          className={`ruler-handle${active === 'left' ? ' active' : ''}`}
          style={{ left: left * scale }}
          aria-label={t('ruler.left')}
          title={t('ruler.left')}
          data-testid="ruler-left"
          onPointerDown={down('left')}
          onPointerMove={move}
          onPointerUp={up}
        />
        <button
          className={`ruler-handle${active === 'right' ? ' active' : ''}`}
          style={{ left: (width - right) * scale }}
          aria-label={t('ruler.right')}
          title={t('ruler.right')}
          data-testid="ruler-right"
          onPointerDown={down('right')}
          onPointerMove={move}
          onPointerUp={up}
        />
      </div>
    </div>
  );
}
