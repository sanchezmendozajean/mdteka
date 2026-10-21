# 09 · Configuración y persistencia

## Qué se guarda dónde

| Dato | Dónde | ¿En Git? |
|------|-------|----------|
| Estilo/página/tipografía de un documento | Bloque `<!-- mdteca:config -->` en el `.md` (`04`) | Sí |
| Modo de pegado de imágenes del documento | Mismo bloque (`images.pasteMode`) | Sí |
| Estructura del proyecto y defaults | `*.mdteca` (`05`) | Sí |
| Imágenes pegadas como archivo | Junto al `.md` (`06`) | Sí |
| Preferencias de la app (tema, idioma, atajos, defaults globales) | `userData/settings.json` | No |
| Estado de sesión (pestañas, paneles, nodos expandidos, zoom y scroll por documento, recientes) | `userData/state/` (clave = hash de la ruta del proyecto/archivo) | No |
| Respaldos de recuperación | `userData/recovery/` | No |

- **CFG-01** MDteca **nunca** crea carpetas ocultas propias (tipo `.mdteca/`) dentro del repositorio del usuario.
- **CFG-02** Los ajustes de app se validan con zod; si el archivo está corrupto se renombra a `settings.corrupt-<fecha>.json` y se usan valores de fábrica.

## Ajustes de la app (secciones)

**General**: idioma de interfaz, abrir al iniciar (pantalla de inicio / último proyecto), comprobar actualizaciones.

**Editor**: modo por defecto (WYSIWYG/Texto), barra flotante de formato, corrector ortográfico e idiomas, autoguardado (off / cada N s / al perder foco), modo máquina de escribir, cursor animado.

**Apariencia**: tema, color de acento, densidad, hoja clara en tema oscuro, escala de interfaz.

**Documento por defecto**: mismo panel que `04` (origen "app").

**Imágenes**: modo de pegado por defecto, umbral de advertencia base64, subcarpeta de imágenes por defecto (vacía = misma carpeta).

**Archivos**: EOL para documentos nuevos (`LF` por defecto), convenciones de serialización Markdown (viñeta `-`/`*`, cursiva `_`/`*`, ancho de tabla), asociar `.md` y `.mdteca` con MDteca.

**Atajos**: tabla editable con buscador (`11`).

**Avanzado**: mostrar bloque de configuración en modo texto, logs de diagnóstico, restablecer ajustes.

## Asociación de archivos

- `.mdteca` → MDteca (ícono propio de proyecto). Doble clic abre el proyecto.
- `.md`, `.markdown` → MDteca opcional (el instalador pregunta; también desde ajustes). Ícono propio de documento.
- Instancia única por defecto: abrir un archivo con la app ya abierta lo enfoca en la ventana adecuada (la de su proyecto si está abierto).
- *Jump list* (Windows) / menú del Dock (macOS) con recientes.
