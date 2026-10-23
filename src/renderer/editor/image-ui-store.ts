import { create } from 'zustand';

/** Imagen seleccionada en el editor visual: la usa el menú flotante (06 · Edición de imágenes). */
export interface SelectedImage {
  pos: number;
  src: string;
  alt: string;
  title: string;
  width: number | null;
  caption: boolean;
}

interface ImageUiState {
  selected: SelectedImage | null;
  /** Ancho provisional mientras se arrastra el tirador; solo se escribe si se confirma. */
  draftWidth: number | null;
  set: (patch: Partial<Omit<ImageUiState, 'set'>>) => void;
}

export const useImageUi = create<ImageUiState>((set) => ({
  selected: null,
  draftWidth: null,
  set: (patch) => set(patch),
}));
