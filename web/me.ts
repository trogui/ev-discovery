import { Pokemon } from '@smogon/calc';
import type { StatID } from '@smogon/calc/dist/data/interface.js';
import { abilityName, battleForme, baseSpecies, defaultAbility, gen, isDamagingMove, itemName, moveName, natureName, speciesName, toID } from '../src/lib/dex';
import { parsePaste } from '../src/lib/paste';
import { emptyStats, parseEvLine, type Stats } from '../src/lib/spread';
import type { MySet } from './calc/types';

export type EditableSet = {
  species: string;
  item: string | null;
  ability: string | null;
  nature: string;
  sp: Stats;
  moves: string[];
};

export type ImportResult = { ok: true; sets: EditableSet[]; warnings: string[] } | { ok: false; error: string };

const STAT_EXPORT: [StatID, string][] = [
  ['hp', 'HP'],
  ['atk', 'Atk'],
  ['def', 'Def'],
  ['spa', 'SpA'],
  ['spd', 'SpD'],
  ['spe', 'Spe'],
];

export function importPaste(text: string): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Paste a Showdown set.' };
  const mons = parsePaste(trimmed.includes('\n') ? trimmed : `${trimmed}\n`);
  if (!mons.length) return { ok: false, error: 'Could not read that. Paste the set exactly as Showdown exports it.' };
  const warnings: string[] = [];
  const sets: EditableSet[] = [];
  for (const mon of mons) {
    const resolved = speciesName(mon.species);
    if (!resolved) {
      warnings.push(`"${mon.species}" is not in Pokémon Champions, skipped.`);
      continue;
    }
    const species = baseSpecies(resolved);
    const item = itemName(mon.item);
    if (mon.item && !item) warnings.push(`${species}: unknown item ${mon.item}.`);
    let sp = emptyStats();
    if (mon.evs) {
      const parsed = parseEvLine(mon.evs);
      if (!parsed) {
        warnings.push(`${species}: invalid spread "${mon.evs}", reset to 0.`);
      } else {
        sp = parsed.sp;
        if (parsed.converted) warnings.push(`${species}: classic EVs converted to Stat Points.`);
      }
    }
    sets.push({
      species,
      item,
      ability: abilityName(mon.ability),
      nature: natureName(mon.nature) ?? 'Serious',
      sp,
      moves: mon.moves.map((m) => moveName(m)).filter((m): m is string => !!m).slice(0, 4),
    });
  }
  if (!sets.length) return { ok: false, error: warnings[0] ?? 'No Pokémon found.' };
  return { ok: true, sets, warnings };
}

export function exportPaste(set: EditableSet) {
  const sp = STAT_EXPORT.filter(([k]) => set.sp[k] > 0)
    .map(([k, label]) => `${set.sp[k]} ${label}`)
    .join(' / ');
  return [
    `${set.species}${set.item ? ` @ ${set.item}` : ''}`,
    set.ability ? `Ability: ${set.ability}` : null,
    'Level: 50',
    sp ? `EVs: ${sp}` : null,
    `${set.nature} Nature`,
    ...set.moves.filter(Boolean).map((m) => `- ${m}`),
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}

export function buildMySet(set: EditableSet): MySet {
  const forme = battleForme(set.species, set.item);
  const own = set.ability ?? defaultAbility(set.species);
  const ability = forme !== set.species ? defaultAbility(forme) : own;
  const stats = new Pokemon(gen, forme, { nature: set.nature, evs: set.sp, item: set.item ?? undefined, ability: ability ?? undefined }).stats;
  return {
    species: set.species,
    forme,
    item: set.item,
    ability,
    nature: set.nature,
    sp: set.sp,
    moves: set.moves.filter((m) => m && isDamagingMove(m)),
    stats: { ...stats },
  };
}

export const EXAMPLE: EditableSet = {
  species: 'Gengar',
  item: 'Gengarite',
  ability: 'Cursed Body',
  nature: 'Timid',
  sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
  moves: ['Shadow Ball', 'Sludge Bomb', 'Protect', 'Icy Wind'],
};
