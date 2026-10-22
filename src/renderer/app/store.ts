import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type RibbonTab = 'file' | 'home' | 'insert' | 'design' | 'layout' | 'view' | 'project';

interface UiState {
  theme: Theme;
  ribbonTab: RibbonTab;
  ribbonCollapsed: boolean;
  navigatorOpen: boolean;
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

export const useUi = create<UiState>((set) => ({
  theme: 'light',
  ribbonTab: 'home',
  ribbonCollapsed: false,
  navigatorOpen: true,
  documentPanelOpen: true,
  stylesFocus: 0,
  pageFocus: 0,
  rulerOpen: true,
  rulerPreview: null,
  set: (patch) => set(patch),
}));
