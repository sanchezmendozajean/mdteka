# 04 · Formato del documento y configuración embebida

Cada `.md` puede llevar su propia configuración visual dentro del mismo archivo, en un **comentario HTML**. Así viaja con el archivo, se versiona en Git y no se renderiza en GitHub, GitLab ni otros visores.

## Ubicación y sintaxis

- **DOC-01** El bloque va **al final del archivo**, precedido por una línea en blanco. Ir al final mantiene limpio el inicio del documento (lo primero que se ve en cualquier visor y en los diffs) y evita interferir con front matter YAML si existiera.
- **DOC-02** Formato exacto:

```markdown
…último párrafo del documento.

<!-- mdteca:config
{
  "version": 1,
  "page": { "size": "A4", "orientation": "portrait", "margins": { "top": 25, "right": 25, "bottom": 25, "left": 25 } },
  "view": { "default": "pages", "continuousWidth": 760 },
  "typography": { "font": "Source Serif 4", "monoFont": "JetBrains Mono", "size": 12, "lineHeight": 1.5, "paragraphSpacing": 0.6 },
  "styles": { "h1": { "size": 2.2, "weight": 700, "spacingBefore": 1.2, "spacingAfter": 0.5 } },
  "images": { "pasteMode": "ask" }
}
-->
```

- **DOC-03** Reglas de lectura:
  - Se busca el **último** comentario que empiece por `<!-- mdteca:config`. Debe estar al final del archivo (solo se admiten espacios en blanco después). Si aparece en otra posición, se respeta tal cual pero se trata como contenido (no como configuración) y se muestra una advertencia.
  - JSON inválido → se ignora, se usan valores heredados y se avisa con opción "Reparar".
  - Claves desconocidas se **conservan** al reescribir (compatibilidad hacia adelante).
  - La secuencia `--` dentro del JSON se escapa como `--` para no cerrar el comentario.
- **DOC-04** Reglas de escritura:
  - Si el documento no tenía bloque y el usuario no cambió ninguna opción del documento, **no se crea** bloque (archivos limpios por defecto).
  - Cuando el usuario cambia una opción, se escribe el bloque con **solo las claves que difieren de lo heredado** (proyecto o app). Al pulsar *Fijar todo en el documento* se escriben todas las claves para hacerlo autosuficiente.
  - JSON con indentación de 2 espacios, claves en **orden canónico fijo** (el del esquema de abajo), sin espacios finales, EOL del archivo. Esto garantiza diffs mínimos.
  - Botón *Restablecer a valores heredados* elimina el bloque.
- **DOC-05** Ninguno de los dos editores muestra el bloque como contenido (ver `03`). Se edita desde el **panel Documento** (derecha) o el diálogo *Configurar página*.

## Esquema (`DocumentConfig`, versión 1)

Unidades: márgenes en **mm**, tamaño de fuente en **pt**, tamaños de títulos y espaciados en **em** relativos al tamaño base, anchos en **px CSS** a zoom 100 %.

```ts
interface DocumentConfig {
  version: 1;
  page?: {
    size?: 'A4' | 'A5' | 'Letter' | 'Legal' | 'B5' | { width: number; height: number }; // mm
    orientation?: 'portrait' | 'landscape';
    margins?: { top: number; right: number; bottom: number; left: number };          // mm
    header?: { text?: string; align?: 'left' | 'center' | 'right' };                  // admite {title} {page} {pages} {date}
    footer?: { text?: string; align?: 'left' | 'center' | 'right' };                  // por defecto "{page}" centrado
    firstPageDifferent?: boolean;
  };
  view?: {
    default?: 'pages' | 'continuous';  // vista con la que se abre
    continuousWidth?: number;           // ancho de la columna editable en vista continua (px)
  };
  typography?: {
    font?: string;           // familia única del documento
    monoFont?: string;       // código
    size?: number;           // pt
    lineHeight?: number;     // múltiplo
    paragraphSpacing?: number; // em tras cada párrafo
    textAlign?: 'left' | 'justify';
    hyphenate?: boolean;
    language?: string;       // BCP-47, para guiones y ortografía (ej. "es-PE")
  };
  styles?: Partial<Record<'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'paragraph'|'blockquote'|'code'|'table'|'link', BlockStyle>>;
  theme?: string;            // id de preset de estilos ("clasico", "moderno", "tecnico"…)
  images?: { pasteMode?: 'base64' | 'file' | 'ask'; maxWidth?: number };
}

interface BlockStyle {
  size?: number;          // em
  weight?: 300|400|500|600|700|800;
  italic?: boolean;
  color?: string;         // hex
  spacingBefore?: number; // em
  spacingAfter?: number;  // em
  uppercase?: boolean;
  letterSpacing?: number; // em
  numbering?: boolean;    // solo títulos: numeración automática 1, 1.1, 1.1.1
  background?: string;    // cita, código
  borderLeft?: string;    // cita
}
```

El esquema se implementa con **zod** en `src/shared/` y se publica como JSON Schema en `specs/schemas/document-config.schema.json` durante la fase 2.

## Tipografía: una fuente por documento

- **DOC-10** Todo el documento se renderiza con **una** familia (`typography.font`) y una monoespaciada para código. No existe selector de fuente por selección.
- **DOC-11** La configuración de un documento **solo afecta a ese documento**. El CSS se genera por documento y se aplica con un *scope* (`[data-doc-id="…"]`) para que pestañas abiertas no se contaminen.
- **DOC-12** Fuentes incluidas (licencia OFL, empaquetadas en la app, disponibles offline): Inter, Source Serif 4, Source Sans 3, Literata, IBM Plex Sans, IBM Plex Serif, Merriweather, Lora, JetBrains Mono, IBM Plex Mono. Además, el usuario PUEDE elegir cualquier fuente del sistema.
- **DOC-13** Portabilidad: si la fuente indicada no existe en otra máquina, se usa la más parecida de las incluidas (serif→Source Serif 4, sans→Inter, mono→JetBrains Mono) y se muestra un aviso discreto en la barra de estado. El archivo **no** se modifica por ello.

## Presets de estilo

Galería de presets en la cinta (*Diseño › Estilos del documento*), con miniatura de cada uno. Aplicar un preset escribe `theme` y, si el usuario retoca algo, solo las diferencias en `styles`.

| Preset | Fuente | Carácter |
|--------|--------|----------|
| Clásico | Source Serif 4 | Libro, justificado, títulos serif |
| Moderno | Inter | Limpio, títulos con peso 700 |
| Técnico | IBM Plex Sans + Plex Mono | Documentación de sistemas, títulos numerados |
| Académico | Literata | Interlineado 1.6, márgenes amplios |
| Compacto | Source Sans 3 | Tamaño 10,5 pt, poco espaciado |

## Herencia

`valores de fábrica` → `ajustes de la app` → `defaults del proyecto (.mdteca)` → `bloque del documento`. El panel Documento muestra cada valor con un indicador de origen (ícono de app / proyecto / documento) y permite "volver al heredado" valor por valor.
