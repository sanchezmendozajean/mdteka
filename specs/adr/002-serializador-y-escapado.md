# ADR 002 · Serializador: estructura con mdast-util-to-markdown, escapado propio

- **Estado**: aceptada (Fase 1)
- **Requisitos**: ED-21, ED-22, ED-25

## Contexto

`02` indica `remark-stringify` con patrones `unsafe` más reglas propias. Los patrones `unsafe` de
mdast-util-to-markdown escapan de forma conservadora y sin conocer el contexto de ProseMirror: escapan
`_` dentro de `snake_case_var` y `<` como `\<`, mientras que ED-25 pide escapado *mínimo* y `&lt;`.

## Decisión

1. La **estructura** (listas, citas, tablas con relleno, código con vallas, títulos ATX, énfasis,
   enlaces) la sigue generando `mdast-util-to-markdown` con las convenciones fijas de ED-22.
2. El **texto literal** lo escapa MDteca (`editor/model/escape.ts`) al convertir ProseMirror → mdast,
   donde se conoce el contexto (inicio de línea, celda de tabla, título, vecinos). El texto ya escapado
   viaja en un nodo propio `literal` con su *handler*, no como `html` (este degrada los saltos duros).
3. La conversión es **por bloque** y solo se ejecuta para bloques modificados. Cada bloque de primer
   nivel guarda su texto original (`src`) y el espacio que lo precede (`gap`); un bloque se reutiliza
   literalmente si al reparsear su `src` resulta estructuralmente igual al nodo actual.
4. El reparseo de un bloque incluye las definiciones de enlace/nota del documento, porque `[foo]` solo
   es una referencia si existe `[foo]: …`.
5. Las listas contiguas reescritas eligen marcadores distintos (`-`/`*`/`+`, `.`/`)`) para no fundirse.
6. Los autolinks literales de GFM (`https://…`) se leen como texto, para que lo tecleado siga siendo
   texto (ED-25).

## Consecuencias

- Prueba por propiedad (20 000 casos + 5 000 por contenedor) de que `parse(serialize(s))` devuelve `s`.
- Escapado mínimo y legible; a cambio, el código de escapado es nuestro y se mantiene con la prueba.
- Efecto conocido: `mdast-util-to-markdown` codifica como `&#x6F;` el carácter pegado a un énfasis `_`
  intrapalabra para que siga siendo válido (p. ej. `_&#x78;_&#x6D;undo`). Es correcto y solo aparece al
  formatear parte de una palabra.
