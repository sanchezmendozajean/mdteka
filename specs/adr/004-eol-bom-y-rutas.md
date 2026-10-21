# ADR 004 · EOL, BOM y rutas

- **Estado**: aceptada (Fase 1)
- **Requisitos**: ED-20, GIT-03, 02 (seguridad)

## Decisiones

1. **EOL**: el texto interno se normaliza a `\n` al abrir y se expande al EOL dominante al guardar
   (`detectFormat` / `applyFormat`). El round-trip es byte-idéntico para archivos con un único estilo
   de fin de línea (LF o CRLF). Un archivo con EOL **mezclados** se unifica al dominante la primera vez
   que se guarda con cambios; no se guarda si no está sucio (GIT-01).
2. **BOM**: se detecta, se aparta del texto y se vuelve a escribir.
3. **Bloque de configuración**: la Fase 1 solo lo aparta (último `<!-- mdteca:config` al final del
   archivo) y lo vuelve a unir idéntico; su lectura y validación son de la Fase 2.
4. **Concesiones de ruta**: el renderer solo puede leer o escribir rutas elegidas en un diálogo o
   recibidas por línea de comandos / asociación de archivos. Las rutas se canonicalizan con
   `realpath.native`, lo que además expande nombres cortos 8.3 de Windows (`JEAN~1.SAN`), con los que
   `fs.watch` falla silenciosamente.
5. **Escritura atómica** con reintentos ante `EPERM`/`EBUSY` (antivirus en Windows).
