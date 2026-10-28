# 10 · Git y portabilidad

El objetivo es que una carpeta de documentación editada con MDTor sea un repositorio Git sano: diffs pequeños y legibles, sin ruido, sin dependencias de la máquina.

## Reglas

- **GIT-01** **Byte-idéntico si no hay cambios.** Abrir/guardar sin editar no modifica el archivo (ver `03`, ED-20). No se guarda un archivo que no está sucio.
- **GIT-02** **Diffs locales.** Editar un párrafo cambia solo las líneas de ese párrafo (preservación de fuente, ED-21).
- **GIT-03** **EOL y codificación**: se respetan los del archivo existente. Nuevos archivos: UTF-8 sin BOM, `LF`, salto de línea final.
- **GIT-04** **Sin reflujo de texto**: MDTor nunca re-ajusta líneas largas ni cambia saltos de línea duros que el usuario escribió en modo texto.
- **GIT-05** **Configuración estable**: el bloque `mdtor:config` y el `.mdtor` se serializan con orden de claves canónico e indentación fija. Cambiar un valor = cambiar una línea.
- **GIT-06** **Rutas relativas y con `/`** en enlaces, imágenes e índice. Nunca rutas absolutas ni `C:\`.
- **GIT-07** **Nada de estado de sesión en el repo** (`09`, CFG-01).
- **GIT-08** **Nombres de archivo seguros**: al crear archivos desde la app se usan slugs en minúsculas, sin espacios ni acentos (`configuracion-inicial.md`), evitando problemas entre Windows/macOS/Linux. Se avisa si dos archivos difieren solo en mayúsculas.
- **GIT-09** **Imágenes base64**: advertencia de tamaño (`06`, IMG-01) y recomendación del modo archivo en proyectos.
- **GIT-10** **Compatibilidad de visores**: todo lo propio de MDTor son comentarios HTML (`mdtor:config`, `mdtor:pagebreak`), invisibles en GitHub/GitLab/VS Code.

## Recomendaciones que la app PUEDE ofrecer

Al crear un proyecto dentro de un repo Git, sugerir (sin imponer) añadir a `.gitattributes`:

```gitattributes
*.md      text eol=lf
*.mdtor  text eol=lf linguist-language=JSON
*.png     binary
*.jpg     binary
```

## Merge del `.mdtor`

- Estructura pensada para resolver conflictos a mano: un ítem por objeto, ids estables, sin arrays de índices numéricos.
- Si al abrir se detectan marcadores de conflicto (`<<<<<<<`), mostrar error claro con la línea y no sobrescribir el archivo.
