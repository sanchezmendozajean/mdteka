import { app } from 'electron';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Estado de sesión por archivo (09, VW-31): vive en `userData/state/`, nunca junto al documento
 * ni en el repositorio. La clave es el hash de la ruta.
 */
interface ViewState {
  zoom: number;
}

const file = () => join(app.getPath('userData'), 'state', 'view.json');
const key = (path: string) => createHash('sha1').update(path.toLowerCase()).digest('hex');

let cache: Record<string, ViewState> | null = null;

function load(): Record<string, ViewState> {
  if (cache) return cache;
  try {
    cache = JSON.parse(readFileSync(file(), 'utf8')) as Record<string, ViewState>;
  } catch {
    cache = {};
  }
  return cache;
}

export function getViewState(path: string): ViewState | null {
  return load()[key(path)] ?? null;
}

/** Estado de sesión de un proyecto (09): nodos expandidos y pestañas abiertas. */
export interface ProjectState {
  expanded: string[];
  open: string[];
  active: string | null;
  /** Vista del navegador: títulos de capítulo o nombres de archivo. */
  navView: 'chapters' | 'files';
}

const projectFile = () => join(app.getPath('userData'), 'state', 'projects.json');
let projects: Record<string, ProjectState> | null = null;

function loadProjects(): Record<string, ProjectState> {
  if (projects) return projects;
  try {
    projects = JSON.parse(readFileSync(projectFile(), 'utf8')) as Record<string, ProjectState>;
  } catch {
    projects = {};
  }
  return projects;
}

export function getProjectState(path: string): ProjectState {
  return {
    expanded: [],
    open: [],
    active: null,
    navView: 'chapters',
    ...loadProjects()[key(path)],
  };
}

export function setProjectState(path: string, state: ProjectState): void {
  loadProjects()[key(path)] = state;
  mkdirSync(dirname(projectFile()), { recursive: true });
  const tmp = `${projectFile()}.tmp`;
  writeFileSync(tmp, JSON.stringify(projects));
  renameSync(tmp, projectFile());
}

const lastFile = () => join(app.getPath('userData'), 'state', 'last.json');

export function getLastProject(): string | null {
  try {
    return (JSON.parse(readFileSync(lastFile(), 'utf8')) as { project: string | null }).project;
  } catch {
    return null;
  }
}

export function setLastProject(path: string | null): void {
  mkdirSync(dirname(lastFile()), { recursive: true });
  writeFileSync(lastFile(), JSON.stringify({ project: path }));
}

export function setViewState(path: string, state: ViewState): void {
  load()[key(path)] = state;
  mkdirSync(dirname(file()), { recursive: true });
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache));
  renameSync(tmp, file());
}

const openDirFile = () => join(app.getPath('userData'), 'state', 'open-dir.json');

/** Carpeta del último archivo abierto con el selector; null si no existe (ya) o no hay ninguna. */
export function getLastOpenDir(): string | null {
  try {
    const dir = (JSON.parse(readFileSync(openDirFile(), 'utf8')) as { dir?: string }).dir;
    return dir && statSync(dir).isDirectory() ? dir : null;
  } catch {
    return null;
  }
}

export function setLastOpenDir(filePath: string): void {
  mkdirSync(dirname(openDirFile()), { recursive: true });
  writeFileSync(openDirFile(), JSON.stringify({ dir: dirname(filePath) }));
}

const RECENT_MAX = 20;
const recentFile = () => join(app.getPath('userData'), 'state', 'recent.json');

function readRecent(): string[] {
  try {
    const list = JSON.parse(readFileSync(recentFile(), 'utf8')) as unknown;
    return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/** Archivos abiertos a propósito (selector, asociación de archivos), el más reciente primero. */
export function addRecent(path: string): void {
  const rest = readRecent().filter((p) => p.toLowerCase() !== path.toLowerCase());
  mkdirSync(dirname(recentFile()), { recursive: true });
  writeFileSync(recentFile(), JSON.stringify([path, ...rest].slice(0, RECENT_MAX)));
}

/** Los recientes que todavía existen. */
export function listRecent(): string[] {
  return readRecent().filter((p) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  });
}
