# 05 · Proyectos

Un **proyecto** es una carpeta con muchos `.md` organizados en subcarpetas, más un **archivo índice** que los ordena, clasifica y es el punto de entrada para abrir el proyecto.

## Archivo índice: `*.mdteca`

- **PRJ-01** Extensión **`.mdteca`**, contenido **JSON** UTF-8. Un nombre de extensión propio permite asociarlo al programa (doble clic abre el proyecto) y el JSON lo hace legible y mergeable en Git.
- **PRJ-02** Ubicación: raíz de la carpeta del proyecto. Nombre sugerido: `<nombre-del-proyecto>.mdteca` (ej. `manual-planillas.mdteca`). Solo se admite un `.mdteca` por carpeta; si hay varios, se pregunta cuál abrir.
- **PRJ-03** Todas las rutas son **relativas** al `.mdteca`, con `/` como separador (también en Windows), sin `./` inicial.
- **PRJ-04** Sin datos de máquina ni de sesión: ni rutas absolutas, ni fechas de apertura, ni pestañas abiertas, ni nodos expandidos. Ese estado va a `userData` de la app (ver `09`).
- **PRJ-05** Serialización determinista: 2 espacios, orden de claves canónico, EOL `\n`, salto de línea final. Los `id` son estables (slug corto + 4 caracteres aleatorios, ej. `cap-instalacion-k3f9`) para que reordenar no genere diffs gigantes.

### Ejemplo

```json
{
  "$schema": "https://mdteca.app/schemas/project-v1.json",
  "format": "mdteca-project",
  "version": 1,
  "title": "Manual del Sistema de Planillas",
  "description": "Documentación funcional y técnica",
  "defaults": {
    "typography": { "font": "IBM Plex Sans", "size": 11 },
    "theme": "tecnico",
    "images": { "pasteMode": "file" }
  },
  "collections": [
    {
      "id": "tecnico-a1b2",
      "title": "Técnico",
      "icon": "cpu",
      "books": [
        {
          "id": "arquitectura-x9k2",
          "title": "Arquitectura",
          "icon": "book-open",
          "folder": "tecnico/arquitectura",
          "items": [
            { "id": "intro-77ad", "title": "Introducción", "file": "tecnico/arquitectura/01-introduccion.md" },
            {
              "id": "modulos-p0q1",
              "title": "Módulos",
              "file": "tecnico/arquitectura/02-modulos.md",
              "children": [
                { "id": "mod-pagos-z8x7", "file": "tecnico/arquitectura/modulos/pagos.md" }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "usuario-c3d4",
      "title": "Usuario",
      "icon": "users",
      "books": [
        { "id": "guia-rapida-m5n6", "title": "Guía rápida", "icon": "rocket", "folder": "usuario/guia-rapida", "items": [] }
      ]
    }
  ],
  "ignore": ["borradores/**", "**/_*.md"]
}
```

- `title` de un ítem es opcional: si falta, se usa el primer H1 del archivo; si no hay H1, el nombre del archivo.
- `icon` usa nombres de Lucide; si falta, se usa el ícono por defecto del tipo.
- `defaults` sigue el esquema `DocumentConfig` de `04` y se hereda en todos los documentos del proyecto.
- JSON Schema en `specs/schemas/project.schema.json` (fase 5).

## Jerarquía de clasificación

```
Proyecto
 └─ Colección (clasificación: "Técnico", "Usuario", "Legal"…)
     └─ Libro (agrupa capítulos; normalmente una carpeta)
         └─ Capítulo (.md)
             └─ Subcapítulo (.md, anidable)
```

- **PRJ-10** Una colección es solo de organización visual (no exige carpeta). Un libro DEBERÍA tener carpeta propia (`folder`) donde se crean sus capítulos nuevos.
- **PRJ-11** Proyectos simples: si solo hay una colección, el navegador la oculta y muestra directamente los libros.

## Navegador de libros (panel izquierdo)

- **PRJ-20** Visible solo en modo proyecto. Ancho redimensionable y colapsable (`Ctrl+Shift+B`).
- **PRJ-21** Encabezado: título del proyecto, botón de ajustes del proyecto, buscador/filtro.
- **PRJ-22** Colecciones como secciones plegables con ícono y contador de libros. Libros con ícono, título y cantidad de capítulos. Capítulos en árbol con sangría y línea guía sutil.
- **PRJ-23** Estado del capítulo con indicador discreto: abierto (punto), con cambios sin guardar (punto relleno), archivo faltante (ícono de alerta en rojo).
- **PRJ-24** Arrastrar y soltar para reordenar capítulos, moverlos entre libros o anidarlos. Mover entre libros **pregunta** si mover también el archivo a la carpeta del libro destino (y actualiza enlaces relativos de imágenes en el `.md`, ver `06`).
- **PRJ-25** Menú contextual (con íconos): nuevo capítulo, nuevo subcapítulo, nuevo libro, nueva colección, renombrar (título / archivo), duplicar, quitar del índice, eliminar archivo (a la papelera del SO), revelar en el explorador, copiar ruta relativa.
- **PRJ-26** Al crear un capítulo, el archivo se nombra con slug del título y prefijo numérico opcional (`03-configuracion.md`), según ajuste del proyecto.
- **PRJ-27** Sección inferior **"Sin indexar"**: lista los `.md` de la carpeta que no están en el índice (excluyendo `ignore`), con acción "Añadir al libro…".
- **PRJ-28** Archivos faltantes (indexados pero no existentes) se muestran con alerta y acciones "Localizar…" / "Quitar del índice".
- **PRJ-29** Enlaces entre documentos del proyecto (`[ver](../otro.md)`) se abren dentro de MDteca en una pestaña.

## Modo archivo vs modo proyecto (decide el usuario)

- **PRJ-30** **Modo archivo**: un `.md` suelto; sin navegador; pestañas de documentos independientes.
- **PRJ-31** **Modo proyecto**: abierto desde un `.mdteca`; navegador visible; pestañas de documentos del proyecto.
- **PRJ-32** El usuario puede cambiar **durante la edición** con un selector en la barra de título (`Archivo ⇄ Proyecto`, cada uno con ícono):
  - Desde modo archivo → *Abrir como proyecto*: busca un `.mdteca` en la carpeta del archivo o carpetas superiores (hasta la raíz del repo Git o 5 niveles). Si existe, abre el proyecto y selecciona el documento. Si no, ofrece *Crear proyecto aquí* (asistente: título, carpeta raíz, importar `.md` existentes agrupados por carpeta → libros).
  - Desde modo proyecto → *Editar solo este archivo*: cierra el navegador y deja el documento actual como archivo suelto (sin cerrar pestañas con cambios).
- **PRJ-33** Al abrir un `.md` que pertenece a un proyecto conocido, se muestra una barra informativa no intrusiva: "Este archivo forma parte de *Manual de Planillas* · Abrir proyecto".
- **PRJ-34** Se permite una ventana por proyecto; varias ventanas simultáneas.

## Ajustes del proyecto

Diálogo (ícono de engranaje del navegador): título, descripción, defaults de documento (mismo panel que `04` con origen "proyecto"), convención de nombres de archivo, carpeta de imágenes (ver `06`), patrones `ignore`, preset de estilos por defecto.

## Exportación de proyecto

- Exportar libro o proyecto completo a **PDF único** (portada opcional, índice generado, cada capítulo empieza en página nueva configurable) y a **HTML** (sitio estático con navegación).
