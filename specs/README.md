# MDTor — Especificaciones

MDTor es un editor de escritorio de Markdown, construido con Electron, que combina la comodidad de un procesador de textos tipo **OnlyOffice Document** (páginas, estilos, barra de herramientas con íconos) con la portabilidad de archivos `.md` puros, pensados para versionarse en Git.

Esta carpeta es la fuente de verdad del producto. Está escrita para que **Claude Code** (implementación) y **Claude Design** (diseño visual) construyan el programa sin ambigüedades.

## Índice

| # | Documento | Contenido |
|---|-----------|-----------|
| 01 | [Visión y alcance](01-vision-y-alcance.md) | Qué es, para quién, objetivos y no-objetivos |
| 02 | [Arquitectura técnica](02-arquitectura.md) | Stack, procesos de Electron, módulos, seguridad |
| 03 | [Editor](03-editor.md) | WYSIWYG y texto plano, fluidez, fidelidad del Markdown |
| 04 | [Formato del documento](04-formato-documento.md) | Configuración embebida en comentario HTML |
| 05 | [Proyectos](05-proyectos.md) | Archivo `.mdtor`, navegador de libros, modo archivo vs proyecto |
| 06 | [Imágenes](06-imagenes.md) | Pegado de imágenes: base64, archivo, preguntar |
| 07 | [Vistas y paginación](07-vistas-y-paginacion.md) | Vista de páginas, hoja continua, zoom, impresión |
| 08 | [Interfaz](08-interfaz.md) | Layout estilo OnlyOffice, cinta, paneles, íconos, temas |
| 09 | [Configuración y persistencia](09-configuracion.md) | Jerarquía de ajustes, qué se guarda dónde |
| 10 | [Git y portabilidad](10-git-y-portabilidad.md) | Reglas para diffs limpios y repos sanos |
| 11 | [Atajos de teclado](11-atajos.md) | Mapa de atajos |
| 12 | [Roadmap y criterios de aceptación](12-roadmap-y-aceptacion.md) | Fases, entregables, pruebas |
| — | [prompts/claude-design.md](prompts/claude-design.md) | Prompt para Claude Design |
| — | [prompts/claude-code.md](prompts/claude-code.md) | Prompt para Claude Code |

## Orden de trabajo recomendado

1. Pasar `prompts/claude-design.md` a **Claude Design** junto con `01`, `07`, `08`. Exportar el resultado (tokens, mockups, componentes) a `specs/design/`.
2. Pasar `prompts/claude-code.md` a **Claude Code** con la carpeta completa del repositorio abierta.
3. Claude Code trabaja por fases (ver `12`) y no avanza de fase sin cumplir los criterios de aceptación.

## Glosario

- **Documento**: un archivo `.md`.
- **Configuración de documento**: bloque JSON dentro de un comentario HTML al final del `.md` (ver `04`).
- **Proyecto**: carpeta con muchos `.md` y un archivo índice `*.mdtor` (ver `05`).
- **Libro**: agrupación de primer nivel dentro de un proyecto (p. ej. "Manual de usuario"). Contiene capítulos.
- **Colección**: clasificación de libros en el navegador (p. ej. "Técnico", "Negocio").
- **Modo WYSIWYG**: edición visual, sin marcas de Markdown visibles.
- **Modo texto**: edición del Markdown fuente.
- **Vista de páginas** / **Vista continua**: dos formas de mostrar el mismo documento (ver `07`).

## Convenciones de estas specs

- **DEBE** = obligatorio. **DEBERÍA** = muy recomendado. **PUEDE** = opcional.
- Cada requisito tiene un identificador (`ED-03`, `IMG-02`…) para referenciarlo en commits, issues y pruebas.
