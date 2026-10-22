import {
  BetweenHorizontalStart,
  ChevronDown,
  MoveVertical,
  Palette,
  Type,
  ALargeSmall,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BUNDLED_FONTS, fontKind, fontStack, PRESETS } from '@shared/document-config';
import { resolveConfig, updateActiveConfig } from '../documents/config';
import { useDocs } from '../documents/store';
import { Icon } from './Icon';
import { Popover } from './Popover';

const useActive = () => useDocs((s) => s.docs.find((d) => d.id === s.activeId));

/** Galería de presets con miniatura (04 · Presets de estilo). */
export function PresetGallery() {
  const { t } = useTranslation();
  const doc = useActive();
  const theme = doc?.config.config?.theme;
  const pick = (id: string | undefined) =>
    // Aplicar un preset parte de cero: lo retocado después se guarda como diferencias.
    updateActiveConfig({ theme: id, typography: undefined, styles: undefined });
  return (
    <Popover
      label={t('ribbon.presets')}
      disabled={!doc}
      testId="preset-gallery"
      trigger={
        <>
          <Icon icon={Palette} size={24} />
          <Icon icon={ChevronDown} size={14} />
        </>
      }
    >
      {(close) => (
        <div className="preset-grid" role="listbox" aria-label={t('ribbon.presets')}>
          {[{ id: undefined, name: t('ribbon.presetNone') }, ...PRESETS].map((p) => {
            const font = (p as (typeof PRESETS)[number]).config?.['typography'] as
              { font?: string } | undefined;
            const family = font?.font ?? 'Inter';
            return (
              <button
                key={p.id ?? 'none'}
                role="option"
                aria-selected={theme === p.id}
                className="preset-card"
                data-preset={p.id ?? 'none'}
                onClick={() => {
                  pick(p.id);
                  close();
                }}
              >
                <span
                  className="preset-thumb"
                  style={{ fontFamily: fontStack(family, fontKind(family)) }}
                >
                  Aa
                </span>
                <span className="preset-name">{p.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

/** Selector de la fuente del documento: incluidas + cualquier fuente del sistema (DOC-12). */
export function FontPicker() {
  const { t } = useTranslation();
  const doc = useActive();
  const current = resolveConfig(doc).typography.font;
  const [other, setOther] = useState('');
  const pick = (font: string) => updateActiveConfig({ typography: { font } });
  return (
    <Popover
      label={t('ribbon.font')}
      disabled={!doc}
      testId="font-picker"
      trigger={
        <>
          <Icon icon={Type} />
          <span className="gallery-current">{current}</span>
          <Icon icon={ChevronDown} size={14} />
        </>
      }
    >
      {(close) => (
        <div>
          <ul className="gallery">
            {BUNDLED_FONTS.filter((f) => f.kind !== 'mono').map((f) => (
              <li key={f.name}>
                <button
                  className="gallery-item"
                  aria-pressed={f.name === current}
                  data-font={f.name}
                  style={{ fontFamily: fontStack(f.name, f.kind) }}
                  onClick={() => {
                    pick(f.name);
                    close();
                  }}
                >
                  <span>{f.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <input
            className="popover-input"
            value={other}
            placeholder={t('ribbon.otherFont')}
            aria-label={t('ribbon.otherFont')}
            data-testid="font-other"
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && other.trim()) {
                pick(other.trim());
                setOther('');
                close();
              }
            }}
          />
        </div>
      )}
    </Popover>
  );
}

interface ValueProps {
  icon: LucideIcon;
  label: string;
  testId: string;
  value: number;
  options: number[];
  format?: (n: number) => string;
  onPick: (n: number) => void;
}

function ValuePicker({ icon, label, testId, value, options, format, onPick }: ValueProps) {
  const doc = useActive();
  const show = format ?? String;
  return (
    <Popover
      label={label}
      disabled={!doc}
      testId={testId}
      trigger={
        <>
          <Icon icon={icon} />
          <span className="value-current">{show(value)}</span>
          <Icon icon={ChevronDown} size={14} />
        </>
      }
    >
      {(close) => (
        <ul className="gallery value-list">
          {options.map((n) => (
            <li key={n}>
              <button
                className="gallery-item"
                aria-pressed={n === value}
                data-value={n}
                onClick={() => {
                  onPick(n);
                  close();
                }}
              >
                <span>{show(n)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

const SIZES = [8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 24];
const LINE_HEIGHTS = [1, 1.15, 1.35, 1.5, 1.6, 1.75, 2];
const SPACINGS = [0, 0.25, 0.4, 0.6, 0.75, 1, 1.5];

export function SizePicker() {
  const { t } = useTranslation();
  const typo = resolveConfig(useActive()).typography;
  return (
    <ValuePicker
      icon={ALargeSmall}
      label={t('ribbon.fontSize')}
      testId="size-picker"
      value={typo.size}
      options={SIZES}
      format={(n) => `${n} pt`}
      onPick={(size) => updateActiveConfig({ typography: { size } })}
    />
  );
}

export function LineHeightPicker() {
  const { t } = useTranslation();
  const typo = resolveConfig(useActive()).typography;
  return (
    <ValuePicker
      icon={MoveVertical}
      label={t('ribbon.lineHeight')}
      testId="lineheight-picker"
      value={typo.lineHeight}
      options={LINE_HEIGHTS}
      onPick={(lineHeight) => updateActiveConfig({ typography: { lineHeight } })}
    />
  );
}

export function SpacingPicker() {
  const { t } = useTranslation();
  const typo = resolveConfig(useActive()).typography;
  return (
    <ValuePicker
      icon={BetweenHorizontalStart}
      label={t('ribbon.paragraphSpacing')}
      testId="spacing-picker"
      value={typo.paragraphSpacing}
      options={SPACINGS}
      format={(n) => `${n} em`}
      onPick={(paragraphSpacing) => updateActiveConfig({ typography: { paragraphSpacing } })}
    />
  );
}
