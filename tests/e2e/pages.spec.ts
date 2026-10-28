import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, mod, save, source, waitForEditor } from './helpers';

const LONG = readFileSync('tests/fixtures/roundtrip/long-document.md', 'utf8');

const para = (i: number, n = 6) =>
  `Párrafo ${i}. ` +
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(
    n,
  );

/** Documento con párrafos largos, un bloque de código de 90 líneas, saltos manuales y títulos. */
const MIXED = (() => {
  let md = '# Título\n\n';
  for (let i = 1; i <= 9; i++) md += `${para(i)}\n\n`;
  md += '## Código\n\n```ts\n';
  md += Array.from({ length: 90 }, (_, i) => `const linea${i} = ${i};`).join('\n');
  md += '\n```\n\n<!-- mdtor:pagebreak -->\n\n## Otra sección\n\n';
  for (let i = 10; i <= 16; i++) md += `${para(i, 9)}\n\n`;
  md += '- uno\n- dos\n- tres\n\n> Una cita final.\n';
  return md;
})();

type Hook = {
  activeDoc: () => { id: string };
  exportPdf: (id: string) => Promise<string | null>;
  preparePrint: (id: string) => Promise<{ pages: number; dispose: () => void }>;
  pages: () => number;
};

/** Ejecuta una función en la página con el gancho de pruebas (`window.__mdtor`). */
const inPage = <T>(page: Page, fn: (h: Hook) => Promise<T> | T): Promise<T> =>
  page.evaluate(`(${fn.toString()})(window.__mdtor)`) as Promise<T>;

/** Exporta a PDF indicando la ruta por variable de entorno (el diálogo nativo no se automatiza). */
async function exportPdf(app: ElectronApplication, page: Page, dir: string): Promise<string> {
  const path = join(dir, 'salida.pdf');
  await app.evaluate((_electron, p) => {
    process.env['MDTOR_E2E_SAVE_PATH'] = p;
  }, path);
  const written = await inPage(page, (h) => h.exportPdf(h.activeDoc().id));
  expect(written).toBeTruthy();
  expect(existsSync(path)).toBe(true);
  return path;
}

/** Páginas de un PDF de Chromium: una entrada `/Type /Page` por hoja. */
const pdfPages = (path: string): number =>
  (
    readFileSync(path)
      .toString('latin1')
      .match(/\/Type\s*\/Page[^s]/g) ?? []
  ).length;

const sheets = (page: Page) => page.evaluate(() => document.querySelectorAll('.sheet').length);

/** Espera a que la paginación se estabilice (el número de hojas deja de cambiar). */
async function settled(page: Page): Promise<number> {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const n = await sheets(page);
    if (n === last && n > 0) {
      await page.waitForTimeout(150);
      if ((await sheets(page)) === n) return n;
    }
    last = n;
    await page.waitForTimeout(120);
  }
  return last;
}

/** Tabla con filas muy altas (una celda larga por fila), para forzar cortes dentro de una fila. */
const TABLE = (() => {
  const cell = 'Texto largo de la celda que ocupa varias líneas dentro de la columna. ';
  let md = '# Tabla\n\n| Término | Significado | Uso |\n| --- | --- | --- |\n';
  for (let i = 1; i <= 12; i++) md += `| T${i} | ${cell.repeat(12)} | ${cell.repeat(6)} |\n`;
  return md;
})();

test.describe('[Fase 3] vista de páginas', () => {
  test('[VW-01] las hojas tienen el tamaño del papel (A4) y 24 px de separación', async () => {
    const { app, page } = await launch({ 'a.md': `${para(1)}\n\n${para(2)}\n` });
    await waitForEditor(page);
    const n = await settled(page);
    expect(n).toBeGreaterThanOrEqual(1);
    const geo = await page.evaluate(() => {
      const r = [...document.querySelectorAll('.sheet')].map((s) => s.getBoundingClientRect());
      return { w: r[0]!.width, h: r[0]!.height, gap: r[1] ? r[1].top - r[0]!.bottom : 24 };
    });
    expect(Math.abs(geo.w - 793.7)).toBeLessThan(1.5); // 210 mm
    expect(Math.abs(geo.h - 1122.5)).toBeLessThan(1.5); // 297 mm
    expect(Math.abs(geo.gap - 24)).toBeLessThan(1.5);
    await app.close();
  });

  test('[VW-12] ningún bloque cruza el margen de la página (documento largo)', async () => {
    const { app, page } = await launch({ 'long.md': LONG });
    await waitForEditor(page);
    await settled(page);
    const bad = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll('.sheet')].map((s) => s.getBoundingClientRect());
      const mm = 96 / 25.4;
      const mT = 25 * mm;
      const mB = 25 * mm;
      const blocks = [...document.querySelector('.ProseMirror')!.children].filter(
        (el) => !el.classList.contains('page-gap') && !el.querySelector('.page-gap-inline'),
      );
      const out: string[] = [];
      for (const el of blocks) {
        const r = el.getBoundingClientRect();
        const i = sheets.findIndex((s) => r.top >= s.top - 1 && r.top < s.bottom);
        if (i < 0) {
          out.push(`sin hoja: ${el.tagName}`);
          continue;
        }
        const s = sheets[i]!;
        if (r.bottom > s.bottom - mB + 1.5 || r.top < s.top + mT - 1.5)
          out.push(
            `${el.tagName} hoja ${i + 1}: ${Math.round(r.top - s.top)}–${Math.round(r.bottom - s.top)}`,
          );
      }
      return out.slice(0, 5);
    });
    expect(bad).toEqual([]);
    await app.close();
  });

  test('[VW-12] un párrafo se corta por líneas y cada línea queda dentro de una página', async () => {
    const md = `${para(1, 4)}\n\n${para(2, 80)}\n\n${para(3, 3)}\n`;
    const { app, page } = await launch({ 'a.md': md });
    await waitForEditor(page);
    const n = await settled(page);
    expect(n).toBeGreaterThanOrEqual(3);
    const out = await page.evaluate(() => {
      const mm = 96 / 25.4;
      const sheets = [...document.querySelectorAll('.sheet')].map((s) => s.getBoundingClientRect());
      const p = document.querySelectorAll('.ProseMirror > p')[1]!;
      const range = document.createRange();
      range.selectNodeContents(p);
      const bad: string[] = [];
      for (const r of range.getClientRects()) {
        if (r.height < 2 || r.height > 60) continue; // el hueco incrustado no es una línea
        const i = sheets.findIndex((s) => r.top >= s.top - 1 && r.top < s.bottom);
        const s = sheets[i];
        if (!s || r.bottom > s.bottom - 25 * mm + 2 || r.top < s.top + 25 * mm - 2)
          bad.push(`línea fuera: ${Math.round(r.top)}`);
      }
      return { bad: bad.slice(0, 3), inline: document.querySelectorAll('.page-gap-inline').length };
    });
    expect(out.bad).toEqual([]);
    expect(out.inline).toBeGreaterThanOrEqual(1);
    await app.close();
  });

  test('[VW-12] una lista que no cabe se corta por líneas y su título no salta de hoja', async () => {
    const item = (i: number) =>
      `- **Elemento ${i}:** ${'Texto de la lista que ocupa más de una línea en la hoja. '.repeat(3)}\n  - Subelemento ${i} con algo de texto.`;
    const md = `${para(1, 9)}\n\n${para(2, 6)}\n\n### Título de la lista\n\n${Array.from({ length: 14 }, (_, i) => item(i + 1)).join('\n')}\n`;
    const { app, page } = await launch({ 'a.md': md });
    await waitForEditor(page);
    expect(await settled(page)).toBeGreaterThanOrEqual(2);
    const out = await page.evaluate(() => {
      const mm = 96 / 25.4;
      const sheets = [...document.querySelectorAll('.sheet')].map((s) => s.getBoundingClientRect());
      const sheetOf = (top: number) => sheets.findIndex((s) => top >= s.top - 1 && top < s.bottom);
      const ul = document.querySelector('.ProseMirror > ul')!;
      const bad: string[] = [];
      for (const p of ul.querySelectorAll('p')) {
        const range = document.createRange();
        range.selectNodeContents(p);
        for (const r of range.getClientRects()) {
          if (r.height < 2 || r.height > 60) continue;
          const s = sheets[sheetOf(r.top)];
          if (!s || r.bottom > s.bottom - 25 * mm + 2 || r.top < s.top + 25 * mm - 2)
            bad.push(`línea fuera: ${Math.round(r.top)}`);
        }
      }
      // La viñeta va con su texto: ningún elemento empieza en una hoja y sigue en otra por su primera línea.
      const split = [...ul.querySelectorAll('li')].filter((li) => {
        const first = li.querySelector('p')!.getBoundingClientRect();
        return sheetOf(li.getBoundingClientRect().top) !== sheetOf(first.top);
      }).length;
      return {
        bad: bad.slice(0, 3),
        split,
        heading: sheetOf(document.querySelector('.ProseMirror > h3')!.getBoundingClientRect().top),
        inline: ul.querySelectorAll('.page-gap-inline').length,
      };
    });
    expect(out.bad).toEqual([]);
    expect(out.split).toBe(0);
    expect(out.heading).toBe(0);
    expect(out.inline).toBeGreaterThanOrEqual(1);
    await app.close();
  });

  test('[VW-14] el número de páginas del PDF coincide con el de la pantalla (documento largo)', async () => {
    const { app, page, dir } = await launch({ 'long.md': LONG });
    await waitForEditor(page);
    const onScreen = await settled(page);
    expect(onScreen).toBeGreaterThan(50);
    const pdf = await exportPdf(app, page, dir);
    expect(pdfPages(pdf)).toBe(onScreen);
    await app.close();
  });

  test('[VW-14] ídem con código partido, saltos manuales, títulos y listas', async () => {
    const { app, page, dir } = await launch({ 'mixed.md': MIXED });
    await waitForEditor(page);
    const onScreen = await settled(page);
    expect(onScreen).toBeGreaterThanOrEqual(6);
    const pdf = await exportPdf(app, page, dir);
    expect(pdfPages(pdf)).toBe(onScreen);
    // La vista de impresión reparte igual que la pantalla.
    const printed = await inPage(page, async (h) => {
      const view = await h.preparePrint(h.activeDoc().id);
      const pages = view.pages;
      view.dispose();
      return pages;
    });
    expect(printed).toBe(onScreen);
    await app.close();
  });

  test('[VW-40] el PDF lleva marcadores a partir de los títulos', async () => {
    const { app, page, dir } = await launch({ 'mixed.md': MIXED });
    await waitForEditor(page);
    await settled(page);
    const pdf = await exportPdf(app, page, dir);
    const text = readFileSync(pdf).toString('latin1');
    expect(text).toContain('/Outlines');
    await app.close();
  });

  test('[VW-12] un salto de página manual fuerza una página nueva', async () => {
    const { app, page } = await launch({ 'a.md': 'Uno\n\n<!-- mdtor:pagebreak -->\n\nDos\n' });
    await waitForEditor(page);
    expect(await settled(page)).toBe(2);
    await app.close();
  });

  test('[VW-13] al escribir en el último bloque de una página el cursor no salta en pantalla', async () => {
    // Tres párrafos de 11 líneas llenan la página 1; al crecer el tercero pasa entero a la página 2.
    const md = `${para(1)}

${para(2)}

${para(3)}

${para(4)}
`;
    const { app, page } = await launch({ 'a.md': md });
    await waitForEditor(page);
    await settled(page);
    await page.locator('.ProseMirror > p').nth(2).click();
    // Cursor al final del párrafo (no de la línea).
    await page.evaluate(() => getSelection()!.modify('move', 'forward', 'paragraphboundary'));
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const w = window as unknown as { __caret: number[]; __run: boolean };
      w.__caret = [];
      w.__run = true;
      const sample = () => {
        const s = getSelection();
        if (s && s.rangeCount) {
          const r = s.getRangeAt(0).cloneRange();
          r.collapse(true);
          const rect = r.getClientRects()[0];
          if (rect) w.__caret.push(Math.round(rect.top));
        }
        if (w.__run) requestAnimationFrame(sample);
      };
      sample();
    });
    const gapsBefore = await page.evaluate(() => document.querySelectorAll('.page-gap').length);
    await page.keyboard.type(' palabra'.repeat(60), { delay: 25 });
    await page.waitForTimeout(900);
    const caret = await page.evaluate(() => {
      const w = window as unknown as { __caret: number[]; __run: boolean };
      w.__run = false;
      return w.__caret;
    });
    // Un salto de línea natural mueve el cursor unos 26 px; cambiar de página sin compensar, más de 200.
    let maxJump = 0;
    for (let i = 1; i < caret.length; i++)
      maxJump = Math.max(maxJump, Math.abs(caret[i]! - caret[i - 1]!));
    expect(maxJump).toBeLessThan(60);
    // Y el texto sí pasó a la página siguiente: la línea del cursor está en la hoja 2.
    const onPage = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll('.sheet')].map((s) => s.getBoundingClientRect());
      const sel = getSelection()!;
      const r = sel.getRangeAt(0).cloneRange();
      r.collapse(true);
      const rect = r.getClientRects()[0]!;
      return sheets.findIndex((s) => rect.top >= s.top - 1 && rect.top < s.bottom) + 1;
    });
    expect(onPage).toBe(2);
    expect(
      await page.evaluate(() => document.querySelectorAll('.page-gap').length),
    ).toBeGreaterThanOrEqual(gapsBefore);
    await app.close();
  });

  test('[VW-11] repaginar un documento de 100 páginas tras editar no bloquea la entrada', async () => {
    const { app, page } = await launch({ 'long.md': LONG });
    await waitForEditor(page);
    await settled(page);
    await page.evaluate(() => {
      const w = window as unknown as { __long: { d: number; t: number }[]; __typing: number[] };
      w.__long = [];
      w.__typing = [];
      performance.clearMeasures('mdtor:paginate');
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__long.push({ d: e.duration, t: e.startTime });
      }).observe({ entryTypes: ['longtask'] });
    });
    await page.locator('.ProseMirror > p').nth(20).click();
    const from = await page.evaluate(() => performance.now());
    await page.keyboard.type('Texto añadido mientras se repagina el documento largo. '.repeat(3), {
      delay: 25,
    });
    const to = await page.evaluate(() => performance.now());
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({
      long: (window as unknown as { __long: { d: number; t: number }[] }).__long,
      paginate: performance.getEntriesByName('mdtor:paginate').map((e) => e.duration),
    }));
    // Ninguna tarea larga mientras se escribe; el volcado a texto ocurre al pausar (ED-12).
    expect(r.long.filter((e) => e.t >= from && e.t <= to)).toEqual([]);
    // Y repaginar tras una edición es incremental: solo se vuelve a medir el bloque editado.
    expect(r.paginate.length).toBeGreaterThan(0);
    expect(Math.max(...r.paginate)).toBeLessThan(40);
    await app.close();
  });

  test('[VW-02] doble clic sobre el encabezado abre la configuración de página', async () => {
    const { app, page } = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(page);
    await page.getByTestId('hide-document-panel').click();
    await expect(page.getByTestId('document-panel')).toHaveCount(0);
    const box = (await page.locator('.sheet').first().boundingBox())!;
    await page.mouse.dblclick(box.x + 40, box.y + 20);
    await expect(page.getByTestId('document-panel')).toBeVisible();
    await app.close();
  });

  test('[VW-02] encabezado y pie con {title}, {page} y {pages}', async () => {
    const { app, page, files } = await launch({
      'informe.md': `${para(1)}
`,
    });
    await waitForEditor(page);
    await page.getByTestId('cfg-header-text').fill('{title} — {page}/{pages}');
    await page.getByTestId('cfg-header-text').press('Enter');
    await expect(page.locator('.sheet-header').first()).toHaveText('informe — 1/1');
    await expect(page.locator('.sheet-footer').first()).toHaveText('1');
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toContain('"text": "{title} — {page}/{pages}"');
    await app.close();
  });
});

test.describe('[Fase 3] zoom, regla y vista continua', () => {
  test('[VW-30] zoom en pasos de 10 % con botones, atajos y Ctrl + rueda', async () => {
    const { app, page } = await launch({ 'a.md': `${para(1)}\n` });
    await waitForEditor(page);
    const zoom = () => page.getByTestId('zoom-value').textContent();
    expect(await zoom()).toBe('100 %');
    await page.getByTestId('zoom-in').click();
    expect(await zoom()).toBe('110 %');
    await page.locator('.ProseMirror').click();
    await page.keyboard.press(`${mod}+Equal`);
    expect(await zoom()).toBe('120 %');
    await page.keyboard.press(`${mod}+Minus`);
    await page.keyboard.press(`${mod}+Minus`);
    expect(await zoom()).toBe('100 %');
    await page.keyboard.press(`${mod}+Minus`);
    expect(await zoom()).toBe('90 %');
    await page.keyboard.press(`${mod}+Alt+Digit0`);
    expect(await zoom()).toBe('100 %');
    await page.keyboard.down(mod);
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, -100);
    await page.keyboard.up(mod);
    await expect.poll(zoom).toBe('110 %');
    // El zoom escala la hoja.
    const w = await page.evaluate(
      () => document.querySelector('.sheet')!.getBoundingClientRect().width,
    );
    expect(Math.abs(w - 793.7 * 1.1)).toBeLessThan(2);
    await app.close();
  });

  test('[VW-31] el zoom se recuerda por documento al volver a abrirlo', async () => {
    const first = await launch({ 'a.md': 'Hola\n', 'b.md': 'Otro\n' });
    await waitForEditor(first.page);
    await first.page.getByTestId('doc-tab').first().click();
    await first.page.getByTestId('zoom-in').click();
    await first.page.getByTestId('zoom-in').click();
    await first.page.waitForTimeout(800); // el guardado del estado se agrupa
    await first.app.close();
    const again = await launch({ 'a.md': 'Hola\n', 'b.md': 'Otro\n' }, first);
    await waitForEditor(again.page);
    await again.page.getByTestId('doc-tab').first().click();
    await expect(again.page.getByTestId('zoom-value')).toHaveText('120 %');
    await again.page.getByTestId('doc-tab').nth(1).click();
    await expect(again.page.getByTestId('zoom-value')).toHaveText('100 %');
    await again.app.close();
  });

  test('[VW-30] el zoom tiene límites de 50 % a 300 %', async () => {
    const { app, page } = await launch({ 'a.md': 'x\n' });
    await waitForEditor(page);
    for (let i = 0; i < 8; i++) await page.getByTestId('zoom-out').click();
    expect(await page.getByTestId('zoom-value').textContent()).toBe('50 %');
    for (let i = 0; i < 30; i++) await page.getByTestId('zoom-in').click();
    expect(await page.getByTestId('zoom-value').textContent()).toBe('300 %');
    await app.close();
  });

  test('[VW-03] arrastrar el marcador de la regla cambia el margen izquierdo', async () => {
    const { app, page, files } = await launch({ 'a.md': `${para(1)}\n` });
    await waitForEditor(page);
    const handle = page.getByTestId('ruler-left');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 });
    // Vista previa en vivo: el texto ya se desplazó antes de soltar.
    const live = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet')!.getBoundingClientRect();
      const p = document.querySelector('.ProseMirror > p')!.getBoundingClientRect();
      return (p.left - sheet.left) / (96 / 25.4);
    });
    expect(live).toBeGreaterThan(29);
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    await save(page);
    const text = readFileSync(files[0]!, 'utf8');
    const cfg = JSON.parse(text.slice(text.indexOf('{\n'), text.lastIndexOf('}') + 1)) as {
      page: { margins: { top: number; right: number; bottom: number; left: number } };
    };
    expect(cfg.page.margins.left).toBeGreaterThan(33);
    expect(cfg.page.margins.left).toBeLessThan(37);
    expect(cfg.page.margins.right).toBe(25);
    await app.close();
  });

  test('[VW-20][VW-21] la vista continua usa el ancho de columna y se guarda como predeterminada', async () => {
    const { app, page, files } = await launch({
      'a.md': `${para(1)}\n\n<!-- mdtor:pagebreak -->\n\nDos\n`,
    });
    await waitForEditor(page);
    await page.getByTestId('hide-navigator').click();
    await page.getByTestId('hide-document-panel').click();
    await page.getByTestId('view-continuous').click();
    await expect(page.locator('.sheet')).toHaveCount(0);
    const width = () =>
      page.evaluate(() => document.querySelector('.doc-column')!.getBoundingClientRect().width);
    expect(Math.abs((await width()) - 760)).toBeLessThan(2);
    await page.getByTestId('column-slider').fill('900');
    expect(Math.abs((await width()) - 900)).toBeLessThan(2);
    // El salto manual se muestra como una línea discontinua con etiqueta (VW-21).
    await expect(page.locator('.ProseMirror .page-break')).toBeVisible();
    await page.getByTestId('tab-view').click();
    await page.locator('[data-command="view.saveDefault"]').click();
    await save(page);
    const text = readFileSync(files[0]!, 'utf8');
    expect(text).toContain('"default": "continuous"');
    expect(text).toContain('"continuousWidth": 900');
    await app.close();
  });

  test('[VW-20] un documento con view.default continuous se abre en vista continua', async () => {
    const { app, page } = await launch({
      'a.md':
        'Hola\n\n<!-- mdtor:config\n{\n  "version": 1,\n  "view": {\n    "default": "continuous"\n  }\n}\n-->\n',
    });
    await waitForEditor(page);
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.getByTestId('view-continuous')).toHaveAttribute('aria-pressed', 'true');
    await app.close();
  });

  test('[VW-02] el orden de la orientación y del papel cambia el tamaño de la hoja', async () => {
    const { app, page, files } = await launch({ 'a.md': 'x\n' });
    await waitForEditor(page);
    await page.getByTestId('tab-layout').click();
    await page.locator('[data-command="layout.landscape"]').click();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('.sheet')!.getBoundingClientRect().width),
      )
      .toBeGreaterThan(1100);
    await page.getByTestId('paper-size').click();
    await page.locator('[data-paper="Letter"]').click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.round(document.querySelector('.sheet')!.getBoundingClientRect().width),
        ),
      )
      .toBe(Math.round(279.4 * (96 / 25.4)));
    await save(page);
    const text = readFileSync(files[0]!, 'utf8');
    expect(text).toContain('"size": "Letter"');
    expect(text).toContain('"orientation": "landscape"');
    await app.close();
  });
});

test.describe('[Fase 3] modo texto y exportación', () => {
  test('[VW-15][ED-04] el modo texto también se ve en páginas', async () => {
    const { app, page } = await launch({ 'long.md': LONG.slice(0, 40000) });
    await waitForEditor(page);
    await settled(page);
    await page.getByTestId('mode-source').click();
    await expect(page.getByTestId('source')).toBeVisible();
    // CodeMirror solo dibuja lo visible: se baja hasta pasar el primer salto.
    await page.evaluate(() => {
      document.querySelector('.editor-scroll')!.scrollTop = 2400;
    });
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('.source-gap').length))
      .toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('page-counter')).toBeVisible();
    // La fuente no cambia por ver el documento en páginas.
    expect((await source(page)).startsWith('# Documento largo')).toBe(true);
    await app.close();
  });

  test('[VW-42] el HTML exportado es autocontenido', async () => {
    const { app, page, dir } = await launch({
      'a.md': '# Hola\n\nUn párrafo con **negrita**.\n\n```js\nlet x = 1;\n```\n',
    });
    await waitForEditor(page);
    const path = join(dir, 'salida.html');
    await app.evaluate((_electron, p) => {
      process.env['MDTOR_E2E_SAVE_PATH'] = p;
    }, path);
    await page.getByTestId('tab-file').click();
    await page.locator('[data-command="file.exportHtml"]').click();
    await expect.poll(() => existsSync(path)).toBe(true);
    const html = readFileSync(path, 'utf8');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<h1>Hola</h1>');
    expect(html).toContain('<strong>negrita</strong>');
    expect(html).toContain('@font-face');
    expect(html).toContain('data:font/woff2;base64');
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
    expect(html).not.toContain('contenteditable');
    await app.close();
  });

  test('las filas altas de una tabla se parten entre hojas y no dejan hueco grande', async () => {
    const { app, page } = await launch({ 'tabla.md': TABLE });
    await waitForEditor(page);
    const n = await settled(page);
    expect(n).toBeGreaterThan(1);
    const report = await page.evaluate(() => {
      const mm = 96 / 25.4;
      const mT = 25 * mm;
      const mB = 25 * mm;
      const sheets = [...document.querySelectorAll('.sheet')].map((x) => x.getBoundingClientRect());
      const inside: string[] = [];
      const bottoms = sheets.map(() => 0);
      for (const p of document.querySelectorAll('.ProseMirror td')) {
        const range = document.createRange();
        range.selectNodeContents(p);
        for (const r of range.getClientRects()) {
          if (r.height < 2 || r.height > 40) continue;
          const i = sheets.findIndex((sh) => r.top >= sh.top - 1 && r.top < sh.bottom);
          if (i < 0) {
            inside.push('fuera de hoja');
            continue;
          }
          const sh = sheets[i]!;
          if (r.top < sh.top + mT - 2 || r.bottom > sh.bottom - mB + 2) inside.push('en el margen');
          bottoms[i] = Math.max(bottoms[i]!, r.bottom - sh.top);
        }
      }
      return { inside, bottoms, free: sheets.map((sh) => sh.height - mB) };
    });
    expect(report.inside).toEqual([]);
    // Salvo la última, cada hoja se llena casi hasta el pie (como mucho ~4 líneas de hueco).
    for (let i = 0; i < report.bottoms.length - 1; i++) {
      expect(report.free[i]! - report.bottoms[i]!).toBeLessThan(110);
    }
    await app.close();
  });
});
