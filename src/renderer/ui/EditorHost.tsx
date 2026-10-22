import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { effectiveConfig } from '@shared/document-config';
import { expandTokens, pageGeometry, SHEET_GAP, type PageGeometry } from '@shared/page';
import { useSettings } from '../documents/config';
import { useDocs } from '../documents/store';
import { editor } from '../editor/controller';
import { usePagination } from '../editor/pagination-store';
import { buildDocCss } from '../editor/typography';

/** Hojas dibujadas detrás del editor, con encabezado y pie (VW-01, VW-02). */
function Sheets({ g, pages, title }: { g: PageGeometry; pages: number; title: string }) {
  const date = useMemo(() => new Date().toLocaleDateString(), []);
  return (
    <div className="sheets" aria-hidden="true" data-testid="sheets">
      {Array.from({ length: Math.max(1, pages) }, (_, i) => {
        const values = { title, page: i + 1, pages: Math.max(1, pages), date };
        const blank = g.firstPageDifferent && i === 0;
        const bar = (kind: 'header' | 'footer') => {
          const cfg = kind === 'header' ? g.header : g.footer;
          const text = blank ? '' : expandTokens(cfg.text, values);
          if (!text) return null;
          const style: CSSProperties = {
            left: g.margins.left,
            right: g.margins.right,
            justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[cfg.align],
            ...(kind === 'header'
              ? { top: 0, height: g.margins.top }
              : { bottom: 0, height: g.margins.bottom }),
          };
          return (
            <div className={`sheet-bar sheet-${kind}`} style={style}>
              {text}
            </div>
          );
        };
        return (
          <div
            key={i}
            className="sheet"
            data-page={i + 1}
            style={{ top: i * (g.height + SHEET_GAP), height: g.height }}
          >
            {bar('header')}
            {bar('footer')}
          </div>
        );
      })}
    </div>
  );
}

/** Monta los dos editores (ProseMirror y CodeMirror) en la misma hoja; solo uno es visible. */
export function EditorHost() {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const pm = useRef<HTMLDivElement>(null);
  const cm = useRef<HTMLDivElement>(null);
  const doc = useDocs((s) => s.docs.find((d) => d.id === s.activeId));
  const activeId = doc?.id ?? null;
  const config = doc?.config.config ?? null;
  const defaults = useSettings((s) => s.documentDefaults);
  const pages = usePagination((s) => s.pages);
  const resolved = useMemo(() => effectiveConfig(config, defaults), [config, defaults]);
  const css = useMemo(
    () => (activeId ? buildDocCss(activeId, resolved) : ''),
    [activeId, resolved],
  );
  const geometry = useMemo(() => pageGeometry(resolved.page), [resolved.page]);
  const paged = doc?.view === 'pages';
  const zoom = doc?.zoom ?? 1;
  const columnWidth = doc?.columnWidth ?? 760;

  useEffect(() => {
    editor.mount(scroller.current!, pm.current!, cm.current!);
    return () => editor.unmount();
  }, []);

  // Vista de páginas: el paginador mide con la tipografía y la geometría actuales (VW-10, VW-11).
  useEffect(() => {
    editor.setPageLayout(paged && activeId ? geometry : null, css);
  }, [paged, activeId, geometry, css]);

  // ED-10: al cambiar la tipografía se recalcula el layout con las fuentes ya cargadas.
  useEffect(() => {
    const { font, monoFont } = resolved.typography;
    void Promise.all([
      document.fonts.load(`1em "${font}"`),
      document.fonts.load(`1em "${monoFont}"`),
    ]).catch(() => undefined);
  }, [resolved.typography]);

  const sheetsHeight = Math.max(1, pages) * (geometry.height + SHEET_GAP) - SHEET_GAP;
  const columnStyle: CSSProperties = paged
    ? {
        width: geometry.width,
        padding: `${geometry.margins.top}px ${geometry.margins.right}px 0 ${geometry.margins.left}px`,
        minHeight: sheetsHeight,
        zoom,
      }
    : { width: `min(${columnWidth}px, calc(100% / ${zoom} - 48px))`, zoom };

  return (
    <div className="editor-scroll" ref={scroller} data-testid="editor-scroll" data-view={doc?.view}>
      <style data-testid="doc-style">{css}</style>
      <div
        className={`doc-column ${paged ? 'view-pages' : 'view-continuous'}`}
        aria-label={t('editor.label')}
        data-doc-id={activeId ?? undefined}
        lang={resolved.typography.language}
        style={columnStyle}
      >
        {paged && (
          <Sheets
            g={geometry}
            pages={pages}
            title={doc?.name.replace(/\.(md|markdown)$/i, '') ?? ''}
          />
        )}
        <div ref={pm} className="wysiwyg-mount" />
        <div ref={cm} className="source-mount" />
      </div>
    </div>
  );
}
