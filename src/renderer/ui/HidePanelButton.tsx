import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCommand } from '../commands/registry';
import { Icon } from './Icon';

const commandOf = (side: 'left' | 'right') =>
  side === 'left' ? 'view.toggleNavigator' : 'view.toggleDocumentPanel';
const nameOf = (side: 'left' | 'right') => (side === 'left' ? 'navigator' : 'document-panel');

/** Botón del encabezado de un panel lateral para esconderlo (se vuelve a mostrar desde su carril). */
export function HidePanelButton({ side }: { side: 'left' | 'right' }) {
  const { t } = useTranslation();
  const label = t('panels.hide');
  return (
    <button
      className="btn btn-mini panel-hide"
      title={label}
      aria-label={label}
      data-testid={`hide-${nameOf(side)}`}
      onClick={() => getCommand(commandOf(side))?.run()}
    >
      <Icon icon={side === 'left' ? ChevronsLeft : ChevronsRight} size={16} />
    </button>
  );
}

/** Carril estrecho que ocupa el sitio de un panel escondido, con el botón para volver a mostrarlo. */
export function PanelRail({ side }: { side: 'left' | 'right' }) {
  const { t } = useTranslation();
  const label = t(side === 'left' ? 'panels.showNavigator' : 'panels.showDocument');
  return (
    <div className={`panel-rail ${side}`}>
      <button
        className="btn btn-mini"
        title={label}
        aria-label={label}
        data-testid={`show-${nameOf(side)}`}
        onClick={() => getCommand(commandOf(side))?.run()}
      >
        <Icon icon={side === 'left' ? ChevronsRight : ChevronsLeft} size={16} />
      </button>
    </div>
  );
}
