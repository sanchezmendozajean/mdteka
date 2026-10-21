import { Library, Moon, PanelRight, PanelTop } from 'lucide-react';
import { useUi } from '../app/store';
import { registerCommand } from './registry';

const ui = () => useUi.getState();

registerCommand({
  id: 'view.toggleNavigator',
  icon: Library,
  shortcut: 'Ctrl+Shift+B',
  run: () => ui().set({ navigatorOpen: !ui().navigatorOpen }),
});
registerCommand({
  id: 'view.toggleDocumentPanel',
  icon: PanelRight,
  shortcut: 'Ctrl+Shift+D',
  run: () => ui().set({ documentPanelOpen: !ui().documentPanelOpen }),
});
registerCommand({
  id: 'view.collapseRibbon',
  icon: PanelTop,
  shortcut: 'Ctrl+F1',
  run: () => ui().set({ ribbonCollapsed: !ui().ribbonCollapsed }),
});
registerCommand({
  id: 'view.toggleTheme',
  icon: Moon,
  run: () => ui().set({ theme: ui().theme === 'light' ? 'dark' : 'light' }),
});
