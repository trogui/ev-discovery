import { Generations } from '@smogon/calc';
import type { StatID } from '@smogon/calc/dist/data/interface.js';

export const gen = Generations.get(0);

export const STAT_IDS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export function toID(text: string | null | undefined) {
  return (text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const SPECIES_ALIASES: Record<string, string> = {
  aegislash: 'Aegislash-Shield',
  floette: 'Floette-Eternal',
};

const EMPTY_ITEMS = new Set(['', 'none', 'nothing', 'noobject', 'noitem']);

type Table = { get(id: never): { name: string } | undefined; [Symbol.iterator](): Iterator<{ id: string; name: string }> };

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function resolver(table: Table, aliases: Record<string, string> = {}) {
  let ids: { id: string; name: string }[] | null = null;
  const memo = new Map<string, string | null>();
  return (text: string | null | undefined): string | null => {
    const id = toID(text);
    if (!id) return null;
    if (memo.has(id)) return memo.get(id)!;
    let name: string | null = aliases[id] ?? table.get(id as never)?.name ?? null;
    if (!name && id.length >= 5) {
      ids ??= [...table].map((entry) => ({ id: entry.id, name: entry.name }));
      let best: { name: string; distance: number } | null = null;
      for (const entry of ids) {
        const distance = levenshtein(id, entry.id);
        if (distance <= 2 && (!best || distance < best.distance)) best = { name: entry.name, distance };
      }
      name = best?.name ?? null;
    }
    memo.set(id, name);
    return name;
  };
}

export const speciesName = resolver(gen.species as unknown as Table, SPECIES_ALIASES);
export const moveName = resolver(gen.moves as unknown as Table);
export const abilityName = resolver(gen.abilities as unknown as Table);
export const natureName = resolver(gen.natures as unknown as Table);
const resolveItem = resolver(gen.items as unknown as Table);

export function itemName(text: string | null | undefined) {
  if (EMPTY_ITEMS.has(toID(text))) return null;
  return resolveItem(text);
}

export function isEmptyItem(text: string | null | undefined) {
  return EMPTY_ITEMS.has(toID(text));
}

export function nature(name: string) {
  return gen.natures.get(toID(name) as never)!;
}

export function isDamagingMove(name: string) {
  const move = gen.moves.get(toID(name) as never);
  return move?.category === 'Physical' || move?.category === 'Special';
}

export function megaForme(species: string, item: string | null) {
  if (!item) return null;
  const stone = gen.items.get(toID(item) as never)?.megaStone;
  return (stone as Record<string, string> | undefined)?.[species] ?? null;
}

export function battleForme(species: string, item: string | null) {
  return megaForme(species, item) ?? species;
}

export function baseSpecies(species: string) {
  const data = gen.species.get(toID(species) as never);
  if (data && /-Mega/.test(data.name) && data.baseSpecies) return data.baseSpecies;
  return species;
}

export function defaultAbility(species: string) {
  return gen.species.get(toID(species) as never)?.abilities?.[0] ?? null;
}

const FIELD_ABILITIES: Record<string, { weather?: string; terrain?: string; intimidate?: true }> = {
  Drought: { weather: 'Sun' },
  Drizzle: { weather: 'Rain' },
  'Sand Stream': { weather: 'Sand' },
  'Snow Warning': { weather: 'Snow' },
  'Grassy Surge': { terrain: 'Grassy' },
  'Psychic Surge': { terrain: 'Psychic' },
  'Electric Surge': { terrain: 'Electric' },
  'Misty Surge': { terrain: 'Misty' },
  Intimidate: { intimidate: true },
};

export function autoField(ability: string | null) {
  return ability ? FIELD_ABILITIES[ability] : undefined;
}
