import { useEffect } from 'react';
import { FileText, Library } from 'lucide-react';
import { editOnlyThisFile, openAsProject } from '../project/actions';
import { useProject } from '../project/store';
import { useTranslation } from 'react-i18next';
import { findByShortcut } from '../commands/registry';
import { wireApp } from '../documents/actions';
import { wireBackground, writeRecoveryNow, autosaveNow } from '../documents/background';
import { wireProject } from '../project/actions';
import { activeDoc, useDocs } from '../documents/store';
import { exportPdf, preparePrint } from '../documents/export';
import { editor } from '../editor/controller';
import { usePagination } from '../editor/pagination-store';
import { AppLogo } from '../ui/AppLogo';
import { CommandButton } from '../ui/CommandButton';
import { Dialogs } from '../ui/Dialogs';
import { DocumentPanel } from '../ui/DocumentPanel';
import { DocTabs } from '../ui/DocTabs';
import { EditorHost } from '../ui/EditorHost';
import { EditorContextMenu } from '../ui/EditorContextMenu';
import { FindBar } from '../ui/FindBar';
import { FloatingToolbar } from '../ui/FloatingToolbar';
import { PanelRail } from '../ui/HidePanelButton';
import { ImagePopover } from '../ui/ImagePopover';
import { SymbolPicker } from '../ui/SymbolPicker';
import { Icon } from '../ui/Icon';
import { KeyTips } from '../ui/KeyTips';
import { Ribbon } from '../ui/Ribbon';
import { Navigator } from '../ui/Navigator';
import { ProjectBar } from '../ui/ProjectBar';
import { StatusBar } from '../ui/StatusBar';
import { Welcome } from '../ui/Welcome';
import { wireAppearance } from './appearance';
import { wireFocus } from './focus';
import { wireLayout } from './layout';
import { useUi } from './store';

const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement;

export function App() {
  const { t } = useTranslation();
  const { theme, navigatorOpen, documentPanelOpen, focusMode } = useUi();
  const hasDocs = useDocs((s) => s.docs.some((d) => !d.hidden));
  const projectTitle = useProject((s) => s.project?.title ?? null);
  const projectOpen = projectTitle !== null;
  const doc = useDocs((s) => s.docs.find((d) => d.id === s.activeId));

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  useEffect(() => {
    document.title = doc ? `${doc.dirty ? '• ' : ''}${doc.name} — MDteca` : 'MDteca';
  }, [doc]);

  useEffect(() => {
    const offProject = wireProject();
    const offAppearance = wireAppearance();
    const offFocus = wireFocus();
    const offLayout = wireLayout();
    const offBackground = wireBackground();
    const off = wireApp();
    void window.mdteca.app.info().then((info) => {
      if (info.e2e)
        (window as unknown as { __mdteca: unknown }).__mdteca = {
          editor,
          activeDoc,
          exportPdf,
          preparePrint,
          writeRecoveryNow,
          autosaveNow,
          pages: () => usePagination.getState().pages,
        };
    });
    return () => {
      off();
      offProject();
      offAppearance();
      offFocus();
      offLayout();
      offBackground();
    };
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
    <div className={`app${focusMode ? ' focus' : ''}`} data-testid="app">
      <header className="titlebar">
        <span className="brand">
          <AppLogo /> {t('app.name')}
        </span>
        <span className="mode-switch" role="group" aria-label={t('project.modeLabel')}>
          <button
            className="mode-btn"
            aria-pressed={!projectOpen}
            data-testid="mode-file"
            onClick={() => projectOpen && editOnlyThisFile()}
          >
            <Icon icon={FileText} size={14} /> {t('project.modeFile')}
          </button>
          <button
            className="mode-btn"
            aria-pressed={projectOpen}
            data-testid="mode-project"
            onClick={() => !projectOpen && void openAsProject()}
          >
            <Icon icon={Library} size={14} /> {t('project.modeProject')}
          </button>
        </span>
        {doc && <span className="title-doc">{doc.name}</span>}
        {projectTitle && (
          <span className="title-project" data-testid="title-project">
            — {projectTitle}
          </span>
        )}
        <span className="title-tools">
          <CommandButton id="file.save" />
          <CommandButton id="edit.undo" />
          <CommandButton id="edit.redo" />
          <span className="title-sep" aria-hidden="true" />
          <CommandButton id="app.palette" />
          <CommandButton id="app.settings" />
          <CommandButton id="view.toggleTheme" />
        </span>
      </header>
      <Ribbon />
      <div className="workspace">
        {navigatorOpen ? <Navigator /> : <PanelRail side="left" />}
        <main className="canvas">
          <ProjectBar />
          <DocTabs />
          <div className="canvas-body" hidden={!hasDocs}>
            <EditorHost />
            {hasDocs && <FindBar />}
          </div>
          {!hasDocs && <Welcome />}
        </main>
        {documentPanelOpen ? <DocumentPanel /> : <PanelRail side="right" />}
      </div>
      <StatusBar />
      <ImagePopover />
      <SymbolPicker />
      <FloatingToolbar />
      <KeyTips />
      <EditorContextMenu />
      <Dialogs />
    </div>
  );
}
