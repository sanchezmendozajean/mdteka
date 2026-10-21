# Prompt para Claude Code

> Abre Claude Code en la raíz del repositorio (`C:\Coding\mdteca`) y pega todo lo que está debajo de la línea. Idealmente, ten ya el resultado de Claude Design en `specs/design/`.

---

Vas a construir **MDteca**, un editor de Markdown de escritorio con Electron. La especificación completa está en `specs/`. Es la fuente de verdad: léela entera antes de escribir código, empezando por `specs/README.md` y `specs/03-editor.md` (el editor tiene prioridad sobre todo lo demás). Si existe `specs/design/`, úsala como referencia visual obligatoria (tokens, componentes, pantallas, mapeo de íconos).

## Cómo trabajar

1. **Primero, plan.** Lee todas las specs y responde con:
   - un resumen de 10 líneas de lo que vas a construir;
   - las dudas o contradicciones que encuentres (con el id del requisito);
   - los riesgos técnicos principales y cómo los vas a mitigar — en particular: preservación de fuente por bloque (ED-20…24), cero saltos de texto (ED-10), ninguna marca Markdown visible en WYSIWYG (ED-11), escapado contextual del texto literal (ED-25) y paginación incremental en un solo editor (VW-10…14).
   Espera mi confirmación antes de empezar la Fase 0.

2. **Trabaja por fases** según `specs/12-roadmap-y-aceptacion.md`. Al terminar cada fase:
   - ejecuta lint, typecheck, tests unitarios y E2E;
   - verifica uno a uno los criterios de aceptación de la fase y dime cuáles pasan y cómo lo comprobaste;
   - actualiza `CHANGELOG.md`;
   - haz un commit por fase (o varios commits pequeños dentro de la fase) con mensajes en español que citen los ids de requisitos (`feat(editor): preservación de fuente por bloque [ED-21]`);
   - detente y espérame antes de pasar a la siguiente fase.

3. **Decisiones**: si cambias una librería del stack de `specs/02-arquitectura.md` o te desvías de un requisito, crea un ADR breve en `specs/adr/NNN-titulo.md` (contexto, decisión, consecuencias) y avísame. No modifiques el resto de las specs sin preguntarme.

4. **Pruebas guiadas por requisitos**: cada test referencia el id que verifica en su nombre (`it('[ED-20] guarda byte-idéntico sin cambios')`). Crea el corpus `tests/fixtures/roundtrip/` al inicio de la Fase 1, incluyendo los ejemplos de CommonMark/GFM, CRLF, BOM, HTML embebido y un documento largo (50+ páginas).

## Reglas no negociables

- **El editor es la estrella**: latencia tecla→pintado < 16 ms p95; nada que salte; nada de sintaxis Markdown visible en WYSIWYG, ni siquiera al posar el cursor (se rechaza el estilo "live preview" que revela marcas).
- **En WYSIWYG lo tecleado es texto, no Markdown** (ED-15, ED-25): sin input rules ni autoformato; escribir `#` o `**` deja esos caracteres literales y el serializador los escapa en el `.md` (`\#`, `\*\*`). El formato solo se aplica con cinta, atajos o menús. En modo texto, en cambio, el Markdown se interpreta normalmente (ED-16).
- **Fidelidad**: abrir y guardar sin cambios = archivo idéntico byte a byte; editar un bloque cambia solo ese bloque en el diff.
- **Configuración en el documento**: bloque `<!-- mdteca:config … -->` al final del `.md` (`specs/04-formato-documento.md`), JSON con orden de claves canónico, solo diferencias respecto a lo heredado, nunca visible como contenido.
- **Proyectos**: archivo índice `*.mdteca` (JSON, rutas relativas con `/`, ids estables, serialización determinista) — `specs/05-proyectos.md`. El usuario puede pasar de modo archivo a modo proyecto y viceversa durante la edición.
- **Imágenes**: modos base64 / archivo / preguntar; los archivos se guardan junto al `.md` como `<nombre>.001.png`, `<nombre>.002.png`… — `specs/06-imagenes.md`.
- **Todo comando tiene ícono** (Lucide). Implementa un registro central de comandos (`id`, etiqueta i18n, ícono, atajo, `when`, `run`) del que se alimentan cinta, menús, menú contextual, paleta de comandos y atajos; añade un test que falle si algún comando no tiene ícono o traducción.
- **Seguridad Electron**: `contextIsolation`, `sandbox`, sin `nodeIntegration`, CSP estricta, IPC tipado y validado con zod, protocolo `mdteca-asset://` para imágenes locales, HTML sanitizado con DOMPurify.
- **Git-friendly**: nada de estado de sesión dentro del repo del usuario; respetar EOL/BOM; nombres de archivo en slug.
- **Una fuente por documento**: no implementes selector de fuente/color por selección.
- **i18n desde el día uno** (es por defecto, en). Ningún texto en duro.
- Windows es la plataforma principal: prueba rutas con `\`, unidades, mayúsculas/minúsculas y asociación de archivos en Windows.

## Entorno

- Node LTS, npm. Scripts mínimos: `dev`, `build`, `test`, `e2e`, `lint`, `typecheck`, `dist` (instaladores con electron-builder, asociando `.mdteca` y opcionalmente `.md`).
- `README.md` en la raíz con cómo ejecutar, compilar y la estructura del código.
- `.gitattributes` con `* text=auto eol=lf` y binarios marcados.

Empieza leyendo las specs y entregándome el plan del punto 1.
