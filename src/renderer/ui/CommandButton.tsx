import { useTranslation } from 'react-i18next';
import { getCommand } from '../commands/registry';
import { useDocs } from '../documents/store';
import { Icon } from './Icon';

interface Props {
  id: string;
  /** Botón grande: ícono de 24 px con la etiqueta debajo. */
  large?: boolean;
  /** Muestra la etiqueta junto al ícono (listas desplegables y menús). */
  label?: boolean;
  /** Fuerza el estado «pulsado» (para estados que no vienen del formato, como paneles). */
  pressed?: boolean;
}

/** Botón enlazado a un comando del registro: ícono, tooltip con nombre y atajo, estado activo. */
export function CommandButton({ id, large, label, pressed }: Props) {
  const { t } = useTranslation();
  const cmd = getCommand(id);
  // Los selectores devuelven booleanos: el botón solo se repinta si su estado cambia.
  const enabled = useDocs((s) =>
    cmd ? (cmd.global || s.activeId !== null) && (cmd.when ? cmd.when() : true) : false,
  );
  const active = useDocs((s) =>
    cmd?.active && s.activeId !== null ? cmd.active(s.format) : undefined,
  );
  if (!cmd) return null;
  const name = t(cmd.labelKey);
  const isActive = pressed ?? active;
  return (
    <button
      className={`btn${large ? ' btn-large' : ''}`}
      title={cmd.shortcut ? `${name} (${cmd.shortcut})` : name}
      aria-label={name}
      aria-pressed={isActive}
      data-command={id}
      disabled={!enabled}
      // Los botones de la cinta no roban el foco ni la selección del editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={cmd.run}
    >
      <Icon icon={cmd.icon} size={large ? 24 : 18} />
      {(large || label) && <span className="btn-label">{name}</span>}
    </button>
  );
}
