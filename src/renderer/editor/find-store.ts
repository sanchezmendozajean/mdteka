import { create } from 'zustand';
import type { FindInfo, FindOptions } from './wysiwyg/find';

interface FindStore {
  open: boolean;
  showReplace: boolean;
  opts: FindOptions;
  replace: string;
  info: FindInfo;
  /** Cambia cada vez que se pide abrir/enfocar la barra (Ctrl+F repetido). */
  focusTick: number;
  set: (patch: Partial<Omit<FindStore, 'set' | 'show'>>) => void;
  show: (replace: boolean) => void;
}

export const useFind = create<FindStore>((set) => ({
  open: false,
  showReplace: false,
  opts: { query: '', caseSensitive: false, wholeWord: false, regex: false },
  replace: '',
  info: { count: 0, current: -1, invalid: false },
  focusTick: 0,
  set: (patch) => set(patch),
  show: (replace) =>
    set((s) => ({ open: true, showReplace: replace || s.showReplace, focusTick: s.focusTick + 1 })),
}));
