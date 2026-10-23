import { app } from 'electron';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Respaldos de recuperación (02, 09): `userData/recovery/<id>.json`. Se escriben cada 30 s mientras
 * un documento tenga cambios sin guardar y se borran al guardarlo o cerrarlo; si la app se cierra
 * de forma inesperada quedan y se ofrecen al abrir (nunca dentro del repositorio del usuario, CFG-01).
 */
export interface RecoveryEntry {
  id: string;
  /** Ruta del documento, o null si aún no se había guardado. */
  path: string | null;
  name: string;
  /** Texto completo tal como se escribiría en disco (con el bloque de configuración). */
  content: string;
  savedAt: number;
}

const dir = () => join(app.getPath('userData'), 'recovery');
const safe = (id: string) => id.replace(/[^A-Za-z0-9-]/g, '');

export function writeRecovery(entry: RecoveryEntry): void {
  mkdirSync(dir(), { recursive: true });
  const target = join(dir(), `${safe(entry.id)}.json`);
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(entry));
  renameSync(tmp, target);
}

export function clearRecovery(id: string): void {
  rmSync(join(dir(), `${safe(id)}.json`), { force: true });
}

export function clearAllRecovery(): void {
  rmSync(dir(), { recursive: true, force: true });
}

export function listRecovery(): RecoveryEntry[] {
  try {
    return readdirSync(dir())
      .filter((n) => n.endsWith('.json'))
      .flatMap((n) => {
        try {
          return [JSON.parse(readFileSync(join(dir(), n), 'utf8')) as RecoveryEntry];
        } catch {
          return []; // respaldo a medias: se ignora
        }
      })
      .sort((a, b) => a.savedAt - b.savedAt);
  } catch {
    return [];
  }
}
