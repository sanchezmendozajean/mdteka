import type { LucideIcon } from 'lucide-react';

interface IconProps {
  icon: LucideIcon;
  size?: number;
}

/** Envoltorio único de íconos Lucide: 18 px y trazo 1,5 por defecto (UI-01). */
export function Icon({ icon: Glyph, size = 18 }: IconProps) {
  return <Glyph size={size} strokeWidth={1.5} aria-hidden />;
}
