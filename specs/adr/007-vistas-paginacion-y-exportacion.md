# ADR 007 · Paginación, vista de impresión y exportación

- **Estado**: aceptada (Fase 3)
- **Requisitos**: VW-01…VW-42, ED-04, ED-10

## Decisiones

1. **Un solo editor, páginas como capa de presentación (VW-10).** Las hojas se dibujan detrás del
   editor (`.sheets`) y los saltos son *widgets* de ProseMirror (`Decoration.widget`) entre bloques o
   dentro de un párrafo / bloque de código; el documento nunca cambia. Un salto entre bloques lleva
   márgenes negativos que anulan los márgenes colapsados de sus vecinos, así que el bloque siguiente
   cae exactamente en el borde superior del área de texto.
2. **Motor puro (`paginator/layout.ts`).** `paginate(bloques, {contentHeight, chrome})` reparte según
   VW-12: corte entre bloques, párrafos y código por línea (huérfanas y viudas de 2 líneas; si
   mover el bloque dejaría más de un 40 % de página vacía), títulos con el bloque siguiente,
   `<!-- mdteca:pagebreak -->` y bloques indivisibles más altos que la página (desbordan). Devuelve
   los cortes y los *trozos* de cada página. Lo usan la pantalla, el modo texto y el PDF (VW-14).
3. **Medición incremental (VW-11).** `Paginator` guarda en un `WeakMap` las medidas por nodo de
   ProseMirror (inmutable): tras editar solo se vuelve a medir el bloque editado y el reparto de
   todo el documento es aritmético. Las líneas de un párrafo se calculan (las alturas de línea son
   fijas, ED-10) y el inicio de la línea cortada se localiza con una búsqueda binaria sobre
   `coordsAtPos` (no `posAtCoords`, que falla fuera de la ventana visible).
4. **Cursor estable (VW-13).** Un cambio de reparto que afecta al bloque del cursor o a los
   anteriores espera a una pausa de 150 ms al escribir (máximo 1,2 s); al aplicarse, se compensa el
   desplazamiento para que el cursor conserve su posición en pantalla.
5. **Geometría en múltiplos de 1/64 px.** Chromium coloca los bloques en 1/64 px; con medidas
   arbitrarias el error de cada salto se acumulaba (~1 px tras 80 páginas). `pageGeometry` ajusta
   hoja y márgenes a 1/64 px.
6. **PDF e impresión (VW-40, VW-41).** Se monta el documento fuera de pantalla con los mismos *node
   views* y CSS, se mide con el mismo `Paginator` y se construye una vista de impresión: cada
   página es un rectángulo del tamaño del papel que recorta los trozos que le asigna el motor.
   Visible solo con `@media print`; `webContents.printToPDF` (con `preferCSSPageSize`, esquema de
   marcadores y PDF etiquetado) o el diálogo del sistema la imprimen. Así el número de páginas
   coincide con la pantalla por construcción, y una prueba lo comprueba con el PDF real.
7. **HTML (VW-42).** Un archivo con el CSS del documento y las fuentes del latín básico
   incrustadas en base64. Las fuentes las lee el proceso principal de `renderer/assets` (el
   renderer no puede leer `file://`). Las imágenes-archivo llegan con la Fase 4.
8. **Modo texto (VW-15).** Un `StateField` de CodeMirror dibuja los mismos saltos como bloques entre
   líneas, con alturas de `lineBlockAt` (las líneas fuera de la ventana usan la estimación de
   CodeMirror, así que el reparto puede ajustarse al desplazarse).
9. **Zoom con la propiedad CSS `zoom`** (50–300 %): escala el diseño real, así que el desplazamiento y
   las medidas siguen siendo coherentes; el paginador divide por el factor de escala medido. Se
   recuerda por documento en `userData/state/view.json` (VW-31).

## No incluido (PUEDE o fase posterior)

Corte de tablas por filas con encabezado repetido (VW-12, «fase posterior: PUEDE»), regla vertical,
imágenes que se escalan para caber (Fase 4). Los títulos del PDF llevan `id` para que los enlaces
`#sección` funcionen, pero no se ha verificado con un visor externo.
