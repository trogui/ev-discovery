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
  if (!mon) return { ok: false, error: 'No entiendo el formato. Pega el set tal cual lo exporta Showdown.' };
  const species = speciesName(mon.species);
  if (!species) return { ok: false, error: `No encuentro "${mon.species}" en Champions.` };

  const warnings: string[] = [];
  const item = itemName(mon.item);
  if (mon.item && !item) warnings.push(`Objeto desconocido: ${mon.item}`);
  const forme = battleForme(species, item);
  const ability = forme !== species ? defaultAbility(forme) : (abilityName(mon.ability) ?? defaultAbility(species));
  const nature = natureName(mon.nature) ?? 'Serious';
  if (!mon.nature) warnings.push('Sin naturaleza: uso Serious (neutra).');

  let sp = emptyStats();
  if (mon.evs) {
    const parsed = parseEvLine(mon.evs);
    if (!parsed) return { ok: false, error: `Spread inválido: "${mon.evs}". Máximo 32 por stat y 66 en total.` };
    sp = parsed.sp;
    if (parsed.converted) warnings.push('Los valores parecían EVs clásicos; los he convertido a SPs.');
  } else warnings.push('Sin spread: todo a 0.');

  const moves = mon.moves.map((m) => moveName(m)).filter((m): m is string => !!m);
  const attacking = moves.filter(isDamagingMove);
  if (!attacking.length) warnings.push('Ningún movimiento de daño: solo verás lo que te hacen.');

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
