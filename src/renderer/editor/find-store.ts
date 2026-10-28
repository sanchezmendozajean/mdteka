import { create } from 'zustand';
import type { FindInfo, FindOptions } from './wysiwyg/find';

export type FindCorner = 'tl' | 'tr' | 'bl' | 'br';

const CORNER_KEY = 'mdtor.findCorner';

function loadCorner(): FindCorner {
  try {
    const v = localStorage.getItem(CORNER_KEY);
    if (v === 'tl' || v === 'tr' || v === 'bl' || v === 'br') return v;
  } catch {
    /* sin almacenamiento: esquina por defecto */
  }
  return 'tr';
}

interface FindStore {
  open: boolean;
  showReplace: boolean;
  opts: FindOptions;
  replace: string;
  info: FindInfo;
  /** Esquina del lienzo donde flota la caja de búsqueda. */
  corner: FindCorner;
  /** Cambia cada vez que se pide abrir/enfocar la barra (Ctrl+F repetido). */
  focusTick: number;
  set: (patch: Partial<Omit<FindStore, 'set' | 'show' | 'setCorner'>>) => void;
  setCorner: (corner: FindCorner) => void;
  show: (replace: boolean) => void;
}

export const useFind = create<FindStore>((set) => ({
  open: false,
  showReplace: false,
  opts: { query: '', caseSensitive: false, wholeWord: false, regex: false },
  replace: '',
  info: { count: 0, current: -1, invalid: false },
  corner: loadCorner(),
  focusTick: 0,
  set: (patch) => set(patch),
  setCorner: (corner) => {
    try {
      localStorage.setItem(CORNER_KEY, corner);
    } catch {
      /* solo es una comodidad */
    }
    set({ corner });
  },
  show: (replace) =>
    set((s) => ({ open: true, showReplace: replace || s.showReplace, focusTick: s.focusTick + 1 })),
}));
