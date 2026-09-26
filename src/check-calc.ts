import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Field, Move, Pokemon, calculate } from '@smogon/calc';
import { gen } from './lib/dex.js';
import type { Meta, MetaSet } from './lib/types.js';

const meta = JSON.parse(await readFile(join(import.meta.dirname, '..', 'data', 'meta.json'), 'utf8')) as Meta;

const toPokemon = (set: MetaSet) =>
  new Pokemon(gen, set.forme, { nature: set.nature, evs: set.sp, item: set.item ?? undefined, ability: set.ability ?? undefined });

function pokeRound(n: number) {
  return n % 1 > 0.5 ? Math.ceil(n) : Math.floor(n);
}

function handDamage(bp: number, atk: number, def: number, stab: number, effectiveness: number, spread: boolean) {
  const base = Math.floor(Math.floor((Math.floor((2 * 50) / 5 + 2) * bp * atk) / def) / 50) + 2;
  const afterSpread = spread ? pokeRound((base * 3072) / 4096) : base;
  return Array.from({ length: 16 }, (_, i) => {
    let damage = Math.floor((afterSpread * (85 + i)) / 100);
    damage = pokeRound(damage * stab);
    return Math.floor(damage * effectiveness);
  });
}

const handCases = [
  { attacker: 'Garchomp', nature: 'Jolly', atkSp: 32, defender: 'Gholdengo', defSp: 0, hpSp: 32, move: 'Earthquake', spread: false },
  { attacker: 'Garchomp', nature: 'Jolly', atkSp: 32, defender: 'Gholdengo', defSp: 0, hpSp: 32, move: 'Earthquake', spread: true },
  { attacker: 'Sneasler', nature: 'Adamant', atkSp: 32, defender: 'Kingambit', defSp: 10, hpSp: 20, move: 'Close Combat', spread: false },
  { attacker: 'Basculegion', nature: 'Adamant', atkSp: 32, defender: 'Charizard', defSp: 0, hpSp: 2, move: 'Wave Crash', spread: false },
];

let handFailures = 0;
for (const c of handCases) {
  const attacker = new Pokemon(gen, c.attacker, { nature: c.nature, evs: { atk: c.atkSp } });
  const defender = new Pokemon(gen, c.defender, { nature: 'Serious', evs: { hp: c.hpSp, def: c.defSp } });
  const move = new Move(gen, c.move);
  const field = new Field({ gameType: c.spread ? 'Doubles' : 'Singles' });
  const result = calculate(gen, attacker, defender, move, field);
  const effectiveness = defender.types.reduce((m, t) => m * (gen.types.get(move.type.toLowerCase() as never)!.effectiveness[t] ?? 1), 1);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const expected = handDamage(move.bp, attacker.stats.atk, defender.stats.def, stab, effectiveness, c.spread && move.target === 'allAdjacent');
  const ok = JSON.stringify(expected) === JSON.stringify(result.damage);
  if (!ok) handFailures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${result.desc()}${ok ? '' : `\n     hand: ${expected.join(',')}\n     calc: ${String(result.damage)}`}`);
}

let calcs = 0;
const errors: string[] = [];
const dummy = new Pokemon(gen, 'Incineroar', { nature: 'Careful', evs: { hp: 32, spd: 32 } });
const field = new Field({ gameType: 'Doubles' });
const start = performance.now();
for (const mon of meta.pokemon) {
  for (const set of mon.sets) {
    try {
      const attacker = toPokemon(set);
      if (!attacker.stats.hp || Object.values(attacker.stats).some((v) => !Number.isFinite(v))) errors.push(`${set.forme}: bad stats`);
      for (const name of set.moves) {
        const result = calculate(gen, attacker, dummy, new Move(gen, name), field);
        calcs++;
        const range = result.range();
        if (!Number.isFinite(range[0]) || !Number.isFinite(range[1])) errors.push(`${set.forme} ${name}: bad range`);
      }
      calculate(gen, dummy, attacker, new Move(gen, 'Flare Blitz'), field);
      calcs++;
    } catch (error) {
      errors.push(`${mon.species} ${set.forme} @ ${set.item}: ${(error as Error).message}`);
    }
  }
}
console.log(`\nmeta sets: ${calcs} calcs in ${(performance.now() - start).toFixed(0)} ms, ${errors.length} errors`);
for (const e of errors.slice(0, 20)) console.log(`  ${e}`);
if (handFailures || errors.length) process.exitCode = 1;
