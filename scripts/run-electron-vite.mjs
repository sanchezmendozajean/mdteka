// Lanza electron-vite sin ELECTRON_RUN_AS_NODE (lo define VS Code y rompe `dev`/`preview`).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const bin = fileURLToPath(
  new URL('../node_modules/electron-vite/bin/electron-vite.js', import.meta.url),
);
const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
