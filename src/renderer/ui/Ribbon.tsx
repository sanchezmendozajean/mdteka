import { useTranslation } from 'react-i18next';
import { useUi, type RibbonTab } from '../app/store';
import { useDocs } from '../documents/store';
import { CommandButton } from './CommandButton';
import {
  FontPicker,
  LineHeightPicker,
  PresetGallery,
  SizePicker,
  SpacingPicker,
} from './DesignParts';
import { ColumnWidthPicker, MarginsPicker, PaperSizePicker } from './LayoutParts';
import { Group, ImageMenu, StylesGallery, TableGrid } from './RibbonParts';
import { resolveConfig } from '../documents/config';

const TABS: RibbonTab[] = ['file', 'home', 'insert', 'design', 'layout', 'view', 'project'];

function FileTab() {
  const { t } = useTranslation();
  return (
    <>
      <Group label={t('ribbon.groups.document')}>
        <CommandButton id="file.new" large />
        <CommandButton id="file.open" large />
        <CommandButton id="file.save" large />
        <CommandButton id="file.saveAs" large />
        <CommandButton id="file.close" large />
      </Group>
      <Group label={t('ribbon.groups.export')}>
        <CommandButton id="file.exportPdf" large />
        <CommandButton id="file.exportHtml" large />
        <CommandButton id="file.print" large />
      </Group>
    </>
  );
}

function HomeTab() {
  const { t } = useTranslation();
  const inTable = useDocs((s) => s.format.inTable && s.format.mode === 'wysiwyg');
  return (
    <>
      <Group label={t('ribbon.groups.clipboard')}>
        <CommandButton id="clipboard.paste" large />
        <div className="stack">
          <CommandButton id="clipboard.cut" />
          <CommandButton id="clipboard.copy" />
        </div>
        <div className="stack">
          <CommandButton id="clipboard.pastePlain" />
          <CommandButton id="clipboard.pasteMarkdown" />
        </div>
      </Group>
      <Group label={t('ribbon.groups.history')}>
        <CommandButton id="edit.undo" />
        <CommandButton id="edit.redo" />
      </Group>
      <Group label={t('ribbon.groups.styles')}>
        <StylesGallery />
        <CommandButton id="block.quote" />
        <CommandButton id="block.codeBlock" />
      </Group>
      <Group label={t('ribbon.groups.format')}>
        <CommandButton id="format.bold" />
        <CommandButton id="format.italic" />
        <CommandButton id="format.strike" />
        <CommandButton id="format.code" />
        <CommandButton id="format.link" />
        <CommandButton id="format.clear" />
      </Group>
      <Group label={t('ribbon.groups.paragraph')}>
        <CommandButton id="list.bullet" />
        <CommandButton id="list.ordered" />
        <CommandButton id="list.tasks" />
        <CommandButton id="list.indent" />
        <CommandButton id="list.outdent" />
      </Group>
      <Group label={t('ribbon.groups.find')}>
        <div className="stack">
          <CommandButton id="edit.find" label />
          <CommandButton id="edit.replace" label />
        </div>
      </Group>
      {inTable && (
        <Group label={t('ribbon.groups.table')}>
          <CommandButton id="table.addRowBefore" />
          <CommandButton id="table.addRowAfter" />
          <CommandButton id="table.deleteRow" />
          <CommandButton id="table.addColBefore" />
          <CommandButton id="table.addColAfter" />
          <CommandButton id="table.deleteCol" />
          <CommandButton id="table.alignLeft" />
          <CommandButton id="table.alignCenter" />
          <CommandButton id="table.alignRight" />
          <CommandButton id="table.delete" />
        </Group>
      )}
    </>
  );
}

function InsertTab() {
  const { t } = useTranslation();
  return (
    <>
      <Group label={t('ribbon.groups.media')}>
        <ImageMenu />
        <TableGrid />
      </Group>
      <Group label={t('ribbon.groups.blocks')}>
        <CommandButton id="block.codeBlock" large />
        <CommandButton id="block.quote" large />
        <CommandButton id="insert.separator" large />
        <CommandButton id="insert.pageBreak" large />
        <CommandButton id="insert.html" large />
      </Group>
      <Group label={t('ribbon.groups.paragraph')}>
        <CommandButton id="format.link" large />
        <CommandButton id="insert.footnote" large />
        <CommandButton id="list.tasks" large />
        <CommandButton id="insert.date" large />
      </Group>
    </>
  );
}

function DesignTab() {
  const { t } = useTranslation();
  const doc = useDocs((s) => s.docs.find((d) => d.id === s.activeId));
  const eff = resolveConfig(doc);
  const typo = eff.typography;
  const numbered = eff.styles.h1.numbering === true;
  return (
    <>
      <Group label={t('ribbon.groups.docStyles')}>
        <PresetGallery />
      </Group>
      <Group label={t('ribbon.groups.typography')}>
        <FontPicker />
        <div className="stack">
          <SizePicker />
          <LineHeightPicker />
        </div>
        <div className="stack">
          <SpacingPicker />
          <div className="inline-row">
            <CommandButton id="design.alignLeft" pressed={typo.textAlign === 'left'} />
            <CommandButton id="design.alignJustify" pressed={typo.textAlign === 'justify'} />
          </div>
        </div>
      </Group>
      <Group label={t('ribbon.groups.headings')}>
        <CommandButton id="design.editStyles" large />
        <CommandButton id="design.numberedHeadings" large pressed={numbered} />
        <CommandButton id="design.reset" large />
      </Group>
    </>
  );
}

function LayoutTab() {
  const { t } = useTranslation();
  const orientation = useDocs((s) => {
    const d = s.docs.find((x) => x.id === s.activeId);
    return resolveConfig(d).page.orientation ?? 'portrait';
  });
  return (
    <>
      <Group label={t('ribbon.groups.pageSetup')}>
        <PaperSizePicker />
        <CommandButton id="layout.portrait" large pressed={orientation === 'portrait'} />
        <CommandButton id="layout.landscape" large pressed={orientation === 'landscape'} />
        <MarginsPicker />
      </Group>
      <Group label={t('ribbon.groups.pageNumbers')}>
        <CommandButton id="layout.headerFooter" large />
      </Group>
      <Group label={t('ribbon.groups.columnGroup')}>
        <ColumnWidthPicker />
      </Group>
    </>
  );
}

function ViewTab() {
  const { t } = useTranslation();
  const { navigatorOpen, documentPanelOpen, rulerOpen } = useUi();
  const view = useDocs((s) => s.docs.find((d) => d.id === s.activeId)?.view);
  return (
    <>
      <Group label={t('ribbon.groups.mode')}>
        <CommandButton id="view.toggleMode" large />
      </Group>
      <Group label={t('ribbon.groups.viewMode')}>
        <CommandButton id="view.pages" large pressed={view === 'pages'} />
        <CommandButton id="view.continuous" large pressed={view === 'continuous'} />
        <CommandButton id="view.ruler" large pressed={rulerOpen} />
        <CommandButton id="view.saveDefault" large />
      </Group>
      <Group label={t('ribbon.groups.zoom')}>
        <CommandButton id="view.zoomIn" large />
        <CommandButton id="view.zoomOut" large />
        <CommandButton id="view.zoomReset" large />
        <CommandButton id="view.fitWidth" large />
        <CommandButton id="view.fitPage" large />
      </Group>
      <Group label={t('ribbon.groups.panels')}>
        <CommandButton id="view.toggleNavigator" large pressed={navigatorOpen} />
        <CommandButton id="view.toggleDocumentPanel" large pressed={documentPanelOpen} />
        <CommandButton id="view.toggleTheme" large />
      </Group>
    </>
  );
}

const BODIES: Partial<Record<RibbonTab, () => React.JSX.Element>> = {
  file: FileTab,
  home: HomeTab,
  insert: InsertTab,
  design: DesignTab,
  layout: LayoutTab,
  view: ViewTab,
};

export function Ribbon() {
  const { t } = useTranslation();
  const { ribbonTab, ribbonCollapsed, set } = useUi();
  const Body = BODIES[ribbonTab];
  return (
    <div className="ribbon">
      <div className="ribbon-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            className="ribbon-tab"
            aria-selected={ribbonTab === tab}
            data-testid={`tab-${tab}`}
            onClick={() => set({ ribbonTab: tab, ribbonCollapsed: false })}
          >
            {t(`ribbon.${tab}`)}
          </button>
        ))}
      </div>
      {!ribbonCollapsed && (
        <div className="ribbon-body" role="toolbar" aria-label={t(`ribbon.${ribbonTab}`)}>
          {Body ? <Body /> : <span className="ribbon-empty">{t('ribbon.empty')}</span>}
        </div>
      )}
    </div>
  );
}
