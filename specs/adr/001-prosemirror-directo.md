# ADR 001 · ProseMirror directo, sin Tiptap

- **Estado**: aceptada (Fase 1)
- **Requisitos**: ED-11, ED-15, ED-21, ED-12

## Contexto

`02-arquitectura.md` admite ProseMirror «vía Tiptap o directo». Tiptap añade una capa de extensiones
(StarterKit) que registra por defecto *input rules* (`# ` → título, `**x**` → negrita…) y *paste rules*,
justo lo que ED-15 prohíbe, y oculta el modelo de documento, donde necesitamos atributos propios por
bloque (`src`, `gap`) para la preservación de fuente (ED-21).

## Decisión

Se usa **ProseMirror directamente** (`prosemirror-state`, `-view`, `-model`, `-commands`, `-history`,
`-keymap`, `-schema-list`, `-tables`, `-gapcursor`, `-dropcursor`). El esquema, los plugins y los
comandos son propios; no existe ningún plugin de *input rules*.

## Consecuencias

- Control total del esquema, del pegado y de las decoraciones (resaltado, búsqueda).
- Hay que escribir los comandos de formato, listas y tablas (≈ 400 líneas), a cambio de no tener que
  desactivar extensiones ajenas.
- Un test verifica que teclear `# Hola`, `**x**`, `- a`, `1. b` y `<b>` produce párrafos literales.
