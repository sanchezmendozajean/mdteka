# 06 · Imágenes

## Modos de pegado

El modo se configura en el documento (`images.pasteMode`, ver `04`), heredable del proyecto y de la app. Valor de fábrica: `ask`.

| Modo | Resultado en el `.md` |
|------|-----------------------|
| `base64` | `![](data:image/png;base64,iVBORw0…)` dentro del documento |
| `file` | Archivo guardado junto al `.md` y enlace relativo `![](manual.001.png)` |
| `ask` | Diálogo al pegar para elegir uno de los dos |

### IMG-01 Pegar como base64

- La imagen se incrusta como data URL.
- Si pesa más de **300 KB** (configurable) se muestra advertencia: "Las imágenes grandes en base64 hacen pesado el archivo y los diffs de Git. ¿Guardar como archivo?" con botones *Guardar como archivo* / *Incrustar igual*.
- En modo texto, la data URL larga se **pliega** visualmente (`![](data:image/png;base64,…·48 KB)`) para no inundar el editor; el texto real no cambia.

### IMG-02 Pegar como archivo

- **Ubicación**: la misma carpeta del `.md` que la usa (por defecto). El proyecto PUEDE definir una subcarpeta relativa al documento (ej. `img/`), pero siempre relativa al `.md`, nunca global.
- **Nombre**: `<nombre-del-md-sin-extensión>.<NNN>.<ext>`
  - `manual.md` → `manual.001.png`, `manual.002.png`, …
  - `NNN` con 3 dígitos y relleno de ceros; si se superan 999 se pasa a 4 dígitos.
  - El número es el **siguiente libre**: se calcula buscando el mayor `NNN` existente en la carpeta para ese documento y sumando 1 (nunca se reutilizan huecos para no confundir historiales de Git).
  - `ext`: `png` para imágenes del portapapeles (bitmap); si se pega/arrastra un archivo se conserva su formato (`jpg`, `gif`, `webp`, `svg`).
- **Enlace**: relativo, con `/`, sin `./`, con espacios codificados (`%20`) o, si el nombre tiene espacios, entre `<…>`.
- Escritura atómica; si falla, no se inserta el enlace y se muestra error.

### IMG-03 Preguntar siempre

Diálogo compacto, centrado, con miniatura de la imagen, peso y dimensiones:

- **Guardar como archivo** (ícono `file-image`) — muestra el nombre que se usará, editable.
- **Incrustar en el documento** (ícono `code`) — muestra el peso resultante.
- Casilla "Recordar para este documento" (escribe `images.pasteMode` en el bloque de config) y enlace "Cambiar el predeterminado…".
- `Enter` = opción predeterminada (archivo), `Esc` = cancelar.

## Otras formas de insertar

- **IMG-10** Arrastrar y soltar archivos de imagen sobre el editor: se aplica el mismo modo. En modo `file`, si la imagen ya está dentro de la carpeta del documento, solo se enlaza (no se copia).
- **IMG-11** *Insertar › Imagen* (ícono `image`): selector de archivo, URL remota o portapapeles.
- **IMG-12** Imágenes remotas (`https://…`) se muestran pero no se descargan salvo acción "Guardar localmente" del menú contextual.

## Edición de imágenes en WYSIWYG

- Clic selecciona la imagen (marco y manejadores). Popover con íconos: texto alternativo, título, reemplazar, convertir a archivo/base64, abrir carpeta, quitar.
- **Redimensionar** visualmente: solo si el usuario confirma "Guardar tamaño", se escribe como `<img src="…" width="400">` (HTML válido en MD); por defecto las imágenes ocupan como máximo el ancho editable (`images.maxWidth`).
- Al eliminar una imagen-archivo del documento, el archivo **no** se borra automáticamente. Acción del proyecto "Limpiar imágenes huérfanas" lista archivos `<doc>.NNN.*` no referenciados para que el usuario decida.

## Renombrar y mover documentos

- **IMG-20** Al renombrar `manual.md` → `guia.md` desde MDTor, se ofrece renombrar sus imágenes (`manual.001.png` → `guia.001.png`) y actualizar los enlaces. Al mover el documento a otra carpeta, se ofrece mover sus imágenes con él.
