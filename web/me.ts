import { Pokemon } from '@smogon/calc';
import { abilityName, battleForme, defaultAbility, gen, isDamagingMove, itemName, moveName, natureName, speciesName } from '../src/lib/dex';
import { parsePaste } from '../src/lib/paste';
import { emptyStats, parseEvLine } from '../src/lib/spread';
import type { MySet } from './calc/types';

export type ParseResult = { ok: true; set: MySet; warnings: string[] } | { ok: false; error: string };

export function parseMySet(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: '' };
  const [mon] = parsePaste(trimmed.includes('\n') ? trimmed : `${trimmed}\n`);
  if (!mon) return { ok: false, error: 'Could not read that. Paste the set exactly as Showdown exports it.' };
  const species = speciesName(mon.species);
  if (!species) return { ok: false, error: `"${mon.species}" is not in Pokémon Champions.` };

  const warnings: string[] = [];
  const item = itemName(mon.item);
  if (mon.item && !item) warnings.push(`Unknown item: ${mon.item}`);
  const forme = battleForme(species, item);
  const ability = forme !== species ? defaultAbility(forme) : (abilityName(mon.ability) ?? defaultAbility(species));
  const nature = natureName(mon.nature) ?? 'Serious';
  if (!mon.nature) warnings.push('No nature, using a neutral one.');

  let sp = emptyStats();
  if (mon.evs) {
    const parsed = parseEvLine(mon.evs);
    if (!parsed) return { ok: false, error: `Invalid spread "${mon.evs}": max 32 per stat and 66 total.` };
    sp = parsed.sp;
    if (parsed.converted) warnings.push('Those looked like classic EVs, converted to Stat Points.');
  } else warnings.push('No spread, all stats at 0.');

  const moves = mon.moves.map((m) => moveName(m)).filter((m): m is string => !!m);
  const attacking = moves.filter(isDamagingMove);
  if (!attacking.length) warnings.push('No damaging moves, so Offense will be empty.');

  const stats = new Pokemon(gen, forme, { nature, evs: sp, item: item ?? undefined, ability: ability ?? undefined }).stats;
  return { ok: true, set: { species, forme, item, ability, nature, sp, moves: attacking, stats: { ...stats } }, warnings };
}

export const EXAMPLE = `Gengar @ Gengarite
Ability: Cursed Body
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Shadow Ball
- Sludge Bomb
- Protect
- Icy Wind`;
