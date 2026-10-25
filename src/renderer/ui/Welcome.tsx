import { useTranslation } from 'react-i18next';
import { openPaths } from '../documents/actions';
import { useProject } from '../project/store';
import { CommandButton } from './CommandButton';
import { Icon } from './Icon';
import { recentIcon, splitPath, useRecentFiles } from './RecentMenu';

export function Welcome() {
  const { t } = useTranslation();
  const recent = useRecentFiles();
  const projectTitle = useProject((s) => s.project?.title);
  return (
    <div className="welcome" data-testid="welcome">
      {projectTitle !== undefined ? (
        <>
          <h1 data-testid="welcome-project">{projectTitle}</h1>
          <div className="welcome-actions">
            <CommandButton id="project.newChapter" large />
            <CommandButton id="project.newBook" large />
            <CommandButton id="project.newCollection" large />
            <CommandButton id="project.search" large />
            <CommandButton id="project.quickOpen" large />
            <CommandButton id="project.exportPdf" large />
            <CommandButton id="project.cleanImages" large />
          </div>
        </>
      ) : (
        <>
          <h1>{t('welcome.title')}</h1>
          <p>{t('welcome.subtitle')}</p>
          <div className="welcome-actions">
            <CommandButton id="file.new" large />
            <CommandButton id="project.new" large />
            <CommandButton id="file.open" large />
          </div>
        </>
      )}
      {projectTitle === undefined && (
        <>
          <hr className="welcome-sep" />
          <section className="welcome-recent" aria-label={t('welcome.recent')}>
            <h2>{t('welcome.recent')}</h2>
            {recent.length === 0 ? (
              <p className="welcome-recent-empty">{t('welcome.noRecent')}</p>
            ) : (
              <ul data-testid="welcome-recent">
                {recent.map((path) => {
                  const { name, dir } = splitPath(path);
                  return (
                    <li key={path}>
                      <button className="btn" title={path} onClick={() => void openPaths([path])}>
                        <Icon icon={recentIcon(name)} />
                        <span className="welcome-recent-name">{name}</span>
                        <span className="welcome-recent-dir">{dir}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
