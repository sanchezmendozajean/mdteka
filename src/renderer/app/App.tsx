import { useEffect } from 'react';
import { FileText, Library, PanelRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CommandButton } from '../ui/CommandButton';
import { Icon } from '../ui/Icon';
import { Ribbon } from '../ui/Ribbon';
import { SidePanel } from '../ui/SidePanel';
import { StatusBar } from '../ui/StatusBar';
import { useUi } from './store';

export function App() {
  const { t } = useTranslation();
  const { theme, navigatorOpen, documentPanelOpen } = useUi();
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  return (
    <div className="app" data-testid="app">
      <header className="titlebar">
        <span className="brand">
          <Icon icon={FileText} /> {t('app.name')}
        </span>
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
          <div className="welcome">
            <h1>{t('welcome.title')}</h1>
            <p>{t('welcome.subtitle')}</p>
          </div>
        </main>
        {documentPanelOpen && (
          <SidePanel
            side="right"
            testId="document-panel"
            title={t('panels.document')}
            icon={PanelRight}
            empty={t('panels.emptyDocument')}
          />
        )}
      </div>
      <StatusBar />
    </div>
  );
}
