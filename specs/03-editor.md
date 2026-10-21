# 03 · Editor

El editor es la pieza central. Este documento tiene prioridad sobre cualquier otro en caso de conflicto.

## Dos modos, un documento

| Modo | Motor | Qué ve el usuario |
|------|-------|-------------------|
| **WYSIWYG** | ProseMirror | Texto con formato final. Nunca marcas de Markdown. |
| **Texto** | CodeMirror 6 | Markdown fuente, con resaltado sutil. |

- **ED-01** El usuario DEBE poder alternar de modo en cualquier momento (botón en la barra de estado, cinta *Vista* y `Ctrl+/`).
- **ED-02** Al alternar, DEBE conservarse: posición del cursor (mapeada al bloque/carácter equivalente), selección cuando sea posible, posición de scroll relativa y el historial de deshacer de cada modo.
- **ED-03** Ambos modos DEBEN aplicar la misma tipografía y ancho del documento (`04`). El modo texto usa la fuente monoespaciada del documento salvo que el usuario elija "texto con fuente del documento".
- **ED-04** Ambos modos DEBEN funcionar en vista de páginas y en vista continua (`07`).

## Experiencia de escritura (requisitos no negociables)

- **ED-10 Sin saltos.** Escribir, borrar, pegar o aplicar formato NO DEBE mover el texto que está antes del cursor, ni cambiar la altura de líneas no editadas, ni desplazar el scroll de forma inesperada.
  - Alturas de línea fijas por tipo de bloque (definidas en `04`), nunca dependientes del contenido en línea.
  - Las fuentes se cargan y miden **antes** del primer pintado (precarga + `document.fonts.ready`); no hay FOUT ni re-layout.
  - Los elementos en línea (código, enlaces, negrita) no alteran la altura de línea (`line-height` fijo, `vertical-align` controlado, padding de `code` solo horizontal).
  - Las imágenes reservan su espacio antes de cargar (dimensiones leídas al insertar y cacheadas).
  - La repaginación nunca mueve el bloque donde está el cursor mientras se escribe; se aplica en el siguiente idle y compensa scroll.
- **ED-11 Sin marcas visibles en WYSIWYG.** Jamás se muestran `**`, `_`, `#`, `>`, `` ` ``, `[]()` ni similares, **tampoco al posar el cursor** sobre el texto formateado (se rechaza el estilo "live preview" que revela sintaxis).
- **ED-15 En WYSIWYG lo que se escribe es texto, nunca sintaxis.** El editor visual NO interpreta como Markdown nada de lo que el usuario teclea. No existen *input rules* ni autoformato: escribir `# Hola` produce un párrafo que dice literalmente "# Hola"; escribir `**x**` produce los cuatro asteriscos y la x como texto normal.
  - El formato en WYSIWYG se aplica **solo** con la cinta, los atajos de teclado (`Ctrl+B`, `Ctrl+1`…), la barra flotante, el menú contextual o la paleta de comandos.
  - Al guardar, esos caracteres se **escapan** en el `.md` para que cualquier visor (GitHub, GitLab, VS Code) muestre el mismo texto literal que el usuario vio. Ver ED-25.
  - Al reabrir el archivo, los escapes se interpretan y el usuario vuelve a ver el carácter limpio (`#`), nunca la barra invertida.
- **ED-16 En modo texto, el Markdown es Markdown.** En el modo texto (CodeMirror) el usuario escribe sintaxis Markdown y esta se interpreta normalmente: si escribe `# Hola` en modo texto y pasa a WYSIWYG, verá un Título 1. Lo que escribe en modo texto se guarda tal cual, sin escapes añadidos.
- **ED-12 Fluidez.** Latencia tecla→pintado < 16 ms p95 (ver `02`). La serialización a Markdown ocurre fuera del camino de la tecla (debounce ~300 ms o en idle).
- **ED-13 Limpieza.** Cursor suave (sin parpadeo agresivo; PUEDE ofrecer cursor animado), selección con color del tema, sin bordes de foco sobre el lienzo.
- **ED-14 Pegado inteligente.** Pegar HTML desde web/Word se convierte a Markdown limpio (sin estilos inline, sin fuentes), conservando su estructura (títulos, listas, negritas). Pegar **texto plano** en WYSIWYG se trata como texto literal, igual que si se tecleara (ED-15): sus `#`, `*`, `-`… se escapan. `Ctrl+Shift+V` pega sin formato. Para pegar un fragmento de Markdown e interpretarlo, existe el comando explícito **Pegar como Markdown** (`Ctrl+Alt+V`, ícono `clipboard-check`). Imágenes: ver `06`.

## Elementos soportados

CommonMark + GFM:

| Elemento | WYSIWYG | Comando (todos con ícono) |
|----------|---------|---------------------------|
| Párrafo | ✔ | Estilo › Normal |
| Títulos H1–H6 | ✔ | Estilo › Título 1…6 |
| Negrita, cursiva, tachado, código en línea | ✔ | Botones de formato |
| Enlace | ✔ (popover para editar/abrir/quitar) | Insertar › Enlace |
| Lista con viñetas / numerada / tareas | ✔ (tab/shift+tab anidan) | Botones de lista |
| Cita | ✔ | Estilo › Cita |
| Bloque de código con lenguaje | ✔ resaltado (Shiki o Lezer), selector de lenguaje | Insertar › Código |
| Tabla GFM | ✔ edición de celdas, añadir/quitar filas/columnas, alineación | Insertar › Tabla (selector de cuadrícula) |
| Línea horizontal | ✔ | Insertar › Separador |
| Imagen | ✔ (redimensionado visual NO altera el MD; ver `06`) | Insertar › Imagen |
| Salto de página | ✔ marca visual discreta | Insertar › Salto de página (`<!-- mdteca:pagebreak -->`) |
| Notas al pie | ✔ | Insertar › Nota al pie |
| HTML embebido | Bloque atómico renderizado y sanitizado; doble clic abre editor de fuente del bloque | — |
| Matemáticas (`$…$`, `$$…$$`) | PUEDE (fase posterior, KaTeX) | — |
| Mermaid | PUEDE (fase posterior) | — |

Todo lo no reconocido se conserva como **bloque crudo** intacto (nodo atómico que muestra un chip "Markdown sin formato · editar"), nunca se pierde.

## Fidelidad del Markdown (round-trip)

- **ED-20** Abrir y guardar sin editar DEBE producir el archivo idéntico byte a byte (mismo EOL, mismo BOM, mismo bloque de config).
- **ED-21** Editar un bloque DEBE afectar solo a ese bloque en el diff. Implementación requerida: **preservación de fuente por bloque**. Cada nodo de bloque guarda el rango original (`position` de mdast) y su texto fuente; al serializar, los bloques no modificados reutilizan su texto original literal y solo los modificados se re-serializan.
- **ED-22** Cuando un bloque se re-serializa, se usan convenciones fijas y configurables (ver `10`): `-` para viñetas, `1.` para numeradas, `**` negrita, `_` cursiva, `` ``` `` para código, títulos ATX (`#`), separador `---`, tablas alineadas con padding.
- **ED-23** Pasar de WYSIWYG a texto y viceversa sin editar NO DEBE alterar la fuente.
- **ED-25 Escapado de texto literal.** Al serializar texto que proviene de WYSIWYG, todo carácter que Markdown interpretaría como sintaxis en esa posición se escapa con `\`. El escapado es **contextual y mínimo** (solo cuando hace falta) para que el `.md` siga siendo legible:

  | El usuario escribe en WYSIWYG | Se guarda como | Motivo |
  |---|---|---|
  | `# Hola` (al inicio del párrafo) | `\# Hola` | Evita título |
  | `Precio #1` (en medio) | `Precio #1` | No es sintaxis ahí; no se escapa |
  | `**importante**` | `\*\*importante\*\*` | Evita negrita |
  | `snake_case_var` | `snake_case_var` | GFM no trata `_` intraword como énfasis |
  | `_nota_` | `\_nota\_` | Evita cursiva |
  | `- item` / `+ item` / `* item` (al inicio) | `\- item` / `\+ item` / `\* item` | Evita lista |
  | `1. Paso` (al inicio) | `1\. Paso` | Evita lista numerada |
  | `> cita` (al inicio) | `\> cita` | Evita cita |
  | `` `codigo` `` | `` \`codigo\` `` | Evita código en línea |
  | `[texto](url)` | `\[texto\](url)` | Evita enlace |
  | `![x](y)` | `!\[x\](y)` | Evita imagen |
  | `~~tachado~~` | `\~\~tachado\~\~` | Evita tachado GFM |
  | `---` / `***` / `===` (línea sola) | `\---` / `\***` / `\===` | Evita separador o título setext |
  | `a \| b` (dentro de una celda de tabla) | `a \| b` | Evita romper la tabla |
  | `C:\ruta` | `C:\\ruta` solo si el carácter siguiente es escapable; si no, `C:\ruta` | La `\` literal no debe convertirse en escape |
  | `<div>` / `<b>` | `&lt;div&gt;` / `&lt;b&gt;` | Evita HTML embebido |
  | `&copy;` | `&amp;copy;` | Evita entidad HTML |
  | `$x$` (si matemáticas está activo) | `\$x\$` | Evita fórmula |
  | ```` ``` ```` (al inicio) | ```` \`\`\` ```` | Evita bloque de código |

  - Las URLs escritas como texto (`https://…`) no se escapan; GFM puede mostrarlas como enlace en otros visores. Convertirlas en enlace dentro de MDteca es siempre una acción explícita (`Ctrl+K`).
  - El escapado lo hace el serializador (remark-stringify con `unsafe` patterns + reglas propias); el modelo ProseMirror guarda el texto **sin** escapes.
  - Prueba obligatoria por propiedad (*property-based*, p. ej. `fast-check`): para cualquier cadena `s` tecleada en un párrafo WYSIWYG, `parse(serialize(s))` produce exactamente un párrafo cuyo texto es `s`.
  - Los bloques no editados conservan su fuente original (ED-21), incluidos los escapes que ya traían.
- **ED-24** Suite de pruebas de round-trip con un corpus (`tests/fixtures/roundtrip/`) que incluya los ejemplos de la especificación CommonMark y GFM, documentos reales largos y casos límite (HTML embebido, listas mixtas, tablas con pipes escapados, CRLF, BOM).

## Funciones de edición

- Deshacer/rehacer ilimitado por sesión (agrupado por pausas de escritura).
- Buscar y reemplazar (`Ctrl+F`, `Ctrl+H`) con mayúsculas, palabra completa y regex; en modo proyecto, buscar en todo el proyecto (`Ctrl+Shift+F`).
- Panel **Esquema** (outline) con los títulos; clic navega; arrastrar reordena secciones (PUEDE, fase posterior).
- Contador de palabras, caracteres y tiempo de lectura en la barra de estado; con selección, cuenta la selección.
- Corrector ortográfico de Chromium con selección de idioma(s), subrayado discreto y sugerencias en el menú contextual.
- Menú contextual propio (no el de Chromium) con íconos: cortar, copiar, pegar, pegar sin formato, formato, insertar, sugerencias ortográficas.
- Barra flotante de formato al seleccionar texto (PUEDE desactivarse).
- Modo concentración (`F11`): oculta cinta y paneles, solo el documento.
- Modo máquina de escribir (PUEDE): mantiene la línea activa centrada verticalmente.

## Modo texto (CodeMirror)

- Aquí sí se escribe Markdown (ED-16). Los atajos de formato (`Ctrl+B`, `Ctrl+1`…) insertan o quitan la sintaxis correspondiente alrededor de la selección.
- Resaltado Markdown sutil: títulos en peso mayor, marcas en color atenuado, código en monoespaciada.
- Plegado de secciones por título.
- El **bloque de configuración** (`04`) se oculta por defecto en modo texto (plegado e ineditable, con un chip "Configuración del documento · abrir panel"). Un ajuste avanzado permite mostrarlo y editarlo como texto; si el JSON resulta inválido, se avisa y no se aplica hasta corregirlo.
- Ajuste de línea suave (soft wrap) al ancho del documento; los saltos duros del archivo se respetan.
