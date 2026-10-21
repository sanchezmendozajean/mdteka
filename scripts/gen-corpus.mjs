// Genera el corpus de round-trip (ED-24) en tests/fixtures/roundtrip/.
//  - commonmark/NNN.md : entradas de los ejemplos de la especificación CommonMark (paquete commonmark-spec)
//  - long-document.md  : documento largo (50+ páginas), determinista
//  - crlf.md, bom.md   : variantes de EOL y BOM con bytes exactos
// Los fixtures escritos a mano (gfm-*.md, edge-*.md) no se regeneran.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests/fixtures/roundtrip');
mkdirSync(join(out, 'commonmark'), { recursive: true });

const spec = readFileSync(join(root, 'node_modules/commonmark-spec/spec.txt'), 'utf8');
const fence = '`'.repeat(32);
const re = new RegExp(`^${fence} example[^\\n]*\\n([\\s\\S]*?)^\\.\\n`, 'gm');
let n = 0;
for (const m of spec.matchAll(re)) {
  n++;
  const input = m[1].replace(/→/g, '\t');
  writeFileSync(join(out, 'commonmark', `${String(n).padStart(3, '0')}.md`), input);
}
console.log(`commonmark: ${n} ejemplos`);

// Documento largo y determinista: ~60 páginas A4 (≈ 3 000 palabras por 6 páginas).
const paragraph = (i) =>
  `Este es el párrafo ${i} del documento largo. Contiene **negrita**, _cursiva_, \`código\` y un [enlace](https://example.com/${i}) ` +
  'para ejercitar el serializador. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore ' +
  'et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
let long = '# Documento largo\n\n';
for (let c = 1; c <= 100; c++) {
  long += `## Capítulo ${c}\n\n`;
  for (let p = 1; p <= 5; p++) long += `${paragraph(c * 10 + p)}\n\n`;
  long += `- Elemento A del capítulo ${c}\n- Elemento B\n  - Anidado\n- Elemento C\n\n`;
  long += `> Cita del capítulo ${c}.\n\n`;
  long += '```ts\nconst x: number = ' + c + ';\nconsole.log(x);\n```\n\n';
  long +=
    '| Columna A | Columna B |\n| --------- | --------: |\n| uno       |         1 |\n| dos       |         2 |\n\n';
}
writeFileSync(join(out, 'long-document.md'), long);
console.log(`long-document.md: ${long.length} caracteres`);

writeFileSync(
  join(out, 'crlf.md'),
  Buffer.from('# Título\r\n\r\nPárrafo uno\r\ncon salto suave.\r\n\r\n- a\r\n- b\r\n', 'utf8'),
);
writeFileSync(
  join(out, 'bom.md'),
  Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('# Con BOM\n\nTexto.\n', 'utf8')]),
);
writeFileSync(
  join(out, 'config-block.md'),
  '# Con configuración\n\nTexto.\n\n<!-- mdteca:config\n{\n  "version": 1,\n  "typography": { "size": 12 },\n  "x-futuro": { "a": 1 }\n}\n-->\n',
);
