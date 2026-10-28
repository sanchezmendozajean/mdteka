# 12 · Roadmap y criterios de aceptación

Cada fase termina con la app ejecutable, pruebas en verde y una nota en `CHANGELOG.md`. No se avanza de fase sin cumplir sus criterios.

## Fase 0 — Cimientos

- Scaffold Electron + Vite + React + TypeScript, ESLint/Prettier, Vitest, Playwright-Electron.
- Seguridad de `02` (contextIsolation, sandbox, CSP, preload tipado).
- Sistema de diseño base desde `specs/design/` (tokens, Icon, Button, Ribbon vacía, paneles, barra de estado).
- i18n es/en.
- **Acepta si**: `npm run dev` abre la ventana con layout vacío estilo `08`; `npm test` y `npm run e2e` pasan; build de Windows instalable.

## Fase 1 — Núcleo del editor

- Parser/serializador mdast ↔ ProseMirror con **preservación de fuente por bloque** (ED-20…24).
- Modo WYSIWYG con todos los elementos de `03` (salvo notas al pie, HTML embebido editable).
- Modo texto CodeMirror y alternancia con mapeo de cursor/scroll (ED-01…04).
- Abrir/guardar archivos sueltos, guardado atómico, detección de cambios externos.
- Cinta *Inicio* e *Insertar* funcionales.
- **Acepta si**: corpus round-trip byte-idéntico; test E2E que escribe 2 000 caracteres y verifica que la posición en pantalla de los bloques anteriores no cambia (ED-10); ninguna marca Markdown visible en WYSIWYG en ningún estado (ED-11, test con selección sobre cada tipo de formato); en WYSIWYG, teclear `# Hola`, `**x**`, `- a`, `1. b`, `<b>` produce párrafos literales guardados como `\# Hola`, `\*\*x\*\*`, `\- a`, `1\. b`, `&lt;b&gt;`, y al reabrir se ven sin barras (ED-15, ED-25); el mismo texto escrito en modo texto se interpreta como Markdown (ED-16); la prueba por propiedad de ED-25 pasa con ≥ 10 000 casos; latencia < 16 ms p95 medida con un doc de 50 páginas.

## Fase 2 — Configuración del documento y tipografía

- Lectura/escritura del bloque `mdtor:config` (DOC-01…05), esquema zod + JSON Schema.
- Panel Documento, pestaña *Diseño*, presets, fuentes incluidas, CSS por documento con scope (DOC-10…13).
- Herencia app → documento (proyecto se suma en fase 5).
- **Acepta si**: dos pestañas con fuentes distintas no se afectan; cambiar el tamaño de fuente modifica una sola línea del bloque; abrir un archivo con bloque desconocido conserva claves extra; documento sin cambios de config no recibe bloque.

## Fase 3 — Vistas y paginación

- Vista de páginas con paginador incremental (VW-10…15), regla, encabezado/pie, saltos manuales.
- Vista continua con ancho configurable (VW-20…22). Zoom. Barra de estado completa.
- Exportación PDF/HTML e impresión (VW-40…42).
- **Acepta si**: el número de páginas en pantalla coincide con el PDF en el corpus de prueba; escribir al final de una página pasa a la siguiente sin salto visual del cursor; repaginar un doc de 100 páginas tras una edición no bloquea la entrada (> 0 frames perdidos solo en idle).

## Fase 4 — Imágenes

- Pegado base64 / archivo / preguntar (IMG-01…03), arrastrar y soltar, inserción, popover, redimensionado opcional, advertencia de tamaño, plegado de data URLs en modo texto.
- **Acepta si**: pegar tres imágenes en `manual.md` crea `manual.001.png`, `manual.002.png`, `manual.003.png` y enlaces relativos; borrar la 002 y pegar otra crea `manual.004.png`; la opción "Recordar" escribe `images.pasteMode` en el bloque.

## Fase 5 — Proyectos

- Formato `.mdtor` (PRJ-01…05), esquema, carga/guardado determinista.
- Navegador de libros con colecciones, libros, capítulos, drag & drop, menú contextual, "Sin indexar", faltantes (PRJ-20…29).
- Cambio de modo archivo ⇄ proyecto durante la edición (PRJ-30…34). Asistente de creación/importación.
- Búsqueda en proyecto, defaults de proyecto, exportar libro/proyecto a PDF.
- Asociación de archivos `.mdtor` y `.md`.
- **Acepta si**: reordenar un capítulo cambia solo las líneas de ese ítem en el `.mdtor`; abrir el `.mdtor` por doble clic en Windows abre el proyecto; un `.md` suelto dentro de un proyecto ofrece "Abrir proyecto".

## Fase 6 — Pulido

- Corrector ortográfico, paleta de comandos, KeyTips, modo concentración, tema oscuro completo, ajustes de la app completos, atajos editables, recuperación ante cierre, actualizaciones automáticas.
- Auditoría de accesibilidad y de "todo tiene ícono" (script que recorre el registro de comandos y falla si alguno no tiene ícono).

## Posteriores (PUEDE)

Matemáticas KaTeX, Mermaid, tablas que repiten encabezado al cortar página, estado Git en el navegador, reordenar secciones desde el esquema, plantillas de proyecto.

## Definición de terminado (todas las fases)

- Requisitos de la fase referenciados por id en los tests.
- Sin errores de TypeScript ni de lint.
- Ningún texto de UI sin traducir; ningún comando sin ícono.
- Probado en Windows; CI compila en macOS y Linux.
