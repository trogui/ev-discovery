import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAW_DIR, fetchCached, mapLimit } from './lib/http.js';
import { gen, toID } from './lib/dex.js';

const SHOWDOWN = 'https://play.pokemonshowdown.com';
const OUT = join(import.meta.dirname, '..', 'web', 'public', 'sprites');

function candidates(name: string) {
  const [first, ...rest] = name.split('-');
  const ids = [rest.length ? `${toID(first)}-${toID(rest.join(''))}` : toID(first), toID(name), toID(first)];
  return [...new Set(ids)];
}

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadBinary(cacheKey: string, url: string) {
  const path = join(RAW_DIR, cacheKey);
  if (await exists(path)) return path;
  const response = await fetch(url, { headers: { 'user-agent': 'ev-discovery/1.0 (personal VGC damage-calc tool)' } });
  if (!response.ok) return null;
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  return path;
}

await mkdir(join(OUT, 'pokemon'), { recursive: true });

const itemsJs = await fetchCached('sprites/items.js', `${SHOWDOWN}/data/items.js`);
const itemNames = new Set<string>([...gen.items].map((i) => i.name));
const itemSprites: Record<string, number> = {};
for (const block of itemsJs.split(/\b[a-z0-9]+:\{name:/).slice(1)) {
  const name = block.match(/^"([^"]+)"/)?.[1];
  const sprite = block.match(/spritenum:(\d+)/)?.[1];
  if (name && sprite && itemNames.has(name)) itemSprites[name] = Number(sprite);
}
await writeFile(join(import.meta.dirname, '..', 'web', 'itemSprites.json'), JSON.stringify(itemSprites) + '\n');
const sheet = await downloadBinary('sprites/itemicons-sheet.png', `${SHOWDOWN}/sprites/itemicons-sheet.png`);
if (sheet) await copyFile(sheet, join(OUT, 'itemicons-sheet.png'));

const species = [...gen.species].map((s) => s.name);
const missing: string[] = [];
await mapLimit(species, 4, async (name) => {
  for (const id of candidates(name)) {
    const file = await downloadBinary(`sprites/gen5/${id}.png`, `${SHOWDOWN}/sprites/gen5/${id}.png`);
    if (file) {
      await copyFile(file, join(OUT, 'pokemon', `${toID(name)}.png`));
      return;
    }
  }
  missing.push(name);
});

console.log(`items: ${Object.keys(itemSprites).length}/${itemNames.size} with icons`);
console.log(`pokemon: ${species.length - missing.length}/${species.length} sprites${missing.length ? `, missing: ${missing.join(', ')}` : ''}`);
