# ADR 006 · Tipografía y configuración por documento

- **Estado**: aceptada (Fase 2)
- **Requisitos**: DOC-01…05, DOC-10…13, `04`, `09`

## Decisiones

1. **Fuentes incluidas con `@fontsource`** (OFL, offline). Inter, Source Sans 3, IBM Plex Sans,
   Source Serif 4, Literata, Merriweather, Lora y JetBrains Mono van como fuentes variables
   (`wght`, normal y cursiva); IBM Plex Serif e IBM Plex Mono no tienen versión variable y se
   incluyen en los pesos 400/600/700 (mono 400/700). Cada archivo trae subconjuntos por
   `unicode-range`, así que solo se descarga del disco lo que el documento usa.
2. **Fuentes del sistema**: Electron no ofrece, sin un permiso que denegamos, una lista de las fuentes
   instaladas. El usuario escribe el nombre (campo con sugerencias de las incluidas). Si no existe
   en la máquina, la pila CSS cae a la incluida más parecida por clase (serif → Source Serif 4,
   sans → Inter, mono → JetBrains Mono) sin tocar el archivo (DOC-13).
3. **Bloque**: `DocumentConfigSchema` (zod, `looseObject`) conserva las claves desconocidas. La
   escritura usa orden canónico, sangría de 2 espacios y solo las claves que difieren de lo heredado
   (`applyPatch`: solo se poda lo que el cambio del usuario deja igual a lo heredado, para que
   *Fijar todo* no se deshaga al editar otro valor). `--` se escribe `--` (el texto del
   requisito no se distingue de `--`; esta es la secuencia JSON válida que no cierra el comentario).
   El bloque se reescribe solo si el usuario cambia algo: abrir y guardar no lo toca (ED-20).
4. **Herencia**: fábrica ← `userData/settings.json` (`documentDefaults`) ← preset (`theme`) ←
   bloque. El proyecto se suma en la Fase 5. Un archivo de ajustes corrupto se aparta como
   `settings.corrupt-<fecha>.json` (CFG-02).
5. **CSS por documento**: se genera con `[data-doc-id="…"]` para el documento activo. Las
   alturas de línea son **píxeles enteros calculados** (tamaño × interlineado, títulos
   `max(1,25 × tamaño, línea base)`), de modo que siguen siendo fijas por tipo de bloque (ED-10)
   con cualquier configuración. `pt → px` con 96/72.
6. **Alcance**: `page`, `view` e `images` se leen, validan y conservan, pero su edición llega con
   las fases 3 y 4. El JSON Schema se genera con `z.toJSONSchema` y una prueba comprueba que
   `specs/schemas/document-config.schema.json` está al día (`UPDATE_SCHEMA=1` lo regenera).
