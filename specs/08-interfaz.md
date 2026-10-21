# 08 · Interfaz

Referencia visual: **OnlyOffice Document Editor** (cinta con pestañas, lienzo gris con hojas, barra de estado con zoom), reinterpretado con una estética más **sobria y elegante**: menos bordes, más aire, tipografía de UI cuidada, íconos de trazo fino.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [logo] Archivo|Proyecto ▾   manual.md • ─ Manual de Planillas    ⌕  ─ □ ✕ │  barra de título (custom, arrastrable)
├──────────────────────────────────────────────────────────────────────────┤
│  Archivo  Inicio  Insertar  Diseño  Disposición  Vista  Proyecto         │  pestañas de la cinta
│  [icono][icono][icono] │ [Estilos ▾ galería ] │ [B][I][S][<>][🔗] │ …   │  cinta (grupos con etiqueta)
├────────────┬───────────────────────────────────────────────┬─────────────┤
│ Navegador  │ ┌ pestañas de documentos ─────────────────┐   │ Panel       │
│ de libros  │   intro.md ×   modulos.md • ×   +             │ Documento   │
│ (proyecto) │                                               │ (plegable)  │
│            │        ┌───────────────────────┐              │             │
│ ▾ Técnico  │        │  regla                │              │ Página      │
│   📖 Arq.  │        │  ┌─────────────────┐  │              │ Tipografía  │
│     intro  │        │  │  HOJA / PÁGINA  │  │              │ Estilos     │
│     mód.   │        │  │                 │  │              │ Imágenes    │
│ ▾ Usuario  │        │  └─────────────────┘  │              │             │
│ Sin index. │        └───────────────────────┘              │             │
├────────────┴───────────────────────────────────────────────┴─────────────┤
│ Pág 3/12 · 1 248 palabras · es-PE      [WYSIWYG|Texto] [Pág|Cont] − ●+ 100%│  barra de estado
└──────────────────────────────────────────────────────────────────────────┘
```

- Panel izquierdo: **Navegador** (modo proyecto) o **Esquema** del documento (ambos modos; en modo proyecto es una segunda pestaña del panel).
- Panel derecho: **Documento** (configuración de `04`) y propiedades contextuales (tabla, imagen, enlace seleccionado).
- Ambos paneles colapsables y redimensionables; el estado se recuerda.

## Cinta de opciones

**UI-01 Todas las opciones tienen ícono** (cinta, menús, menú contextual, diálogos, navegador, barra de estado). Íconos de **Lucide**, 18 px en cinta (24 px en botones grandes), trazo 1,5. Cada botón tiene tooltip con nombre y atajo.

| Pestaña | Grupos y comandos (ícono Lucide sugerido) |
|---------|------------------------------------------|
| **Archivo** (vista tipo *backstage* a pantalla completa) | Nuevo documento `file-plus`, Nuevo proyecto `folder-plus`, Abrir `folder-open`, Recientes `history`, Guardar `save`, Guardar como `save-all`, Exportar PDF `file-down`, Exportar HTML `file-code`, Imprimir `printer`, Propiedades `info`, Ajustes `settings`, Salir `log-out` |
| **Inicio** | Portapapeles: pegar `clipboard-paste`, cortar `scissors`, copiar `copy`, pegar sin formato `clipboard-type` · Deshacer `undo-2`/Rehacer `redo-2` · Estilos: galería Normal/Título 1–6/Cita/Código (`pilcrow`, `heading-1`…`heading-6`, `quote`, `square-code`) · Formato: `bold`, `italic`, `strikethrough`, `code`, `link`, `remove-formatting` · Párrafo: `list`, `list-ordered`, `list-checks`, `indent-increase`, `indent-decrease` · Buscar `search`, Reemplazar `replace` |
| **Insertar** | Imagen `image`, Tabla `table` (selector de cuadrícula), Bloque de código `square-code`, Cita `quote`, Separador `minus`, Salto de página `file-minus`, Enlace `link`, Nota al pie `footprints`, Lista de tareas `list-checks`, HTML `code-xml`, Fecha `calendar` |
| **Diseño** | Galería de presets de estilo (miniaturas) `palette`, Fuente del documento `type`, Tamaño `a-large-small`, Interlineado `move-vertical`, Espaciado de párrafo `between-horizontal-start`, Alineación `align-left`/`align-justify`, Editar estilos `brush`, Títulos numerados `list-tree`, Restablecer `rotate-ccw` |
| **Disposición** | Tamaño de papel `file`, Orientación `rectangle-vertical`/`rectangle-horizontal`, Márgenes `square-dashed` (presets: Normal, Estrecho, Ancho, Personalizado), Encabezado y pie `panel-top`/`panel-bottom`, Ancho de columna continua `move-horizontal`, Modo de pegado de imágenes `image-plus` |
| **Vista** | WYSIWYG `eye` / Texto `file-code-2`, Páginas `files` / Continua `scroll-text`, Zoom `zoom-in`/`zoom-out`, Regla `ruler`, Esquema `list-tree`, Navegador `library`, Panel Documento `panel-right`, Concentración `maximize`, Tema claro/oscuro `sun`/`moon` |
| **Proyecto** (habilitada en modo proyecto; en modo archivo muestra *Abrir como proyecto* y *Crear proyecto*) | Nuevo capítulo `file-plus-2`, Nuevo libro `book-plus`, Nueva colección `folder-tree`, Buscar en proyecto `file-search`, Sin indexar `file-question`, Imágenes huérfanas `image-off`, Exportar libro `book-down`, Ajustes del proyecto `settings-2` |

- La cinta PUEDE colapsarse a solo pestañas (`Ctrl+F1`), como OnlyOffice.
- Botones con estado activo (negrita, lista…) reflejan la selección actual.
- Desplegables con vista previa en vivo al pasar el ratón (estilos, fuentes, presets).

## Estética

- **UI-10 Tipografía de interfaz**: Inter (incluida), 13 px base, pesos 400/500/600.
- **UI-11 Paleta**: neutros cálidos, un solo color de acento (sugerido: azul tinta `#2F5BEA` o verde petróleo — decide Claude Design). Tokens en CSS variables. Contraste AA mínimo.
- **UI-12 Temas**: claro (por defecto), oscuro y "seguir al sistema". En tema oscuro, la hoja PUEDE seguir siendo blanca (ajuste "Hoja clara en tema oscuro", activado por defecto) o adoptar papel oscuro.
- **UI-13 Superficies**: radios 6–8 px, sombras muy suaves, bordes de 1 px solo donde separan regiones. La hoja tiene sombra tipo papel.
- **UI-14 Movimiento**: transiciones 120–180 ms, `ease-out`; nada que se mueva dentro del texto. Respeta `prefers-reduced-motion`.
- **UI-15 Densidad**: modo cómodo (por defecto) y compacto.
- **UI-16 Idioma de la interfaz**: español (por defecto) e inglés, con i18n desde el inicio (`i18next`). Ningún texto de UI en duro.

## Diálogos y pantallas

1. **Pantalla de inicio** (sin documento): acciones grandes con ícono (Nuevo documento, Nuevo proyecto, Abrir…), lista de recientes separada en *Proyectos* y *Archivos*, con ruta atenuada.
2. **Diálogo de pegado de imagen** (`06`, IMG-03).
3. **Configurar página**: tamaño, orientación, márgenes con vista previa de hoja.
4. **Editar estilos**: lista de tipos de bloque a la izquierda, controles a la derecha, vista previa en vivo de un texto de muestra.
5. **Ajustes de la app**: secciones con ícono (General, Editor, Apariencia, Imágenes, Archivos, Atajos, Avanzado).
6. **Asistente de proyecto nuevo / importar carpeta**.
7. **Conflicto de cambios externos** (`02`).

## Accesibilidad

- Navegación completa por teclado: `Alt` muestra *KeyTips* sobre la cinta (como Office/OnlyOffice).
- Roles ARIA en cinta (toolbar), navegador (tree), pestañas (tablist).
- Escalado de interfaz independiente del zoom del documento.
