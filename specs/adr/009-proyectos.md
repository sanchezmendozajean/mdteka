# ADR 009 · Proyectos

- **Estado**: aceptada (Fase 5)
- **Requisitos**: PRJ-01…PRJ-34, GIT-05, IMG-20, `04` (herencia), `09` (estado de sesión)

## Decisiones

1. **El índice se escribe al instante.** Cada operación del navegador (reordenar, renombrar, añadir…)
   serializa el `.mdtor` y lo guarda con escritura atómica; el proyecto no tiene «cambios sin
   guardar». Es lo que hace que reordenar un capítulo sea un cambio de una línea en Git y que el
   archivo pueda editarse a mano a la vez: un cambio externo se recarga solo (se vigila con el mismo
   observador de archivos que los documentos).
2. **Serialización determinista con una línea por ítem (PRJ-05).** `serializeProject` no usa
   `JSON.stringify` con sangría: escribe los ítems sin hijos, y los libros y colecciones vacíos, en una
   sola línea, como en el ejemplo de `05`. Mover un capítulo cambia solo su línea (la coma del último
   elemento obliga a tocar a su vecino cuando se mueve el último: es inherente a JSON). El orden de
   claves es canónico y las claves desconocidas se conservan al final.
3. **Los ids son estables y no dependen del orden (PRJ-05).** `slug-corto-xxxx` con 4 caracteres
   aleatorios; el título de un ítem es opcional y, si falta, sale del primer H1 (leído por el proceso
   principal de los primeros 16 KB de cada archivo).
4. **Rutas del proyecto: relativas, con `/`, sin `./` ni `..` (PRJ-03).** Se validan en el esquema y
   en el renderer se convierten a rutas del sistema solo en el borde (`absolutePath`).
5. **Concesiones por carpeta.** Hasta ahora el renderer solo podía leer archivos que el usuario eligió.
   Para un proyecto el proceso principal concede la **carpeta del `.mdtor`** (`grantTree`): dentro de
   ella solo se conceden, al primer uso, los `.md`/`.txt`/`.mdtor`, y las imágenes por
   `mdtor-asset://`. El asistente de proyecto nuevo solo puede conceder la carpeta de un documento
   ya abierto (o una elegida en el diálogo nativo).
6. **Herencia (04).** fábrica ← ajustes de la app ← **proyecto** ← preset ← bloque del documento. Si el
   documento no elige preset vale el del proyecto (`defaults.theme`) y los valores explícitos del
   proyecto lo superan; si el documento elige otro preset, este supera lo explícito del proyecto
   (el usuario lo eligió después y más cerca). El panel Documento muestra el origen «proyecto».
7. **Mover y renombrar con imágenes (IMG-20, PRJ-24).** Las imágenes `<doc>.NNN.<ext>` viajan con su
   documento y se renombran a `<nuevo>.NNN.<ext>` (siguiente número libre si chocan); los demás
   enlaces relativos (`](…)` y `src="…"`) se recalculan para apuntar al mismo archivo. Al mover entre
   libros se **pregunta** si el archivo también va a la carpeta del libro. Un documento abierto con
   cambios se guarda primero (se pregunta) y su pestaña se reabre en la ruta nueva.
8. **Sin indexar (PRJ-27).** Se explora la carpeta (sin carpetas ocultas ni `node_modules`, máximo
   5000 archivos) y se restan lo indexado y los patrones `ignore` (globs propios: `**` cruza
   carpetas, `*` y `?` no).
9. **Sesión en `userData` (PRJ-04, 09).** Nodos desplegados, pestañas abiertas y la activa se guardan
   en `userData/state/projects.json`, con la ruta del `.mdtor` como clave; nunca en el proyecto.
10. **Un solo proyecto abierto.** Abrir otro proyecto reemplaza al actual (los documentos abiertos se
    quedan como archivos sueltos). Pasar a modo archivo deja las pestañas como están (PRJ-32).
11. **Modo archivo con el panel visible.** El navegador sigue mostrándose (con acciones para abrir o
    crear un proyecto) en modo archivo, como se validó en el diseño de la Fase 0; PRJ-20 pide que
    sea visible solo en modo proyecto. Se oculta o muestra con `Ctrl+Shift+B` y su ancho se
    arrastra (200–520 px, se recuerda).
12. **Exportación a PDF.** Un libro o el proyecto se exporta armando un documento temporal (sin
    pestaña) con portada, índice generado y los capítulos, separados por `mdtor:pagebreak` si se
    pide, y se imprime con el mismo motor de páginas que el editor. Las rutas de imágenes de cada
    capítulo se reescriben relativas a la carpeta del proyecto.
13. **Conflictos de Git.** Un `.mdtor` con marcadores `<<<<<<<` se rechaza con la línea del conflicto
    y no se toca (10 · Merge).

## Desviaciones y pendientes

- **PRJ-34 (una ventana por proyecto, varias ventanas simultáneas): no implementado.** La
  instancia única de la app enfoca la ventana existente y abre el proyecto en ella. Cambia la
  arquitectura de ventanas (estado por ventana en main), así que se deja para una fase posterior.
- **Exportación a HTML de sitio estático con navegación**: no implementada (el PDF sí).
- **Ajustes del proyecto**: el cuadro cubre título, descripción, numeración de capítulos nuevos,
  `ignore`, preset, fuente, tamaño y pegado de imágenes; el resto de los defaults se editan en el
  `.mdtor` o con «Fijar todo en el documento». «Carpeta de imágenes» queda para cuando exista la
  opción por documento.
- **`.gitattributes`** (PUEDE en `10`): no se sugiere al crear el proyecto.
- Los subcapítulos nuevos se crean en la carpeta del libro (no en una subcarpeta del padre).
