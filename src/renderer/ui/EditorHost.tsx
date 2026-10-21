import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { editor } from '../editor/controller';

/** Monta los dos editores (ProseMirror y CodeMirror) en la misma hoja; solo uno es visible. */
export function EditorHost() {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const pm = useRef<HTMLDivElement>(null);
  const cm = useRef<HTMLDivElement>(null);

  useEffect(() => {
    editor.mount(scroller.current!, pm.current!, cm.current!);
    return () => editor.unmount();
  }, []);

  return (
    <div className="editor-scroll" ref={scroller} data-testid="editor-scroll">
      <div className="doc-column" aria-label={t('editor.label')}>
        <div ref={pm} className="wysiwyg-mount" />
        <div ref={cm} className="source-mount" />
      </div>
    </div>
  );
}
