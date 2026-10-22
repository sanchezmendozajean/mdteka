import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { effectiveConfig } from '@shared/document-config';
import { useSettings } from '../documents/config';
import { useDocs } from '../documents/store';
import { editor } from '../editor/controller';
import { buildDocCss } from '../editor/typography';

/** Monta los dos editores (ProseMirror y CodeMirror) en la misma hoja; solo uno es visible. */
export function EditorHost() {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const pm = useRef<HTMLDivElement>(null);
  const cm = useRef<HTMLDivElement>(null);
  const activeId = useDocs((s) => s.activeId);
  const config = useDocs((s) => s.docs.find((d) => d.id === s.activeId)?.config.config ?? null);
  const defaults = useSettings((s) => s.documentDefaults);
  const resolved = useMemo(() => effectiveConfig(config, defaults), [config, defaults]);
  const css = useMemo(
    () => (activeId ? buildDocCss(activeId, resolved) : ''),
    [activeId, resolved],
  );

  useEffect(() => {
    editor.mount(scroller.current!, pm.current!, cm.current!);
    return () => editor.unmount();
  }, []);

  // ED-10: al cambiar la tipografía se recalcula el layout con las fuentes ya cargadas.
  useEffect(() => {
    const { font, monoFont } = resolved.typography;
    void Promise.all([
      document.fonts.load(`1em "${font}"`),
      document.fonts.load(`1em "${monoFont}"`),
    ]).catch(() => undefined);
  }, [resolved.typography]);

  return (
    <div className="editor-scroll" ref={scroller} data-testid="editor-scroll">
      <style data-testid="doc-style">{css}</style>
      <div
        className="doc-column"
        aria-label={t('editor.label')}
        data-doc-id={activeId ?? undefined}
        lang={resolved.typography.language}
      >
        <div ref={pm} className="wysiwyg-mount" />
        <div ref={cm} className="source-mount" />
      </div>
    </div>
  );
}
