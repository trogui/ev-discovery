import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { spreadKey } from './lib/spread.js';
import type { Meta, MunchPokemon, SourceSet } from './lib/types.js';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const { values } = parseArgs({ options: { top: { type: 'string', default: '40' }, verbose: { type: 'boolean', default: false } } });

const read = async <T>(name: string) => JSON.parse(await readFile(join(DATA_DIR, name), 'utf8')) as T;
const pct = (x: number) => `${(x * 100).toFixed(1).padStart(5)}%`;

function shares(sets: SourceSet[], pick: (s: SourceSet) => string[]) {
  const counts = new Map<string, number>();
  for (const set of sets) for (const key of new Set(pick(set))) counts.set(key, (counts.get(key) ?? 0) + 1);
  return new Map([...counts].map(([k, v]) => [k, v / sets.length]));
}

const top = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);

function totalVariation(a: Map<string, number>, b: Map<string, number>) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let sum = 0;
  for (const k of keys) sum += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
  return sum / 2;
}

const meta = await read<Meta>('meta.json');
const limitless = await read<{ sets: SourceSet[] }>('normalized/limitless.json');
const pastes = await read<{ sets: SourceSet[] }>('normalized/vgcpastes.json');
const munch = await read<{ pokemon: MunchPokemon[] }>('normalized/munchstats.json');

const rows: string[] = [];
const flagged: string[] = [];
for (const mon of meta.pokemon.slice(0, Number(values.top))) {
  const ladder = munch.pokemon.find((p) => p.species === mon.species)!;
  const ours = limitless.sets.filter((s) => s.species === mon.species);
  const ourPastes = pastes.sets.filter((s) => s.species === mon.species);

  const itemsOurs = shares(ours, (s) => (s.item ? [s.item] : []));
  const itemsLadder = new Map(ladder.items.map((i) => [i.name, i.pct]));
  const itemTv = totalVariation(itemsOurs, itemsLadder);

  const naturesOurs = shares(ours, (s) => (s.nature ? [s.nature] : []));
  const naturesLadder = new Map(ladder.natures.map((n) => [n.name, n.pct]));
  const natureTv = totalVariation(naturesOurs, naturesLadder);

  const spreadsPaste = shares(ourPastes, (s) => [spreadKey(s.sp!)]);
  const spreadsLadder = new Map(ladder.spreads.map((s) => [spreadKey(s.sp), s.pct]));
  const topLadderSpread = top(spreadsLadder, 1)[0];
  const topPasteSpreads = top(spreadsPaste, 3).map(([k]) => k);
  const spreadMatch = !topLadderSpread || topPasteSpreads.includes(topLadderSpread[0]);

  const coverage = mon.sets.reduce((sum, s) => sum + s.weight, 0);
  const row = `#${String(mon.rank).padStart(2)} ${mon.species.padEnd(16)} n=${String(ours.length).padStart(4)}/${String(ourPastes.length).padStart(3)}  items TV ${pct(itemTv)}  natures TV ${pct(natureTv)}  top ladder spread in top-3 pastes: ${spreadMatch ? 'yes' : 'NO '}  sets ${mon.sets.length} cover ${pct(coverage)}`;
  rows.push(row);
  if (itemTv > 0.2 || natureTv > 0.2 || !spreadMatch) flagged.push(mon.species);

  if (values.verbose || itemTv > 0.2 || natureTv > 0.2) {
    const detail = (label: string, a: Map<string, number>, b: Map<string, number>) =>
      `    ${label}: ` + [...new Set([...top(a, 4), ...top(b, 4)].map(([k]) => k))].map((k) => `${k} ${pct(a.get(k) ?? 0)}/${pct(b.get(k) ?? 0)}`).join(' · ');
    rows.push(detail('items   tournaments/ladder', itemsOurs, itemsLadder));
    rows.push(detail('natures tournaments/ladder', naturesOurs, naturesLadder));
  }
  if (values.verbose || !spreadMatch) rows.push(`    spreads ladder top: ${top(spreadsLadder, 3).map(([k, v]) => `${k} ${pct(v)}`).join(' · ')} | pastes top: ${top(spreadsPaste, 3).map(([k, v]) => `${k} ${pct(v)}`).join(' · ')}`);
}

console.log('Tournaments (Limitless + VGCPastes) vs in-game ladder (MunchStats). TV = total variation distance, 0% identical, 100% disjoint.\n');
console.log(rows.join('\n'));
console.log(`\nflagged (${flagged.length}): ${flagged.join(', ') || 'none'}`);
