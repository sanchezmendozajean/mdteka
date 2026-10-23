import { Library, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { acceptSuggestion, dismissSuggestion } from '../project/actions';
import { useProject } from '../project/store';
import { Icon } from './Icon';

/** Aviso no intrusivo: el archivo abierto pertenece a un proyecto conocido (PRJ-33). */
export function ProjectBar() {
  const { t } = useTranslation();
  const suggestion = useProject((s) => s.suggestion);
  if (!suggestion) return null;
  return (
    <div className="project-bar" role="status" data-testid="project-bar">
      <Icon icon={Library} size={16} />
      <span>{t('project.suggestion', { title: suggestion.title })}</span>
      <button
        className="btn btn-primary btn-small"
        data-testid="project-bar-open"
        onClick={() => void acceptSuggestion()}
      >
        {t('project.suggestionOpen')}
      </button>
      <button
        className="btn btn-mini"
        title={t('project.dismiss')}
        aria-label={t('project.dismiss')}
        data-testid="project-bar-dismiss"
        onClick={dismissSuggestion}
      >
        <Icon icon={X} size={14} />
      </button>
    </div>
  );
}
