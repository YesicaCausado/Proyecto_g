/**
 * dev-server.sandbox.mjs — TEMPORAL (entorno de auditoría con sandbox)
 * =====================================================================
 * El sandbox del entorno de auditoría bloquea los procesos hijo con stdio
 * 'pipe' (EPERM). Vite 8 (rolldown-vite) llama a exec("net use") en
 * windowsSafeRealPathSync → el spawn falla y rompe la carga del config.
 *
 * Este wrapper:
 *   1. Parchea child_process.exec/execFile/execSync/spawnSync para que
 *      devuelvan un error controlado SIN crear procesos hijo (Vite degrada
 *      con gracia: if (error) return).
 *   2. Importa el config REAL (vite.config.ts) y arranca el dev server real
 *      con configFile: false para que Vite no lo vuelva a empaquetar.
 *
 * En una máquina sin sandbox NO es necesario: usa `npm run dev` normal.
 */
import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sandboxError = () =>
  Object.assign(new Error('exec disabled: sandboxed environment (pipe stdio blocked)'), {
    code: 1,
    killed: false,
  });

const _origSpawn = cp.spawn;
cp.exec = function patchedExec(command, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const child = new cp.ChildProcess();
  if (typeof cb === 'function') process.nextTick(() => cb(sandboxError()));
  return child;
};
cp.execFile = function patchedExecFile(file, args, options, callback) {
  const cb =
    typeof args === 'function' ? args : typeof options === 'function' ? options : callback;
  const child = new cp.ChildProcess();
  if (typeof cb === 'function') process.nextTick(() => cb(sandboxError()));
  return child;
};
cp.execSync = function patchedExecSync() {
  return Buffer.from('');
};
cp.spawnSync = function patchedSpawnSync() {
  return {
    status: 1,
    signal: null,
    stdout: Buffer.from(''),
    stderr: Buffer.from(''),
    error: sandboxError(),
  };
};
// spawn con stdio inherit/ignore sigue funcionando (permitido por el sandbox).
cp.spawn = function patchedSpawn(file, args, options, callback) {
  const cb = typeof args === 'function' ? args : typeof options === 'function' ? options : callback;
  const opts = typeof args === 'object' && args !== null && !Array.isArray(args) && typeof args !== 'function' ? args : options;
  const stdio = opts?.stdio;
  const usesPipes =
    stdio === undefined ||
    stdio === 'pipe' ||
    (Array.isArray(stdio) && stdio.some((s) => s === 'pipe' || s === null));
  if (usesPipes) {
    const child = new cp.ChildProcess();
    if (typeof cb === 'function') process.nextTick(() => cb(sandboxError()));
    return child;
  }
  return _origSpawn(file, args, opts, cb);
};

const { createServer } = await import('vite');

// Leer el config REAL y expandir __dirname a la ruta absoluta del frontend en
// un archivo temporal (Vite hace lo mismo al empaquetarlo como CJS). No se
// define __dirname como global: vite-plugin-pwa detecta `typeof __dirname`
// y resolvería su ../package.json contra este directorio (incorrecto).
const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const configSrc = fs.readFileSync(path.join(frontendDir, 'vite.config.ts'), 'utf-8');
const expanded = configSrc.replaceAll('__dirname', JSON.stringify(frontendDir));
const tmpConfig = path.join(frontendDir, 'vite.config.sandbox.ts');
fs.writeFileSync(tmpConfig, expanded, 'utf-8');
const configModule = await import('./vite.config.sandbox.ts');
const userConfig = configModule.default ?? configModule;
fs.rmSync(tmpConfig, { force: true });

const server = await createServer({
  ...userConfig,
  configFile: false,
});
await server.listen();
server.printUrls();
