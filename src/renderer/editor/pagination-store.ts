import { create } from 'zustand';

/** Resultado de la paginación del documento activo (lo lee la hoja y la barra de estado). */
interface PaginationState {
  /** Páginas del documento activo en vista de páginas; 0 si no hay vista de páginas. */
  pages: number;
  /** Página visible (según el desplazamiento). */
  current: number;
  set: (patch: Partial<Omit<PaginationState, 'set'>>) => void;
}

export const usePagination = create<PaginationState>((set) => ({
  pages: 0,
  current: 1,
  set: (patch) => set(patch),
}));
