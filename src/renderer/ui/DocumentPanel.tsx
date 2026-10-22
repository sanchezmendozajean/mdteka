import { FileText, PanelRight, RotateCcw, Settings } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BUNDLED_FONTS,
  originOf,
  PRESETS,
  STYLE_KEYS,
  type StyleKey,
} from '@shared/document-config';
import { PAPER_MM } from '@shared/page';
import { useUi } from '../app/store';
import { saveViewAsDefault } from '../documents/view';
import {
  pinAll,
  repairConfig,
  resolveConfig,
  resetConfig,
  saveAsAppDefaults,
  updateConfig,
  useSettings,
} from '../documents/config';
import { useDocs } from '../documents/store';
import { Icon } from './Icon';

type Json = Record<string, unknown>;

/** `['a','b']`, 3 → `{ a: { b: 3 } }`. */
function nest(path: string[], value: unknown): Json {
  return path.reduceRight<unknown>((acc, key) => ({ [key]: acc }), value) as Json;
}

interface RowProps {
  label: string;
  path: string[];
  children: ReactNode;
}

/** Fila de campo con indicador de origen y «volver al heredado» (04 · Herencia). */
function Row({ label, path, children }: RowProps) {
  const { t } = useTranslation();
  const doc = useDocs((d) => d.docs.find((x) => x.id === d.activeId));
  const defaults = useSettings((d) => d.documentDefaults);
  if (!doc) return null;
  const origin = originOf(path, doc.config.config, defaults);
  return (
    <div className="field-row" data-testid={`cfg-${path.join('.')}`} data-origin={origin}>
      <span className="field-label">{label}</span>
      <div className="field-control">{children}</div>
      <span className="field-origin">
        {origin === 'document' && (
          <>
            <span title={t('docPanel.originDocument')}>
              <Icon icon={FileText} size={14} />
            </span>
            <button
              className="btn btn-mini"
              title={t('docPanel.backToInherited')}
              aria-label={t('docPanel.backToInherited')}
              data-testid={`cfg-reset-${path.join('.')}`}
              onClick={() => updateConfig(doc.id, nest(path, undefined))}
            >
              <Icon icon={RotateCcw} size={14} />
            </button>
          </>
        )}
        {origin === 'app' && (
          <span title={t('docPanel.originApp')}>
            <Icon icon={Settings} size={14} />
          </span>
        )}
      </span>
    </div>
  );
}

/** Campo numérico con la unidad dentro del cuadro (como Illustrator); ↑/↓ cambian el valor. */
function NumberInput({
  value,
  min,
  max,
  step,
  unit,
  onCommit,
  testId,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onCommit: (n: number) => void;
  testId: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const apply = (text: string) => {
    const n = Number(text.replace(',', '.'));
    if (!Number.isFinite(n) || text.trim() === '') return setDraft(String(value));
    const clamped = Math.round(Math.min(max, Math.max(min, n)) * 1000) / 1000;
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <span className="unit-input">
      <input
        inputMode="decimal"
        className="field-input"
        value={draft}
        data-testid={testId}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => apply(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply(draft);
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const n = Number(draft.replace(',', '.'));
            apply(String((Number.isFinite(n) ? n : value) + (e.key === 'ArrowUp' ? step : -step)));
          }
        }}
      />
      <span className="unit" aria-hidden="true">
        {unit}
      </span>
    </span>
  );
}

/** Campo de texto que confirma al salir o con Enter. */
function TextInput({
  value,
  onCommit,
  testId,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  testId: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft);
  return (
    <input
      className="field-input"
      value={draft}
      placeholder={placeholder}
      data-testid={testId}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

/** Campo de fuente: texto libre con sugerencias de las fuentes incluidas. */
function FontInput({
  value,
  mono,
  onCommit,
  testId,
}: {
  value: string;
  mono: boolean;
  onCommit: (v: string) => void;
  testId: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const list = `fonts-${mono ? 'mono' : 'text'}`;
  const commit = (v: string) => {
    const name = v.trim();
    if (name && name !== value)
      onCommit(
        BUNDLED_FONTS.find((f) => f.name.toLowerCase() === name.toLowerCase())?.name ?? name,
      );
    else setDraft(value);
  };
  return (
    <>
      <input
        className="field-input"
        list={list}
        value={draft}
        data-testid={testId}
        onChange={(e) => {
          setDraft(e.target.value);
          if (BUNDLED_FONTS.some((f) => f.name === e.target.value)) commit(e.target.value);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
      />
      <datalist id={list}>
        {BUNDLED_FONTS.filter((f) => (f.kind === 'mono') === mono).map((f) => (
          <option key={f.name} value={f.name} />
        ))}
      </datalist>
    </>
  );
}

export function DocumentPanel() {
  const { t } = useTranslation();
  const doc = useDocs((s) => s.docs.find((d) => d.id === s.activeId));
  const stylesFocus = useUi((s) => s.stylesFocus);
  const [styleKey, setStyleKey] = useState<StyleKey>('h1');
  const stylesRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const pageFocus = useUi((s) => s.pageFocus);

  useEffect(() => {
    if (pageFocus > 0) pageRef.current?.scrollIntoView({ block: 'start' });
  }, [pageFocus]);

  useEffect(() => {
    if (stylesFocus > 0) stylesRef.current?.scrollIntoView({ block: 'start' });
  }, [stylesFocus]);

  const shell = (body: ReactNode) => (
    <aside className="panel right" data-testid="document-panel" aria-label={t('panels.document')}>
      <div className="panel-title">
        <Icon icon={PanelRight} /> {t('panels.document')}
      </div>
      {body}
    </aside>
  );
  if (!doc) return shell(<div className="panel-empty">{t('docPanel.noDoc')}</div>);

  const cfg = doc.config.config;
  const eff = resolveConfig(doc);
  const typo = eff.typography;
  const page = eff.page;
  const margins = page.margins ?? { top: 25, right: 25, bottom: 25, left: 25 };
  const style = eff.styles[styleKey] ?? {};
  const set = (path: string[], value: unknown) => updateConfig(doc.id, nest(path, value));

  const stylePath = (k: string) => ['styles', styleKey, k];
  const isHeading = styleKey.startsWith('h');
  const flag = (k: 'italic' | 'uppercase' | 'numbering', label: string) => (
    <Row label={label} path={stylePath(k)}>
      <input
        type="checkbox"
        checked={style[k] === true}
        data-testid={`style-${k}`}
        onChange={(e) => set(stylePath(k), e.target.checked)}
      />
    </Row>
  );

  return shell(
    <div className="panel-scroll">
      {doc.config.status === 'invalid' && (
        <div className="panel-warning" role="alert" data-testid="config-invalid">
          {t('docPanel.invalid', { error: doc.config.error ?? '' })}
          <button className="btn" onClick={() => repairConfig(doc.id)}>
            {t('docPanel.repair')}
          </button>
        </div>
      )}

      <section className="panel-section">
        <h3>{t('docPanel.preset')}</h3>
        <select
          className="field-input"
          value={cfg?.theme ?? ''}
          data-testid="cfg-theme"
          onChange={(e) =>
            updateConfig(doc.id, {
              theme: e.target.value || undefined,
              typography: undefined,
              styles: undefined,
            })
          }
        >
          <option value="">{t('ribbon.presetNone')}</option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </section>

      <section className="panel-section" ref={pageRef} data-testid="page-section">
        <h3>{t('docPanel.pageSection')}</h3>
        <Row label={t('docPanel.paperSize')} path={['page', 'size']}>
          <select
            className="field-input"
            value={typeof page.size === 'string' ? page.size : 'A4'}
            data-testid="cfg-paper"
            onChange={(e) => set(['page', 'size'], e.target.value)}
          >
            {Object.keys(PAPER_MM).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('docPanel.orientation')} path={['page', 'orientation']}>
          <select
            className="field-input"
            value={page.orientation ?? 'portrait'}
            data-testid="cfg-orientation"
            onChange={(e) => set(['page', 'orientation'], e.target.value)}
          >
            <option value="portrait">{t('docPanel.portrait')}</option>
            <option value="landscape">{t('docPanel.landscape')}</option>
          </select>
        </Row>
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <Row
            key={side}
            label={t(`docPanel.margin${side[0]!.toUpperCase()}${side.slice(1)}`)}
            path={['page', 'margins']}
          >
            <NumberInput
              value={Math.round(margins[side] * 10) / 10}
              min={0}
              max={200}
              step={1}
              unit="mm"
              testId={`cfg-margin-${side}`}
              onCommit={(n) => set(['page', 'margins'], { ...margins, [side]: n })}
            />
          </Row>
        ))}
        <Row label={t('docPanel.header')} path={['page', 'header', 'text']}>
          <TextInput
            value={page.header?.text ?? ''}
            testId="cfg-header-text"
            placeholder={t('docPanel.tokensHint')}
            onCommit={(v) => set(['page', 'header', 'text'], v)}
          />
        </Row>
        <Row label={t('docPanel.headerAlign')} path={['page', 'header', 'align']}>
          <select
            className="field-input"
            value={page.header?.align ?? 'left'}
            data-testid="cfg-header-align"
            onChange={(e) => set(['page', 'header', 'align'], e.target.value)}
          >
            <option value="left">{t('docPanel.alignLeft')}</option>
            <option value="center">{t('docPanel.alignCenter')}</option>
            <option value="right">{t('docPanel.alignRight')}</option>
          </select>
        </Row>
        <Row label={t('docPanel.footer')} path={['page', 'footer', 'text']}>
          <TextInput
            value={page.footer?.text ?? ''}
            testId="cfg-footer-text"
            placeholder={t('docPanel.tokensHint')}
            onCommit={(v) => set(['page', 'footer', 'text'], v)}
          />
        </Row>
        <Row label={t('docPanel.footerAlign')} path={['page', 'footer', 'align']}>
          <select
            className="field-input"
            value={page.footer?.align ?? 'center'}
            data-testid="cfg-footer-align"
            onChange={(e) => set(['page', 'footer', 'align'], e.target.value)}
          >
            <option value="left">{t('docPanel.alignLeft')}</option>
            <option value="center">{t('docPanel.alignCenter')}</option>
            <option value="right">{t('docPanel.alignRight')}</option>
          </select>
        </Row>
        <Row label={t('docPanel.firstPageDifferent')} path={['page', 'firstPageDifferent']}>
          <input
            type="checkbox"
            checked={page.firstPageDifferent === true}
            data-testid="cfg-first-page"
            onChange={(e) => set(['page', 'firstPageDifferent'], e.target.checked)}
          />
        </Row>
        <button
          className="btn panel-inline-btn"
          data-testid="cfg-save-view"
          onClick={() => saveViewAsDefault(doc.id)}
        >
          {t('docPanel.saveView')}
        </button>
      </section>

      <section className="panel-section">
        <h3>{t('docPanel.typography')}</h3>
        <Row label={t('docPanel.font')} path={['typography', 'font']}>
          <FontInput
            value={typo.font}
            mono={false}
            testId="cfg-font"
            onCommit={(v) => set(['typography', 'font'], v)}
          />
        </Row>
        <Row label={t('docPanel.monoFont')} path={['typography', 'monoFont']}>
          <FontInput
            value={typo.monoFont}
            mono
            testId="cfg-monoFont"
            onCommit={(v) => set(['typography', 'monoFont'], v)}
          />
        </Row>
        <Row label={t('docPanel.size')} path={['typography', 'size']}>
          <NumberInput
            value={typo.size}
            min={6}
            max={48}
            step={0.5}
            testId="cfg-size"
            unit="pt"
            onCommit={(n) => set(['typography', 'size'], n)}
          />
        </Row>
        <Row label={t('docPanel.lineHeight')} path={['typography', 'lineHeight']}>
          <NumberInput
            value={typo.lineHeight}
            min={1}
            max={3}
            step={0.05}
            testId="cfg-lineHeight"
            unit="×"
            onCommit={(n) => set(['typography', 'lineHeight'], n)}
          />
        </Row>
        <Row label={t('docPanel.paragraphSpacing')} path={['typography', 'paragraphSpacing']}>
          <NumberInput
            value={typo.paragraphSpacing}
            min={0}
            max={4}
            step={0.05}
            testId="cfg-paragraphSpacing"
            unit="em"
            onCommit={(n) => set(['typography', 'paragraphSpacing'], n)}
          />
        </Row>
        <Row label={t('docPanel.textAlign')} path={['typography', 'textAlign']}>
          <select
            className="field-input"
            value={typo.textAlign}
            data-testid="cfg-textAlign"
            onChange={(e) => set(['typography', 'textAlign'], e.target.value)}
          >
            <option value="left">{t('docPanel.alignLeft')}</option>
            <option value="justify">{t('docPanel.alignJustify')}</option>
          </select>
        </Row>
        <Row label={t('docPanel.hyphenate')} path={['typography', 'hyphenate']}>
          <input
            type="checkbox"
            checked={typo.hyphenate}
            data-testid="cfg-hyphenate"
            onChange={(e) => set(['typography', 'hyphenate'], e.target.checked)}
          />
        </Row>
        <Row label={t('docPanel.language')} path={['typography', 'language']}>
          <input
            className="field-input"
            defaultValue={typo.language}
            key={typo.language}
            data-testid="cfg-language"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== typo.language) set(['typography', 'language'], v);
            }}
          />
        </Row>
      </section>

      <section className="panel-section" ref={stylesRef} data-testid="styles-section">
        <h3>{t('docPanel.styles')}</h3>
        <div className="field-row">
          <span className="field-label">{t('docPanel.element')}</span>
          <div className="field-control">
            <select
              className="field-input"
              value={styleKey}
              data-testid="style-element"
              onChange={(e) => setStyleKey(e.target.value as StyleKey)}
            >
              {STYLE_KEYS.filter((k) => k !== 'table').map((k) => (
                <option key={k} value={k}>
                  {t(`docPanel.elements.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <span className="field-origin" />
        </div>
        {isHeading && (
          <Row label={t('docPanel.styleSize')} path={stylePath('size')}>
            <NumberInput
              value={style.size ?? 1}
              min={0.25}
              max={10}
              step={0.05}
              testId="style-size"
              unit="em"
              onCommit={(n) => set(stylePath('size'), n)}
            />
          </Row>
        )}
        <Row label={t('docPanel.weight')} path={stylePath('weight')}>
          <select
            className="field-input"
            value={style.weight ?? ''}
            data-testid="style-weight"
            onChange={(e) =>
              set(stylePath('weight'), e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value="" />
            {[300, 400, 500, 600, 700, 800].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Row>
        {flag('italic', t('docPanel.italic'))}
        <Row label={t('docPanel.color')} path={stylePath('color')}>
          <input
            type="color"
            value={style.color ?? '#1f1e1c'}
            data-testid="style-color"
            onChange={(e) => set(stylePath('color'), e.target.value)}
          />
        </Row>
        {(isHeading || styleKey === 'paragraph') && (
          <>
            <Row label={t('docPanel.spacingBefore')} path={stylePath('spacingBefore')}>
              <NumberInput
                value={style.spacingBefore ?? 0}
                min={0}
                max={10}
                step={0.05}
                testId="style-spacingBefore"
                unit="em"
                onCommit={(n) => set(stylePath('spacingBefore'), n)}
              />
            </Row>
            <Row label={t('docPanel.spacingAfter')} path={stylePath('spacingAfter')}>
              <NumberInput
                value={style.spacingAfter ?? 0}
                min={0}
                max={10}
                step={0.05}
                testId="style-spacingAfter"
                unit="em"
                onCommit={(n) => set(stylePath('spacingAfter'), n)}
              />
            </Row>
          </>
        )}
        {isHeading && flag('uppercase', t('docPanel.uppercase'))}
        {isHeading && flag('numbering', t('docPanel.numbering'))}
      </section>

      <section className="panel-actions">
        <button className="btn" data-testid="cfg-pin" onClick={() => pinAll(doc.id)}>
          {t('docPanel.pinAll')}
        </button>
        <button className="btn" data-testid="cfg-reset" onClick={() => resetConfig(doc.id)}>
          {t('docPanel.reset')}
        </button>
        <button
          className="btn"
          data-testid="cfg-save-default"
          disabled={!cfg}
          onClick={() => void saveAsAppDefaults(doc.id)}
        >
          {t('docPanel.saveAsDefault')}
        </button>
      </section>
    </div>,
  );
}
