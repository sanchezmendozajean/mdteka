import i18next from 'i18next';
import { FileText, Trash2 } from 'lucide-react';
import { joinConfig } from '@shared/document-config';
import { appSettings, useAppSettings } from '../app/settings';
import { editor } from '../editor/controller';
import { applyFormat } from '../editor/model/text-format';
import { restoreRecovered, saveDocument } from './actions';
import { askChoose, useDocs } from './store';

/** Tareas en segundo plano: autoguardado (02) y respaldo de recuperación cada 30 s (09). */

export const RECOVERY_MS = 30_000;
const api = () => window.mdteca;

/** Documentos con ruta y cambios sin guardar: lo único que el autoguardado puede escribir sin preguntar. */
const dirtySavable = () =>
  useDocs.getState().docs.filter((d) => d.dirty && d.path && !d.hidden && !d.externalChange);

export async function autosaveNow(): Promise<void> {
  editor.flush();
  for (const doc of dirtySavable()) await saveDocument(doc.id);
}

/** Ids con respaldo escrito: se borran cuando el documento deja de tener cambios. */
const written = new Set<string>();

/** Escribe el respaldo de cada documento con cambios y borra el de los que ya no los tienen. */
export async function writeRecoveryNow(): Promise<void> {
  editor.flush();
  const docs = useDocs.getState().docs.filter((d) => !d.hidden);
  for (const doc of docs) {
    if (!doc.dirty) {
      if (written.delete(doc.id)) void api().recovery.clear(doc.id);
      continue;
    }
    const source = editor.sourceOf(doc.id);
    const content = applyFormat(
      joinConfig(source, doc.configRaw, doc.savedConfigRaw !== ''),
      doc.eol,
      doc.bom,
    );
    written.add(doc.id);
    await api().recovery.write(doc.id, doc.path, doc.name, content);
  }
  // Documentos cerrados desde el último ciclo.
  const open = new Set(docs.map((d) => d.id));
  for (const id of [...written]) {
    if (!open.has(id)) {
      written.delete(id);
      void api().recovery.clear(id);
    }
  }
}

/** Tras un cierre inesperado quedan respaldos: se ofrece recuperarlos (02). */
export async function checkRecovery(): Promise<void> {
  const entries = await api().recovery.list();
  if (entries.length === 0) return;
  const answer = await askChoose(
    i18next.t('recovery.title'),
    [
      {
        id: 'restore',
        label: i18next.t('recovery.restore', { count: entries.length }),
        icon: FileText,
        hint: entries.map((e) => e.name).join(', '),
      },
      { id: 'discard', label: i18next.t('recovery.discard'), icon: Trash2, danger: true },
    ],
    i18next.t('recovery.body'),
  );
  if (answer === 'restore') for (const entry of entries) await restoreRecovered(entry);
  // Los respaldos viejos ya cumplieron: los de la sesión nueva se escriben con los ids nuevos.
  for (const entry of entries) await api().recovery.clear(entry.id);
}

export function wireBackground(): () => void {
  let autosaveTimer: ReturnType<typeof setInterval> | undefined;
  const configure = () => {
    clearInterval(autosaveTimer);
    const { mode, seconds } = appSettings().editor.autosave;
    if (mode === 'interval') autosaveTimer = setInterval(() => void autosaveNow(), seconds * 1000);
  };
  configure();
  const off = useAppSettings.subscribe(configure);
  const onBlur = () => {
    if (appSettings().editor.autosave.mode === 'blur') void autosaveNow();
  };
  window.addEventListener('blur', onBlur);
  const recovery = setInterval(() => void writeRecoveryNow(), RECOVERY_MS);
  return () => {
    off();
    clearInterval(autosaveTimer);
    clearInterval(recovery);
    window.removeEventListener('blur', onBlur);
  };
}
