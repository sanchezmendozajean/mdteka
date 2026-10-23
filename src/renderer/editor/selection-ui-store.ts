import { create } from 'zustand';

/** Rectángulo (en pantalla) de la selección de texto del editor visual: lo usa la barra flotante. */
export interface SelectionBox {
  top: number;
  left: number;
  width: number;
}

export const useSelectionUi = create<{
  box: SelectionBox | null;
  set: (box: SelectionBox | null) => void;
}>((set) => ({ box: null, set: (box) => set({ box }) }));
