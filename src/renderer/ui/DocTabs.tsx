import { FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { closeDocument } from '../documents/actions';
import { useDocs } from '../documents/store';
import { editor } from '../editor/controller';
import { Icon } from './Icon';

export function DocTabs() {
  const { t } = useTranslation();
  const { docs: all, activeId } = useDocs();
  const docs = all.filter((d) => !d.hidden);
  if (docs.length === 0) return null;
  return (
    <div className="doc-tabs" role="tablist" aria-label={t('doc.tabs')}>
      {docs.map((doc) => (
        <div
          key={doc.id}
          role="tab"
          tabIndex={0}
          aria-selected={doc.id === activeId}
          className="doc-tab"
          data-testid="doc-tab"
          data-active={doc.id === activeId}
          title={doc.path ?? doc.name}
          onClick={() => editor.activate(doc.id)}
          onAuxClick={(e) => e.button === 1 && void closeDocument(doc.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && editor.activate(doc.id)}
        >
          <Icon icon={FileText} size={14} />
          <span className="doc-tab-name">{doc.name}</span>
          {doc.dirty && (
            <span className="dirty-dot" data-testid="dirty-dot" title={t('doc.unsavedMarker')} />
          )}
          {doc.externalChange && <span className="external-dot" title={t('doc.externalMarker')} />}
          {/* Para el ratón: con teclado o lector de pantalla se cierra con Ctrl+W (comando «Cerrar documento»). */}
          <span
            className="tab-close"
            aria-hidden="true"
            data-testid="tab-close"
            title={t('doc.closeTab', { name: doc.name })}
            onClick={(e) => {
              e.stopPropagation();
              void closeDocument(doc.id);
            }}
          >
            <Icon icon={X} size={14} />
          </span>
        </div>
      ))}
    </div>
  );
}
