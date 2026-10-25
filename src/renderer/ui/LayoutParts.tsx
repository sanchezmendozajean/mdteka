import { ChevronDown, File, MoveHorizontal, SquareDashed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PAPER_MM, pageGeometry } from '@shared/page';
import { useUi } from '../app/store';
import { resolveConfig, updateActiveConfig } from '../documents/config';
import { useDocs } from '../documents/store';
import { setColumnWidth } from '../documents/view';
import { BtnLabel } from './BtnLabel';
import { Icon } from './Icon';
import { Popover } from './Popover';

const useActive = () => useDocs((s) => s.docs.find((d) => d.id === s.activeId));

function sameMargins(a: number, b: number) {
  return Math.abs(a - b) < 0.2;
}

/** Tamaño de papel (A4, A5, Letter, Legal, B5). */
export function PaperSizePicker() {
  const { t } = useTranslation();
  const doc = useActive();
  const eff = resolveConfig(doc);
  const size = typeof eff.page.size === 'string' ? eff.page.size : 'A4';
  return (
    <Popover
      label={t('ribbon.paperSize')}
      disabled={!doc}
      testId="paper-size"
      trigger={
        <>
          <Icon icon={File} size={24} />
          <BtnLabel>{size}</BtnLabel>
          <Icon icon={ChevronDown} size={14} />
        </>
      }
    >
      {(close) => (
        <ul className="gallery">
          {(Object.keys(PAPER_MM) as (keyof typeof PAPER_MM)[]).map((k) => (
            <li key={k}>
              <button
                className="gallery-item"
                aria-pressed={k === size}
                data-paper={k}
                onClick={() => {
                  updateActiveConfig({ page: { size: k } });
                  close();
                }}
              >
                <span>
                  {k} · {PAPER_MM[k].width} × {PAPER_MM[k].height} mm
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

const PRESETS = [
  { id: 'marginNormal', top: 25, right: 25, bottom: 25, left: 25 },
  { id: 'marginNarrow', top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  { id: 'marginWide', top: 25.4, right: 50.8, bottom: 25.4, left: 50.8 },
] as const;

/** Presets de márgenes; «Personalizado» abre la sección Página del panel. */
export function MarginsPicker() {
  const { t } = useTranslation();
  const doc = useActive();
  const g = pageGeometry(resolveConfig(doc).page);
  const mm = (px: number) => px / (96 / 25.4);
  const current = PRESETS.find(
    (p) =>
      sameMargins(mm(g.margins.top), p.top) &&
      sameMargins(mm(g.margins.right), p.right) &&
      sameMargins(mm(g.margins.bottom), p.bottom) &&
      sameMargins(mm(g.margins.left), p.left),
  );
  return (
    <Popover
      label={t('ribbon.margins')}
      disabled={!doc}
      testId="margins-picker"
      trigger={
        <>
          <Icon icon={SquareDashed} size={24} />
          <BtnLabel>{t('ribbon.margins')}</BtnLabel>
          <Icon icon={ChevronDown} size={14} />
        </>
      }
    >
      {(close) => (
        <ul className="gallery">
          {PRESETS.map((p) => (
            <li key={p.id}>
              <button
                className="gallery-item"
                aria-pressed={current?.id === p.id}
                data-margins={p.id}
                onClick={() => {
                  updateActiveConfig({
                    page: {
                      margins: { top: p.top, right: p.right, bottom: p.bottom, left: p.left },
                    },
                  });
                  close();
                }}
              >
                <span>
                  {t(`ribbon.${p.id}`)} · {p.top} / {p.right} mm
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              className="gallery-item"
              data-margins="custom"
              onClick={() => {
                useUi.getState().set({
                  documentPanelOpen: true,
                  pageFocus: useUi.getState().pageFocus + 1,
                });
                close();
              }}
            >
              <span>{t('ribbon.marginCustom')}</span>
            </button>
          </li>
        </ul>
      )}
    </Popover>
  );
}

const WIDTHS = [560, 640, 720, 760, 820, 900, 1000, 1200];

/** Ancho de la columna en la vista continua (VW-20). */
export function ColumnWidthPicker() {
  const { t } = useTranslation();
  const doc = useActive();
  return (
    <Popover
      label={t('ribbon.columnWidth')}
      disabled={!doc}
      testId="column-width"
      trigger={
        <>
          <Icon icon={MoveHorizontal} size={24} />
          <BtnLabel>{doc?.columnWidth ?? 760} px</BtnLabel>
          <Icon icon={ChevronDown} size={14} />
        </>
      }
    >
      {(close) => (
        <ul className="gallery value-list">
          {WIDTHS.map((w) => (
            <li key={w}>
              <button
                className="gallery-item"
                aria-pressed={doc?.columnWidth === w}
                data-width={w}
                onClick={() => {
                  if (doc) setColumnWidth(doc.id, w);
                  close();
                }}
              >
                <span>{w} px</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
