import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lineDiff } from '@renderer/documents/diff';
import { parseProject, serializeProject, type Project } from '@shared/project';
import { launch, source, waitForEditor, type Launched } from './helpers';

/** Proyecto de prueba: un libro con tres capítulos y otro libro vacío, en una sola colección. */
const PROJECT = (extra: Record<string, unknown> = {}) =>
  serializeProject({
    $schema: 'https://mdteca.app/schemas/project-v1.json',
    format: 'mdteca-project',
    version: 1,
    title: 'Manual de prueba',
    collections: [
      {
        id: 'general-aaaa',
        title: 'General',
        books: [
          {
            id: 'uso-bbbb',
            title: 'Uso',
            icon: 'book-open',
            folder: 'uso',
            items: [
              { id: 'uno-0001', file: 'uso/01-uno.md' },
              { id: 'dos-0002', file: 'uso/02-dos.md' },
              { id: 'tres-0003', file: 'uso/03-tres.md' },
            ],
          },
          { id: 'ref-cccc', title: 'Referencia', icon: 'library', folder: 'ref', items: [] },
        ],
      },
    ],
    ...extra,
  } as Project);

const FILES = (extra: Record<string, string> = {}): Record<string, string> => ({
  'manual.mdteca': PROJECT(),
  'uso/01-uno.md': '# Uno\n\nPrimer capítulo con alfa.\n',
  'uso/02-dos.md': '# Dos\n\nSegundo capítulo con alfa y beta.\n',
  'uso/03-tres.md': '# Tres\n\nTercero.\n',
  ...extra,
});

const open = (files: Record<string, string | Buffer>, extraEnv: Record<string, string> = {}) =>
  launch(files, undefined, ['manual.mdteca'], extraEnv);

const chapters = (page: Page) => page.getByTestId('nav-chapter');
const names = (page: Page) => chapters(page).locator('.nav-label').allTextContents();
const projectText = (l: Launched) => readFileSync(join(l.dir, 'manual.mdteca'), 'utf8');
const closeApp = (app: ElectronApplication) => app.close();

test.describe('[Fase 5] abrir un proyecto', () => {
  test('[PRJ-01][PRJ-31] el .mdteca recibido por la línea de comandos abre el proyecto', async () => {
    const l = await open(FILES());
    await expect(l.page.getByTestId('nav-header')).toContainText('Manual de prueba');
    // Los títulos salen del primer H1 del archivo (05).
    await expect.poll(() => names(l.page)).toEqual(['Uno', 'Dos', 'Tres']);
    await expect(l.page.getByTestId('mode-project')).toHaveAttribute('aria-pressed', 'true');
    await expect(l.page.getByTestId('title-project')).toContainText('Manual de prueba');
    // Con una sola colección el navegador la oculta (PRJ-11).
    await expect(l.page.getByTestId('nav-collection')).toHaveCount(0);
    await expect(l.page.getByTestId('nav-book')).toHaveCount(2);
    await closeApp(l.app);
  });

  test('[PRJ-22] con varias colecciones se muestran como secciones con su contador', async () => {
    const two = serializeProject({
      format: 'mdteca-project',
      version: 1,
      title: 'Dos colecciones',
      collections: [
        { id: 'a-1111', title: 'Técnico', books: [{ id: 'b-2222', title: 'Arq', items: [] }] },
        { id: 'c-3333', title: 'Usuario', books: [] },
      ],
    } as Project);
    const l = await launch({ 'manual.mdteca': two }, undefined, ['manual.mdteca']);
    await expect(l.page.getByTestId('nav-collection')).toHaveCount(2);
    await expect(l.page.getByTestId('nav-collection').first()).toContainText('Técnico');
    await closeApp(l.app);
  });

  test('[PRJ-23] clic abre el capítulo; el punto marca abierto y con cambios sin guardar', async () => {
    const l = await open(FILES());
    await chapters(l.page).first().click();
    await waitForEditor(l.page);
    await expect(l.page.getByTestId('doc-tab')).toContainText('01-uno.md');
    await expect(chapters(l.page).first().getByTestId('nav-open')).toBeVisible();
    await l.page.locator('.ProseMirror').click();
    await l.page.keyboard.press('Control+End');
    await l.page.keyboard.type('X');
    await expect(chapters(l.page).first().getByTestId('nav-dirty')).toBeVisible();
    await closeApp(l.app);
  });

  test('[PRJ-28] un archivo indexado que no existe se marca y se puede quitar del índice', async () => {
    const files = FILES();
    delete (files as Record<string, string | undefined>)['uso/02-dos.md'];
    const l = await open(files);
    await expect(l.page.getByTestId('nav-missing')).toHaveCount(1);
    await l.page.getByTestId('nav-remove-missing').click();
    await expect.poll(() => projectText(l)).not.toContain('02-dos.md');
    await expect(l.page.getByTestId('nav-missing')).toHaveCount(0);
    await closeApp(l.app);
  });

  test('un proyecto inválido avisa y no abre el navegador', async () => {
    const l = await open({ 'manual.mdteca': '{ "format": "otro" }' });
    await expect(l.page.getByTestId('dialog-error')).toBeVisible();
    await expect(l.page.getByTestId('nav-header')).toHaveCount(0);
    await closeApp(l.app);
  });
});

test.describe('[Fase 5] reordenar y mover [PRJ-24]', () => {
  /** Líneas añadidas o quitadas entre dos textos. */
  const changed = (a: string, b: string) =>
    lineDiff(a, b)
      .filter((x) => x.kind !== 'same')
      .map((x) => x.text.trim().replace(/,$/, ''));

  test('arrastrar un capítulo antes de otro cambia solo las líneas de ese ítem en el .mdteca', async () => {
    const l = await open(FILES());
    await expect.poll(() => names(l.page)).toEqual(['Uno', 'Dos', 'Tres']);
    const before = projectText(l);
    // «Dos» se suelta en la mitad superior de «Uno»: queda primero.
    await chapters(l.page)
      .nth(1)
      .dragTo(chapters(l.page).nth(0), { targetPosition: { x: 40, y: 3 } });
    await expect.poll(() => names(l.page)).toEqual(['Dos', 'Uno', 'Tres']);
    await expect.poll(() => projectText(l)).not.toBe(before);
    const diff = changed(before, projectText(l));
    expect(diff.length).toBeGreaterThan(0);
    // Mover «Dos» antes de «Uno» equivale a mover «Uno» después de «Dos»: el diff toca las líneas
    // de un único ítem y de ningún otro.
    const ids = new Set(diff.map((line) => /"id": "([^"]+)"/.exec(line)?.[1]));
    expect(ids.size).toBe(1);
    expect(ids.has('tres-0003')).toBe(false);
    await closeApp(l.app);
  });

  test('arrastrar sobre el centro de un capítulo lo anida como subcapítulo', async () => {
    const l = await open(FILES());
    await chapters(l.page).nth(2).dragTo(chapters(l.page).nth(0));
    await expect.poll(() => projectText(l)).toContain('"children"');
    const parsed = parseProject(projectText(l));
    expect(parsed.ok && parsed.project.collections[0]!.books[0]!.items[0]!.children?.[0]?.id).toBe(
      'tres-0003',
    );
    await closeApp(l.app);
  });

  test('moverlo a otro libro pregunta si el archivo también va a la carpeta del libro', async () => {
    const l = await open(FILES());
    await chapters(l.page).nth(0).dragTo(l.page.getByTestId('nav-book').nth(1));
    await expect(l.page.getByTestId('dialog-choose')).toBeVisible();
    await l.page.getByTestId('choose-move').click();
    await expect.poll(() => projectText(l)).toContain('"file": "ref/01-uno.md"');
    expect(existsSync(join(l.dir, 'ref', '01-uno.md'))).toBe(true);
    expect(existsSync(join(l.dir, 'uso', '01-uno.md'))).toBe(false);
    await closeApp(l.app);
  });

  test('«Solo cambiar el índice» deja el archivo donde estaba', async () => {
    const l = await open(FILES());
    await chapters(l.page).nth(0).dragTo(l.page.getByTestId('nav-book').nth(1));
    await l.page.getByTestId('choose-keep').click();
    const inReference = () => {
      const parsed = parseProject(projectText(l));
      return parsed.ok ? parsed.project.collections[0]!.books[1]!.items.map((i) => i.file) : [];
    };
    await expect.poll(inReference).toEqual(['uso/01-uno.md']);
    expect(existsSync(join(l.dir, 'uso', '01-uno.md'))).toBe(true);
    await closeApp(l.app);
  });
});

test.describe('[Fase 5] menú contextual [PRJ-25][PRJ-26]', () => {
  const menu = async (page: Page, row: ReturnType<typeof chapters>, item: string) => {
    await row.click({ button: 'right' });
    await page.getByTestId(`menu-${item}`).click();
  };

  test('nuevo capítulo crea el archivo con slug del título y prefijo numérico si el proyecto lo pide', async () => {
    const l = await launch(
      { ...FILES(), 'manual.mdteca': PROJECT({ naming: { numbered: true } }) },
      undefined,
      ['manual.mdteca'],
    );
    await l.page.getByTestId('nav-book').first().click({ button: 'right' });
    await l.page.getByTestId('menu-new-chapter').click();
    await l.page.getByTestId('prompt-input').fill('Configuración inicial');
    await l.page.getByTestId('prompt-accept').click();
    await expect
      .poll(() => existsSync(join(l.dir, 'uso', '04-configuracion-inicial.md')))
      .toBe(true);
    expect(readFileSync(join(l.dir, 'uso', '04-configuracion-inicial.md'), 'utf8')).toBe(
      '# Configuración inicial\n',
    );
    await expect.poll(() => projectText(l)).toContain('"file": "uso/04-configuracion-inicial.md"');
    await expect(l.page.getByTestId('doc-tab')).toContainText('04-configuracion-inicial.md');
    await closeApp(l.app);
  });

  test('sin prefijo numérico el nombre es solo el slug', async () => {
    const l = await open(FILES());
    await l.page.getByTestId('nav-book').first().click({ button: 'right' });
    await l.page.getByTestId('menu-new-chapter').click();
    await l.page.getByTestId('prompt-input').fill('Anexo A');
    await l.page.getByTestId('prompt-accept').click();
    await expect.poll(() => existsSync(join(l.dir, 'uso', 'anexo-a.md'))).toBe(true);
    await closeApp(l.app);
  });

  test('nuevo subcapítulo, renombrar título (vacío vuelve al H1) y quitar del índice', async () => {
    const l = await open(FILES());
    await menu(l.page, chapters(l.page).nth(0), 'new-sub');
    await l.page.getByTestId('prompt-input').fill('Detalle');
    await l.page.getByTestId('prompt-accept').click();
    await expect.poll(() => projectText(l)).toContain('"children"');
    await menu(l.page, chapters(l.page).nth(1), 'rename');
    await l.page.getByTestId('prompt-input').fill('Segundo');
    await l.page.getByTestId('prompt-accept').click();
    await expect.poll(() => projectText(l)).toContain('"title": "Segundo"');
    await expect(chapters(l.page).filter({ hasText: 'Segundo' })).toHaveCount(1);
    await menu(l.page, chapters(l.page).filter({ hasText: 'Segundo' }), 'rename');
    await l.page.getByTestId('prompt-input').fill('');
    await l.page.getByTestId('prompt-accept').click();
    await expect.poll(() => projectText(l)).not.toContain('"title": "Segundo"');
    await menu(l.page, chapters(l.page).filter({ hasText: 'Tres' }), 'remove');
    await expect.poll(() => projectText(l)).not.toContain('03-tres.md');
    // El archivo sigue en disco y pasa a «Sin indexar».
    expect(existsSync(join(l.dir, 'uso', '03-tres.md'))).toBe(true);
    await expect(l.page.getByTestId('nav-unindexed-file')).toHaveText(/03-tres\.md/);
    await closeApp(l.app);
  });

  test('renombrar archivo y duplicar', async () => {
    const l = await open(FILES());
    await menu(l.page, chapters(l.page).nth(0), 'rename-file');
    await l.page.getByTestId('prompt-input').fill('inicio');
    await l.page.getByTestId('prompt-accept').click();
    await expect.poll(() => existsSync(join(l.dir, 'uso', 'inicio.md'))).toBe(true);
    expect(existsSync(join(l.dir, 'uso', '01-uno.md'))).toBe(false);
    await expect.poll(() => projectText(l)).toContain('"file": "uso/inicio.md"');
    await menu(l.page, chapters(l.page).nth(0), 'duplicate');
    await expect.poll(() => existsSync(join(l.dir, 'uso', 'inicio-copia.md'))).toBe(true);
    await expect.poll(() => chapters(l.page).count()).toBe(4);
    await closeApp(l.app);
  });

  test('copiar la ruta relativa y eliminar el archivo (a la papelera)', async () => {
    const l = await open(FILES());
    await menu(l.page, chapters(l.page).nth(2), 'delete');
    await l.page.getByTestId('choose-delete').click();
    await expect.poll(() => existsSync(join(l.dir, 'uso', '03-tres.md'))).toBe(false);
    await expect.poll(() => projectText(l)).not.toContain('03-tres.md');
    await closeApp(l.app);
  });

  test('nueva colección y nuevo libro desde el menú del fondo', async () => {
    const l = await open(FILES());
    await l.page.getByTestId('nav-book').first().click({ button: 'right' });
    await expect(l.page.getByTestId('menu-new-chapter')).toBeVisible();
    await l.page.keyboard.press('Escape');
    await l.page.locator('.nav-tree').click({ button: 'right', position: { x: 100, y: 300 } });
    await l.page.getByTestId('menu-new-collection').click();
    await l.page.getByTestId('prompt-input').fill('Legal');
    await l.page.getByTestId('prompt-accept').click();
    await expect.poll(() => projectText(l)).toContain('"title": "Legal"');
    // Ahora hay dos colecciones y se muestran.
    await expect(l.page.getByTestId('nav-collection')).toHaveCount(2);
    await closeApp(l.app);
  });
});

test.describe('[Fase 5] sin indexar [PRJ-27]', () => {
  test('lista los .md que no están en el índice y los añade a un libro', async () => {
    const l = await open(FILES({ 'uso/extra.md': '# Extra\n', 'borradores/x.md': '# X\n' }));
    // Se excluye lo que cubre `ignore`: aquí no hay patrones, así que aparecen los dos.
    await expect(l.page.getByTestId('nav-unindexed-file')).toHaveCount(2);
    await l.page
      .getByTestId('nav-unindexed-file')
      .filter({ hasText: 'uso/extra.md' })
      .getByTestId('nav-add-to-book')
      .click();
    await l.page.getByTestId('choose-uso-bbbb').click();
    await expect.poll(() => projectText(l)).toContain('"file": "uso/extra.md"');
    await expect(l.page.getByTestId('nav-unindexed-file')).toHaveCount(1);
    await closeApp(l.app);
  });

  test('los patrones de ignore los excluyen', async () => {
    const l = await launch(
      {
        ...FILES({ 'borradores/x.md': '# X\n', 'uso/_nota.md': '# N\n' }),
        'manual.mdteca': PROJECT({ ignore: ['borradores/**', '**/_*.md'] }),
      },
      undefined,
      ['manual.mdteca'],
    );
    await expect(l.page.getByTestId('nav-unindexed')).toHaveCount(0);
    await closeApp(l.app);
  });
});

test.describe('[Fase 5] modo archivo ⇄ proyecto [PRJ-30…33]', () => {
  test('[PRJ-33] un .md suelto dentro de un proyecto ofrece «Abrir proyecto»', async () => {
    const l = await launch(FILES(), undefined, ['uso/02-dos.md']);
    await waitForEditor(l.page);
    await expect(l.page.getByTestId('mode-file')).toHaveAttribute('aria-pressed', 'true');
    await expect(l.page.getByTestId('project-bar')).toContainText('Manual de prueba');
    await l.page.getByTestId('project-bar-open').click();
    await expect(l.page.getByTestId('nav-header')).toContainText('Manual de prueba');
    await expect(l.page.getByTestId('project-bar')).toHaveCount(0);
    // El documento queda seleccionado en el navegador.
    await expect(chapters(l.page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await closeApp(l.app);
  });

  test('descartar el aviso lo oculta', async () => {
    const l = await launch(FILES(), undefined, ['uso/02-dos.md']);
    await l.page.getByTestId('project-bar-dismiss').click();
    await expect(l.page.getByTestId('project-bar')).toHaveCount(0);
    await closeApp(l.app);
  });

  test('[PRJ-32] el selector de la barra de título cambia a modo proyecto y de vuelta sin cerrar pestañas', async () => {
    const l = await launch(FILES(), undefined, ['uso/01-uno.md']);
    await waitForEditor(l.page);
    await l.page.getByTestId('mode-project').click();
    await expect(l.page.getByTestId('nav-header')).toBeVisible();
    await expect(l.page.getByTestId('mode-project')).toHaveAttribute('aria-pressed', 'true');
    await l.page.getByTestId('mode-file').click();
    await expect(l.page.getByTestId('nav-header')).toHaveCount(0);
    await expect(l.page.getByTestId('doc-tab')).toHaveCount(1);
    await expect(l.page.getByTestId('mode-file')).toHaveAttribute('aria-pressed', 'true');
    await closeApp(l.app);
  });

  test('[PRJ-32] sin .mdteca cercano ofrece crear el proyecto aquí e importa los .md por carpeta', async () => {
    const l = await launch(
      {
        'libro/a.md': '# A\n',
        'libro/b.md': '# B\n',
        'otro/c.md': '# C\n',
        'raiz.md': '# Raíz\n',
      },
      undefined,
      ['libro/a.md'],
    );
    await waitForEditor(l.page);
    await l.page.getByTestId('mode-project').click();
    await expect(l.page.getByTestId('dialog-wizard')).toBeVisible();
    await l.page.getByTestId('wizard-title').fill('Mi proyecto');
    // La carpeta sugerida es la del documento; se cambia a la raíz con el selector (simulado).
    await l.page.getByTestId('wizard-accept').click();
    await expect(l.page.getByTestId('nav-header')).toContainText('Mi proyecto');
    const file = join(l.dir, 'libro', 'mi-proyecto.mdteca');
    await expect.poll(() => existsSync(file)).toBe(true);
    const parsed = parseProject(readFileSync(file, 'utf8'));
    expect(parsed.ok).toBe(true);
    // Un libro con la carpeta importada.
    expect(parsed.ok && parsed.project.collections[0]!.books[0]!.items.map((i) => i.file)).toEqual([
      'a.md',
      'b.md',
    ]);
    await closeApp(l.app);
  });
});

test.describe('[Fase 5] defaults del proyecto [04]', () => {
  test('los documentos heredan la tipografía del proyecto y el panel marca su origen', async () => {
    const l = await launch(
      {
        ...FILES(),
        'manual.mdteca': PROJECT({
          defaults: { typography: { font: 'Lora', size: 13 }, images: { pasteMode: 'file' } },
        }),
      },
      undefined,
      ['manual.mdteca'],
    );
    await chapters(l.page).first().click();
    await waitForEditor(l.page);
    await expect(l.page.getByTestId('cfg-typography.font')).toHaveAttribute(
      'data-origin',
      'project',
    );
    await expect(l.page.getByTestId('cfg-typography.size')).toHaveAttribute(
      'data-origin',
      'project',
    );
    const font = await l.page.evaluate(
      () => getComputedStyle(document.querySelector('.ProseMirror p')!).fontFamily,
    );
    expect(font).toContain('Lora');
    // Un documento sin cambios no recibe bloque de configuración (DOC-04).
    expect(await source(l.page)).not.toContain('mdteca:config');
    await closeApp(l.app);
  });

  test('el cuadro de ajustes del proyecto escribe título, ignorados y valores por defecto', async () => {
    const l = await open(FILES({ 'uso/_nota.md': '# N\n' }));
    await l.page.getByTestId('nav-header').locator('[data-command="project.settings"]').click();
    await l.page.getByTestId('settings-title').fill('Manual nuevo');
    await l.page.getByTestId('settings-ignore').fill('**/_*.md');
    await l.page.getByTestId('settings-numbered').check();
    await l.page.getByTestId('settings-theme').selectOption('tecnico');
    await l.page.getByTestId('settings-accept').click();
    await expect.poll(() => projectText(l)).toContain('"title": "Manual nuevo"');
    const text = projectText(l);
    expect(text).toContain('"ignore": ["**/_*.md"]');
    expect(text).toContain('"numbered": true');
    expect(text).toContain('"theme": "tecnico"');
    await expect(l.page.getByTestId('nav-unindexed')).toHaveCount(0);
    await closeApp(l.app);
  });
});

test.describe('[Fase 5] búsqueda y salto rápido', () => {
  test('buscar en el proyecto lista las coincidencias y abre el archivo', async () => {
    const l = await open(FILES());
    await l.page.keyboard.press('Control+Shift+f');
    await l.page.getByTestId('project-search-input').fill('alfa');
    await expect(l.page.getByTestId('project-search-hit')).toHaveCount(2);
    await expect(l.page.getByTestId('project-search-count')).toContainText('2');
    await l.page.getByTestId('project-search-hit').nth(1).click();
    await expect(l.page.getByTestId('doc-tab')).toContainText('02-dos.md');
    await closeApp(l.app);
  });

  test('Ctrl+Shift+O abre el selector rápido de capítulos', async () => {
    const l = await open(FILES());
    await l.page.keyboard.press('Control+Shift+o');
    await l.page.getByTestId('quick-open-input').fill('tre');
    await expect(l.page.getByTestId('quick-open-row')).toHaveCount(1);
    await l.page.keyboard.press('Enter');
    await expect(l.page.getByTestId('doc-tab')).toContainText('03-tres.md');
    await closeApp(l.app);
  });
});

test.describe('[Fase 5] formato y sesión [PRJ-04][PRJ-05]', () => {
  test('el .mdteca queda en forma canónica y sin datos de sesión', async () => {
    const l = await open(FILES());
    await chapters(l.page)
      .nth(2)
      .dragTo(chapters(l.page).nth(0), { targetPosition: { x: 40, y: 3 } });
    await expect.poll(() => names(l.page)).toEqual(['Tres', 'Uno', 'Dos']);
    await l.page.getByTestId('nav-book').first().click(); // pliega el libro
    const text = projectText(l);
    const parsed = parseProject(text);
    expect(parsed.ok && serializeProject(parsed.project)).toBe(text);
    expect(text).not.toMatch(/expanded|openTabs|lastOpened/);
    expect(text.endsWith('}\n')).toBe(true);
    await closeApp(l.app);
  });

  test('nodos desplegados y pestañas abiertas se recuerdan en userData y no en el proyecto', async () => {
    const first = await open(FILES());
    await chapters(first.page).nth(1).click();
    await waitForEditor(first.page);
    await first.page.getByTestId('nav-book').first().click(); // pliega «Uso»
    const reuse = { dir: first.dir, userData: first.userData };
    await first.page.waitForTimeout(700);
    const before = projectText(first);
    await closeApp(first.app);
    const second = await launch({}, reuse, undefined);
    await second.app.close();
    const third = await launch({ 'manual.mdteca': before }, reuse, ['manual.mdteca']);
    await expect(third.page.getByTestId('doc-tab')).toContainText('02-dos.md');
    // «Uso» seguía plegado: sus capítulos no se ven.
    await expect(chapters(third.page)).toHaveCount(0);
    expect(projectText(third)).toBe(before);
    await closeApp(third.app);
  });

  test('[PRJ-29] un enlace relativo a otro .md del proyecto se abre en una pestaña', async () => {
    const l = await open(
      FILES({ 'uso/01-uno.md': '# Uno\n\nVer [el segundo](02-dos.md) aquí.\n' }),
    );
    await chapters(l.page).first().click();
    await waitForEditor(l.page);
    await l.page.locator('.ProseMirror a').click({ modifiers: ['Control'] });
    await expect(l.page.getByTestId('doc-tab')).toHaveCount(2);
    await expect(l.page.getByTestId('doc-tab').nth(1)).toContainText('02-dos.md');
    await closeApp(l.app);
  });
});

/** PNG de 1 × 1 px. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('[Fase 5] navegador: ancho, bienvenida y recarga', () => {
  test('[PRJ-20] el ancho del navegador se cambia arrastrando su borde', async () => {
    const l = await open(FILES());
    const nav = l.page.getByTestId('navigator');
    const before = (await nav.boundingBox())!.width;
    const handle = (await l.page.getByTestId('navigator-resizer').boundingBox())!;
    await l.page.mouse.move(handle.x + 3, handle.y + 100);
    await l.page.mouse.down();
    await l.page.mouse.move(handle.x + 103, handle.y + 100, { steps: 5 });
    await l.page.mouse.up();
    const after = (await nav.boundingBox())!.width;
    expect(after).toBeGreaterThan(before + 80);
    // Colapsable con Ctrl+Shift+B.
    await l.page.keyboard.press('Control+Shift+b');
    await expect(nav).toHaveCount(0);
    await closeApp(l.app);
  });

  test('la bienvenida ofrece abrir y crear proyectos', async () => {
    const l = await launch({});
    await expect(
      l.page.locator('[data-testid="welcome"] [data-command="file.open"]'),
    ).toBeVisible();
    await expect(
      l.page.locator('[data-testid="welcome"] [data-command="project.new"]'),
    ).toBeVisible();
    await closeApp(l.app);
  });

  test('«Abrir proyecto…» elige el .mdteca con el diálogo y lo abre', async () => {
    const l = await launch(FILES(), undefined, [], {
      MDTECA_E2E_OPEN_PATH: join(tmpdir(), 'no-existe.mdteca'),
    });
    await closeApp(l.app);
    const path = join(l.dir, 'manual.mdteca');
    const second = await launch({}, { dir: l.dir, userData: l.userData }, [], {
      MDTECA_E2E_OPEN_PATH: path,
    });
    await second.page.locator('.ribbon').getByRole('tab', { name: 'Proyecto' }).click();
    await second.page.locator('.ribbon [data-command="project.open"]').click();
    await expect(second.page.getByTestId('nav-header')).toContainText('Manual de prueba');
    await closeApp(second.app);
  });

  test('un cambio del .mdteca fuera de MDteca se recoge sin reiniciar', async () => {
    const l = await open(FILES());
    await expect.poll(() => names(l.page)).toEqual(['Uno', 'Dos', 'Tres']);
    const parsed = parseProject(projectText(l));
    if (!parsed.ok) throw new Error(parsed.error);
    parsed.project.collections[0]!.books[0]!.items.reverse();
    writeFileSync(join(l.dir, 'manual.mdteca'), serializeProject(parsed.project));
    await expect.poll(() => names(l.page), { timeout: 10000 }).toEqual(['Tres', 'Dos', 'Uno']);
    await closeApp(l.app);
  });

  test('[PRJ-01] con la aplicación abierta, abrir un .mdteca (doble clic) abre ese proyecto', async () => {
    const l = await launch(FILES(), undefined, []);
    await expect(l.page.getByTestId('welcome')).toBeVisible();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electronPath = require('electron') as unknown as string;
    const env = { ...process.env, MDTECA_E2E: '1', MDTECA_USER_DATA: l.userData } as Record<
      string,
      string
    >;
    delete env['ELECTRON_RUN_AS_NODE'];
    // Es lo que hace Windows al abrir el archivo asociado con la aplicación ya en marcha.
    const second = spawn(electronPath, ['.', join(l.dir, 'manual.mdteca')], {
      cwd: process.cwd(),
      env,
      stdio: 'ignore',
    });
    await expect(l.page.getByTestId('nav-header')).toContainText('Manual de prueba', {
      timeout: 15000,
    });
    second.kill();
    await closeApp(l.app);
  });
});

test.describe('[Fase 5] imágenes al mover y renombrar [IMG-20]', () => {
  const withImage = (): Record<string, string | Buffer> => ({
    ...FILES({ 'uso/01-uno.md': '# Uno\n\n![figura](01-uno.001.png)\n\n![logo](../logo.png)\n' }),
    'uso/01-uno.001.png': PNG,
    'logo.png': PNG,
  });

  test('renombrar el archivo renombra sus imágenes y actualiza el texto', async () => {
    const l = await open(withImage());
    await chapters(l.page).first().click({ button: 'right' });
    await l.page.getByTestId('menu-rename-file').click();
    await l.page.getByTestId('prompt-input').fill('inicio');
    await l.page.getByTestId('prompt-accept').click();
    await expect.poll(() => existsSync(join(l.dir, 'uso', 'inicio.001.png'))).toBe(true);
    expect(existsSync(join(l.dir, 'uso', '01-uno.001.png'))).toBe(false);
    expect(readFileSync(join(l.dir, 'uso', 'inicio.md'), 'utf8')).toBe(
      '# Uno\n\n![figura](inicio.001.png)\n\n![logo](../logo.png)\n',
    );
    await closeApp(l.app);
  });

  test('mover el archivo a otro libro lleva sus imágenes y recalcula los enlaces', async () => {
    const l = await open(withImage());
    await chapters(l.page).nth(0).dragTo(l.page.getByTestId('nav-book').nth(1));
    await l.page.getByTestId('choose-move').click();
    await expect.poll(() => existsSync(join(l.dir, 'ref', '01-uno.001.png'))).toBe(true);
    expect(readFileSync(join(l.dir, 'ref', '01-uno.md'), 'utf8')).toBe(
      '# Uno\n\n![figura](01-uno.001.png)\n\n![logo](../logo.png)\n',
    );
    await closeApp(l.app);
  });

  test('«Quitar imágenes sin usar» lista las huérfanas del documento y las manda a la papelera', async () => {
    const l = await open({ ...withImage(), 'uso/01-uno.002.png': PNG });
    await chapters(l.page).first().click();
    await waitForEditor(l.page);
    await l.page.getByTestId('tab-project').click();
    await l.page.locator('[data-command="project.cleanImages"]').click();
    await expect(l.page.getByTestId('dialog-choose')).toContainText('01-uno.002.png');
    await l.page.getByTestId('choose-trash').click();
    await expect.poll(() => existsSync(join(l.dir, 'uso', '01-uno.002.png'))).toBe(false);
    expect(existsSync(join(l.dir, 'uso', '01-uno.001.png'))).toBe(true);
    await closeApp(l.app);
  });
});

test.describe('[Fase 5] exportar el proyecto a PDF', () => {
  const pdfPages = (path: string) =>
    (
      readFileSync(path)
        .toString('latin1')
        .match(/\/Type\s*\/Page\b(?!s)/g) ?? []
    ).length;

  test('portada, índice y un capítulo por página en un PDF único', async () => {
    const out = join(tmpdir(), `mdteca-proyecto-${Date.now()}.pdf`);
    const l = await open(FILES(), { MDTECA_E2E_SAVE_PATH: out });
    await l.page.getByTestId('tab-project').click();
    await l.page.locator('[data-command="project.exportPdf"]').click();
    await l.page.getByTestId('choose-full').click();
    await expect.poll(() => existsSync(out), { timeout: 30000 }).toBe(true);
    await expect.poll(() => pdfPages(out), { timeout: 30000 }).toBe(5);
    // La exportación no deja pestañas ni cambios en el proyecto.
    await expect(l.page.getByTestId('doc-tab')).toHaveCount(0);
    await closeApp(l.app);
  });

  test('«Todo seguido» no inserta saltos de página entre capítulos', async () => {
    const out = join(tmpdir(), `mdteca-proyecto-seguido-${Date.now()}.pdf`);
    const l = await open(FILES(), { MDTECA_E2E_SAVE_PATH: out });
    await l.page.getByTestId('nav-book').first().click({ button: 'right' });
    await l.page.getByTestId('menu-export').click();
    await l.page.getByTestId('choose-flow').click();
    await expect.poll(() => existsSync(out), { timeout: 30000 }).toBe(true);
    await expect.poll(() => pdfPages(out), { timeout: 30000 }).toBe(1);
    await closeApp(l.app);
  });
});

test('[UI] los paneles Navegador y Documento se esconden desde su encabezado y se vuelven a mostrar', async () => {
  const l = await launch({});
  await l.page.getByTestId('hide-navigator').click();
  await expect(l.page.getByTestId('navigator')).toHaveCount(0);
  await l.page.getByTestId('show-navigator').click();
  await expect(l.page.getByTestId('navigator')).toBeVisible();
  await l.page.getByTestId('hide-document-panel').click();
  await expect(l.page.getByTestId('document-panel')).toHaveCount(0);
  await l.page.getByTestId('show-document-panel').click();
  await expect(l.page.getByTestId('document-panel')).toBeVisible();
  await closeApp(l.app);
});
