import { Eye, Files, Type, ZoomIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

export function StatusBar() {
  const { t } = useTranslation();
  return (
    <footer className="statusbar" data-testid="statusbar">
      <span>
        <Icon icon={Type} size={14} /> {t('status.words', { count: 0 })}
      </span>
      <span className="spacer" />
      <span title={t('status.mode')}>
        <Icon icon={Eye} size={14} /> WYSIWYG
      </span>
      <span title={t('status.view')}>
        <Icon icon={Files} size={14} /> {t('ribbon.view')}
      </span>
      <span title={t('status.zoom')}>
        <Icon icon={ZoomIn} size={14} /> 100 %
      </span>
    </footer>
  );
}
