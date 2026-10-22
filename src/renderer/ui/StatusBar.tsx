import { Eye, FileCode2, Files, TriangleAlert, Type, ZoomIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fontKind } from '@shared/document-config';
import { activeDoc, useDocs } from '../documents/store';
import { resolveConfig } from '../documents/config';
import { editor } from '../editor/controller';
import { isFontAvailable } from '../editor/font-check';
import { Icon } from './Icon';

const fontFallbackName = (name: string) =>
  ({ sans: 'Inter', serif: 'Source Serif 4', mono: 'JetBrains Mono' })[fontKind(name)];

export function StatusBar() {
  const { t } = useTranslation();
  useDocs();
  const doc = activeDoc();
  const mode = doc?.mode;
  const font = doc ? resolveConfig(doc).typography.font : null;
  // DOC-13: aviso discreto si la fuente del documento no existe aquí; el archivo no se toca.
  const missing = font && !isFontAvailable(font) ? font : null;
  return (
    <footer className="statusbar" data-testid="statusbar">
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
      <span title={t('status.view')}>
        <Icon icon={Files} size={14} /> {t('ribbon.view')}
      </span>
      <span title={t('status.zoom')}>
        <Icon icon={ZoomIn} size={14} /> 100 %
      </span>
    </footer>
  );
}
