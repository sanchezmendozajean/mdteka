import { useTranslation } from 'react-i18next';
import { formatShortcut, getCommand, shortcutOf } from '../commands/registry';
import { useAppSettings } from '../app/settings';
import { useDocs } from '../documents/store';
import { useProject } from '../project/store';
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
  // Se repinta al reasignar atajos para que el tooltip muestre el vigente.
  useAppSettings((s) => s.settings.shortcuts[id]);
  const shortcut = cmd ? shortcutOf(cmd) : undefined;
  // Algunos comandos dependen de que haya un proyecto abierto: se repinta al abrirlo o cerrarlo.
  useProject((s) => s.project !== null);
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
  const visibleLabel = large
    ? t(`ribbonShort.${id.replace('.', '_')}`, { defaultValue: name })
    : name;
  // El nombre accesible debe contener el texto visible (WCAG 2.5.3).
  const accessibleName = name.toLowerCase().includes(visibleLabel.toLowerCase())
    ? name
    : `${visibleLabel}: ${name}`;
  return (
    <button
      className={`btn${large ? ' btn-large' : ''}`}
      title={shortcut ? `${name} (${formatShortcut(shortcut)})` : name}
      aria-label={accessibleName}
      aria-pressed={isActive}
      data-command={id}
      disabled={!enabled}
      // Los botones de la cinta no roban el foco ni la selección del editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={cmd.run}
    >
      <Icon icon={cmd.icon} size={large ? 24 : 18} />
      {(large || label) && <span className="btn-label">{visibleLabel}</span>}
    </button>
  );
}
