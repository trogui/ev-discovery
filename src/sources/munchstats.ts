import { abilityName, itemName, moveName, natureName, speciesName } from '../lib/dex.js';
import { fetchCached } from '../lib/http.js';
import { parseSlashSpread } from '../lib/spread.js';
import type { MunchEntry, MunchPokemon } from '../lib/types.js';

const BASE = 'https://www.munchstats.com/champions/doubles';
const CRAWL_DELAY_MS = 10_000;

export type MunchResult = { snapshot: string; ranking: { name: string; rank: number }[]; pokemon: MunchPokemon[]; unresolved: string[] };

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

function parseRanking(html: string) {
  const list = html.match(/<ul id="pokemon-list">([\s\S]*?)<\/ul>/)?.[1] ?? '';
  return [...list.matchAll(/selectPokemon\('([^']+)'\)[\s\S]*?<span class="right-text">#(\d+)<\/span>/g)].map((m) => ({
    name: decode(m[1]),
    rank: Number(m[2]),
  }));
}

function parseSections(html: string) {
  const sections = new Map<string, { label: string; pct: number }[]>();
  for (const chunk of html.split('<h2').slice(1)) {
    const title = decode(chunk.slice(chunk.indexOf('>') + 1, chunk.indexOf('</h2>')).replace(/<[^>]+>/g, ''));
    const entries = [...chunk.matchAll(/<span class="left-text"[^>]*>([^<]+)<\/span>[\s\S]*?<span class="right-text">([\d.]+)%<\/span>/g)].map(
      (m) => ({ label: decode(m[1]), pct: Number(m[2]) / 100 }),
    );
    if (entries.length) sections.set(title, entries);
  }
  return sections;
}

export async function ingestMunchStats(top = 40): Promise<MunchResult> {
  const snapshot = new Date().toISOString().slice(0, 10);
  const unresolved = new Set<string>();
  const page = (name: string) =>
    fetchCached(`munchstats/${snapshot}/${name}.html`, `${BASE}/${encodeURIComponent(name)}`, { minIntervalMs: CRAWL_DELAY_MS });

  const ranking = parseRanking(await page('Rillaboom'));
  if (!ranking.length) throw new Error('MunchStats ranking not found; page layout may have changed');

  const pokemon: MunchPokemon[] = [];
  for (const { name, rank } of ranking.slice(0, top)) {
    const species = speciesName(name);
    if (!species) {
      unresolved.add(`species:${name}`);
      continue;
    }
    const sections = parseSections(await page(name));
    const entries = (title: string, resolve: (s: string) => string | null): MunchEntry[] =>
      (sections.get(title) ?? []).flatMap(({ label, pct }) => {
        const resolved = resolve(label);
        if (!resolved) unresolved.add(`${title}:${label}`);
        return resolved ? [{ name: resolved, pct }] : [];
      });
    const spreads = (sections.get('Stat Point Spreads') ?? []).flatMap(({ label, pct }) => {
      const sp = parseSlashSpread(label);
      return sp ? [{ sp, pct }] : [];
    });
    if (!spreads.length) unresolved.add(`spreads:${name}`);
    pokemon.push({
      species,
      rank,
      moves: entries('Moves', moveName),
      items: entries('Items', itemName),
      abilities: entries('Abilities', abilityName),
      natures: entries('Natures', natureName),
      spreads,
    });
  }

  return { snapshot, ranking, pokemon, unresolved: [...unresolved].sort() };
}
