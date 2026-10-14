import fs from 'node:fs/promises';
import { listFiles, safePath } from './files.mjs';

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const stopWords = new Set('para como donde cuando quiero puedes sobre desde tambien tengo necesito recuerda dime una unos unas del los las que con por mi mis tus sus este esta esto mas hoy haz crea crear'.split(' '));
export async function searchNotes(vault, query, limit = 5) {
  if (typeof query !== 'string' || query.length > 12000) throw new Error('Consulta de memoria inválida.');
  const terms = [...new Set(normalize(query).match(/[a-z0-9]{3,}/g) || [])].filter(x => !stopWords.has(x)).slice(0, 24);
  if (!terms.length) return [];
  const results = [];
  for (const file of (await listFiles(vault)).filter(x => x.endsWith('.md'))) {
    const target = await safePath(vault, file, ['.md']);
    const content = (await fs.readFile(target, 'utf8')).slice(0, 100000);
    const searchable = normalize(content), filename = normalize(file);
    let score = 0, position = -1;
    for (const term of terms) {
      const index = searchable.indexOf(term);
      if (filename.includes(term)) score += 5;
      if (index >= 0) { score += 1; if (position < 0) position = index; }
    }
    if (score) { const start = Math.max(0, position - 160); results.push({ file, score, excerpt: content.slice(start, start + 900), offset: start }); }
  }
  return results.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file)).slice(0, limit);
}
export async function selectMemory(vault, query, budget = 6000) {
  const sections = [], files = [];
  let remaining = budget;
  const append = (file, content, cap) => {
    if (remaining < 100) return;
    const heading = `--- ${file} ---\n`, room = Math.min(cap, remaining - heading.length - 2);
    if (room <= 0) return;
    const text = heading + content.slice(0, room) + '\n\n';
    sections.push(text); remaining -= text.length; files.push(file);
  };
  for (const [file, cap] of [['NORMAS.md', 1100], ['IDENTIDAD.md', 900], ['PERFIL.md', 1400]]) append(file, await fs.readFile(await safePath(vault, file, ['.md']), 'utf8'), cap);
  if (/web|landing|diseñ|estilo|marca|css|proyecto|portfolio|página/i.test(query)) append('ESTILO.md', await fs.readFile(await safePath(vault, 'ESTILO.md', ['.md']), 'utf8'), 1400);
  for (const result of await searchNotes(vault, query, 6)) if (!files.includes(result.file)) append(result.file, result.excerpt, 700);
  const text = sections.join('');
  return { text, files, characters: text.length, budget };
}
export function recentHistory(history, budget = 12000) {
  const selected = []; let remaining = budget;
  for (const entry of history.slice(-16).reverse()) {
    if (remaining < 100) break;
    const cap = Math.min(remaining, 6000);
    const marker = '\n[Mensaje anterior recortado]';
    const content = entry.content.length > cap ? entry.content.slice(0, Math.max(0, cap - marker.length)) + marker : entry.content;
    selected.unshift({ role: entry.role, content }); remaining -= content.length;
  }
  return selected;
}
