# Prompt para Claude Design

> Copia todo lo que está debajo de la línea y pégalo en Claude Design. Adjunta también `specs/01-vision-y-alcance.md`, `specs/04-formato-documento.md`, `specs/06-imagenes.md`, `specs/07-vistas-y-paginacion.md` y `specs/08-interfaz.md`.

---

Eres el diseñador de producto de **MDteca**, un editor de Markdown de escritorio (Electron) que se siente como un procesador de textos profesional. La referencia de estructura es **OnlyOffice Document Editor** (cinta de opciones con pestañas, lienzo gris con hojas de papel, regla, barra de estado con zoom), pero la estética debe ser **más sobria y elegante**: mucho aire, pocos bordes, tipografía de interfaz cuidada (Inter), íconos de trazo fino (**Lucide**), un único color de acento.

Los documentos adjuntos son la especificación. Respeta en especial:

- **Todas las opciones tienen ícono**: cinta, menús, menú contextual, diálogos, navegador, barra de estado. Usa nombres de íconos Lucide (la tabla de `08-interfaz.md` trae sugerencias; puedes mejorarlas).
- El **documento es el protagonista**: la interfaz se retira visualmente; la hoja de papel destaca.
- **Una fuente por documento**: no diseñes selectores de fuente por selección de texto ni color de letra; el formato del documento se controla en el panel Documento y en la pestaña Diseño.
- Nunca se muestran marcas de Markdown (`**`, `#`) en el modo WYSIWYG.

## Entregables

1. **Sistema de diseño** (tema claro y oscuro):
   - Tokens: color (neutros, acento, estados, lienzo, hoja, sombra de hoja, selección de texto), tipografía de UI, espaciado (escala de 4 px), radios, sombras, duraciones de animación, densidad cómoda/compacta.
   - Entrega los tokens también como **variables CSS** y como **JSON**, listos para copiar a código.
   - Componentes: botón de cinta (pequeño, grande con etiqueta, toggle, split-button con desplegable), grupo de cinta con etiqueta, pestañas de cinta, galería con miniaturas (estilos, presets), desplegable, campo numérico con unidades (mm, pt), deslizador, conmutador segmentado (WYSIWYG/Texto, Páginas/Continua), tooltip con atajo, pestañas de documento (con estado "sin guardar"), árbol del navegador (colección / libro / capítulo / estado), menú contextual con íconos y atajos, popover de enlace e imagen, barra flotante de formato, diálogo modal, barra informativa, toast, barra de estado.

2. **Pantallas** (1440×900, tema claro; las marcadas con ★ también en oscuro):
   1. ★ Editor en **modo archivo**, vista de **páginas**, WYSIWYG, con regla y panel Documento abierto a la derecha. Documento de ejemplo realista (manual técnico en español con títulos, lista, tabla, bloque de código, imagen y cita) que cruza de la página 1 a la 2.
   2. ★ Editor en **modo proyecto**: navegador de libros a la izquierda (2 colecciones, 3 libros, capítulos anidados, un capítulo con cambios sin guardar, uno faltante, sección "Sin indexar"), pestañas de documentos, vista de páginas.
   3. Mismo documento en **vista continua** (hoja larga con ancho de columna configurable; muestra el manejador para arrastrar el ancho y el deslizador en la barra de estado).
   4. Mismo documento en **modo texto** (Markdown fuente con resaltado sutil, dentro de la hoja) mostrando el chip plegado "Configuración del documento".
   5. Las 7 pestañas de la cinta (Archivo como *backstage* a pantalla completa, Inicio, Insertar, Diseño, Disposición, Vista, Proyecto) — una lámina con todas.
   6. **Diálogo de pegado de imagen** (modo "preguntar"): miniatura, peso, dimensiones, opción "Guardar como archivo" con nombre `manual.003.png` editable, opción "Incrustar en el documento", casilla "Recordar para este documento".
   7. **Panel Documento** en detalle: secciones Página, Tipografía, Estilos, Imágenes; cada valor con indicador de origen (app / proyecto / documento) y acción "volver al heredado".
   8. **Editar estilos** (lista de tipos de bloque + controles + vista previa en vivo).
   9. **Configurar página** (tamaño, orientación, márgenes con vista previa).
   10. **Pantalla de inicio** con recientes separados en Proyectos y Archivos.
   11. **Selector Archivo ⇄ Proyecto** en la barra de título y la barra informativa "Este archivo forma parte de *Manual de Planillas* · Abrir proyecto".
   12. Modo **concentración**.
   13. Galería de **presets de estilo de documento** (Clásico, Moderno, Técnico, Académico, Compacto) con miniaturas de página.

3. **Especificaciones de interacción** breves: estados hover/activo/foco/deshabilitado de los controles, comportamiento del redimensionado de paneles, animaciones permitidas (nunca dentro del texto), KeyTips con `Alt`.

4. **Íconos de la app**: ícono de aplicación y dos íconos de tipo de archivo (`.mdteca` para proyecto y `.md` para documento), originales, coherentes entre sí.

## Formato de entrega

Organiza el resultado para que pueda exportarse a la carpeta `specs/design/` del repositorio:

```
specs/design/
  tokens.css
  tokens.json
  components.md        (anatomía, medidas y estados de cada componente)
  screens/             (exportaciones PNG de cada pantalla, nombradas 01-editor-paginas.png…)
  icons/               (app y tipos de archivo, SVG)
  README.md            (decisiones de diseño y mapeo de íconos Lucide por comando)
```

Antes de empezar, si algo de la especificación te parece contradictorio o mejorable para la elegancia o la usabilidad, propónmelo brevemente y espera mi confirmación.
