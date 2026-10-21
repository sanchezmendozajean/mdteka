# Changelog

## [Fase 0] — Cimientos

- Scaffold Electron + electron-vite + React + TypeScript estricto, ESLint, Prettier, Vitest y Playwright-Electron.
- Seguridad (02): `contextIsolation`, `sandbox`, sin `nodeIntegration`, CSP estricta, permisos denegados, IPC con contrato zod, apertura externa solo http/https/mailto, instancia única.
- Sistema de diseño base desde `specs/design/`: tokens claro/oscuro, `Icon` (Lucide), `CommandButton`, cinta con las 7 pestañas (vacía), paneles Navegador/Documento y barra de estado.
- Registro central de comandos con test que exige ícono y traducción (UI-01, UI-16).
- i18n es/en con prueba de paridad de claves.
- `npm run dist` genera instalador NSIS sin firmar.
