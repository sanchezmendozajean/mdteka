import {
  FileText,
  FolderKanban,
  FolderOpen,
  HelpCircle,
  Pencil,
  ScanSearch,
  Settings,
  Shapes,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BUNDLED_FONTS, PRESETS } from '@shared/document-config';
import { flatten, itemTitle } from '@shared/project';
import { openPaths } from '../documents/actions';
import type { DialogRequest, WizardResult } from '../documents/store';
import { absoluteOf, updateSettings } from '../project/actions';
import { PROJECT_ICONS } from '../project/icons';
import { useProject } from '../project/store';
import { Icon } from './Icon';
import { Modal } from './Modal';

type Req<K extends DialogRequest['kind']> = Extract<DialogRequest, { kind: K }>;

/** Una línea de texto (nombre de capítulo, libro, archivo…). */
export function PromptDialog({
  req,
  finish,
}: {
  req: Req<'prompt'>;
  finish: (r: string | null) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(req.initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    finish(value);
  };
  return (
    <Modal title={req.title} icon={Pencil} testId="dialog-prompt" onCancel={() => finish(null)}>
      <form onSubmit={submit}>
        <label className="field">
          <span>{req.label}</span>
          <input
            ref={input}
            value={value}
            data-testid="prompt-input"
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => finish(null)}>
            {t('dialogs.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" data-testid="prompt-accept">
            {req.confirm ?? t('dialogs.accept')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Elegir entre varias opciones (qué proyecto abrir, mover el archivo, confirmar un borrado…). */
export function ChooseDialog({
  req,
  finish,
}: {
  req: Req<'choose'>;
  finish: (r: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal title={req.title} icon={HelpCircle} testId="dialog-choose" onCancel={() => finish(null)}>
      {req.body && <p className="choose-body">{req.body}</p>}
      <div className="choose-options">
        {req.options.map((o, i) => (
          <button
            key={o.id}
            className={`btn choose-option${o.danger ? ' danger' : ''}`}
            autoFocus={i === 0}
            data-testid={`choose-${o.id}`}
            onClick={() => finish(o.id)}
          >
            {o.icon && <Icon icon={o.icon} />}
            <span>
              <strong>{o.label}</strong>
              {o.hint && <small>{o.hint}</small>}
            </span>
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" data-testid="choose-cancel" onClick={() => finish(null)}>
          {t('dialogs.cancel')}
        </button>
      </div>
    </Modal>
  );
}

/** Asistente de proyecto nuevo (PRJ-32). */
export function WizardDialog({
  req,
  finish,
}: {
  req: Req<'wizard'>;
  finish: (r: WizardResult | null) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(req.initial.title);
  const [folder, setFolder] = useState(req.initial.folder);
  const [importExisting, setImport] = useState(req.initial.importExisting);
  const pick = async () => {
    const chosen = await window.mdtor.project.folderDialog();
    if (chosen) setFolder(chosen);
  };
  const ok = title.trim() !== '' && folder !== null;
  return (
    <Modal
      title={t('project.wizardTitle')}
      icon={FolderKanban}
      testId="dialog-wizard"
      persistent
      onCancel={() => finish(null)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) finish({ title: title.trim(), folder, importExisting });
        }}
      >
        <label className="field">
          <span>{t('project.wizardName')}</span>
          <input
            autoFocus
            value={title}
            data-testid="wizard-title"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="field">
          <span>{t('project.wizardFolder')}</span>
          <div className="wizard-folder">
            <code data-testid="wizard-folder" title={folder ?? ''}>
              {folder ?? '—'}
            </code>
            <button
              type="button"
              className="btn"
              data-testid="wizard-pick"
              onClick={() => void pick()}
            >
              <Icon icon={FolderOpen} /> {t('project.wizardPick')}
            </button>
          </div>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={importExisting}
            data-testid="wizard-import"
            onChange={(e) => setImport(e.target.checked)}
          />
          <span>{t('project.wizardImport')}</span>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => finish(null)}>
            {t('dialogs.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!ok}
            data-testid="wizard-accept"
          >
            {t('project.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Ajustes del proyecto: título, descripción, nombres, ignorados y valores por defecto (05). */
export function ProjectSettingsDialog({ finish }: { finish: () => void }) {
  const { t } = useTranslation();
  const project = useProject((s) => s.project)!;
  const defaults = (project.defaults ?? {}) as Record<string, unknown> & {
    typography?: { font?: string; size?: number };
    images?: { pasteMode?: string };
    theme?: string;
  };
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? '');
  const [numbered, setNumbered] = useState(!!project.naming?.numbered);
  const [ignore, setIgnore] = useState((project.ignore ?? []).join('\n'));
  const [theme, setTheme] = useState(defaults.theme ?? '');
  const [font, setFont] = useState(defaults.typography?.font ?? '');
  const [size, setSize] = useState(
    defaults.typography?.size ? String(defaults.typography.size) : '',
  );
  const [paste, setPaste] = useState(defaults.images?.pasteMode ?? '');

  const save = async () => {
    const next: Record<string, unknown> = { ...defaults };
    const set = (key: string, value: unknown) => {
      if (value === '' || value === undefined) delete next[key];
      else next[key] = value;
    };
    set('theme', theme);
    const typography = { ...(defaults.typography ?? {}) } as Record<string, unknown>;
    if (font) typography['font'] = font;
    else delete typography['font'];
    const n = Number(size.replace(',', '.'));
    if (size && Number.isFinite(n) && n > 0) typography['size'] = n;
    else delete typography['size'];
    set('typography', Object.keys(typography).length ? typography : undefined);
    const images = { ...(defaults.images ?? {}) } as Record<string, unknown>;
    if (paste) images['pasteMode'] = paste;
    else delete images['pasteMode'];
    set('images', Object.keys(images).length ? images : undefined);
    const patterns = ignore
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    await updateSettings({
      title: title.trim() || project.title,
      description: description.trim() || undefined,
      naming: numbered ? { ...project.naming, numbered: true } : undefined,
      ignore: patterns.length ? patterns : undefined,
      defaults: Object.keys(next).length ? next : undefined,
    });
    finish();
  };

  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: [string, string][],
    testId: string,
  ) => (
    <label className="field">
      <span>{label}</span>
      <select value={value} data-testid={testId} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('project.settingsInherit')}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Modal
      title={t('project.settings')}
      icon={Settings}
      testId="dialog-project-settings"
      wide
      onCancel={finish}
    >
      <div className="settings-grid">
        <label className="field">
          <span>{t('project.settingsTitleField')}</span>
          <input
            value={title}
            data-testid="settings-title"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('project.settingsDescription')}</span>
          <input
            value={description}
            data-testid="settings-description"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={numbered}
            data-testid="settings-numbered"
            onChange={(e) => setNumbered(e.target.checked)}
          />
          <span>{t('project.settingsNumbered')}</span>
        </label>
        <label className="field">
          <span>{t('project.settingsIgnore')}</span>
          <textarea
            rows={3}
            value={ignore}
            data-testid="settings-ignore"
            onChange={(e) => setIgnore(e.target.value)}
          />
        </label>
        <h3 className="settings-section">{t('project.settingsDefaults')}</h3>
        <p className="modal-hint">{t('project.settingsHelp')}</p>
        {select(
          t('project.settingsTheme'),
          theme,
          setTheme,
          PRESETS.map((p) => [p.id, p.name]),
          'settings-theme',
        )}
        {select(
          t('project.settingsFont'),
          font,
          setFont,
          BUNDLED_FONTS.map((f) => [f.name, f.name]),
          'settings-font',
        )}
        <label className="field">
          <span>{t('project.settingsSize')}</span>
          <input
            value={size}
            placeholder={t('project.settingsInherit')}
            data-testid="settings-size"
            onChange={(e) => setSize(e.target.value)}
          />
        </label>
        {select(
          t('project.settingsImages'),
          paste,
          setPaste,
          [
            ['file', t('project.pasteFile')],
            ['base64', t('project.pasteBase64')],
            ['ask', t('project.pasteAsk')],
          ],
          'settings-paste',
        )}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={finish}>
          {t('dialogs.cancel')}
        </button>
        <button
          className="btn btn-primary"
          data-testid="settings-accept"
          onClick={() => void save()}
        >
          {t('dialogs.accept')}
        </button>
      </div>
    </Modal>
  );
}

/** Selector rápido de capítulos (Ctrl+Shift+O). */
export function QuickOpenDialog({ finish }: { finish: () => void }) {
  const { t } = useTranslation();
  const project = useProject((s) => s.project)!;
  const info = useProject((s) => s.info);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return flatten(project)
      .map(({ item, book }) => ({
        item,
        book,
        title: itemTitle(item, info[item.file]?.h1),
      }))
      .filter(
        (r) =>
          !needle ||
          r.title.toLowerCase().includes(needle) ||
          r.item.file.toLowerCase().includes(needle),
      )
      .slice(0, 50);
  }, [project, info, query]);
  const choose = (i: number) => {
    const row = rows[i];
    if (!row) return;
    finish();
    void openPaths([absoluteOf(row.item)]);
  };
  return (
    <Modal
      title={t('project.quickOpenTitle')}
      icon={ScanSearch}
      testId="dialog-quick-open"
      onCancel={finish}
    >
      <input
        className="quick-input"
        autoFocus
        data-testid="quick-open-input"
        placeholder={t('project.quickOpenPlaceholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex(Math.min(rows.length - 1, index + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex(Math.max(0, index - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(index);
          }
          e.stopPropagation();
        }}
      />
      <div className="quick-list" role="listbox" aria-label={t('project.quickOpenTitle')}>
        {rows.length === 0 && <div className="panel-empty">{t('project.quickOpenNone')}</div>}
        {rows.map((r, i) => (
          <button
            key={r.item.id}
            role="option"
            aria-selected={i === index}
            className={`quick-row${i === index ? ' active' : ''}`}
            data-testid="quick-open-row"
            onMouseEnter={() => setIndex(i)}
            onClick={() => choose(i)}
          >
            <Icon icon={FileText} size={15} />
            <span className="quick-title">{r.title}</span>
            <small>{r.item.file}</small>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Rejilla de íconos de Lucide para colecciones y libros. */
export function IconPickerDialog({
  req,
  finish,
}: {
  req: Req<'iconPicker'>;
  finish: (r: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      title={t('project.iconTitle')}
      icon={Shapes}
      testId="dialog-icon-picker"
      onCancel={() => finish(null)}
    >
      <div className="icon-grid">
        {Object.entries(PROJECT_ICONS).map(([name, icon]) => (
          <button
            key={name}
            className="btn"
            title={name}
            aria-label={name}
            aria-pressed={req.current === name}
            data-testid={`icon-${name}`}
            onClick={() => finish(name)}
          >
            <Icon icon={icon} />
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={() => finish(null)}>
          {t('dialogs.cancel')}
        </button>
      </div>
    </Modal>
  );
}
