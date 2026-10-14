import fs from 'node:fs/promises';
import path from 'node:path';

export async function safePath(root, relative, extensions) {
  if (typeof relative !== 'string' || !relative || relative.length > 200 || /[\\:\x00-\x1f]/.test(relative) || path.isAbsolute(relative)) throw new Error('Ruta no permitida.');
  const segments = relative.split('/');
  if (segments.some(s => !s || s === '.' || s === '..' || s.startsWith('.') || /[<>"|?*]/.test(s) || /[. ]$/.test(s) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(s))) throw new Error('Ruta no permitida.');
  if (!extensions.includes(path.extname(relative).toLowerCase())) throw new Error('Tipo de archivo no permitido.');
  await fs.mkdir(root, { recursive: true });
  const absoluteRoot = path.resolve(root);
  if ((await fs.lstat(absoluteRoot)).isSymbolicLink()) throw new Error('No se permiten enlaces simbólicos.');
  let current = absoluteRoot;
  for (const part of segments) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('No se permiten enlaces simbólicos.'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  if (!current.startsWith(absoluteRoot + path.sep)) throw new Error('Fuera de la carpeta de JARVIS.');
  return current;
}
export async function listFiles(root, prefix = '') {
  let entries;
  try { entries = await fs.readdir(path.join(root, prefix), { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(root, relative));
    else if (entry.isFile()) files.push(relative);
    if (files.length > 200) throw new Error('Máximo 200 archivos por carpeta.');
  }
  return files.sort();
}
