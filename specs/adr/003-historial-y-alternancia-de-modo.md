# ADR 003 · Historial de deshacer y alternancia de modo

- **Estado**: aceptada (Fase 1)
- **Requisitos**: ED-02, ED-23

## Contexto

ED-02 pide conservar «el historial de deshacer de cada modo» al alternar, pero la fuente de verdad es
un único texto Markdown. Si se edita en un modo, el historial del otro describe un estado que ya no
existe: aplicarlo corrompería el documento.

## Decisión

Cada documento conserva un estado por modo (ProseMirror y CodeMirror), cada uno con su historial, junto
con la fuente de la que se derivó. Al cambiar de modo:

- si **no hubo ediciones** en el modo que se abandona, el destino conserva su estado y su historial;
- si **hubo ediciones**, el destino se reconstruye desde la fuente y **su historial empieza vacío**.

La posición del cursor se traslada en cualquier caso (bloque + carácter) y el scroll se conserva en
proporción.

## Consecuencias

- Alternar sin editar no altera nada (ED-23, test E2E) y no pierde deshacer.
- Tras editar en un modo y volver al otro, no se puede deshacer más allá del cambio de modo. Es el
  comportamiento seguro; la alternativa (un historial unificado por transacciones de texto) se deja
  como mejora posible.
