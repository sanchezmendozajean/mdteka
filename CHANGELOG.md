# Changelog

## [Fase 2] — Configuración del documento y tipografía

**Bloque `mdteca:config`** (`04`)
- Lectura y escritura del bloque al final del archivo, con esquema zod y JSON Schema publicado en `specs/schemas/document-config.schema.json` [DOC-01, DOC-02].
- Claves desconocidas conservadas. JSON inválido o fuera de esquema se ignora, avisa en el panel y se puede *Reparar*. La secuencia `--` se escapa dentro del JSON [DOC-03].
- Solo se escriben las claves que difieren de lo heredado, en orden canónico y con sangría de 2 espacios. Cambiar el tamaño modifica una sola línea; un documento sin cambios de configuración no recibe bloque y abrir/guardar no lo toca. *Restablecer a valores heredados* lo elimina y *Fijar todo en el documento* escribe todas las claves [DOC-04].
- Ningún editor muestra el bloque; editarlo deja el documento con cambios sin guardar [DOC-05].

**Tipografía y presets**
- Pestaña **Diseño**: galería de presets con miniatura (Clásico, Moderno, Técnico, Académico, Compacto), fuente, tamaño, interlineado, espaciado de párrafo, alineación, títulos numerados, editar estilos y restablecer.
- Panel **Documento**: tipografía y estilos de bloque (títulos, párrafo, cita, código, enlace) con indicador de origen (documento / app) y *volver al heredado* por valor. *Usar como predeterminado de la app* escribe `userData/settings.json`.
- Una familia por documento más una monoespaciada. 10 fuentes OFL empaquetadas y cualquier fuente del sistema por nombre; si falta, se usa la incluida más parecida y la barra de estado avisa sin tocar el archivo [DOC-10, DOC-12, DOC-13].
- CSS por documento acotado con `[data-doc-id]`: dos pestañas con fuentes distintas no se afectan. Las alturas de línea siguen siendo píxeles enteros fijos por tipo de bloque [DOC-11, ED-10].
- Herencia fábrica → app → preset → documento (el proyecto se suma en la Fase 5).

**Interfaz y editor** (ajustes pedidos durante la fase)
- Los desplegables de la cinta ya no se recortan al desplazarla.
- Quitar un bloque de código conserva las líneas como párrafos.
- Flecha abajo al final de un bloque de código final crea un párrafo debajo.
- Barra de selección en el margen izquierdo: clic = línea, arrastrar = líneas, doble clic = párrafo, triple clic = todo.
- Una palabra muy larga se parte y ya no empuja los paneles.

**Decisiones**: ADR 006.

**Pendiente de fases posteriores**: edición de `page` y `view` (Fase 3) e `images` (Fase 4); se leen, validan y conservan. La lista de fuentes del sistema se sustituye por escribir el nombre (ADR 006).

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
