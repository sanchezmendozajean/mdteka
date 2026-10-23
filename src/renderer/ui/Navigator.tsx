import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  BookPlus,
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Copy,
  CopyPlus,
  ExternalLink,
  FileDown,
  FilePlus2,
  FileText,
  FolderSearch,
  FolderTree,
  Library,
  Pencil,
  Regex,
  Search,
  Shapes,
  TableOfContents,
  Trash2,
  WholeWord,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  flatten,
  itemTitle,
  type Book,
  type Collection,
  type Project,
  type ProjectItem,
  unindexed,
  type Target,
} from '@shared/project';
import { NAV_MAX, NAV_MIN, saveNavWidth, useUi } from '../app/store';
import { openPaths } from '../documents/actions';
import { askIcon, useDocs } from '../documents/store';
import {
  absoluteOf,
  addUnindexed,
  copyRelativePath,
  deleteChapterFile,
  duplicateChapter,
  locateMissing,
  moveChapter,
  newBook,
  newChapter,
  newCollection,
  openHit,
  removeNode,
  renameFile,
  renameNode,
  revealFile,
  runSearch,
  setIcon,
} from '../project/actions';
import { exportProjectPdf } from '../project/export';
import { projectIcon } from '../project/icons';
import { useProject } from '../project/store';
import { CommandButton } from './CommandButton';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { HidePanelButton } from './HidePanelButton';
import { Outline } from './Outline';
import { Icon } from './Icon';

const DRAG_TYPE = 'application/x-mdteca-item';
type Zone = 'before' | 'inside' | 'after';
type Drop = { id: string; zone: Zone } | null;

const norm = (p: string | null | undefined) => (p ?? '').replace(/\\/g, '/').toLowerCase();

interface Ctx {
  project: Project;
  open: Map<string, { dirty: boolean }>;
  activePath: string;
  title: (item: ProjectItem) => string;
  filter: string;
  visible: (item: ProjectItem) => boolean;
  expanded: Set<string>;
  toggle: (id: string) => void;
  menu: (e: React.MouseEvent, items: MenuItem[]) => void;
  drop: Drop;
  setDrop: (d: Drop) => void;
  dragging: React.MutableRefObject<string | null>;
}

function countItems(items: ProjectItem[]): number {
  return items.reduce((n, i) => n + 1 + countItems(i.children ?? []), 0);
}

// ---------------------------------------------------------------------------------------------
// Capítulo
// ---------------------------------------------------------------------------------------------

function ChapterRow({
  item,
  book,
  parentId,
  index,
  depth,
  ctx,
}: {
  item: ProjectItem;
  book: Book;
  parentId: string | null;
  index: number;
  depth: number;
  ctx: Ctx;
}) {
  const { t } = useTranslation();
  const info = useProject((s) => s.info[item.file]);
  const missing = info?.exists === false;
  const kids = (item.children ?? []).filter(ctx.visible);
  const hasKids = (item.children?.length ?? 0) > 0;
  const isOpen = ctx.filter ? true : ctx.expanded.has(item.id);
  const abs = absoluteOf(item);
  const doc = ctx.open.get(norm(abs));
  const active = ctx.activePath === norm(abs);
  const dropHere = ctx.drop?.id === item.id ? ctx.drop.zone : null;
  const label = ctx.title(item);

  const onDrag = (e: DragEvent) => {
    if (!ctx.dragging.current || ctx.dragging.current === item.id) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    ctx.setDrop({ id: item.id, zone: y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'inside' });
  };
  const onDropHere = (e: DragEvent) => {
    const dragged = ctx.dragging.current;
    const zone = ctx.drop?.zone;
    ctx.setDrop(null);
    ctx.dragging.current = null;
    if (!dragged || !zone || dragged === item.id) return;
    e.preventDefault();
    const target: Target =
      zone === 'inside'
        ? { bookId: book.id, parentId: item.id, index: item.children?.length ?? 0 }
        : { bookId: book.id, parentId, index: zone === 'before' ? index : index + 1 };
    void moveChapter(dragged, target);
  };

  const items: MenuItem[] = [
    {
      id: 'open',
      label: t('project.open'),
      icon: FileText,
      run: () => void openPaths([abs]),
      hidden: missing,
    },
    {
      id: 'locate',
      label: t('project.locate'),
      icon: FolderSearch,
      run: () => void locateMissing(item.id),
      hidden: !missing,
    },
    {
      id: 'new-sub',
      label: t('project.newSubchapter'),
      icon: FilePlus2,
      run: () => void newChapter(book.id, item.id),
      separator: true,
    },
    {
      id: 'rename',
      label: t('project.renameTitle'),
      icon: Pencil,
      run: () => void renameNode('item', item.id),
    },
    {
      id: 'rename-file',
      label: t('project.renameFile'),
      icon: Pencil,
      run: () => void renameFile(item.id),
      hidden: missing,
    },
    {
      id: 'duplicate',
      label: t('project.duplicate'),
      icon: CopyPlus,
      run: () => void duplicateChapter(item.id),
      hidden: missing,
    },
    {
      id: 'remove',
      label: t('project.removeFromIndex'),
      icon: X,
      run: () => void removeNode('item', item.id),
      separator: true,
    },
    {
      id: 'delete',
      label: t('project.deleteTitle'),
      icon: Trash2,
      danger: true,
      run: () => void deleteChapterFile(item.id),
      hidden: missing,
    },
    {
      id: 'reveal',
      label: t('project.reveal'),
      icon: ExternalLink,
      run: () => revealFile(item.file),
      separator: true,
      hidden: missing,
    },
    {
      id: 'copy-path',
      label: t('project.copyPath'),
      icon: Copy,
      run: () => copyRelativePath(item.file),
    },
  ];

  return (
    <div role="none">
      <div
        role="treeitem"
        tabIndex={0}
        aria-selected={active}
        aria-expanded={hasKids ? isOpen : undefined}
        className={`nav-row nav-chapter${active ? ' active' : ''}${missing ? ' missing' : ''}${dropHere ? ` drop-${dropHere}` : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        data-testid="nav-chapter"
        data-id={item.id}
        data-file={item.file}
        draggable
        onDragStart={(e) => {
          ctx.dragging.current = item.id;
          e.dataTransfer.setData(DRAG_TYPE, item.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          ctx.dragging.current = null;
          ctx.setDrop(null);
        }}
        onDragOver={onDrag}
        onDragLeave={() => ctx.drop?.id === item.id && ctx.setDrop(null)}
        onDrop={onDropHere}
        onClick={() => !missing && void openPaths([abs])}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!missing) void openPaths([abs]);
          } else if (e.key === 'F2') void renameNode('item', item.id);
        }}
        onContextMenu={(e) => ctx.menu(e, items)}
        title={missing ? t('project.missing') : item.file}
      >
        {hasKids ? (
          <button
            className="nav-chevron"
            aria-label={label}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              ctx.toggle(item.id);
            }}
          >
            <Icon icon={isOpen ? ChevronDown : ChevronRight} size={14} />
          </button>
        ) : (
          <span className="nav-chevron" />
        )}
        <Icon icon={FileText} size={15} />
        <span className="nav-label">{label}</span>
        {missing && (
          <>
            <span className="nav-alert" data-testid="nav-missing" title={t('project.missing')}>
              <Icon icon={AlertTriangle} size={14} />
            </span>
            <button
              className="btn btn-mini"
              title={t('project.locate')}
              aria-label={t('project.locate')}
              onClick={(e) => {
                e.stopPropagation();
                void locateMissing(item.id);
              }}
            >
              <Icon icon={FolderSearch} size={14} />
            </button>
            <button
              className="btn btn-mini"
              title={t('project.removeFromIndex')}
              aria-label={t('project.removeFromIndex')}
              data-testid="nav-remove-missing"
              onClick={(e) => {
                e.stopPropagation();
                void removeNode('item', item.id);
              }}
            >
              <Icon icon={X} size={14} />
            </button>
          </>
        )}
        {!missing && doc && (
          <span
            className={`nav-state${doc.dirty ? ' dirty' : ''}`}
            data-testid={doc.dirty ? 'nav-dirty' : 'nav-open'}
            title={doc.dirty ? t('project.stateDirty') : t('project.stateOpen')}
          />
        )}
      </div>
      {hasKids && isOpen && (
        <div role="group" className="nav-children" style={{ marginLeft: 17 + depth * 14 }}>
          {kids.map((child) => (
            <ChapterRow
              key={child.id}
              item={child}
              book={book}
              parentId={item.id}
              index={(item.children ?? []).indexOf(child)}
              depth={depth + 1}
              ctx={ctx}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Libro y colección
// ---------------------------------------------------------------------------------------------

function BookNode({ book, depth, ctx }: { book: Book; depth: number; ctx: Ctx }) {
  const { t } = useTranslation();
  const isOpen = ctx.filter ? true : ctx.expanded.has(book.id);
  const count = countItems(book.items);
  const items = book.items.filter(ctx.visible);
  const dropHere = ctx.drop?.id === book.id ? 'inside' : null;
  const menuItems: MenuItem[] = [
    {
      id: 'new-chapter',
      label: t('project.newChapter'),
      icon: FilePlus2,
      run: () => void newChapter(book.id),
    },
    {
      id: 'export',
      label: t('project.exportBook'),
      icon: FileDown,
      run: () => void exportProjectPdf(book.id),
    },
    {
      id: 'rename',
      label: t('project.rename'),
      icon: Pencil,
      run: () => void renameNode('book', book.id),
      separator: true,
    },
    {
      id: 'icon',
      label: t('project.changeIcon'),
      icon: Shapes,
      run: () =>
        void askIcon(book.icon).then((i) => {
          if (i) void setIcon('book', book.id, i);
        }),
    },
    {
      id: 'remove',
      label: t('project.removeFromIndex'),
      icon: X,
      run: () => void removeNode('book', book.id),
      separator: true,
    },
  ];
  return (
    <div role="none">
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={isOpen}
        className={`nav-row nav-book${dropHere ? ' drop-inside' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        data-testid="nav-book"
        data-id={book.id}
        onClick={() => ctx.toggle(book.id)}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), ctx.toggle(book.id))
        }
        onContextMenu={(e) => ctx.menu(e, menuItems)}
        onDragOver={(e) => {
          if (!ctx.dragging.current) return;
          e.preventDefault();
          ctx.setDrop({ id: book.id, zone: 'inside' });
        }}
        onDragLeave={() => ctx.drop?.id === book.id && ctx.setDrop(null)}
        onDrop={(e) => {
          const dragged = ctx.dragging.current;
          ctx.setDrop(null);
          ctx.dragging.current = null;
          if (!dragged) return;
          e.preventDefault();
          void moveChapter(dragged, { bookId: book.id, parentId: null, index: book.items.length });
        }}
      >
        <span className="nav-chevron">
          <Icon icon={isOpen ? ChevronDown : ChevronRight} size={14} />
        </span>
        <Icon icon={projectIcon(book.icon, BookOpen)} size={16} />
        <span className="nav-label">{book.title}</span>
        <span className="nav-count">{count}</span>
      </div>
      {isOpen && (
        <div role="group" className="nav-children" style={{ marginLeft: 17 + depth * 14 }}>
          {items.map((item) => (
            <ChapterRow
              key={item.id}
              item={item}
              book={book}
              parentId={null}
              index={book.items.indexOf(item)}
              depth={depth + 1}
              ctx={ctx}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionNode({ collection, ctx }: { collection: Collection; ctx: Ctx }) {
  const { t } = useTranslation();
  const isOpen = ctx.filter ? true : ctx.expanded.has(collection.id);
  const books = collection.books.filter((b) => b.items.some(ctx.visible) || !ctx.filter);
  const menuItems: MenuItem[] = [
    {
      id: 'new-book',
      label: t('project.newBook'),
      icon: BookPlus,
      run: () => void newBook(collection.id),
    },
    {
      id: 'rename',
      label: t('project.rename'),
      icon: Pencil,
      run: () => void renameNode('collection', collection.id),
      separator: true,
    },
    {
      id: 'icon',
      label: t('project.changeIcon'),
      icon: Shapes,
      run: () =>
        void askIcon(collection.icon).then((i) => {
          if (i) void setIcon('collection', collection.id, i);
        }),
    },
    {
      id: 'remove',
      label: t('project.removeFromIndex'),
      icon: X,
      run: () => void removeNode('collection', collection.id),
      separator: true,
    },
  ];
  return (
    <div role="none">
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={isOpen}
        className="nav-row nav-collection"
        data-testid="nav-collection"
        data-id={collection.id}
        onClick={() => ctx.toggle(collection.id)}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), ctx.toggle(collection.id))
        }
        onContextMenu={(e) => ctx.menu(e, menuItems)}
      >
        <span className="nav-chevron">
          <Icon icon={isOpen ? ChevronDown : ChevronRight} size={14} />
        </span>
        <Icon icon={projectIcon(collection.icon, FolderTree)} size={16} />
        <span className="nav-label">{collection.title}</span>
        <span className="nav-count" title={t('project.books', { count: collection.books.length })}>
          {collection.books.length}
        </span>
      </div>
      {isOpen && (
        <div role="group" className="nav-children" style={{ marginLeft: 17 }}>
          {books.map((b) => (
            <BookNode key={b.id} book={b} depth={1} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// «Sin indexar» (PRJ-27)
// ---------------------------------------------------------------------------------------------

function Unindexed() {
  const { t } = useTranslation();
  const files = useProject((s) => s.files);
  const project = useProject((s) => s.project);
  const [open, setOpen] = useState(true);
  const list = useMemo(() => (project ? unindexed(project, files) : []), [project, files]);
  if (list.length === 0) return null;
  return (
    <section
      className="nav-unindexed"
      data-testid="nav-unindexed"
      aria-label={t('project.unindexed')}
    >
      <button className="nav-row nav-section" onClick={() => setOpen(!open)}>
        <span className="nav-chevron">
          <Icon icon={open ? ChevronDown : ChevronRight} size={14} />
        </span>
        <span className="nav-label">{t('project.unindexed')}</span>
        <span className="nav-count">{list.length}</span>
      </button>
      {open &&
        list.map((file) => (
          <div
            key={file}
            className="nav-row nav-loose"
            data-testid="nav-unindexed-file"
            data-file={file}
            title={file}
          >
            <Icon icon={FileText} size={15} />
            <span className="nav-label">{file}</span>
            <button
              className="btn btn-mini"
              title={t('project.addToBook')}
              aria-label={t('project.addToBook')}
              data-testid="nav-add-to-book"
              onClick={() => void addUnindexed(file)}
            >
              <Icon icon={BookPlus} size={14} />
            </button>
          </div>
        ))}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Buscar en el proyecto
// ---------------------------------------------------------------------------------------------

function SearchPanel() {
  const { t } = useTranslation();
  const search = useProject((s) => s.search);
  const info = useProject((s) => s.info);
  const project = useProject((s) => s.project)!;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titles = useMemo(
    () =>
      new Map(flatten(project).map((x) => [x.item.file, itemTitle(x.item, info[x.item.file]?.h1)])),
    [project, info],
  );
  const run = (patch: Partial<typeof search>) => {
    clearTimeout(timer.current);
    if ('query' in patch) timer.current = setTimeout(() => void runSearch(patch), 250);
    else void runSearch(patch);
    useProject.getState().set({ search: { ...search, ...patch } });
  };
  const byFile = new Map<string, typeof search.results>();
  for (const hit of search.results) byFile.set(hit.file, [...(byFile.get(hit.file) ?? []), hit]);
  const toggle = (
    icon: LucideIcon,
    label: string,
    key: 'caseSensitive' | 'wholeWord' | 'regex',
  ) => (
    <button
      className="btn btn-mini"
      aria-pressed={search[key]}
      title={label}
      aria-label={label}
      data-testid={`project-search-${key}`}
      onClick={() => run({ [key]: !search[key] })}
    >
      <Icon icon={icon} size={16} />
    </button>
  );
  return (
    <div className="nav-search" data-testid="project-search">
      <div className="nav-search-bar">
        <button
          className="btn btn-mini"
          title={t('project.searchBack')}
          aria-label={t('project.searchBack')}
          data-testid="project-search-back"
          onClick={() => useProject.getState().set({ panel: 'tree' })}
        >
          <Icon icon={ArrowLeft} size={16} />
        </button>
        <input
          className="nav-input"
          data-testid="project-search-input"
          placeholder={t('project.searchPlaceholder')}
          value={search.query}
          onChange={(e) => run({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') useProject.getState().set({ panel: 'tree' });
            e.stopPropagation();
          }}
        />
        {toggle(CaseSensitive, t('find.matchCase'), 'caseSensitive')}
        {toggle(WholeWord, t('find.wholeWord'), 'wholeWord')}
        {toggle(Regex, t('find.regex'), 'regex')}
      </div>
      <div className="nav-results" role="list">
        {search.done && search.results.length === 0 && (
          <div className="panel-empty">{t('project.searchNone')}</div>
        )}
        {search.done && search.results.length > 0 && (
          <div className="nav-results-count" data-testid="project-search-count">
            {t('project.searchResults', { count: search.results.length })}
          </div>
        )}
        {[...byFile].map(([file, hits]) => (
          <div key={file} role="listitem">
            <div className="nav-result-file" title={file}>
              <Icon icon={FileText} size={14} />
              <span>{titles.get(file) ?? file}</span>
              <span className="nav-count">{hits.length}</span>
            </div>
            {hits.map((h) => (
              <button
                key={`${h.file}:${h.n}`}
                className="nav-result"
                data-testid="project-search-hit"
                onClick={() => void openHit(h)}
              >
                <span className="nav-result-line">{h.line}</span>
                <span className="nav-result-text">
                  {h.text.slice(0, h.from)}
                  <mark>{h.text.slice(h.from, h.to)}</mark>
                  {h.text.slice(h.to)}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------

function EmptyNavigator(): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="panel-empty" data-testid="navigator-empty">
      <p>{t('panels.emptyNavigator')}</p>
      <div className="nav-empty-actions">
        <CommandButton id="project.open" label />
        <CommandButton id="project.new" label />
        <CommandButton id="project.openAs" label />
      </div>
    </div>
  );
}

export function Navigator() {
  const { t } = useTranslation();
  const project = useProject((s) => s.project);
  const width = useUi((s) => s.navigatorWidth);
  const leftTab = useUi((s) => s.leftTab);
  const info = useProject((s) => s.info);
  const expandedIds = useProject((s) => s.expanded);
  const filter = useProject((s) => s.filter);
  const panel = useProject((s) => s.panel);
  const docs = useDocs((s) => s.docs);
  const activeId = useDocs((s) => s.activeId);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const dragging = useRef<string | null>(null);

  const open = useMemo(
    () =>
      new Map(docs.flatMap((d) => (d.path ? [[norm(d.path), { dirty: d.dirty }] as const] : []))),
    [docs],
  );
  const activePath = norm(docs.find((d) => d.id === activeId)?.path);
  const expanded = useMemo(() => new Set(expandedIds), [expandedIds]);

  const ctx: Ctx | null = useMemo(() => {
    if (!project) return null;
    const needle = filter.trim().toLowerCase();
    const title = (item: ProjectItem) => itemTitle(item, info[item.file]?.h1);
    const visible = (item: ProjectItem): boolean =>
      !needle || title(item).toLowerCase().includes(needle) || (item.children ?? []).some(visible);
    return {
      project,
      open,
      activePath,
      title,
      filter: needle,
      visible,
      expanded,
      toggle: (id) =>
        useProject.getState().set({
          expanded: expanded.has(id) ? expandedIds.filter((x) => x !== id) : [...expandedIds, id],
        }),
      menu: (e, items) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY, items });
      },
      drop,
      setDrop,
      dragging,
    };
  }, [project, info, filter, open, activePath, expanded, expandedIds, drop]);

  const background: MenuItem[] = [
    {
      id: 'new-collection',
      label: t('project.newCollection'),
      icon: FolderTree,
      run: () => void newCollection(),
    },
    { id: 'new-book', label: t('project.newBook'), icon: BookPlus, run: () => void newBook() },
  ];

  return (
    <aside
      className="panel left"
      data-testid="navigator"
      aria-label={t('panels.navigator')}
      style={{ width }}
    >
      <div
        className="panel-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('project.resize')}
        data-testid="navigator-resizer"
        onPointerDown={(e) => {
          e.preventDefault();
          const handle = e.currentTarget;
          handle.setPointerCapture(e.pointerId);
          const startX = e.clientX;
          const start = width;
          const move = (m: PointerEvent) =>
            useUi.getState().set({
              navigatorWidth: Math.min(NAV_MAX, Math.max(NAV_MIN, start + m.clientX - startX)),
            });
          const up = () => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', up);
            saveNavWidth(useUi.getState().navigatorWidth);
          };
          handle.addEventListener('pointermove', move);
          handle.addEventListener('pointerup', up);
        }}
      />
      <div className="panel-tabs" role="tablist">
        {(['navigator', 'outline'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            className="panel-tab"
            aria-selected={leftTab === tab}
            data-testid={`left-tab-${tab}`}
            onClick={() => useUi.getState().set({ leftTab: tab })}
          >
            <Icon icon={tab === 'navigator' ? Library : TableOfContents} size={16} />
            {t(`panels.${tab}`)}
          </button>
        ))}
        <HidePanelButton side="left" />
      </div>
      {leftTab === 'outline' ? (
        <Outline />
      ) : (
        <>
          {!project || !ctx ? (
            <EmptyNavigator />
          ) : (
            <>
              <div className="nav-header" data-testid="nav-header">
                <span className="nav-project-title" title={project.description ?? project.title}>
                  {project.title}
                </span>
                <CommandButton id="project.search" />
                <CommandButton id="project.settings" />
              </div>
              {panel === 'search' ? (
                <SearchPanel />
              ) : (
                <>
                  <div className="nav-filter">
                    <Icon icon={Search} size={14} />
                    <input
                      className="nav-input"
                      data-testid="nav-filter"
                      placeholder={t('project.filter')}
                      aria-label={t('project.filter')}
                      value={filter}
                      onChange={(e) => useProject.getState().set({ filter: e.target.value })}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div
                    className="nav-tree"
                    role="tree"
                    aria-label={t('panels.navigator')}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, items: background });
                    }}
                  >
                    {project.collections.length === 0 && (
                      <div className="panel-empty">{t('project.emptyBody')}</div>
                    )}
                    {/* Con una sola colección el navegador la oculta (PRJ-11). */}
                    {project.collections.length === 1
                      ? project.collections[0]!.books.filter(
                          (b) => !ctx.filter || b.items.some(ctx.visible),
                        ).map((b) => <BookNode key={b.id} book={b} depth={0} ctx={ctx} />)
                      : project.collections.map((c) => (
                          <CollectionNode key={c.id} collection={c} ctx={ctx} />
                        ))}
                  </div>
                  <Unindexed />
                </>
              )}
            </>
          )}
        </>
      )}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </aside>
  );
}
