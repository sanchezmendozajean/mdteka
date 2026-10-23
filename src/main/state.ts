import { app } from 'electron';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
  return loadProjects()[key(path)] ?? { expanded: [], open: [], active: null };
}

export function setProjectState(path: string, state: ProjectState): void {
  loadProjects()[key(path)] = state;
  mkdirSync(dirname(projectFile()), { recursive: true });
  const tmp = `${projectFile()}.tmp`;
  writeFileSync(tmp, JSON.stringify(projects));
  renameSync(tmp, projectFile());
}

export function setViewState(path: string, state: ViewState): void {
  load()[key(path)] = state;
  mkdirSync(dirname(file()), { recursive: true });
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache));
  renameSync(tmp, file());
}
