import { ChevronDown, Image as ImageGlyph, Table } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatShortcut, getCommand, shortcutOf } from '../commands/registry';
import { useDocs } from '../documents/store';
import { editor } from '../editor/controller';
import { BtnLabel } from './BtnLabel';
import { Icon } from './Icon';
import { Popover } from './Popover';

export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ribbon-group" role="group" aria-label={label}>
      <div className="ribbon-group-items">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}

const STYLE_ITEMS = [
  'block.paragraph',
  'block.heading1',
  'block.heading2',
  'block.heading3',
  'block.heading4',
  'block.heading5',
  'block.heading6',
  'block.quote',
  'block.codeBlock',
] as const;

const STYLE_FOR_BLOCK: Record<string, string> = {
  paragraph: 'block.paragraph',
  h1: 'block.heading1',
  h2: 'block.heading2',
  h3: 'block.heading3',
  h4: 'block.heading4',
  h5: 'block.heading5',
  h6: 'block.heading6',
  code: 'block.codeBlock',
};

/** Galería de estilos de bloque (Normal, Título 1–6, Cita, Código). */
export function StylesGallery() {
  const { t } = useTranslation();
  const hasDoc = useDocs((s) => s.activeId !== null);
  const format = useDocs((s) => s.format);
  const current = format.quote ? 'block.quote' : STYLE_FOR_BLOCK[format.block ?? 'paragraph'];
  const currentCmd = getCommand(current ?? 'block.paragraph');
  return (
    <Popover
      label={t('ribbon.stylesGallery')}
      disabled={!hasDoc}
      testId="styles-gallery"
      trigger={
        <>
          {currentCmd && <Icon icon={currentCmd.icon} />}
          <span className="gallery-current">{currentCmd ? t(currentCmd.labelKey) : ''}</span>
          <Icon icon={ChevronDown} size={14} />
        </>
      }
    >
      {(close) => (
        <ul className="gallery">
          {STYLE_ITEMS.map((id) => {
            const cmd = getCommand(id)!;
            return (
              <li key={id}>
                <button
                  className={`gallery-item gallery-${id.replace('block.', '')}`}
                  data-command={id}
                  aria-pressed={id === current}
                  onClick={() => {
                    cmd.run();
                    close();
                  }}
                >
                  <Icon icon={cmd.icon} />
                  <span>{t(cmd.labelKey)}</span>
                  {shortcutOf(cmd) && <kbd>{formatShortcut(shortcutOf(cmd)!)}</kbd>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}

/** Selector de cuadrícula para insertar tablas. */
export function TableGrid() {
  const { t } = useTranslation();
  const hasDoc = useDocs((s) => s.activeId !== null);
  const cmd = getCommand('insert.table')!;
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  const SIZE = 8;
  return (
    <Popover
      large
      label={t(cmd.labelKey)}
      disabled={!hasDoc}
      testId="table-grid"
      trigger={
        <>
          <Icon icon={Table} size={24} />
          <BtnLabel>{t(cmd.labelKey)}</BtnLabel>
        </>
      }
    >
      {(close) => (
        <div className="grid-picker">
          <div className="grid-cells" onMouseLeave={() => setHover({ rows: 0, cols: 0 })}>
            {Array.from({ length: SIZE * SIZE }, (_, i) => {
              const row = Math.floor(i / SIZE) + 1;
              const col = (i % SIZE) + 1;
              return (
                <button
                  key={i}
                  className={`grid-cell${row <= hover.rows && col <= hover.cols ? ' on' : ''}`}
                  aria-label={t('ribbon.tableGrid', { rows: row, cols: col })}
                  data-testid={`grid-${row}-${col}`}
                  onMouseEnter={() => setHover({ rows: row, cols: col })}
                  onClick={() => {
                    editor.insertTable(row, col);
                    close();
                  }}
                />
              );
            })}
          </div>
          <div className="grid-caption">
            {hover.rows ? t('ribbon.tableGrid', { rows: hover.rows, cols: hover.cols }) : ' '}
          </div>
        </div>
      )}
    </Popover>
  );
}

/** Insertar › Imagen: desde un archivo, una dirección o el portapapeles (06 · IMG-11). */
export function ImageMenu() {
  const { t } = useTranslation();
  const hasDoc = useDocs((s) => s.activeId !== null);
  return (
    <Popover
      large
      label={t('ribbon.image')}
      disabled={!hasDoc}
      testId="image-menu"
      trigger={
        <>
          <Icon icon={ImageGlyph} size={24} />
          <BtnLabel>{t('ribbon.image')}</BtnLabel>
        </>
      }
    >
      {(close) => (
        <ul className="gallery">
          {['insert.image', 'insert.imageUrl', 'insert.imageClipboard'].map((id) => {
            const cmd = getCommand(id)!;
            return (
              <li key={id}>
                <button
                  className="gallery-item"
                  data-command={id}
                  onClick={() => {
                    close();
                    cmd.run();
                  }}
                >
                  <Icon icon={cmd.icon} />
                  <span>{t(cmd.labelKey)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}
