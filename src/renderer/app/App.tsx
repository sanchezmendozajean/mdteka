import { useEffect } from 'react';
import { FileText, Library } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { findByShortcut } from '../commands/registry';
import { wireApp } from '../documents/actions';
import { activeDoc, useDocs } from '../documents/store';
import { exportPdf, preparePrint } from '../documents/export';
import { editor } from '../editor/controller';
import { usePagination } from '../editor/pagination-store';
import { CommandButton } from '../ui/CommandButton';
import { Dialogs } from '../ui/Dialogs';
import { DocumentPanel } from '../ui/DocumentPanel';
import { DocTabs } from '../ui/DocTabs';
import { EditorHost } from '../ui/EditorHost';
import { FindBar } from '../ui/FindBar';
import { Icon } from '../ui/Icon';
import { Ribbon } from '../ui/Ribbon';
import { SidePanel } from '../ui/SidePanel';
import { StatusBar } from '../ui/StatusBar';
import { Welcome } from '../ui/Welcome';
import { useUi } from './store';

const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement;

export function App() {
  const { t } = useTranslation();
  const { theme, navigatorOpen, documentPanelOpen } = useUi();
  const hasDocs = useDocs((s) => s.docs.length > 0);
  const doc = useDocs((s) => s.docs.find((d) => d.id === s.activeId));

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  useEffect(() => {
    document.title = doc ? `${doc.dirty ? '• ' : ''}${doc.name} — MDteca` : 'MDteca';
  }, [doc]);

  useEffect(() => {
    const off = wireApp();
    void window.mdteca.app.info().then((info) => {
      if (info.e2e)
        (window as unknown as { __mdteca: unknown }).__mdteca = {
          editor,
          activeDoc,
          exportPdf,
          preparePrint,
          pages: () => usePagination.getState().pages,
        };
    });
    return off;
  }, []);

  // Atajos del registro de comandos (se atienden en captura para ganar al editor).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = findByShortcut(e);
      if (!cmd) return;
      // En un campo de texto de la interfaz solo valen archivo y buscar; el resto es del campo.
      if (isTextField(e.target) && !cmd.inFields) return;
      const enabled =
        (cmd.global || useDocs.getState().activeId !== null) && (cmd.when ? cmd.when() : true);
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      cmd.run();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="app" data-testid="app">
      <header className="titlebar">
        <span className="brand">
          <Icon icon={FileText} /> {t('app.name')}
        </span>
        {doc && <span className="title-doc">{doc.name}</span>}
        <CommandButton id="view.toggleNavigator" pressed={navigatorOpen} />
        <CommandButton id="view.toggleDocumentPanel" pressed={documentPanelOpen} />
        <CommandButton id="view.toggleTheme" />
      </header>
      <Ribbon />
      <div className="workspace">
        {navigatorOpen && (
          <SidePanel
            side="left"
            testId="navigator"
            title={t('panels.navigator')}
            icon={Library}
            empty={t('panels.emptyNavigator')}
          />
        )}
        <main className="canvas">
          <DocTabs />
          {hasDocs && <FindBar />}
          <div className="canvas-body" hidden={!hasDocs}>
            <EditorHost />
          </div>
          {!hasDocs && <Welcome />}
        </main>
        {documentPanelOpen && <DocumentPanel />}
      </div>
      <StatusBar />
      <Dialogs />
    </div>
  );
}
