import { useTranslation } from 'react-i18next';
import { editor } from '../editor/controller';
import { useOutline } from '../editor/outline-store';

/** Esquema del documento activo: sus títulos con sangría por nivel; clic lleva el cursor al título. */
export function Outline() {
  const { t } = useTranslation();
  const items = useOutline((s) => s.items);
  if (items.length === 0)
    return (
      <div className="panel-empty" data-testid="outline-empty">
        {t('panels.emptyOutline')}
      </div>
    );
  const base = Math.min(...items.map((i) => i.level));
  return (
    <nav className="outline" data-testid="outline" aria-label={t('panels.outline')}>
      {items.map((item, i) => (
        <button
          key={`${item.pos}-${i}`}
          className="outline-item"
          style={{ paddingLeft: 12 + (item.level - base) * 14 }}
          data-testid="outline-item"
          data-level={item.level}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.goToOutline(i)}
        >
          {item.text}
        </button>
      ))}
    </nav>
  );
}
