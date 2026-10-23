import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type RibbonTab = 'file' | 'home' | 'insert' | 'design' | 'layout' | 'view' | 'project';

interface UiState {
  theme: Theme;
  ribbonTab: RibbonTab;
  ribbonCollapsed: boolean;
  navigatorOpen: boolean;
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

const NAV_KEY = 'mdteca.navigatorWidth';
export const NAV_MIN = 200;
export const NAV_MAX = 520;
const savedNavWidth = (): number => {
  try {
    const n = Number(localStorage.getItem(NAV_KEY));
    return n >= NAV_MIN && n <= NAV_MAX ? n : 260;
  } catch {
    return 260;
  }
};
export const saveNavWidth = (n: number): void => {
  try {
    localStorage.setItem(NAV_KEY, String(Math.round(n)));
  } catch {
    /* sin almacenamiento: el ancho no se recuerda */
  }
};

export const useUi = create<UiState>((set) => ({
  theme: 'light',
  ribbonTab: 'home',
  ribbonCollapsed: false,
  navigatorOpen: true,
  focusMode: false,
  navigatorWidth: savedNavWidth(),
  documentPanelOpen: true,
  stylesFocus: 0,
  pageFocus: 0,
  rulerOpen: true,
  rulerPreview: null,
  set: (patch) => set(patch),
}));
