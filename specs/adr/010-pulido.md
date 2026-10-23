# ADR 010 · Pulido

- **Estado**: aceptada (Fase 6)
- **Requisitos**: `09` (ajustes), `11` (atajos), `08` (interfaz y accesibilidad), `03` (editor), `02` (recuperación), CFG-01, CFG-02, UI-11, UI-12, UI-15, UI-16

## Decisiones

1. **Ajustes en un solo esquema compartido.** `src/shared/settings.ts` (zod) lo usan main (que valida
   y escribe `userData/settings.json`) y el renderer (que lo aplica). Cada cambio es un parche
   (`settings:set`): los objetos se funden y solo los atajos y los valores por defecto del documento
   se sustituyen enteros. Un archivo antiguo (solo `documentDefaults`) sigue siendo válido; uno
   corrupto se aparta como `settings.corrupt-<fecha>.json` (CFG-02). Los cambios se guardan al
   instante: el diálogo no tiene «Aplicar».
2. **Apariencia por atributos del `<html>`.** Tema (`data-theme`, con «seguir al sistema»), acento
   (`data-accent`), densidad (`data-density`) y hoja (`data-sheet`) son atributos que activan reglas
   CSS; la escala de la interfaz es el zoom del navegador (`webFrame.setZoomFactor`), independiente
   del zoom del documento. En tema oscuro la hoja sigue clara por defecto (UI-12); con «hoja oscura»
   se redefinen los tokens del documento (tinta, código, enlaces y colores de sintaxis).
3. **Contraste AA.** `--text-3` pasó de `#7f7a72` a `#6b665e` (3,8:1 → ≥ 4,5:1 sobre los fondos). La
   auditoría con axe-core la comprueba en claro y oscuro (ribbon, editor, paneles y ajustes).
4. **Atajos editables.** El registro distingue el atajo de fábrica del reasignado (`shortcutOf`);
   reasignar descarta los alternativos del comando y se rechaza un atajo ya usado, avisando de cuál
   comando lo tiene. Los comandos «nativos» (copiar, pegar, deshacer…) los gestiona el navegador y
   no se reasignan. Hay una prueba de que los atajos de fábrica no chocan entre sí.
5. **Paleta de comandos** (`Ctrl+Shift+P`) lista todo el registro con ícono y atajo; los comandos no
   disponibles se muestran atenuados y no se ejecutan.
6. **Recuperación (02).** Cada 30 s se escribe `userData/recovery/<id>.json` de cada documento con
   cambios (también los sin guardar) y se borra al guardarlo o cerrarlo; un cierre normal borra todo.
   Si quedan respaldos al abrir, se ofrece recuperarlos: el documento vuelve con los cambios sin
   guardar y el archivo en disco no se toca. Nunca se escribe dentro del repositorio (CFG-01).
7. **Autoguardado (02).** Desactivado por defecto; «cada N s» o «al perder el foco». Solo escribe
   documentos que ya tienen ruta (nunca abre un diálogo) y se salta los que tienen un cambio externo
   sin resolver.
8. **Menú contextual propio.** Chromium no muestra su menú: el proceso principal reenvía el
   `context-menu` (con las sugerencias del corrector) y la interfaz dibuja el suyo con íconos, solo
   sobre los editores. La barra flotante de formato aparece con una selección de texto en WYSIWYG y se
   puede desactivar.
9. **Esquema** como segunda pestaña del panel izquierdo: se calcula de los títulos de primer nivel
   (nodos en WYSIWYG, líneas `#` fuera de bloques de código en modo texto) y al hacer clic se recalcula
   la posición, porque la publicada puede ser de la otra vista.
10. **KeyTips (`Alt`).** Dos niveles: letras sobre las pestañas y teclas sobre los botones de la
    pestaña elegida. Se calculan del DOM (no hay una tabla a mantener) y se clican con `.click()`.
11. **Accesibilidad.** El nombre de los controles de la cinta contiene su texto visible; la pestaña
    de documento ya no contiene un botón (el cierre con ratón es un elemento decorativo; con teclado
    se usa `Ctrl+W`); los selectores y campos del panel Documento se nombran con la etiqueta de su
    fila; los editores y las listas llevan nombre accesible. `npm run audit` ejecuta las pruebas de
    íconos/traducciones del registro y la auditoría axe.

## Desviaciones y pendientes

- **Actualizaciones automáticas: no implementadas.** Necesitan decidir dónde se publican las
  versiones (GitHub Releases, un servidor propio…) y firmar el instalador; sin eso `electron-updater`
  no tiene a qué preguntar. Por eso Ajustes no muestra «comprobar actualizaciones».
- **Íconos propios de `.md` y `.mdteca` (09)**: el instalador usa el ícono por defecto de Electron;
  faltan los recursos gráficos de marca.
- **Modo máquina de escribir** solo en WYSIWYG (en modo texto no se centra la línea).
- **Convenciones de serialización configurables (09 › Archivos)** no se ofrecen: el serializador usa
  convenciones fijas (ED-22) para que los diffs de Git sean estables. «Subcarpeta de imágenes por
  defecto» y «Mostrar el bloque de configuración en modo texto» tampoco (DOC-05 lo prohíbe por ahora).
- **Corrector ortográfico**: las sugerencias y el diccionario dependen del corrector del sistema
  (Windows) o de Chromium; las pruebas simulan el aviso del clic derecho con sugerencias, no ejercitan
  un diccionario real. El menú del Dock y la *jump list* de recientes no están hechos.
- **Notas al pie** (`Insertar › Nota al pie`) siguen sin implementarse: se conservan como bloques
  literales.
