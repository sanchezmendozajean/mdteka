import { create } from 'zustand';

interface SymbolStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** Estado del selector de símbolos (botón de la cinta y atajo Ctrl+Shift+.). */
export const useSymbols = create<SymbolStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
