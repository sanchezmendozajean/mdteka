import { useTranslation } from 'react-i18next';
import { CommandButton } from './CommandButton';

export function Welcome() {
  const { t } = useTranslation();
  return (
    <div className="welcome" data-testid="welcome">
      <h1>{t('welcome.title')}</h1>
      <p>{t('welcome.subtitle')}</p>
      <div className="welcome-actions">
        <CommandButton id="file.new" large />
        <CommandButton id="file.open" large />
        <CommandButton id="project.open" large />
        <CommandButton id="project.new" large />
      </div>
    </div>
  );
}
