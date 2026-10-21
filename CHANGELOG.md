# Changelog

## [Fase 1] — Núcleo del editor

**Markdown y fidelidad**
- Modelo ProseMirror ↔ mdast con **preservación de fuente por bloque** (`src` + `gap`): abrir y guardar sin cambios es idéntico byte a byte (EOL, BOM, bloque de configuración) y editar un bloque solo cambia ese bloque [ED-20, ED-21].
- Serializador con convenciones fijas (`-`, `1.`, `**`, `_`, vallas de código, ATX, `---`, tablas con relleno) y listas contiguas que no se funden [ED-22].
- **Escapado contextual y mínimo** del texto literal, con prueba por propiedad (20 000 casos, más 5 000 por contenedor) [ED-25].
- Corpus `tests/fixtures/roundtrip/`: 652 ejemplos de CommonMark, GFM, CRLF, BOM, HTML embebido, front matter, líneas en blanco y un documento de 66 páginas (`node scripts/gen-corpus.mjs` regenera la parte generada) [ED-24].
- Lo no reconocido (definiciones, notas al pie, YAML, HTML) se conserva como bloque literal; el HTML se muestra sanitizado.

**Editor**
- Modo WYSIWYG (ProseMirror, sin *input rules*: lo tecleado es texto) y modo texto (CodeMirror 6 con plegado de secciones) [ED-15, ED-16]. Alternancia con `Ctrl+/`, barra de estado y cinta; conserva cursor, selección y scroll relativo [ED-01, ED-02, ED-23].
- Párrafos, títulos 1–6, énfasis, enlaces (`Ctrl+K`, `Ctrl`+clic abre), listas con viñetas / numeradas / de tareas con sangrado por `Tab`, citas, bloques de código con selector de lenguaje y resaltado (Lezer), tablas con filas, columnas y alineación, separador, salto de página, HTML embebido y Markdown sin formato (con editor de la fuente del bloque).
- Alturas de línea fijas por tipo de bloque, sin saltos al teclear [ED-10]; ninguna marca Markdown visible, tampoco con selección [ED-11]; p95 ≈ 8–12 ms por tecla en un documento de 66 páginas [ED-12].
- Pegado: HTML → estructura limpia (DOMPurify, sin estilos); texto plano → literal; `Ctrl+Alt+V` pega como Markdown [ED-14].
- Buscar y reemplazar (`Ctrl+F` / `Ctrl+H`) con mayúsculas, palabra completa y regex, común a los dos modos.
- Contador de palabras en la barra de estado.

**Archivos**
- Abrir (diálogo, línea de comandos, asociación), guardar y guardar como con escritura atómica y concesiones de ruta; pestañas con indicador de cambios; confirmación al cerrar.
- Detección de cambios externos: recarga silenciosa si no hay cambios locales; si los hay, *Recargar* / *Mantener los míos* / *Comparar*.

**Interfaz**
- Cinta **Archivo**, **Inicio** (portapapeles, historial, galería de estilos, formato, párrafo, buscar, tabla contextual), **Insertar** (tabla con selector de cuadrícula, bloques, enlace, fecha) y **Vista**.
- Registro central de comandos con atajos; test que exige ícono y traducción (es/en).

**Decisiones**: ADR 001–005 en `specs/adr/`.

**Pendiente de fases posteriores** (no forma parte de los criterios de la Fase 1): imágenes (Fase 4), vistas de páginas (Fase 3), menú contextual propio, barra flotante de formato, panel Esquema, corrector ortográfico y paleta de comandos (Fase 6), notas al pie y edición enriquecida de HTML embebido.

## [Fase 0] — Cimientos

- Scaffold Electron + electron-vite + React + TypeScript estricto, ESLint, Prettier, Vitest y Playwright-Electron.
- Seguridad (02): `contextIsolation`, `sandbox`, sin `nodeIntegration`, CSP estricta, permisos denegados, IPC con contrato zod, apertura externa solo http/https/mailto, instancia única.
- Sistema de diseño base desde `specs/design/`: tokens claro/oscuro, `Icon` (Lucide), `CommandButton`, cinta con las 7 pestañas (vacía), paneles Navegador/Documento y barra de estado.
- Registro central de comandos con test que exige ícono y traducción (UI-01, UI-16).
- i18n es/en con prueba de paridad de claves.
- `npm run dist` genera instalador NSIS sin firmar.
