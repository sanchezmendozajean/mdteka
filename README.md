# MDTor

Editor de Markdown de escritorio (Electron) con vista de páginas, configuración por documento y proyectos. Las especificaciones están en [`specs/`](specs/README.md).

## Requisitos

Node LTS y npm. Windows es la plataforma principal.

## Scripts

| Script              | Qué hace                                            |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Arranca la app con recarga en caliente              |
| `npm run build`     | Compila main, preload y renderer a `out/`           |
| `npm test`          | Pruebas unitarias (Vitest)                          |
| `npm run e2e`       | Compila y ejecuta las pruebas E2E (Playwright)     |
| `npm run lint`      | ESLint                                              |
| `npm run typecheck` | TypeScript estricto                                 |
| `npm run dist`      | Instalador Windows (NSIS, sin firmar) en `release/` |

Notas de entorno:

- Si `ELECTRON_RUN_AS_NODE` está definido (VS Code lo hace), `dev` y `e2e` lo eliminan del proceso hijo.
- Tras un proxy con certificado propio, usa `NODE_OPTIONS=--use-system-ca` para descargar Electron y los binarios de electron-builder.

## Estructura

```
src/
  main/       proceso principal: ventana, CSP, IPC validado, archivos con concesiones
  preload/    puente tipado `window.mdtor`
  renderer/
    app/        shell y estado de la interfaz
    commands/   registro central de comandos y atajos
    documents/  pestañas, abrir/guardar, cambios externos, diálogos
    editor/
      model/      esquema ProseMirror ↔ mdast, preservación de fuente, escapado
      wysiwyg/    vista ProseMirror, comandos, vistas de nodo, resaltado, búsqueda
      source/     vista CodeMirror, comandos de modo texto
      sync/       mapeo de cursor entre modos
      controller.ts  orquesta ambos modos y los comandos
    i18n/  styles/  ui/
  shared/     contrato IPC (zod) y tipos compartidos
tests/
  unit/       Vitest, cada test cita el id del requisito
  e2e/        Playwright-Electron
  fixtures/roundtrip/  corpus de round-trip (scripts/gen-corpus.mjs)
specs/        fuente de verdad (+ design/, adr/)
```
