import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type RibbonTab = 'file' | 'home' | 'insert' | 'design' | 'layout' | 'view' | 'project';

interface UiState {
  theme: Theme;
  ribbonTab: RibbonTab;
  ribbonCollapsed: boolean;
  navigatorOpen: boolean;
  /** Pestaña del panel izquierdo: navegador de libros o esquema del documento. */
  leftTab: 'navigator' | 'outline';
  /** Modo concentración: solo el documento (F11). */
  focusMode: boolean;
  /** Ancho del navegador en px (PRJ-20): se puede arrastrar y se recuerda. */
  navigatorWidth: number;
  documentPanelOpen: boolean;
  /** Se incrementa para pedir al panel Documento que muestre la sección de estilos. */
  stylesFocus: number;
  /** Ídem para la sección Página (encabezado y pie, márgenes). */
  pageFocus: number;
  rulerOpen: boolean;
  /** Márgenes (mm) mientras se arrastra un marcador de la regla: vista previa en vivo. */
  rulerPreview: { left: number; right: number } | null;
  set: (patch: Partial<Omit<UiState, 'set'>>) => void;
}

export { NAV_MAX, NAV_MIN } from '@shared/settings';

export const useUi = create<UiState>((set) => ({
  theme: 'light',
  ribbonTab: 'home',
  ribbonCollapsed: false,
  navigatorOpen: true,
  focusMode: false,
  leftTab: 'navigator',
  navigatorWidth: 260,
  documentPanelOpen: true,
  stylesFocus: 0,
  pageFocus: 0,
  rulerOpen: true,
  rulerPreview: null,
  set: (patch) => set(patch),
}));
