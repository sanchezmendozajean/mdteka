# ADR 008 · Imágenes

- **Estado**: aceptada (Fase 4)
- **Requisitos**: IMG-01…IMG-12, ED-04, `02` (seguridad), VW-12

## Decisiones

1. **`mdtor-asset://` limitado a las carpetas de los documentos abiertos.** El proceso principal
   registra el esquema (`standard`, `secure`) y lo atiende con `protocol.handle`: decodifica la ruta,
   la canonicaliza con `realpath`, exige extensión de imagen y que esté dentro de la carpeta de un
   documento concedido, y limita el tamaño. Un `.txt` junto al documento o `..` no se sirven; un SVG
   se envía con su propia CSP para que no ejecute nada. Una prueba E2E lo comprueba.
2. **CSP: `img-src` admite `https:`.** IMG-12 pide mostrar imágenes remotas, y no hay forma de
   permitirlas sin abrir `https:` en general. El riesgo asumido es el de las imágenes de rastreo; no
   se descargan salvo con «Guardar localmente».
3. **Nombres y escritura (IMG-02).** `<doc>.<NNN>.<ext>` con el mayor número existente + 1 (nunca se
   reutilizan huecos, 4 dígitos pasado el 999), escritura atómica y enlace relativo con `/`, con los
   espacios y los paréntesis codificados (`%20`, `%28`) para no depender de `<…>`. El nombre se puede
   editar en el diálogo; si ya existe, se usa el numerado.
4. **Un documento sin guardar no tiene carpeta.** Antes de crear el archivo se guarda el documento
   (el diálogo lo avisa). Para una imagen en `file` mode es la única alternativa honesta a escribir
   en una ruta inventada.
5. **Una sola imagen va en línea; varias, cada una en su párrafo.** Tras insertar una imagen queda
   seleccionada (con su menú); si se pega otra con una imagen seleccionada, va detrás en lugar de
   sustituirla.
6. **Tamaño guardado (06).** Soltar el tirador escribe el ancho (antes había que confirmar con «Guardar
   tamaño»; se quitó a petición) como `<img src="…" alt="…" width="N">`. Una `<img>` sola en su línea es un
   bloque HTML para CommonMark, pero aquí se lee como imagen dentro de su párrafo, así que el
   documento sigue editándose como imagen y se guarda idéntico. Cualquier otra etiqueta o atributo
   se conserva como HTML.
7. **`sameContent` y `src`.** El atributo `src` de los bloques es la fuente original para la
   preservación, y se ignoraba en la comparación; en una imagen es su origen y sí cuenta (si no, un
   cambio de archivo a base64 reutilizaba el texto viejo). Hay una prueba.
8. **Imágenes y paginación.** Las imágenes son «indivisibles» para el paginador (no tienen líneas
   uniformes) y se escalan para caber en el área de texto (`max-height`). Al cargar, su bloque se
   vuelve a medir. El PDF espera a que carguen antes de montar la vista de impresión.
9. **Modo texto (IMG-01).** Las data URL largas se pliegan con una decoración (`…·48 KB`) atómica;
   el texto real no cambia. Pegar o soltar una imagen en modo texto inserta `![](…)`.
10. **HTML exportado con imágenes-archivo (VW-42).** Se pregunta si incrustarlas o copiarlas a
    `<nombre>_files/`.
11. **Rutas aún sin conceder.** `grant` canonicaliza la carpeta de un archivo que todavía no existe
    (Guardar como), para que la ruta concedida coincida con la que tendrá después (nombres cortos
    8.3 en Windows).
12. **Título visible como pie de foto (extensión de 06).** Por defecto el título es solo el tooltip
    estándar. Para mostrarlo se escribe `<!-- mdtor:caption -->` inmediatamente después de la
    imagen (`![a](f.png "T")<!-- mdtor:caption -->`, o tras la etiqueta `<img … width>`). Es un
    comentario HTML: no lo muestra ningún otro renderizador y sigue la convención de
    `mdtor:config` y `mdtor:pagebreak`. Descartadas: listas de atributos `{.caption}` (otros visores
    muestran el texto), prefijos en el título (ensucian el tooltip) y una clave en el bloque de
    configuración (no se ligaría a la imagen). Sin título no se escribe el marcador.

## Desviaciones menores

- El enlace «Cambiar el predeterminado…» del diálogo (IMG-03) es la casilla «Usar también como
  predeterminado de la app»; los ajustes de la app llegan en la Fase 6.
- Renombrar o mover documentos con sus imágenes (IMG-20) llega con los proyectos (Fase 5).
