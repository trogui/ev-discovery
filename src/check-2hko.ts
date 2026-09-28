import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Field, Move, Pokemon, calculate } from '@smogon/calc';
import { recoveryFor, twoHitKoChance } from '../web/calc/twohko';
import { gen } from './lib/dex.js';
import type { Meta } from './lib/types.js';

const meta = JSON.parse(await readFile(join(import.meta.dirname, '..', 'data', 'meta.json'), 'utf8')) as Meta;

const defenders = [
  { forme: 'Incineroar', item: 'Sitrus Berry', nature: 'Careful', evs: { hp: 32, def: 14, spd: 20 } },
  { forme: 'Archaludon', item: 'Leftovers', nature: 'Bold', evs: { hp: 32, def: 1, spd: 24, spe: 9 } },
  { forme: 'Gholdengo', item: 'Choice Specs', nature: 'Modest', evs: { hp: 2, spa: 32, spe: 32 } },
  { forme: 'Farigiraf', item: 'Sitrus Berry', nature: 'Bold', evs: { hp: 27, def: 20, spd: 19 } },
  { forme: 'Garchomp', item: 'Life Orb', nature: 'Jolly', evs: { hp: 2, atk: 32, spe: 32 } },
];
const fields = [{}, { terrain: 'Grassy' }, { weather: 'Sand' }] as const;

let compared = 0;
let mismatches = 0;
let sitrusCompared = 0;
const examples: string[] = [];
for (const d of defenders) {
  for (const f of fields) {
    const field = new Field({ gameType: 'Doubles', ...(f as object) });
    for (const mon of meta.pokemon) {
      for (const set of mon.sets.slice(0, 2)) {
        const attacker = new Pokemon(gen, set.forme, { nature: set.nature, evs: set.sp, item: set.item ?? undefined, ability: set.ability ?? undefined });
        const defender = new Pokemon(gen, d.forme, { nature: d.nature, evs: d.evs, item: d.item });
        for (const moveName of set.moves) {
          const result = calculate(gen, attacker, defender, new Move(gen, moveName), field);
          const damage = result.damage as number[] | number;
          if (!Array.isArray(damage) || Array.isArray(damage[0]) || Math.max(...damage) === 0) continue;
          let ko: { chance?: number; n: number; text?: string };
          try {
            ko = result.kochance();
          } catch {
            continue;
          }
          if (ko.n !== 2 || ko.chance === undefined) continue;
          const dist = new Map<number, number>();
          for (const x of damage) dist.set(x, (dist.get(x) ?? 0) + 1 / damage.length);
          const ours = twoHitKoChance(dist, dist, defender.maxHP(), recoveryFor(defender, { weather: (f as { weather?: string }).weather ?? '', terrain: (f as { terrain?: string }).terrain ?? '', gravity: false }), false);
          compared++;
          const sitrus = d.item === 'Sitrus Berry';
          if (sitrus) sitrusCompared++;
          if (sitrus ? ours > ko.chance + 0.001 : Math.abs(ours - ko.chance) > 0.001) {
            mismatches++;
            if (examples.length < 12) examples.push(`${set.forme} ${moveName} vs ${d.forme} @ ${d.item} ${JSON.stringify(f)}: ours ${(ours * 100).toFixed(2)}% calc ${(ko.chance * 100).toFixed(2)}% (${ko.text ?? ''})`);
          }
        }
      }
    }
  }
}
console.log(`2HKO chance vs @smogon/calc kochance: ${compared} compared (${sitrusCompared} with Sitrus, where calc ignores the berry so ours must be <= calc), ${mismatches} mismatches`);
for (const e of examples) console.log(`  ${e}`);
if (mismatches) process.exitCode = 1;
