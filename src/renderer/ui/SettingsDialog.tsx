import {
  Files,
  FileText,
  Image as ImageIcon,
  Keyboard,
  Palette,
  PenLine,
  RotateCcw,
  Settings,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BUNDLED_FONTS, PRESETS } from '@shared/document-config';
import { ACCENTS } from '@shared/settings';
import { resetAppSettings, updateAppSettings, useAppSettings } from '../app/settings';
import {
  conflictFor,
  formatShortcut,
  listCommands,
  shortcutFromEvent,
  shortcutOf,
} from '../commands/registry';
import { askChoose } from '../documents/store';
import { Icon } from './Icon';
import { Modal } from './Modal';

export type SettingsSection =
  | 'general'
  | 'editor'
  | 'appearance'
  | 'documentDefaults'
  | 'images'
  | 'files'
  | 'shortcuts'
  | 'advanced';

const SECTIONS: [SettingsSection, LucideIcon][] = [
  ['general', Settings],
  ['editor', PenLine],
  ['appearance', Palette],
  ['documentDefaults', FileText],
  ['images', ImageIcon],
  ['files', Files],
  ['shortcuts', Keyboard],
  ['advanced', Wrench],
];

const SPELL_CHOICES = ['es-ES', 'es-MX', 'es-AR', 'en-US', 'en-GB', 'fr', 'de', 'pt-BR', 'it'];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="set-row">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        data-testid={testId}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
  testId,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
  testId: string;
}) {
  return (
    <select value={value} data-testid={testId} onChange={(e) => onChange(e.target.value as T)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------------------------

function General() {
  const { t } = useTranslation();
  const g = useAppSettings((s) => s.settings.general);
  return (
    <>
      <Row label={t('settings.language')}>
        <Select
          value={g.language}
          testId="set-language"
          options={[
            ['es', t('settings.languageEs')],
            ['en', t('settings.languageEn')],
          ]}
          onChange={(language) => void updateAppSettings({ general: { language } })}
        />
      </Row>
      <Row label={t('settings.openOnStart')}>
        <Select
          value={g.openOnStart}
          testId="set-open-on-start"
          options={[
            ['welcome', t('settings.openWelcome')],
            ['lastProject', t('settings.openLast')],
          ]}
          onChange={(openOnStart) => void updateAppSettings({ general: { openOnStart } })}
        />
      </Row>
    </>
  );
}

function Editor() {
  const { t } = useTranslation();
  const e = useAppSettings((s) => s.settings.editor);
  const [available, setAvailable] = useState<string[]>(SPELL_CHOICES);
  useEffect(() => {
    void window.mdtor.spell.configure(e.spellcheck, e.spellLanguages).then((list) => {
      setAvailable(SPELL_CHOICES.filter((l) => list.length === 0 || list.includes(l)));
    });
    // Solo al abrir la sección: consultar los idiomas disponibles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const patch = (editor: Record<string, unknown>) => void updateAppSettings({ editor });
  return (
    <>
      <Row label={t('settings.defaultMode')}>
        <Select
          value={e.defaultMode}
          testId="set-default-mode"
          options={[
            ['wysiwyg', t('settings.modeWysiwyg')],
            ['source', t('settings.modeSource')],
          ]}
          onChange={(defaultMode) => patch({ defaultMode })}
        />
      </Row>
      <Check
        label={t('settings.floatingToolbar')}
        checked={e.floatingToolbar}
        testId="set-floating-toolbar"
        onChange={(floatingToolbar) => patch({ floatingToolbar })}
      />
      <Check
        label={t('settings.typewriter')}
        checked={e.typewriter}
        testId="set-typewriter"
        onChange={(typewriter) => patch({ typewriter })}
      />
      <Check
        label={t('settings.spellcheck')}
        checked={e.spellcheck}
        testId="set-spellcheck"
        onChange={(spellcheck) => patch({ spellcheck })}
      />
      {e.spellcheck && (
        <fieldset className="set-group" data-testid="set-spell-languages">
          <legend>{t('settings.spellLanguages')}</legend>
          {available.map((lang) => (
            <label className="check" key={lang}>
              <input
                type="checkbox"
                checked={e.spellLanguages.includes(lang)}
                data-testid={`set-spell-${lang}`}
                onChange={(ev) =>
                  patch({
                    spellLanguages: ev.target.checked
                      ? [...e.spellLanguages, lang]
                      : e.spellLanguages.filter((l) => l !== lang),
                  })
                }
              />
              <span>{lang}</span>
            </label>
          ))}
        </fieldset>
      )}
      <Row label={t('settings.autosave')}>
        <Select
          value={e.autosave.mode}
          testId="set-autosave"
          options={[
            ['off', t('settings.autosaveOff')],
            ['interval', t('settings.autosaveInterval')],
            ['blur', t('settings.autosaveBlur')],
          ]}
          onChange={(mode) => patch({ autosave: { mode } })}
        />
      </Row>
      {e.autosave.mode === 'interval' && (
        <Row label={t('settings.autosaveSeconds')}>
          <input
            type="number"
            min={5}
            max={3600}
            value={e.autosave.seconds}
            data-testid="set-autosave-seconds"
            onChange={(ev) => {
              const seconds = Math.round(Number(ev.target.value));
              if (seconds >= 5 && seconds <= 3600) patch({ autosave: { seconds } });
            }}
          />
        </Row>
      )}
    </>
  );
}

const ACCENT_COLORS: Record<string, string> = {
  teal: '#1d6a72',
  blue: '#2f5bea',
  violet: '#7048e8',
  rose: '#c2255c',
  amber: '#b45f06',
  green: '#2b8a3e',
};

function Appearance() {
  const { t } = useTranslation();
  const a = useAppSettings((s) => s.settings.appearance);
  const patch = (appearance: Record<string, unknown>) => void updateAppSettings({ appearance });
  return (
    <>
      <Row label={t('settings.theme')}>
        <Select
          value={a.theme}
          testId="set-theme"
          options={[
            ['light', t('settings.themeLight')],
            ['dark', t('settings.themeDark')],
            ['system', t('settings.themeSystem')],
          ]}
          onChange={(theme) => patch({ theme })}
        />
      </Row>
      <div className="set-row">
        <span>{t('settings.accent')}</span>
        <div className="swatches" role="radiogroup" aria-label={t('settings.accent')}>
          {ACCENTS.map((accent) => (
            <button
              key={accent}
              role="radio"
              aria-checked={a.accent === accent}
              className="swatch"
              style={{ background: ACCENT_COLORS[accent] }}
              title={t(`settings.accents.${accent}`)}
              aria-label={t(`settings.accents.${accent}`)}
              data-testid={`set-accent-${accent}`}
              onClick={() => patch({ accent })}
            />
          ))}
        </div>
      </div>
      <Row label={t('settings.density')}>
        <Select
          value={a.density}
          testId="set-density"
          options={[
            ['comfortable', t('settings.densityComfortable')],
            ['compact', t('settings.densityCompact')],
          ]}
          onChange={(density) => patch({ density })}
        />
      </Row>
      <Check
        label={t('settings.lightSheet')}
        checked={a.lightSheetInDark}
        testId="set-light-sheet"
        onChange={(lightSheetInDark) => patch({ lightSheetInDark })}
      />
      <Row label={`${t('settings.uiScale')} · ${Math.round(a.uiScale * 100)} %`}>
        <input
          type="range"
          min={80}
          max={150}
          step={10}
          value={Math.round(a.uiScale * 100)}
          data-testid="set-ui-scale"
          onChange={(ev) => patch({ uiScale: Number(ev.target.value) / 100 })}
        />
      </Row>
    </>
  );
}

function DocumentDefaults() {
  const { t } = useTranslation();
  const defaults = useAppSettings((s) => s.settings.documentDefaults) as Record<string, unknown> & {
    theme?: string;
    typography?: { font?: string; size?: number; lineHeight?: number };
  };
  /** Cambia un valor por defecto; un valor vacío vuelve al de fábrica. */
  const setTypo = (key: string, value: unknown) => {
    const typography = { ...(defaults.typography ?? {}) } as Record<string, unknown>;
    if (value === '' || value === undefined) delete typography[key];
    else typography[key] = value;
    const next = { ...defaults };
    if (Object.keys(typography).length) next['typography'] = typography;
    else delete next['typography'];
    void updateAppSettings({ documentDefaults: next });
  };
  const setTheme = (theme: string) => {
    const next = { ...defaults };
    if (theme) next['theme'] = theme;
    else delete next['theme'];
    void updateAppSettings({ documentDefaults: next });
  };
  const num = (v: string) => (v.trim() === '' ? '' : Number(v.replace(',', '.')));
  return (
    <>
      <p className="modal-hint">{t('settings.docDefaultsHelp')}</p>
      <Row label={t('settings.docPreset')}>
        <select
          value={defaults.theme ?? ''}
          data-testid="set-doc-theme"
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="">{t('docPanel.presetNone')}</option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t('settings.docFont')}>
        <select
          value={defaults.typography?.font ?? ''}
          data-testid="set-doc-font"
          onChange={(e) => setTypo('font', e.target.value)}
        >
          <option value="">{t('project.settingsInherit')}</option>
          {BUNDLED_FONTS.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t('settings.docSize')}>
        <input
          defaultValue={defaults.typography?.size ?? ''}
          placeholder={t('project.settingsInherit')}
          data-testid="set-doc-size"
          onBlur={(e) => {
            const n = num(e.target.value);
            if (n === '' || (Number.isFinite(n) && n >= 6 && n <= 72)) setTypo('size', n);
          }}
        />
      </Row>
      <Row label={t('settings.docLineHeight')}>
        <input
          defaultValue={defaults.typography?.lineHeight ?? ''}
          placeholder={t('project.settingsInherit')}
          data-testid="set-doc-line-height"
          onBlur={(e) => {
            const n = num(e.target.value);
            if (n === '' || (Number.isFinite(n) && n >= 1 && n <= 3)) setTypo('lineHeight', n);
          }}
        />
      </Row>
    </>
  );
}

function Images() {
  const { t } = useTranslation();
  const warnKb = useAppSettings((s) => s.settings.images.warnKb);
  const defaults = useAppSettings((s) => s.settings.documentDefaults) as {
    images?: { pasteMode?: string };
  } & Record<string, unknown>;
  const setMode = (mode: string) => {
    const images = { ...(defaults.images ?? {}) } as Record<string, unknown>;
    if (mode) images['pasteMode'] = mode;
    else delete images['pasteMode'];
    const next = { ...defaults };
    if (Object.keys(images).length) next['images'] = images;
    else delete next['images'];
    void updateAppSettings({ documentDefaults: next });
  };
  return (
    <>
      <Row label={t('settings.imagesMode')}>
        <select
          value={defaults.images?.pasteMode ?? ''}
          data-testid="set-paste-mode"
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="">{t('project.settingsInherit')}</option>
          <option value="file">{t('project.pasteFile')}</option>
          <option value="base64">{t('project.pasteBase64')}</option>
          <option value="ask">{t('project.pasteAsk')}</option>
        </select>
      </Row>
      <Row label={t('settings.imagesWarn')}>
        <input
          type="number"
          min={50}
          max={10000}
          defaultValue={warnKb}
          data-testid="set-warn-kb"
          onBlur={(e) => {
            const n = Math.round(Number(e.target.value));
            if (n >= 50 && n <= 10000) void updateAppSettings({ images: { warnKb: n } });
          }}
        />
      </Row>
    </>
  );
}

function FilesSection() {
  const { t } = useTranslation();
  const eol = useAppSettings((s) => s.settings.files.newEol);
  return (
    <>
      <Row label={t('settings.filesEol')}>
        <Select
          value={eol}
          testId="set-eol"
          options={[
            ['lf', t('settings.eolLf')],
            ['crlf', t('settings.eolCrlf')],
          ]}
          onChange={(newEol) => void updateAppSettings({ files: { newEol } })}
        />
      </Row>
      <p className="modal-hint">{t('settings.serializationNote')}</p>
      <div className="set-row">
        <span>{t('settings.associate')}</span>
        <button
          className="btn"
          data-testid="set-associate"
          onClick={() => void window.mdtor.appUi.openDefaultApps()}
        >
          {t('settings.associateButton')}
        </button>
      </div>
      <p className="modal-hint">{t('settings.associateHelp')}</p>
    </>
  );
}

function Shortcuts() {
  const { t } = useTranslation();
  const overrides = useAppSettings((s) => s.settings.shortcuts);
  const [query, setQuery] = useState('');
  const [capturing, setCapturing] = useState<string | null>(null);
  const [warning, setWarning] = useState('');
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listCommands().filter((c) => !needle || t(c.labelKey).toLowerCase().includes(needle));
    // `overrides` fuerza el recálculo al reasignar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, t, overrides]);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return setCapturing(null);
      if (e.key === 'Backspace' || e.key === 'Delete') {
        void updateAppSettings({ shortcuts: { ...overrides, [capturing]: '' } });
        setWarning('');
        return setCapturing(null);
      }
      const shortcut = shortcutFromEvent(e);
      if (!shortcut) return;
      const other = conflictFor(shortcut, capturing);
      if (other) return setWarning(t('settings.shortcutsConflict', { name: t(other.labelKey) }));
      void updateAppSettings({ shortcuts: { ...overrides, [capturing]: shortcut } });
      setWarning('');
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, overrides, t]);

  const reset = (id: string) => {
    const next = { ...overrides };
    delete next[id];
    void updateAppSettings({ shortcuts: next });
  };
  return (
    <>
      <p className="modal-hint">{t('settings.shortcutsHint')}</p>
      <input
        className="quick-input"
        placeholder={t('settings.shortcutsSearch')}
        value={query}
        data-testid="set-shortcut-search"
        onChange={(e) => setQuery(e.target.value)}
      />
      {warning && (
        <p className="set-warning" role="alert" data-testid="set-shortcut-warning">
          {warning}
        </p>
      )}
      <div className="shortcut-list" data-testid="shortcut-list">
        {rows.map((cmd) => {
          const current = shortcutOf(cmd);
          const changed = cmd.id in overrides;
          return (
            <div className="shortcut-row" key={cmd.id} data-testid={`shortcut-${cmd.id}`}>
              <Icon icon={cmd.icon} size={16} />
              <span className="shortcut-name">{t(cmd.labelKey)}</span>
              {cmd.native ? (
                <kbd title={t('settings.shortcutsNative')}>
                  {cmd.shortcut ? formatShortcut(cmd.shortcut) : '—'}
                </kbd>
              ) : (
                <button
                  className="btn shortcut-key"
                  aria-pressed={capturing === cmd.id}
                  data-testid={`shortcut-set-${cmd.id}`}
                  onClick={() => {
                    setWarning('');
                    setCapturing(capturing === cmd.id ? null : cmd.id);
                  }}
                >
                  {capturing === cmd.id
                    ? t('settings.shortcutsPress')
                    : current
                      ? formatShortcut(current)
                      : t('settings.shortcutsNone')}
                </button>
              )}
              {changed && (
                <button
                  className="btn btn-mini"
                  title={t('settings.shortcutsReset')}
                  aria-label={t('settings.shortcutsReset')}
                  data-testid={`shortcut-reset-${cmd.id}`}
                  onClick={() => reset(cmd.id)}
                >
                  <Icon icon={RotateCcw} size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {Object.keys(overrides).length > 0 && (
        <button
          className="btn"
          data-testid="shortcut-reset-all"
          onClick={() => void updateAppSettings({ shortcuts: {} })}
        >
          <Icon icon={RotateCcw} /> {t('settings.shortcutsResetAll')}
        </button>
      )}
    </>
  );
}

function Advanced() {
  const { t } = useTranslation();
  return (
    <div className="set-row">
      <span>{t('settings.advancedReset')}</span>
      <button
        className="btn"
        data-testid="set-reset"
        onClick={async () => {
          const answer = await askChoose(
            t('settings.advancedReset'),
            [{ id: 'reset', label: t('settings.advancedReset'), icon: RotateCcw, danger: true }],
            t('settings.advancedResetBody'),
            true,
          );
          if (answer === 'reset') await resetAppSettings();
        }}
      >
        <Icon icon={RotateCcw} /> {t('settings.advancedReset')}
      </button>
    </div>
  );
}

const BODIES: Record<SettingsSection, () => ReactNode> = {
  general: () => <General />,
  editor: () => <Editor />,
  appearance: () => <Appearance />,
  documentDefaults: () => <DocumentDefaults />,
  images: () => <Images />,
  files: () => <FilesSection />,
  shortcuts: () => <Shortcuts />,
  advanced: () => <Advanced />,
};

/** Ajustes de la app (09): secciones con ícono; cada cambio se guarda al instante. */
export function SettingsDialog({
  section,
  finish,
}: {
  section?: SettingsSection;
  finish: () => void;
}) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<SettingsSection>(section ?? 'general');
  return (
    <Modal
      title={t('settings.title')}
      icon={Settings}
      testId="dialog-settings"
      wide
      onCancel={finish}
    >
      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('settings.title')}>
          {SECTIONS.map(([id, icon]) => (
            <button
              key={id}
              className="settings-tab"
              aria-current={current === id}
              data-testid={`settings-tab-${id}`}
              onClick={() => setCurrent(id)}
            >
              <Icon icon={icon} size={16} /> {t(`settings.sections.${id}`)}
            </button>
          ))}
        </nav>
        <div className="settings-body" data-testid={`settings-section-${current}`}>
          {BODIES[current]()}
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" data-testid="settings-close" onClick={finish}>
          <Icon icon={X} /> {t('settings.close')}
        </button>
      </div>
    </Modal>
  );
}
