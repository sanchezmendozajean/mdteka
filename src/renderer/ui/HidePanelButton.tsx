import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCommand } from '../commands/registry';
import { Icon } from './Icon';

/** Botón del encabezado de un panel lateral para esconderlo (se vuelve a mostrar desde la barra de título). */
export function HidePanelButton({ side }: { side: 'left' | 'right' }) {
  const { t } = useTranslation();
  const id = side === 'left' ? 'view.toggleNavigator' : 'view.toggleDocumentPanel';
  const label = t('panels.hide');
  return (
    <button
      className="btn btn-mini panel-hide"
      title={label}
      aria-label={label}
      data-testid={`hide-${side === 'left' ? 'navigator' : 'document-panel'}`}
      onClick={() => getCommand(id)?.run()}
    >
      <Icon icon={side === 'left' ? ChevronsLeft : ChevronsRight} size={16} />
    </button>
  );
}
