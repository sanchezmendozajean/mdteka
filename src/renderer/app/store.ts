import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type RibbonTab = 'file' | 'home' | 'insert' | 'design' | 'layout' | 'view' | 'project';

interface UiState {
  theme: Theme;
  ribbonTab: RibbonTab;
  ribbonCollapsed: boolean;
  navigatorOpen: boolean;
  documentPanelOpen: boolean;
  set: (patch: Partial<Omit<UiState, 'set'>>) => void;
}

export const useUi = create<UiState>((set) => ({
  theme: 'light',
  ribbonTab: 'home',
  ribbonCollapsed: false,
  navigatorOpen: true,
  documentPanelOpen: true,
  set: (patch) => set(patch),
}));
