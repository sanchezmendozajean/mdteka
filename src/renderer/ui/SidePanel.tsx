import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';

interface Props {
  side: 'left' | 'right';
  title: string;
  icon: LucideIcon;
  empty: string;
  testId: string;
}

export function SidePanel({ side, title, icon, empty, testId }: Props) {
  return (
    <aside className={`panel ${side}`} data-testid={testId} aria-label={title}>
      <div className="panel-title">
        <Icon icon={icon} /> {title}
      </div>
      <div className="panel-empty">{empty}</div>
    </aside>
  );
}
