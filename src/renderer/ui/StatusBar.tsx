import {
  Eye,
  FileCode2,
  FileText,
  Files,
  Minus,
  Plus,
  ScrollText,
  TriangleAlert,
  Type,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fontKind } from '@shared/document-config';
import { activeDoc, useDocs } from '../documents/store';
import { resolveConfig } from '../documents/config';
import { setColumnWidth, setView, setZoom, stepZoom, ZOOM_MAX, ZOOM_MIN } from '../documents/view';
import { editor } from '../editor/controller';
import { isFontAvailable } from '../editor/font-check';
import { usePagination } from '../editor/pagination-store';
import { Icon } from './Icon';

const fontFallbackName = (name: string) =>
  ({ sans: 'Inter', serif: 'Source Serif 4', mono: 'JetBrains Mono' })[fontKind(name)];

export function StatusBar() {
  const { t } = useTranslation();
  useDocs();
  const doc = activeDoc();
  const pages = usePagination((s) => s.pages);
  const current = usePagination((s) => s.current);
  const mode = doc?.mode;
  const font = doc ? resolveConfig(doc).typography.font : null;
  // DOC-13: aviso discreto si la fuente del documento no existe aquí; el archivo no se toca.
  const missing = font && !isFontAvailable(font) ? font : null;
  const paged = doc?.view === 'pages';
  return (
    <footer className="statusbar" data-testid="statusbar">
      {doc && paged && pages > 0 && (
        <span data-testid="page-counter">
          <Icon icon={FileText} size={14} />{' '}
          {t('status.page', { current: Math.min(current, pages), total: pages })}
        </span>
      )}
      <span data-testid="word-count">
        <Icon icon={Type} size={14} /> {t('status.words', { count: doc?.words ?? 0 })}
      </span>
      {missing && (
        <span className="status-warning" data-testid="font-fallback">
          <Icon icon={TriangleAlert} size={14} />{' '}
          {t('docPanel.fontFallback', { font: missing, fallback: fontFallbackName(missing) })}
        </span>
      )}
      <span className="spacer" />
      <div className="segmented" role="group" aria-label={t('status.mode')}>
        <button
          className="seg"
          aria-pressed={mode === 'wysiwyg'}
          disabled={!doc}
          data-testid="mode-wysiwyg"
          onClick={() => editor.setMode('wysiwyg')}
        >
          <Icon icon={Eye} size={14} /> {t('status.wysiwyg')}
        </button>
        <button
          className="seg"
          aria-pressed={mode === 'source'}
          disabled={!doc}
          data-testid="mode-source"
          onClick={() => editor.setMode('source')}
        >
          <Icon icon={FileCode2} size={14} /> {t('status.source')}
        </button>
      </div>
      <div className="segmented" role="group" aria-label={t('status.view')}>
        <button
          className="seg"
          aria-pressed={doc?.view === 'pages'}
          disabled={!doc}
          data-testid="view-pages"
          onClick={() => doc && setView(doc.id, 'pages')}
        >
          <Icon icon={Files} size={14} /> {t('status.pages')}
        </button>
        <button
          className="seg"
          aria-pressed={doc?.view === 'continuous'}
          disabled={!doc}
          data-testid="view-continuous"
          onClick={() => doc && setView(doc.id, 'continuous')}
        >
          <Icon icon={ScrollText} size={14} /> {t('status.continuous')}
        </button>
      </div>
      {doc && doc.view === 'continuous' && (
        <label className="status-slider" title={t('status.columnWidth')}>
          <input
            type="range"
            min={480}
            max={1400}
            step={20}
            value={doc.columnWidth}
            aria-label={t('status.columnWidth')}
            data-testid="column-slider"
            onChange={(e) => setColumnWidth(doc.id, Number(e.target.value))}
          />
          <span>{doc.columnWidth} px</span>
        </label>
      )}
      <div className="status-zoom" role="group" aria-label={t('status.zoom')}>
        <button
          className="btn btn-mini"
          disabled={!doc}
          aria-label={t('status.zoomOut')}
          title={t('status.zoomOut')}
          data-testid="zoom-out"
          onClick={() => doc && stepZoom(doc.id, -1)}
        >
          <Icon icon={Minus} size={14} />
        </button>
        <input
          type="range"
          min={ZOOM_MIN * 100}
          max={ZOOM_MAX * 100}
          step={10}
          value={Math.round((doc?.zoom ?? 1) * 100)}
          disabled={!doc}
          aria-label={t('status.zoomSlider')}
          data-testid="zoom-slider"
          onChange={(e) => doc && setZoom(doc.id, Number(e.target.value) / 100)}
        />
        <button
          className="btn btn-mini"
          disabled={!doc}
          aria-label={t('status.zoomIn')}
          title={t('status.zoomIn')}
          data-testid="zoom-in"
          onClick={() => doc && stepZoom(doc.id, 1)}
        >
          <Icon icon={Plus} size={14} />
        </button>
        <span data-testid="zoom-value" className="zoom-value">
          {Math.round((doc?.zoom ?? 1) * 100)} %
        </span>
      </div>
    </footer>
  );
}
