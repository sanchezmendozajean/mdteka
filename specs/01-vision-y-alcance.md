# 01 · Visión y alcance

## Visión

> Escribir Markdown con la sensación de un procesador de textos profesional, sin renunciar a archivos de texto plano que viven felices en Git.

MDteca es para quien documenta sistemas, escribe manuales o libros técnicos y quiere:

- un editor visual **limpio y estable**, donde el texto no salta y nunca aparecen asteriscos ni almohadillas mientras edita en modo visual;
- ver el documento **en páginas** como en OnlyOffice/Word, o como una hoja continua;
- que cada documento **lleve su propio estilo** (fuente, tamaño, ancho, márgenes) dentro del mismo `.md`;
- organizar muchos documentos como **proyecto** con un índice navegable;
- versionar todo con **Git** con diffs legibles.

## Usuarios objetivo

| Perfil | Necesidad principal |
|--------|--------------------|
| Desarrollador/a que documenta sistemas | Docs en el repo, diffs limpios, imágenes junto al `.md` |
| Redactor/a técnico | Manuales largos organizados por libros y capítulos |
| Estudiante | Apuntes y trabajos con aspecto de documento impreso |

## Objetivos (en alcance v1)

1. Edición de Markdown en **dos modos intercambiables**: WYSIWYG y texto plano (`03`).
2. **Vista de páginas** con tamaño de papel y márgenes, y **vista continua** de hoja larga (`07`).
3. **Configuración por documento** guardada en un comentario HTML dentro del `.md` (`04`).
4. **Modo archivo** y **modo proyecto**, elegibles por el usuario durante la edición (`05`).
5. **Archivo índice de proyecto** `*.mdteca` (JSON) asociado al programa (`05`).
6. **Pegado de imágenes** con tres modos: base64, archivo, preguntar (`06`).
7. **Interfaz elegante** estilo OnlyOffice: cinta de opciones, **todas las opciones con ícono** (`08`).
8. Exportación a **PDF** y **HTML**; impresión.
9. Windows, macOS y Linux. Windows es la plataforma principal de pruebas.

## No-objetivos

- **No** se mezclan varias fuentes dentro de un documento como en Office. Un documento = una familia tipográfica de texto (+ una monoespaciada para código). Los estilos se definen por tipo de bloque (títulos, párrafo, cita…), no por selección de texto arbitraria.
- **No** hay color/tamaño de letra por selección. El formato en línea se limita a lo que Markdown expresa (negrita, cursiva, tachado, código, enlace).
- **No** es un cliente Git: no hace commits ni push. Solo garantiza que sus archivos sean amigables con Git (`10`). (Mostrar el estado Git de los archivos es un PUEDE de fases posteriores.)
- **No** hay colaboración en tiempo real ni sincronización en la nube.
- **No** se inventan extensiones propietarias de Markdown que rompan el renderizado en GitHub/GitLab. Todo lo propio de MDteca vive en comentarios HTML, que otros visores ignoran.

## Principios de producto

1. **El editor es la estrella.** Cualquier decisión que perjudique la fluidez de escritura se rechaza.
2. **El archivo es del usuario.** Abrir y guardar sin cambios no altera ni un byte. Editar un párrafo solo cambia ese párrafo en el diff.
3. **Markdown estándar primero.** CommonMark + GFM (tablas, listas de tareas, tachado, autolinks).
4. **Silencio visual.** Interfaz sobria, mucho espacio en blanco, el documento al centro.
5. **Todo tiene ícono.** Cada comando del menú, la cinta, los menús contextuales y los diálogos lleva un ícono coherente.
