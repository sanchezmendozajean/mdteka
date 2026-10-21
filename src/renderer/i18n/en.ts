import type { es } from './es';

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export const en: Widen<typeof es> = {
  app: { name: 'MDteca' },
  ribbon: {
    file: 'File',
    home: 'Home',
    insert: 'Insert',
    design: 'Design',
    layout: 'Layout',
    view: 'View',
    project: 'Project',
    empty: 'Commands for this tab will arrive in upcoming phases.',
  },
  panels: {
    navigator: 'Navigator',
    outline: 'Outline',
    document: 'Document',
    emptyNavigator: 'Open a project to see its books.',
    emptyOutline: 'Document headings will appear here.',
    emptyDocument: 'Document settings will appear here.',
  },
  status: { words: '{{count}} words', mode: 'Mode', view: 'View', zoom: 'Zoom' },
  welcome: {
    title: 'Welcome to MDteca',
    subtitle: 'Write Markdown with the feel of a word processor.',
  },
  commands: {
    'view.toggleNavigator': 'Show/hide navigator',
    'view.toggleDocumentPanel': 'Show/hide Document panel',
    'view.collapseRibbon': 'Collapse ribbon',
    'view.toggleTheme': 'Toggle light/dark theme',
  },
};
