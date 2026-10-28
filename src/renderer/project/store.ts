import { create } from 'zustand';
import { basenameOf, dirnameOf, joinPath, type Project } from '@shared/project';

/** Estado del proyecto abierto (05). El texto del `.mdtor` es la fuente; esto es su lectura. */
export interface FileInfo {
  exists: boolean;
  h1?: string;
}

export interface ProjectSuggestion {
  /** Documento que se abrió suelto. */
  docPath: string;
  /** `.mdtor` al que pertenece. */
  projectPath: string;
  title: string;
}

export interface SearchState {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  results: { file: string; n: number; line: number; text: string; from: number; to: number }[];
  /** La búsqueda ya se ejecutó con estos valores (distingue «sin resultados» de «sin buscar»). */
  done: boolean;
}

interface ProjectStore {
  project: Project | null;
  /** Ruta absoluta del `.mdtor`. */
  path: string | null;
  /** Carpeta del proyecto (ruta absoluta). */
  root: string | null;
  /** Existencia y primer título de cada archivo indexado, por ruta del proyecto. */
  info: Record<string, FileInfo>;
  /** Todos los `.md` de la carpeta que no están en `ignore`. */
  files: string[];
  /** Ids de colecciones, libros y capítulos desplegados. */
  expanded: string[];
  filter: string;
  panel: 'tree' | 'search';
  suggestion: ProjectSuggestion | null;
  search: SearchState;
  set: (patch: Partial<Omit<ProjectStore, 'set'>>) => void;
}

export const useProject = create<ProjectStore>((set) => ({
  project: null,
  path: null,
  root: null,
  info: {},
  files: [],
  expanded: [],
  filter: '',
  panel: 'tree',
  suggestion: null,
  search: {
    query: '',
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    results: [],
    done: false,
  },
  set: (patch) => set(patch),
}));

const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();

/** ¿Está el archivo dentro de la carpeta del proyecto abierto? */
export function inProject(path: string | null): boolean {
  const { root } = useProject.getState();
  return !!(root && path && norm(path).startsWith(`${norm(root).replace(/\/$/, '')}/`));
}

/** Ruta del proyecto (relativa, con `/`) de un archivo absoluto, o null si no está dentro. */
export function projectRelative(path: string): string | null {
  const { root } = useProject.getState();
  if (!root || !inProject(path)) return null;
  return path.replace(/\\/g, '/').slice(root.replace(/\\/g, '/').replace(/\/$/, '').length + 1);
}

/** Ruta absoluta (con el separador de la carpeta del proyecto) de una ruta del proyecto. */
export function absolutePath(rel: string, root = useProject.getState().root): string {
  if (!root) return rel;
  const sep = root.includes('\\') ? '\\' : '/';
  return `${root.replace(/[\\/]$/, '')}${sep}${rel.split('/').join(sep)}`;
}

/** Defaults del proyecto que heredan los documentos de su carpeta (04). */
export function defaultsOfProject(path: string | null): Record<string, unknown> | null {
  const { project } = useProject.getState();
  return project && inProject(path) ? (project.defaults ?? null) : null;
}

/** Igual que `defaultsOfProject`, reactivo (el objeto es estable mientras no cambien los defaults). */
export function useProjectDefaults(path: string | null): Record<string, unknown> | null {
  return useProject((s) => {
    const root = s.root;
    if (!s.project || !root || !path) return null;
    return norm(path).startsWith(`${norm(root).replace(/\/$/, '')}/`)
      ? (s.project.defaults ?? null)
      : null;
  });
}

export { basenameOf, dirnameOf, joinPath };
