import {
  Check,
  Code,
  Download,
  FileImage,
  FolderOpen,
  ImageUp,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  convertToBase64,
  convertToFile,
  imageKind,
  replaceImage,
  showImageInFolder,
} from '../documents/images';
import { editor } from '../editor/controller';
import { useImageUi } from '../editor/image-ui-store';
import { Icon } from './Icon';

function Action({
  icon,
  label,
  testId,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  testId: string;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      className="btn"
      title={label}
      aria-label={label}
      data-testid={testId}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon icon={icon} />
    </button>
  );
}

/** Campo que confirma al salir o con Enter. */
function Field({
  label,
  value,
  testId,
  onCommit,
}: {
  label: string;
  value: string;
  testId: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft);
  return (
    <label className="field image-field">
      <span>{label}</span>
      <input
        value={draft}
        data-testid={testId}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          e.stopPropagation();
        }}
      />
    </label>
  );
}

/**
 * Menú flotante de la imagen seleccionada (06): texto alternativo, título, reemplazar, convertir
 * (archivo ⇄ base64), abrir carpeta, quitar y confirmar el tamaño elegido con el tirador.
 */
export function ImagePopover() {
  const { t } = useTranslation();
  const sel = useImageUi((s) => s.selected);
  const draft = useImageUi((s) => s.draftWidth);
  const root = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Sigue a la imagen (desplazamiento, zoom, repaginación): se recalcula en cada fotograma.
  const selPos = sel?.pos ?? null;
  useLayoutEffect(() => {
    if (selPos === null) return setPos(null);
    let frame = 0;
    const follow = () => {
      const img = editor.imageElement(selPos);
      const box = root.current;
      if (img && box) {
        const r = img.getBoundingClientRect();
        const w = box.offsetWidth;
        const h = box.offsetHeight;
        const below = r.bottom + 8;
        const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 8) : below;
        const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
        setPos((p) =>
          p && Math.abs(p.top - top) < 0.5 && Math.abs(p.left - left) < 0.5 ? p : { top, left },
        );
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [selPos]);

  if (!sel) return null;
  const kind = imageKind(sel.src);
  const width = draft ?? sel.width;
  return (
    <div
      ref={root}
      className="image-popover"
      role="dialog"
      aria-label={t('images.menu')}
      data-testid="image-popover"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      <Field
        label={t('images.alt')}
        value={sel.alt}
        testId="image-alt"
        onCommit={(alt) => editor.updateImage(sel.pos, { alt })}
      />
      <Field
        label={t('images.titleField')}
        value={sel.title}
        testId="image-title"
        onCommit={(title) => editor.updateImage(sel.pos, { title: title || null })}
      />
      <label className="check image-caption-check">
        <input
          type="checkbox"
          data-testid="image-caption"
          checked={sel.caption && sel.title !== ''}
          disabled={sel.title === ''}
          onChange={(e) => editor.updateImage(sel.pos, { caption: e.target.checked })}
        />
        <span>{t('images.captionVisible')}</span>
      </label>
      <div className="image-actions">
        <Action
          icon={ImageUp}
          label={t('images.replace')}
          testId="image-replace"
          onClick={() => void replaceImage(sel.pos)}
        />
        {kind === 'data' && (
          <Action
            icon={FileImage}
            label={t('images.toFile')}
            testId="image-to-file"
            onClick={() => void convertToFile(sel.pos, sel.src)}
          />
        )}
        {kind === 'remote' && (
          <Action
            icon={Download}
            label={t('images.saveLocally')}
            testId="image-save-locally"
            onClick={() => void convertToFile(sel.pos, sel.src)}
          />
        )}
        {kind === 'file' && (
          <>
            <Action
              icon={Code}
              label={t('images.toBase64')}
              testId="image-to-base64"
              onClick={() => void convertToBase64(sel.pos, sel.src)}
            />
            <Action
              icon={FolderOpen}
              label={t('images.openFolder')}
              testId="image-open-folder"
              onClick={() => showImageInFolder(sel.src)}
            />
          </>
        )}
        <Action
          icon={Trash2}
          label={t('images.remove')}
          testId="image-remove"
          onClick={() => editor.deleteImage(sel.pos)}
        />
      </div>
      <div className="image-size">
        <span data-testid="image-width">
          {width ? `${Math.round(width)} px` : t('images.autoSize')}
        </span>
        {draft !== null && draft !== sel.width && (
          <button
            className="btn"
            data-testid="image-save-size"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.updateImage(sel.pos, { width: draft });
              useImageUi.getState().set({ draftWidth: null });
            }}
          >
            <Icon icon={Check} /> {t('images.saveSize')}
          </button>
        )}
        {sel.width !== null && draft === null && (
          <button
            className="btn"
            data-testid="image-reset-size"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.updateImage(sel.pos, { width: null })}
          >
            <Icon icon={RotateCcw} /> {t('images.resetSize')}
          </button>
        )}
      </div>
    </div>
  );
}
