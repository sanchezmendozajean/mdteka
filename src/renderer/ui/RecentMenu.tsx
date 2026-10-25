import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FileText, FolderKanban, History } from 'lucide-react';
import { openPaths } from '../documents/actions';
import { BtnLabel } from './BtnLabel';
import { Icon } from './Icon';
import { Popover } from './Popover';

export const splitPath = (path: string): { name: string; dir: string } => {
  const p = path.replaceAll('\\', '/');
  const i = p.lastIndexOf('/');
  return { name: p.slice(i + 1), dir: p.slice(0, i) };
};

/** Últimos archivos abiertos a propósito; se vuelve a leer cada vez que el componente se monta. */
export function useRecentFiles(): string[] {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    void window.mdteca.recent
      .list()
      .then(setRecent)
      .catch(() => undefined);
  }, []);
  return recent;
}

export const recentIcon = (name: string) => (/\.mdteca$/i.test(name) ? FolderKanban : FileText);

function RecentList({ close }: { close: () => void }) {
  const { t } = useTranslation();
  const recent = useRecentFiles();
  if (recent.length === 0) return <p className="popover-empty">{t('welcome.noRecent')}</p>;
  return (
    <ul className="gallery recent-list">
      {recent.map((path) => {
        const { name, dir } = splitPath(path);
        return (
          <li key={path}>
            <button
              className="gallery-item"
              title={path}
              onClick={() => {
                close();
                void openPaths([path]);
              }}
            >
              <Icon icon={recentIcon(name)} />
              <span className="welcome-recent-name">{name}</span>
              <span className="welcome-recent-dir">{dir}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Archivo › Recientes: desplegable con los últimos archivos abiertos, junto a «Abrir…». */
export function RecentMenu() {
  const { t } = useTranslation();
  return (
    <Popover
      large
      label={t('ribbon.recent')}
      testId="recent-menu"
      trigger={
        <>
          <Icon icon={History} size={24} />
          <BtnLabel>{t('ribbon.recent')}</BtnLabel>
          <Icon icon={ChevronDown} size={14} />
        </>
      }
    >
      {(close) => <RecentList close={close} />}
    </Popover>
  );
}
