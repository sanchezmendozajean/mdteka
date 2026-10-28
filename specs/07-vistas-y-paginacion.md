# 07 · Vistas y paginación

El mismo documento se puede ver de dos formas. Cambiar entre ellas no modifica el archivo (salvo que el usuario marque "Guardar como vista predeterminada del documento", que escribe `view.default`).

## Vista de páginas (estilo OnlyOffice)

- **VW-01** El lienzo es un fondo neutro (gris claro en tema claro, gris carbón en oscuro) con **hojas** del tamaño de papel configurado (`page.size`, `orientation`), con sombra suave y separación de 24 px entre hojas.
- **VW-02** El área editable respeta los **márgenes** (`page.margins`). Encabezado y pie de página se dibujan en los márgenes con el texto configurado (`{page}`, `{pages}`, `{title}`, `{date}`); no son editables desde el cuerpo, se editan con doble clic sobre ellos (abre panel) o desde *Disposición › Encabezado y pie*.
- **VW-03** **Regla** horizontal (y vertical opcional) como OnlyOffice, mostrando márgenes; arrastrar los marcadores de margen modifica `page.margins` del documento (con vista previa en vivo).
- **VW-04** La escritura fluye de una página a la siguiente de forma continua, como en un procesador de textos. El cursor puede pasar de una página a otra con flechas sin saltos visuales.

### Algoritmo de paginación (requisitos)

- **VW-10** Un solo editor (ProseMirror o CodeMirror) para todo el documento; las páginas son una **capa de presentación**: hojas dibujadas detrás y **decoraciones de salto** (widgets con la altura del margen inferior + separación + margen superior + encabezado) insertadas entre bloques. No se crean varios editores.
- **VW-11** Medición incremental: se cachea la altura de cada bloque; tras una edición solo se re-mide el bloque afectado y se recalculan los saltos desde esa página en adelante, en `requestIdleCallback`/`requestAnimationFrame`, sin bloquear la tecla.
- **VW-12** Reglas de corte (v1):
  - Se corta entre bloques. Un párrafo que no cabe se mueve entero a la página siguiente, **excepto** si es más alto que una página o si dejaría más de un 40 % de la página vacía: entonces se corta por **línea** (usando rectángulos de línea del DOM) insertando el salto como decoración en línea.
  - Títulos no quedan huérfanos al pie (se mueven con el bloque siguiente).
  - Tablas se cortan por filas y repiten la fila de encabezado (fase posterior: PUEDE).
  - Bloques de código se cortan por líneas.
  - Imágenes no se cortan; si son más altas que la página se escalan para caber.
  - `<!-- mdtor:pagebreak -->` fuerza salto.
- **VW-13** El bloque que contiene el cursor no cambia de página mientras el usuario escribe dentro de la misma línea; si debe moverse, se hace al terminar la ráfaga (pausa ≥ 150 ms) compensando el scroll para que el cursor quede en la misma posición en pantalla.
- **VW-14** La paginación en pantalla DEBE coincidir con la exportación a PDF (misma lógica de corte; el PDF se genera desde una vista de impresión que reutiliza el paginador).
- **VW-15** En modo **texto** también hay vista de páginas: líneas de código en la hoja con los mismos márgenes (útil para revisar longitud).

## Vista continua (hoja larga)

- **VW-20** Una sola hoja blanca, infinitamente larga, centrada, con el ancho de columna `view.continuousWidth` (configurable con un deslizador en la barra de estado y arrastrando los bordes de la hoja con un ícono de manejador al pasar el ratón).
- **VW-21** Sin encabezados/pies ni saltos; los saltos de página manuales se muestran como una línea discontinua tenue con la etiqueta "Salto de página".
- **VW-22** Padding superior generoso (≈ 64 px) para que el título no quede pegado al borde.

## Zoom

- **VW-30** 50 %–300 %, pasos de 10 %. `Ctrl + rueda`, `Ctrl +`/`Ctrl -`/`Ctrl+Alt+0`. Presets: *Ajustar a página*, *Ajustar a ancho*, *100 %*.
- **VW-31** El zoom es de la vista (no se guarda en el documento); se recuerda por documento en `userData`.

## Barra de estado (abajo)

De izquierda a derecha, cada elemento con ícono:

`Página 3 de 12` · `1 248 palabras` · idioma · aviso de fuente sustituida (si aplica) · … · selector **WYSIWYG / Texto** · selector **Páginas / Continua** · ancho de columna (solo en continua) · zoom (− deslizador + %).

## Impresión y PDF

- **VW-40** *Archivo › Exportar › PDF* usa `webContents.printToPDF` sobre una vista de impresión con el mismo CSS y paginador. Incluye marcadores (bookmarks) a partir de los títulos y enlaces internos funcionales.
- **VW-41** *Archivo › Imprimir* (`Ctrl+P`) usa el diálogo del sistema con la misma vista.
- **VW-42** Exportar a HTML: un archivo autocontenido con el CSS del documento (imágenes-archivo copiadas a carpeta junto al HTML o incrustadas, a elección).
