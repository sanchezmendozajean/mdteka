(function () {
  const R = (t, k) => ({ t, k: k || 't' });
  window.MDT = {
    MM: 3.7795,
    PS: { A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6], B5: [176, 250] },
    PSL: { A4: 'A4', A5: 'A5', Letter: 'Carta', Legal: 'Oficio', B5: 'B5' },
    APP: { size: 'A4', orientation: 'portrait', margins: { top: 25, right: 25, bottom: 25, left: 25 }, header: '{title}', footer: '{page}', font: 'Source Serif 4', mono: 'JetBrains Mono', fontSize: 12, lineHeight: 1.5, paraSpacing: 0.6, align: 'left', lang: 'es-PE', theme: 'clasico', numbering: false, pasteMode: 'ask', maxWidth: 100 },
    PROJ: { font: 'IBM Plex Sans', mono: 'IBM Plex Mono', fontSize: 11, theme: 'tecnico', header: 'Manual del Sistema de Planillas', pasteMode: 'file' },
    PRESETS: {
      clasico: { font: 'Source Serif 4', fontSize: 12, lineHeight: 1.5, align: 'justify', numbering: false },
      moderno: { font: 'Inter', fontSize: 11, lineHeight: 1.55, align: 'left', numbering: false },
      tecnico: { font: 'IBM Plex Sans', mono: 'IBM Plex Mono', fontSize: 11, lineHeight: 1.5, align: 'left', numbering: true },
      academico: { font: 'Literata', fontSize: 12, lineHeight: 1.6, align: 'justify', numbering: false, margins: { top: 30, right: 30, bottom: 30, left: 30 } },
      compacto: { font: 'Source Sans 3', fontSize: 10.5, lineHeight: 1.35, paraSpacing: 0.4, align: 'left', numbering: false }
    },
    PRESET_NAMES: { clasico: 'Clásico', moderno: 'Moderno', tecnico: 'Técnico', academico: 'Académico', compacto: 'Compacto' },
    BS0: {
      paragraph: { size: 1, weight: 400, italic: false, upper: false, before: 0, after: 0.6, color: 'var(--ink)' },
      h1: { size: 2, weight: 700, italic: false, upper: false, before: 0, after: 0.55, color: 'var(--ink)' },
      h2: { size: 1.38, weight: 600, italic: false, upper: false, before: 1.3, after: 0.45, color: 'var(--ink)' },
      h3: { size: 1.12, weight: 600, italic: false, upper: false, before: 1.1, after: 0.35, color: 'var(--ink)' },
      blockquote: { size: 1, weight: 400, italic: true, upper: false, before: 0.3, after: 0.9, color: 'var(--ink-2)' },
      code: { size: 0.84, weight: 400, italic: false, upper: false, before: 0.2, after: 0.9, color: 'var(--ink)' },
      table: { size: 0.9, weight: 400, italic: false, upper: false, before: 0.35, after: 1, color: 'var(--ink)' },
      link: { size: 1, weight: 500, italic: false, upper: false, before: 0, after: 0, color: 'var(--doc-link)' }
    },
    BTYPES: [['paragraph', 'Normal', 'pilcrow'], ['h1', 'Título 1', 'heading-1'], ['h2', 'Título 2', 'heading-2'], ['h3', 'Título 3', 'heading-3'], ['blockquote', 'Cita', 'quote'], ['code', 'Código', 'square-code'], ['table', 'Tabla', 'table'], ['link', 'Enlace', 'link']],
    SWATCHES: [['var(--ink)', 'Tinta'], ['var(--ink-2)', 'Grafito'], ['#1D6A72', 'Petróleo'], ['#2E4A7A', 'Azul'], ['#8A3B2E', 'Óxido']],
    BLOCKS: [
      { k: 'h1', num: '3', t: 'Instalación del módulo de pagos', page: 1 },
      { k: 'p', page: 1, runs: [R('Este capítulo describe cómo instalar y configurar el '), R('módulo de pagos', 'b'), R(' en un servidor de producción. Antes de continuar, '), R('verifque', 'spell'), R(' que su entorno cumple los requisitos descritos en el '), R('capítulo 2', 'link'), R('.')] },
      { k: 'h2', num: '3.1', t: 'Requisitos previos', page: 1 },
      { k: 'li', page: 1, runs: [R('Servidor con '), R('Ubuntu 22.04 LTS', 'b'), R(' o superior.')] },
      { k: 'li', page: 1, runs: [R('PostgreSQL 15 con la extensión '), R('pgcrypto', 'code'), R(' habilitada.')] },
      { k: 'li', page: 1, runs: [R('Acceso de administrador al panel de Planillas.')] },
      { k: 'li', page: 1, last: true, runs: [R('Certificado TLS vigente para el dominio de la empresa.')] },
      { k: 'p', page: 1, runs: [R('La tabla 3.1 resume los recursos mínimos según el número de trabajadores procesados por mes.')] },
      { k: 'table', page: 1, head: ['Trabajadores', 'CPU', 'Memoria', 'Disco'], rows: [['Hasta 500', '2 vCPU', '4 GB', '40 GB'], ['De 500 a 5 000', '4 vCPU', '8 GB', '120 GB'], ['Más de 5 000', '8 vCPU', '16 GB', '400 GB']], caption: 'Tabla 3.1 · Recursos mínimos por volumen mensual' },
      { k: 'h2', num: '3.2', t: 'Instalación', page: 1 },
      { k: 'p', page: 1, runs: [R('Descargue el paquete desde el repositorio interno y ejecute el instalador con permisos de administrador:')] },
      { k: 'code', page: 1, lang: 'bash', lines: [
        [['$ ', 'm'], ['curl ', 't'], ['-O ', 'f'], ['https://repo.planillas.pe/pagos/pagos-3.4.1.tar.gz', 's']],
        [['$ ', 'm'], ['tar ', 't'], ['-xzf ', 'f'], ['pagos-3.4.1.tar.gz', 's'], [' && ', 'm'], ['cd ', 't'], ['pagos-3.4.1', 's']],
        [['$ ', 'm'], ['sudo ./instalar.sh ', 't'], ['--entorno=', 'f'], ['produccion', 's']]
      ] },
      { k: 'p', page: 2, runs: [R('Al finalizar, el instalador muestra un resumen de los servicios activos y la URL del panel de control. El panel debe verse como en la figura 3.1.')] },
      { k: 'img', page: 2, alt: 'Panel de control del módulo de pagos', src: 'manual.001.png', caption: 'Figura 3.1 · Panel de control del módulo de pagos' },
      { k: 'quote', page: 2, runs: [R('Importante:', 'b'), R(' no ejecute el instalador sobre una base de datos con planillas abiertas. Cierre el periodo vigente antes de actualizar el módulo.')] },
      { k: 'h3', num: '3.2.1', t: 'Variables de entorno', page: 2 },
      { k: 'p', page: 2, runs: [R('El archivo '), R('/etc/pagos/pagos.env', 'code'), R(' define la conexión a la base de datos y la moneda por defecto. Reinicie el servicio después de cada cambio con '), R('systemctl restart pagos', 'code'), R('.')] },
      { k: 'break', page: 2 },
      { k: 'h2', num: '3.3', t: 'Verificación', page: 3 },
      { k: 'p', page: 3, runs: [R('Complete la siguiente lista antes de habilitar el módulo para los usuarios finales:')] },
      { k: 'task', page: 3, done: true, runs: [R('Servicio '), R('pagos', 'code'), R(' activo y habilitado al inicio.')] },
      { k: 'task', page: 3, done: true, runs: [R('Conexión a la base de datos verificada.')] },
      { k: 'task', page: 3, done: false, runs: [R('Primer pago de prueba conciliado con el banco.')] },
      { k: 'task', page: 3, done: false, last: true, runs: [R('Respaldo inicial programado.')] }
    ],
    TREE: [
      { id: 'tecnico', title: 'Técnico', icon: 'cpu', books: [
        { id: 'arq', title: 'Arquitectura', icon: 'book-open', items: [
          { id: 'intro', title: 'Introducción', st: 'open' },
          { id: 'mod', title: 'Módulos', children: [{ id: 'm-pagos', title: 'Pagos' }, { id: 'm-plan', title: 'Planillas' }] },
          { id: 'inst', title: 'Instalación del módulo de pagos', st: 'dirty' },
          { id: 'seg', title: 'Seguridad y permisos' }
        ] },
        { id: 'ope', title: 'Operación', icon: 'server', items: [
          { id: 'resp', title: 'Respaldos' },
          { id: 'moni', title: 'Monitoreo', st: 'missing' },
          { id: 'inc', title: 'Gestión de incidentes' }
        ] }
      ] },
      { id: 'usuario', title: 'Usuario', icon: 'users', books: [
        { id: 'guia', title: 'Guía rápida', icon: 'rocket', items: [
          { id: 'pp', title: 'Primeros pasos', st: 'open' },
          { id: 'calc', title: 'Cálculo de planilla' },
          { id: 'bol', title: 'Boletas de pago' }
        ] }
      ] }
    ],
    UNINDEXED: ['borrador-integraciones.md', 'notas-reunion.md'],
    RECENT_PROJECTS: [
      { title: 'Manual del Sistema de Planillas', path: 'D:\\docs\\planillas\\manual-planillas.mdteca', when: 'Hoy' },
      { title: 'Tesis de maestría', path: 'C:\\Users\\ana\\tesis\\tesis.mdteca', when: 'Ayer' },
      { title: 'API Pagos v3', path: '~/repos/api-pagos/docs/api.mdteca', when: '12 oct' }
    ],
    RECENT_FILES: [
      { title: 'manual.md', path: 'D:\\docs\\planillas\\tecnico\\pagos', when: 'Hoy' },
      { title: 'notas-reunion.md', path: 'D:\\docs\\planillas', when: 'Hoy' },
      { title: 'README.md', path: '~/repos/mdteca', when: '15 oct' },
      { title: 'apuntes-calculo.md', path: 'C:\\Users\\ana\\uni\\2026-2', when: '9 oct' }
    ]
  };
})();
