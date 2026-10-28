# 02 · Arquitectura técnica

## Stack

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| Shell | **Electron** (versión estable actual) | Requisito |
| Build | **Vite** + `electron-vite` (o equivalente) | Arranque y HMR rápidos |
| Lenguaje | **TypeScript** estricto (`strict: true`) | Robustez |
| UI | **React** + **Zustand** para estado | Ecosistema maduro, estado simple |
| Editor WYSIWYG | **ProseMirror** (vía **Tiptap** o directo) | Control total del modelo, decoraciones, rendimiento |
| Editor texto | **CodeMirror 6** | Rendimiento en archivos grandes, folding, búsqueda |
| Markdown | **unified / remark** (`remark-parse`, `remark-gfm`, `remark-stringify`) | AST (mdast) estándar y posiciones de origen |
| Sanitizado | **DOMPurify** | HTML embebido seguro |
| Íconos | **Lucide** (`lucide-react`) | Set amplio, trazo uniforme, licencia ISC |
| Empaquetado | **electron-builder** | Instaladores y asociación de archivos |
| Pruebas | **Vitest** (unidad) + **Playwright** para Electron (E2E) | |
| Lint/format | ESLint + Prettier | |

> Si durante la implementación se descubre que una librería impide cumplir un requisito de `03` (fluidez o fidelidad), se DEBE reemplazar, documentando la decisión en `specs/adr/`.

## Procesos

```
┌──────────────────────────── main (Node) ────────────────────────────┐
│ ventanas · menús nativos · diálogos · sistema de archivos · watcher │
│ asociación de archivos · exportación PDF (printToPDF) · ajustes app │
└───────────────▲─────────────────────────────────────────────────────┘
                │ IPC tipado (contextBridge, canales con esquema)
┌───────────────┴──────────── preload ────────────────────────────────┐
│ expone window.mdtor.{fs, project, dialog, settings, export, shell} │
└───────────────▲─────────────────────────────────────────────────────┘
                │
┌───────────────┴──────────── renderer (React) ───────────────────────┐
│ UI · editor ProseMirror · editor CodeMirror · paginador · stores    │
└─────────────────────────────────────────────────────────────────────┘
```

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- El renderer **nunca** accede a `fs` directamente. Todo pasa por la API del preload, validada en main (rutas normalizadas, sin escapar del directorio del proyecto salvo diálogos explícitos).
- CSP estricta. Imágenes locales servidas mediante un protocolo propio `mdtor-asset://` registrado en main, limitado a las carpetas abiertas.
- Enlaces externos se abren con `shell.openExternal` tras validar el esquema (`http`, `https`, `mailto`).

## Módulos (renderer)

```
src/
  main/                 proceso principal
    fs/                 lectura/escritura atómica, watcher (chokidar)
    project/            carga/guardado de .mdtor
    export/             PDF / HTML
    protocol/           mdtor-asset://
  preload/
  renderer/
    app/                shell de la app, layout, rutas de paneles
    ui/                 componentes (Ribbon, Button, Icon, Dialog, Panel…)
    editor/
      model/            esquema ProseMirror ↔ mdast
      markdown/         parse, serialize, preservación de fuente (ver 03)
      wysiwyg/          vista ProseMirror, plugins, input rules
      source/           vista CodeMirror
      sync/             mapeo de posiciones entre modos
    document/
      config/           lectura/escritura del bloque de configuración (04)
      styles/           generación de CSS por documento
    layout/
      paginator/        cálculo de páginas (07)
    images/             pegado e inserción (06)
    project/            navegador, árbol, operaciones (05)
    stores/             Zustand
  shared/               tipos, esquemas (zod), constantes
```

## Modelo de documento en memoria

```ts
interface OpenDocument {
  id: string;                 // uuid de sesión
  path: string | null;        // null = sin guardar
  source: string;             // Markdown completo SIN el bloque de config
  config: DocumentConfig;     // ver 04
  hasConfigBlock: boolean;    // si el archivo traía bloque de config
  eol: '\n' | '\r\n';         // detectado al abrir, se respeta al guardar
  bom: boolean;               // detectado al abrir, se respeta al guardar
  dirty: boolean;
  mode: 'wysiwyg' | 'source';
  view: 'pages' | 'continuous';
}
```

- La **fuente de verdad** es el texto Markdown (`source`). El estado ProseMirror se deriva de él y se re-serializa con preservación de fuente (ver `03`, ED-20+).
- La configuración se separa del cuerpo al abrir y se vuelve a unir al guardar; ninguno de los dos editores la muestra como texto editable (salvo el panel avanzado, `04`).

## Guardado

- Escritura **atómica**: escribir a `archivo.md.tmp` y renombrar.
- Autoguardado opcional (desactivado por defecto) con intervalo configurable.
- Recuperación ante cierre inesperado: copia de respaldo en `userData/recovery/` cada 30 s mientras haya cambios sin guardar.
- Detección de cambios externos (watcher): si el archivo cambia en disco y no hay cambios locales → recargar sin perder posición; si hay cambios locales → aviso con opciones *Recargar*, *Mantener los míos*, *Comparar*.

## Rendimiento (presupuestos)

| Métrica | Objetivo |
|---------|----------|
| Arranque en frío hasta ventana usable | < 1,5 s |
| Latencia de tecla a pintado (doc de 50 páginas) | < 16 ms p95 |
| Cambio WYSIWYG ↔ texto (doc de 50 páginas) | < 150 ms |
| Abrir proyecto de 500 archivos | < 1 s hasta navegador visible |
| Repaginación tras edición | incremental, en `requestIdleCallback`, nunca bloquea la escritura |
