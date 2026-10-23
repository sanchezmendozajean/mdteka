import { Code, FileImage, ImageIcon, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DialogRequest, ImagePasteChoice } from '../documents/store';
import { Icon } from './Icon';
import { Modal } from './Modal';

type Req<K extends DialogRequest['kind']> = Extract<DialogRequest, { kind: K }>;

const kb = (bytes: number) => Math.max(1, Math.round(bytes / 1024));

/** Diálogo al pegar una imagen en modo «preguntar» (06 · IMG-03). */
export function ImagePasteDialog({
  req,
  finish,
}: {
  req: Req<'imagePaste'>;
  finish: (r: ImagePasteChoice | null) => void;
}) {
  const { t } = useTranslation();
  const { info } = req;
  const ext = info.name?.split('.').pop() ?? 'png';
  const stem = info.name ? info.name.slice(0, info.name.length - ext.length - 1) : '';
  const [name, setName] = useState(stem);
  const [remember, setRemember] = useState(false);
  const [asDefault, setAsDefault] = useState(false);
  const choose = (mode: 'file' | 'base64') =>
    finish({
      mode,
      name:
        mode === 'file' && info.count === 1 && name && name !== stem ? `${name}.${ext}` : undefined,
      remember,
      asDefault,
    });

  // Enter = guardar como archivo (opción predeterminada); Esc cancela (lo gestiona Modal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        choose('file');
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <Modal
      title={t('images.pasteTitle')}
      icon={ImageIcon}
      testId="dialog-image-paste"
      onCancel={() => finish(null)}
    >
      <div className="image-ask">
        <div className="image-ask-thumb">
          {info.preview ? <img src={info.preview} alt="" /> : <Icon icon={ImageIcon} size={48} />}
        </div>
        <div className="image-ask-meta">
          <p data-testid="image-meta">
            {info.width && info.height ? `${info.width} × ${info.height} px · ` : ''}
            {kb(info.bytes)} KB
            {info.count > 1 ? ` · ${t('images.more', { count: info.count - 1 })}` : ''}
          </p>
          <button
            className="btn image-choice"
            autoFocus
            data-testid="image-as-file"
            onClick={() => choose('file')}
          >
            <Icon icon={FileImage} />
            <span>
              <strong>{t('images.asFile')}</strong>
              {!info.name && <small>{t('images.saveFirst')}</small>}
              {info.name && info.count > 1 && <small>{info.name}</small>}
            </span>
          </button>
          {info.name && info.count === 1 && (
            <input
              className="field-input image-name"
              value={name}
              aria-label={t('images.fileName')}
              data-testid="image-name"
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <button
            className="btn image-choice"
            data-testid="image-embed"
            onClick={() => choose('base64')}
          >
            <Icon icon={Code} />
            <span>
              <strong>{t('images.embed')}</strong>
              <small>{t('images.embedSize', { kb: kb((info.bytes * 4) / 3) })}</small>
            </span>
          </button>
        </div>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={remember}
          data-testid="image-remember"
          onChange={(e) => setRemember(e.target.checked)}
        />
        {t('images.remember')}
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={asDefault}
          data-testid="image-default"
          onChange={(e) => setAsDefault(e.target.checked)}
        />
        {t('images.asDefault')}
      </label>
      <div className="modal-actions">
        <button className="btn" onClick={() => finish(null)}>
          {t('dialogs.cancel')}
        </button>
      </div>
    </Modal>
  );
}

/** Aviso al incrustar una imagen pesada (06 · IMG-01). */
export function ImageLargeDialog({
  req,
  finish,
}: {
  req: Req<'imageLarge'>;
  finish: (r: 'file' | 'embed' | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      title={t('images.largeTitle')}
      icon={TriangleAlert}
      testId="dialog-image-large"
      onCancel={() => finish(null)}
    >
      <p>{t('images.largeBody', { kb: req.kb })}</p>
      <div className="modal-actions">
        <button className="btn" data-testid="image-large-embed" onClick={() => finish('embed')}>
          {t('images.embedAnyway')}
        </button>
        <button
          className="btn btn-primary"
          autoFocus
          data-testid="image-large-file"
          onClick={() => finish('file')}
        >
          {t('images.asFile')}
        </button>
      </div>
    </Modal>
  );
}

/** Dirección de una imagen remota (06 · IMG-11). */
export function ImageUrlDialog({ finish }: { finish: (r: string | null) => void }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('https://');
  const valid = /^https?:\/\/\S+$/i.test(url.trim());
  return (
    <Modal
      title={t('images.urlTitle')}
      icon={ImageIcon}
      testId="dialog-image-url"
      onCancel={() => finish(null)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) finish(url.trim());
        }}
      >
        <label className="field">
          <span>{t('images.urlLabel')}</span>
          <input
            autoFocus
            value={url}
            data-testid="image-url"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => finish(null)}>
            {t('dialogs.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!valid}
            data-testid="image-url-accept"
          >
            {t('dialogs.accept')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Cómo llevar las imágenes-archivo a un HTML exportado (06 · VW-42). */
export function ExportImagesDialog({
  req,
  finish,
}: {
  req: Req<'exportImages'>;
  finish: (r: 'embed' | 'folder' | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      title={t('images.exportTitle')}
      icon={ImageIcon}
      testId="dialog-export-images"
      onCancel={() => finish(null)}
    >
      <p>{t('images.exportBody', { count: req.count })}</p>
      <div className="modal-actions">
        <button className="btn" data-testid="export-folder" onClick={() => finish('folder')}>
          {t('images.exportFolder')}
        </button>
        <button
          className="btn btn-primary"
          autoFocus
          data-testid="export-embed"
          onClick={() => finish('embed')}
        >
          {t('images.exportEmbed')}
        </button>
      </div>
    </Modal>
  );
}
