export const es = {
  app: { name: 'MDteca' },
  ribbon: {
    file: 'Archivo',
    home: 'Inicio',
    insert: 'Insertar',
    design: 'Diseño',
    layout: 'Disposición',
    view: 'Vista',
    project: 'Proyecto',
    empty: 'Los comandos de esta pestaña llegarán en las próximas fases.',
  },
  panels: {
    navigator: 'Navegador',
    outline: 'Esquema',
    document: 'Documento',
    emptyNavigator: 'Abre un proyecto para ver sus libros.',
    emptyOutline: 'Los títulos del documento aparecerán aquí.',
    emptyDocument: 'La configuración del documento aparecerá aquí.',
  },
  status: { words: '{{count}} palabras', mode: 'Modo', view: 'Vista', zoom: 'Zoom' },
  welcome: {
    title: 'Bienvenido a MDteca',
    subtitle: 'Escribe Markdown con la sensación de un procesador de textos.',
  },
  commands: {
    'view.toggleNavigator': 'Mostrar/ocultar navegador',
    'view.toggleDocumentPanel': 'Mostrar/ocultar panel Documento',
    'view.collapseRibbon': 'Colapsar cinta',
    'view.toggleTheme': 'Cambiar tema claro/oscuro',
  },
} as const;
