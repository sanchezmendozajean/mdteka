import { Link2, TriangleAlert, Unlink, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lineDiff } from '../documents/diff';
import { useDialogs } from '../documents/store';
import { Icon } from './Icon';
import {
  ExportImagesDialog,
  ImageLargeDialog,
  ImagePasteDialog,
  ImageUrlDialog,
} from './ImageDialogs';
import { CommandPalette } from './CommandPalette';
import { Modal } from './Modal';
import { SettingsDialog } from './SettingsDialog';
import {
  ChooseDialog,
  IconPickerDialog,
  ProjectSettingsDialog,
  PromptDialog,
  QuickOpenDialog,
  WizardDialog,
} from './ProjectDialogs';

export function Dialogs() {
  const { t } = useTranslation();
  const { current, close } = useDialogs();
  const first = useRef<HTMLInputElement>(null);
  const [href, setHref] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    if (current?.kind === 'link') {
      setHref(current.initial.href);
      setTitle(current.initial.title);
      setText(current.initial.text);
      requestAnimationFrame(() => first.current?.focus());
    }
  }, [current]);

  const diff = useMemo(
    () => (current?.kind === 'compare' ? lineDiff(current.mine, current.theirs) : []),
    [current],
  );

  if (!current) return null;
  const done = <T,>(resolve: (v: T) => void, value: T) => {
    resolve(value);
    close();
  };

  switch (current.kind) {
    case 'unsaved':
      return (
        <Modal
          title={t('dialogs.unsavedTitle')}
          icon={TriangleAlert}
          testId="dialog-unsaved"
          onCancel={() => done(current.resolve, 'cancel')}
        >
          <p>{t('dialogs.unsavedBody', { name: current.name })}</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => done(current.resolve, 'cancel')}>
              {t('dialogs.cancel')}
            </button>
            <button
              className="btn"
              data-testid="dialog-discard"
              onClick={() => done(current.resolve, 'discard')}
            >
              {t('dialogs.discard')}
            </button>
            <button
              className="btn btn-primary"
              autoFocus
              data-testid="dialog-save"
              onClick={() => done(current.resolve, 'save')}
            >
              {t('dialogs.save')}
            </button>
          </div>
        </Modal>
      );
    case 'external':
      return (
        <Modal
          title={t('dialogs.externalTitle')}
          icon={TriangleAlert}
          testId="dialog-external"
          onCancel={() => done(current.resolve, 'keep')}
        >
          <p>{t('dialogs.externalBody', { name: current.name })}</p>
          <div className="modal-actions">
            <button
              className="btn"
              data-testid="dialog-compare"
              onClick={() => done(current.resolve, 'compare')}
            >
              {t('dialogs.compare')}
            </button>
            <button
              className="btn"
              data-testid="dialog-keep"
              onClick={() => done(current.resolve, 'keep')}
            >
              {t('dialogs.keep')}
            </button>
            <button
              className="btn btn-primary"
              autoFocus
              data-testid="dialog-reload"
              onClick={() => done(current.resolve, 'reload')}
            >
              {t('dialogs.reload')}
            </button>
          </div>
        </Modal>
      );
    case 'compare':
      return (
        <Modal
          title={t('dialogs.compareTitle', { name: current.name })}
          icon={TriangleAlert}
          wide
          testId="dialog-compare-view"
          onCancel={() => done(current.resolve, undefined)}
        >
          <p className="modal-hint">{t('dialogs.compareHint')}</p>
          <pre className="diff">
            {diff.map((line, i) => (
              <div key={i} className={`diff-${line.kind}`}>
                {line.kind === 'mine' ? '− ' : line.kind === 'theirs' ? '+ ' : '  '}
                {line.text}
              </div>
            ))}
          </pre>
          <div className="modal-actions">
            <button
              className="btn btn-primary"
              autoFocus
              onClick={() => done(current.resolve, undefined)}
            >
              {t('dialogs.close')}
            </button>
          </div>
        </Modal>
      );
    case 'error':
      return (
        <Modal
          title={t('dialogs.errorTitle')}
          icon={TriangleAlert}
          testId="dialog-error"
          onCancel={() => done(current.resolve, undefined)}
        >
          <p className="modal-pre">{current.message}</p>
          <div className="modal-actions">
            <button
              className="btn btn-primary"
              autoFocus
              onClick={() => done(current.resolve, undefined)}
            >
              {t('dialogs.accept')}
            </button>
          </div>
        </Modal>
      );
    case 'palette':
      return <CommandPalette finish={() => done(current.resolve, undefined)} />;
    case 'settings':
      return (
        <SettingsDialog section={current.section} finish={() => done(current.resolve, undefined)} />
      );
    case 'prompt':
      return <PromptDialog req={current} finish={(r) => done(current.resolve, r)} />;
    case 'choose':
      return <ChooseDialog req={current} finish={(r) => done(current.resolve, r)} />;
    case 'wizard':
      return <WizardDialog req={current} finish={(r) => done(current.resolve, r)} />;
    case 'projectSettings':
      return <ProjectSettingsDialog finish={() => done(current.resolve, undefined)} />;
    case 'quickOpen':
      return <QuickOpenDialog finish={() => done(current.resolve, undefined)} />;
    case 'iconPicker':
      return <IconPickerDialog req={current} finish={(r) => done(current.resolve, r)} />;
    case 'imagePaste':
      return <ImagePasteDialog req={current} finish={(r) => done(current.resolve, r)} />;
    case 'imageLarge':
      return <ImageLargeDialog req={current} finish={(r) => done(current.resolve, r)} />;
    case 'imageUrl':
      return <ImageUrlDialog finish={(r) => done(current.resolve, r)} />;
    case 'exportImages':
      return <ExportImagesDialog req={current} finish={(r) => done(current.resolve, r)} />;
    case 'link':
      return (
        <Modal
          title={t('dialogs.linkTitle')}
          icon={Link2}
          testId="dialog-link"
          onCancel={() => done(current.resolve, null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              done(current.resolve, { href, title: title || null, text });
            }}
          >
            <label className="field">
              <span>{t('dialogs.linkUrl')}</span>
              <input
                ref={first}
                value={href}
                onChange={(e) => setHref(e.target.value)}
                data-testid="link-url"
              />
            </label>
            {!current.initial.hasSelection && !current.initial.href && (
              <label className="field">
                <span>{t('dialogs.linkText')}</span>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  data-testid="link-text"
                />
              </label>
            )}
            <label className="field">
              <span>{t('dialogs.linkTitleField')}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="modal-actions">
              {current.initial.href && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => done(current.resolve, { href: '' })}
                >
                  <Icon icon={Unlink} /> {t('dialogs.linkRemove')}
                </button>
              )}
              <button type="button" className="btn" onClick={() => done(current.resolve, null)}>
                <Icon icon={X} /> {t('dialogs.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" data-testid="link-accept">
                {t('dialogs.accept')}
              </button>
            </div>
          </form>
        </Modal>
      );
  }
}
