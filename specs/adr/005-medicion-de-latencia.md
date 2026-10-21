# ADR 005 · Cómo se mide la latencia tecla → pintado

- **Estado**: aceptada (Fase 1)
- **Requisitos**: ED-12, `02` (presupuestos)

## Contexto

Playwright envía las teclas por CDP con separaciones de pocos ms, y `requestAnimationFrame` espera al
siguiente vsync (≈ 16 ms), así que medir «desde keydown hasta el siguiente fotograma» mide el protocolo
y la pantalla, no el editor. Una primera versión del test dio 14 ms de mediana con un editor de 2 ms.

## Decisión

El test E2E mide, por tecla:

1. desde `beforeinput` hasta que ProseMirror termina de actualizar el DOM (`view.updateState`), y
2. el coste de estilo + layout pendiente, forzado con una lectura de `offsetHeight` en el siguiente
   fotograma.

La suma es la latencia del editor. **No incluye el rasterizado ni la composición**, que son del
navegador. El umbral es p95 < 16 ms con `long-document.md` (≈ 66 páginas por palabras, 7 600 nodos).

## Medidas (Windows 11, Electron 45)

p50 ≈ 6,5 ms, p95 ≈ 8–12 ms en tres ejecuciones. Lo que se midió y movió la aguja: recalcular las
decoraciones de resaltado de código en cada tecla recorría todo el documento (`dispatch` pasó de
p50 5,7 ms / p95 19,9 ms a 2,3 / 7,5 ms); ahora solo se recalculan si la transacción toca un bloque de
código. Se probó `contain: layout style` por bloque y no produjo diferencia medible, así que no se usa.
Tampoco se midió por separado el efecto de no repintar la cinta cuando el formato no cambia; se
mantiene porque es gratis.
