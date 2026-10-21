import { useTranslation } from 'react-i18next';
import { useUi, type RibbonTab } from '../app/store';

const TABS: RibbonTab[] = ['file', 'home', 'insert', 'design', 'layout', 'view', 'project'];

export function Ribbon() {
  const { t } = useTranslation();
  const { ribbonTab, ribbonCollapsed, set } = useUi();
  return (
    <div className="ribbon">
      <div className="ribbon-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            className="ribbon-tab"
            aria-selected={ribbonTab === tab}
            onClick={() => set({ ribbonTab: tab, ribbonCollapsed: false })}
          >
            {t(`ribbon.${tab}`)}
          </button>
        ))}
      </div>
      {!ribbonCollapsed && (
        <div className="ribbon-body" role="toolbar" aria-label={t(`ribbon.${ribbonTab}`)}>
          {t('ribbon.empty')}
        </div>
      )}
    </div>
  );
}
