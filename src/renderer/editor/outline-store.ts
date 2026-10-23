import { create } from 'zustand';

/** Un título del documento activo para el panel Esquema. `pos` es su posición en el editor. */
export interface OutlineItem {
  level: number;
  text: string;
  pos: number;
}

export const useOutline = create<{ items: OutlineItem[]; set: (items: OutlineItem[]) => void }>(
  (set) => ({ items: [], set: (items) => set({ items }) }),
);
