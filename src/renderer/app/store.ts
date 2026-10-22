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
  set: (patch: Partial<Omit<UiState, 'set'>>) => void;
}

export const useUi = create<UiState>((set) => ({
  theme: 'light',
  ribbonTab: 'home',
  ribbonCollapsed: false,
  navigatorOpen: true,
  documentPanelOpen: true,
  stylesFocus: 0,
  set: (patch) => set(patch),
}));
