import { useTranslation } from 'react-i18next';
import { getCommand } from '../commands/registry';
import { Icon } from './Icon';

/** Botón enlazado a un comando del registro: ícono, tooltip con nombre y atajo. */
export function CommandButton({ id, pressed }: { id: string; pressed?: boolean }) {
  const { t } = useTranslation();
  const cmd = getCommand(id);
  if (!cmd) return null;
  const label = t(cmd.labelKey);
  return (
    <button
      className="btn"
      title={cmd.shortcut ? `${label} (${cmd.shortcut})` : label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={cmd.run}
    >
      <Icon icon={cmd.icon} />
    </button>
  );
}
