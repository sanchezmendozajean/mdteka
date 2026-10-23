# Changelog

## [Fase 6] — Pulido

**Ajustes de la app** (`09`)

- Diálogo con secciones **General, Editor, Apariencia, Documento por defecto, Imágenes, Archivos, Atajos y Avanzado** (`Ctrl+,`); cada cambio se guarda al instante en `userData/settings.json`, validado con zod [CFG-02].
- General: idioma de la interfaz (español / inglés, al instante) y abrir el último proyecto al iniciar.
- Editor: modo por defecto, barra flotante, corrector e idiomas, autoguardado (desactivado / cada N s / al perder el foco) y modo máquina de escribir.
- Apariencia: tema claro, oscuro o «seguir al sistema», color de acento (6), densidad cómoda o compacta, hoja clara u oscura en tema oscuro y escala de la interfaz (80–150 %) [UI-12, UI-15].
- Imágenes: modo de pegado y umbral de aviso de base64. Archivos: fin de línea de los documentos nuevos y acceso a «aplicaciones predeterminadas» de Windows. Avanzado: restablecer ajustes.
- «Cambiar el predeterminado…» en el diálogo de pegado de imágenes abre Ajustes › Imágenes.

**Atajos y paleta** (`11`)

- Atajos reasignables (tabla con buscador): capturan la combinación, avisan de conflictos, se pueden quitar o restablecer. `Ctrl+Tab` / `Ctrl+Shift+Tab` cambian de pestaña.
- Paleta de comandos (`Ctrl+Shift+P`) con todos los comandos, su ícono y su atajo.
- KeyTips con `Alt`: letras sobre las pestañas y teclas sobre los botones.

**Editor**

- Barra flotante de formato al seleccionar texto (se puede desactivar).
- Menú contextual propio con íconos y sugerencias del corrector (cortar, copiar, pegar, pegar sin formato, formato).
- Panel **Esquema** (segunda pestaña del panel izquierdo): títulos del documento; clic lleva el cursor allí en WYSIWYG y en modo texto.
- Modo concentración (`F11`, pantalla completa; `Esc` sale) y modo máquina de escribir.

**Seguridad de los datos** (`02`)

- Autoguardado opcional.
- Recuperación ante un cierre inesperado: respaldo cada 30 s en `userData/recovery/`; al abrir se ofrece recuperar los documentos (también los sin guardar) con sus cambios sin guardar.

**Apariencia y accesibilidad**

- Tema oscuro completo, con hoja clara por defecto y hoja oscura opcional (tinta, código, enlaces y sintaxis incluidos).
- Contraste AA en claro y oscuro (`--text-3` más oscuro); nombres accesibles en cinta, pestañas, listas, editores y panel Documento.
- Los paneles Navegador y Documento tienen botón para esconderse.
- `npm run audit`: íconos y traducciones de cada comando (UI-01, UI-16) y auditoría de accesibilidad con axe sobre las pantallas principales y los diálogos.

**Decisiones**: ADR 010.

**Pendiente**: actualizaciones automáticas (hay que decidir dónde se publican las versiones y firmar el instalador), íconos propios de `.md` y `.mdteca`, notas al pie, menú del Dock y _jump list_ de recientes, modo máquina de escribir en modo texto, y una ventana por proyecto (PRJ-34, Fase 5).

## [Fase 5] — Proyectos

**Formato `.mdteca`** (`05`)

- JSON con esquema zod y JSON Schema publicado en `specs/schemas/project.schema.json`; rutas relativas con `/` (sin `./` ni `..`), ids estables `slug-xxxx`, claves desconocidas conservadas [PRJ-01, PRJ-03, PRJ-05].
- Serialización determinista: 2 espacios, orden de claves fijo, `\n` y salto final, **una línea por capítulo**. Reordenar un capítulo cambia solo las líneas de ese ítem [PRJ-05, GIT-05].
- Sin datos de máquina ni de sesión: nodos desplegados, pestañas abiertas y zoom van a `userData` [PRJ-04].
- Un `.mdteca` con marcadores de conflicto de Git se rechaza con la línea y no se toca.

**Navegador de libros** (panel izquierdo)

- Colecciones plegables (se ocultan si solo hay una), libros con ícono y contador, capítulos en árbol con línea guía; indicador de abierto, con cambios sin guardar y archivo faltante, este con «Localizar…» y «Quitar del índice» [PRJ-11, PRJ-22, PRJ-23, PRJ-28].
- Arrastrar y soltar: antes, después o dentro (subcapítulo) de otro capítulo, o sobre un libro. Al cambiar de libro pregunta si el archivo también va a su carpeta [PRJ-24].
- Menú contextual con íconos: nuevo capítulo, subcapítulo, libro y colección, renombrar (título o archivo), duplicar, quitar del índice, eliminar (papelera del sistema), revelar y copiar la ruta relativa; cambiar el ícono de libros y colecciones [PRJ-25].
- Capítulos nuevos con slug del título y prefijo numérico opcional (`03-configuracion.md`) [PRJ-26].
- **Sin indexar**: los `.md` de la carpeta fuera del índice y de `ignore`, con «Añadir al libro…» [PRJ-27].
- Buscar en el proyecto (`Ctrl+Shift+F`) con mayúsculas, palabra completa y regex; al hacer clic abre el archivo en esa coincidencia. Selector rápido de capítulos (`Ctrl+Shift+O`). Filtro por título. Ancho redimensionable y colapsable con `Ctrl+Shift+B` [PRJ-20, PRJ-21].
- Un enlace relativo a otro `.md` del proyecto se abre en una pestaña con `Ctrl`+clic [PRJ-29].

**Modo archivo ⇄ proyecto**

- Selector _Archivo | Proyecto_ en la barra de título [PRJ-30…32]. _Abrir como proyecto_ busca el `.mdteca` junto al archivo y en las carpetas superiores (hasta la raíz de Git o 5 niveles) y, si no hay, ofrece el asistente de proyecto nuevo, que puede importar los `.md` existentes (cada carpeta es un libro). _Editar solo este archivo_ vuelve al modo archivo sin cerrar pestañas.
- Un `.md` suelto que pertenece a un proyecto muestra «Este archivo forma parte de … · Abrir proyecto» [PRJ-33].
- Abrir un `.mdteca` (línea de comandos, asociación de archivos o con la aplicación ya abierta) abre el proyecto [PRJ-01].

**Ajustes y herencia**

- Ajustes del proyecto: título, descripción, numeración de capítulos nuevos, patrones `ignore` y valores por defecto de los documentos (preset, fuente, tamaño, pegado de imágenes). Herencia fábrica ← app ← **proyecto** ← preset ← documento; el panel Documento marca el origen «proyecto» [04].

**Archivos e imágenes**

- Mover o renombrar un capítulo lleva sus imágenes `<doc>.NNN.<ext>` (renombradas) y recalcula los demás enlaces relativos [IMG-20].
- _Quitar imágenes sin usar_: lista las imágenes propias del documento que ya no aparecen en su texto y las manda a la papelera [IMG-20].

**Exportación**

- _Exportar libro / proyecto a PDF_: un único PDF con portada, índice generado y cada capítulo en página nueva (o todo seguido), con el mismo motor de páginas que el editor.

**Decisiones**: ADR 009.

**Pendiente**: una ventana por proyecto (PRJ-34), exportación a HTML de sitio estático, sugerencia de `.gitattributes`, «carpeta de imágenes» en los ajustes del proyecto y «Cambiar el predeterminado…» como enlace a los ajustes de la app (Fase 6).

## [Fase 4] — Imágenes

**Pegado** (`06`)

- Modos `base64`, `file` y `ask` (valor de fábrica), heredables, en `images.pasteMode` [IMG-01…03].
- **Archivo**: `<doc>.<NNN>.<ext>` junto al documento (`manual.001.png`, `002`…), siempre el siguiente libre (no se reutilizan huecos), escritura atómica y enlace relativo codificado. Un documento sin guardar se guarda antes [IMG-02].
- **Base64**: advertencia a partir de 300 KB con _Guardar como archivo_ / _Incrustar igual_ [IMG-01].
- **Preguntar**: diálogo con miniatura, dimensiones y peso, nombre editable, _Recordar para este documento_ (escribe `images.pasteMode` en el bloque), «también predeterminado de la app», `Enter` = archivo y `Esc` cancela [IMG-03].
- Arrastrar y soltar: mismo modo; un archivo ya dentro de la carpeta del documento solo se enlaza [IMG-10]. También en modo texto, donde inserta el Markdown.
- _Insertar › Imagen_: desde un archivo, una dirección (https) o el portapapeles [IMG-11].

**Edición en WYSIWYG**

- Las imágenes locales se muestran por el protocolo `mdteca-asset://`, limitado a las carpetas de los documentos abiertos y solo para imágenes; las remotas se muestran sin descargarse [IMG-12].
- Clic selecciona la imagen y abre su menú: texto alternativo, título, reemplazar, convertir a archivo o a base64, guardar localmente una remota, abrir carpeta y quitar (no borra el archivo).
- Redimensionado con tirador: al soltar el tirador se escribe `<img src="…" width="N">`; _Quitar tamaño_ vuelve a la sintaxis Markdown.
- En modo texto las data URL largas se pliegan (`…·48 KB`) sin cambiar el texto.
- Las imágenes se escalan para caber en la página y entran en el reparto de páginas y en el PDF; el HTML exportado las incrusta o las copia a una carpeta.

- **Título visible** (a voluntad): la casilla «Visible en el documento» del menú de la imagen muestra el título como pie de foto bajo la imagen (también en PDF y HTML). Se guarda como un comentario pegado a la imagen, `![alt](foto.png "Título")<!-- mdteca:caption -->`; otros visores de Markdown lo ocultan y solo muestran el tooltip. Requiere título.

**Decisiones**: ADR 008.

**Pendiente**: «Cambiar el predeterminado…» como enlace a los ajustes de la app (Fase 6). Renombrar o mover un documento con sus imágenes (IMG-20) y la limpieza de huérfanas se hicieron en la Fase 5.

## [Fase 3] — Vistas y paginación

**Vista de páginas** (`07`)

- Hojas del tamaño del papel (A4, A5, Letter, Legal, B5, orientación vertical u horizontal) con sombra y 24 px de separación; el área editable respeta los márgenes. Un solo editor: los saltos de página son decoraciones, el documento no cambia [VW-01, VW-10].
- Motor de paginación puro (`paginator/layout.ts`): corte entre bloques; párrafos y código se cortan por líneas (viudas y huérfanas de 2 líneas, o si mover el bloque dejaría más del 40 % vacío); los títulos no quedan solos al pie; `<!-- mdteca:pagebreak -->` fuerza página; los bloques indivisibles más altos que una página desbordan [VW-12].
- Medición incremental con caché por nodo: tras editar solo se vuelve a medir el bloque editado. Un documento de ~134 páginas se repagina en menos de 40 ms y escribir no produce tareas largas [VW-11].
- El cursor no salta: lo que mueve su bloque espera a una pausa al escribir y el desplazamiento se compensa para que conserve su posición en pantalla [VW-13].
- Encabezado y pie con `{title}`, `{page}`, `{pages}` y `{date}` (pie `{page}` centrado por defecto, «primera página distinta»); doble clic sobre ellos abre su configuración [VW-02].
- Regla horizontal con marcadores de margen arrastrables y vista previa en vivo; escribe `page.margins` [VW-03].
- Modo texto también en páginas, con los mismos márgenes y saltos [VW-15, ED-04].

**Vista continua, zoom y barra de estado**

- Vista continua con ancho de columna configurable (deslizador en la barra de estado), salto manual como línea discontinua con etiqueta y 64 px de margen superior; _Guardar como vista predeterminada_ escribe `view.default` y `view.continuousWidth` [VW-20…VW-22].
- Zoom 50–300 % en pasos de 10 % (botones, deslizador, `Ctrl +`/`Ctrl -`/`Ctrl+Alt+0`, `Ctrl` + rueda), _ajustar a ancho_ y _a página_; se recuerda por documento en `userData/state/` [VW-30, VW-31].
- Barra de estado: «Página N de M», selector Páginas / Continua, ancho de columna y zoom [07].
- Pestaña **Disposición** (papel, orientación, márgenes con presets, encabezado y pie, ancho de columna) y sección **Página** en el panel Documento.

**Exportación e impresión**

- _Exportar a PDF_ (`printToPDF`, con marcadores a partir de los títulos), _Imprimir_ (`Ctrl+P`) y _Exportar a HTML_ autocontenido con CSS y fuentes incrustadas [VW-40…VW-42].
- La vista de impresión usa el mismo motor y los mismos bloques que la pantalla: el número de páginas del PDF coincide con el de la pantalla en el documento largo del corpus (134 páginas) y en un documento con código partido, saltos manuales y listas [VW-14].

**Decisiones**: ADR 007.

**Pendiente**: corte de tablas por filas con encabezado repetido (PUEDE en `07`), regla vertical, imágenes escaladas para caber (Fase 4) y verificar los enlaces internos del PDF con un visor externo.

## [Fase 2] — Configuración del documento y tipografía

**Bloque `mdteca:config`** (`04`)

- Lectura y escritura del bloque al final del archivo, con esquema zod y JSON Schema publicado en `specs/schemas/document-config.schema.json` [DOC-01, DOC-02].
- Claves desconocidas conservadas. JSON inválido o fuera de esquema se ignora, avisa en el panel y se puede _Reparar_. La secuencia `--` se escapa dentro del JSON [DOC-03].
- Solo se escriben las claves que difieren de lo heredado, en orden canónico y con sangría de 2 espacios. Cambiar el tamaño modifica una sola línea; un documento sin cambios de configuración no recibe bloque y abrir/guardar no lo toca. _Restablecer a valores heredados_ lo elimina y _Fijar todo en el documento_ escribe todas las claves [DOC-04].
- Ningún editor muestra el bloque; editarlo deja el documento con cambios sin guardar [DOC-05].

**Tipografía y presets**

- Pestaña **Diseño**: galería de presets con miniatura (Clásico, Moderno, Técnico, Académico, Compacto), fuente, tamaño, interlineado, espaciado de párrafo, alineación, títulos numerados, editar estilos y restablecer.
- Panel **Documento**: tipografía y estilos de bloque (títulos, párrafo, cita, código, enlace) con indicador de origen (documento / app) y _volver al heredado_ por valor. _Usar como predeterminado de la app_ escribe `userData/settings.json`.
- Una familia por documento más una monoespaciada. 10 fuentes OFL empaquetadas y cualquier fuente del sistema por nombre; si falta, se usa la incluida más parecida y la barra de estado avisa sin tocar el archivo [DOC-10, DOC-12, DOC-13].
- CSS por documento acotado con `[data-doc-id]`: dos pestañas con fuentes distintas no se afectan. Las alturas de línea siguen siendo píxeles enteros fijos por tipo de bloque [DOC-11, ED-10].
- Herencia fábrica → app → preset → documento (el proyecto se suma en la Fase 5).

**Interfaz y editor** (ajustes pedidos durante la fase)

- Los desplegables de la cinta ya no se recortan al desplazarla.
- Quitar un bloque de código conserva las líneas como párrafos.
- Flecha abajo al final de un bloque de código final crea un párrafo debajo.
- Barra de selección en el margen izquierdo: clic = línea, arrastrar = líneas, doble clic = párrafo, triple clic = todo.
- Clic en el margen derecho = cursor al final de esa línea (también tras una imagen a todo el ancho); clic bajo la última línea = cursor al final del documento.
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

- Modo WYSIWYG (ProseMirror, sin _input rules_: lo tecleado es texto) y modo texto (CodeMirror 6 con plegado de secciones) [ED-15, ED-16]. Alternancia con `Ctrl+/`, barra de estado y cinta; conserva cursor, selección y scroll relativo [ED-01, ED-02, ED-23].
- Párrafos, títulos 1–6, énfasis, enlaces (`Ctrl+K`, `Ctrl`+clic abre), listas con viñetas / numeradas / de tareas con sangrado por `Tab`, citas, bloques de código con selector de lenguaje y resaltado (Lezer), tablas con filas, columnas y alineación, separador, salto de página, HTML embebido y Markdown sin formato (con editor de la fuente del bloque).
- Alturas de línea fijas por tipo de bloque, sin saltos al teclear [ED-10]; ninguna marca Markdown visible, tampoco con selección [ED-11]; p95 ≈ 8–12 ms por tecla en un documento de 66 páginas [ED-12].
- Pegado: HTML → estructura limpia (DOMPurify, sin estilos); texto plano → literal; `Ctrl+Alt+V` pega como Markdown [ED-14].
- Buscar y reemplazar (`Ctrl+F` / `Ctrl+H`) con mayúsculas, palabra completa y regex, común a los dos modos.
- Contador de palabras en la barra de estado.

**Archivos**

- Abrir (diálogo, línea de comandos, asociación), guardar y guardar como con escritura atómica y concesiones de ruta; pestañas con indicador de cambios; confirmación al cerrar.
- Detección de cambios externos: recarga silenciosa si no hay cambios locales; si los hay, _Recargar_ / _Mantener los míos_ / _Comparar_.

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
