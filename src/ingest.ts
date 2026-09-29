import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { applyWeights, mergePokemon, newestDate } from './merge.js';
import { buildPresets } from './presets.js';
import type { Meta, SourceSet } from './lib/types.js';
import { ingestLimitless } from './sources/limitless.js';
import { ingestMunchStats } from './sources/munchstats.js';
import { ingestVgcPastes } from './sources/vgcpastes.js';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const REGULATION = 'M-C';

const { values } = parseArgs({ options: { top: { type: 'string', default: '40' } } });
const top = Number(values.top);

async function writeJson(name: string, data: unknown) {
  await writeFile(join(DATA_DIR, name), JSON.stringify(data, null, 1) + '\n');
}

function bySpecies(sets: SourceSet[]) {
  const map = new Map<string, SourceSet[]>();
  for (const set of sets) map.set(set.species, [...(map.get(set.species) ?? []), set]);
  return map;
}

const log = (message: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);

log(`ingest ${REGULATION}, top ${top}`);
const [limitless, pastes] = await Promise.all([ingestLimitless(REGULATION), ingestVgcPastes(REGULATION)]);
log(`limitless: ${limitless.tournaments.length} tournaments, ${limitless.sets.length} sets, ${limitless.unresolved.length} unresolved`);
log(`vgcpastes: ${pastes.teams.length} teams, ${pastes.sets.length} sets, ${pastes.rejected.length} rejected, ${pastes.unresolved.length} unresolved`);
log(`munchstats: fetching top ${top} (crawl delay 10s, cached per day)`);
const munch = await ingestMunchStats(top);
log(`munchstats: snapshot ${munch.snapshot}, ${munch.pokemon.length} pokemon, ${munch.unresolved.length} unresolved`);

const anchor = newestDate([...limitless.sets, ...pastes.sets]);
const limitlessSets = applyWeights(limitless.sets, anchor);
const pasteSets = applyWeights(pastes.sets, anchor);
log(`weights anchored at ${new Date(anchor).toISOString().slice(0, 10)}`);

await mkdir(join(DATA_DIR, 'normalized'), { recursive: true });
await writeJson('normalized/limitless.json', { tournaments: limitless.tournaments, unresolved: limitless.unresolved, sets: limitlessSets });
await writeJson('normalized/vgcpastes.json', { teams: pastes.teams, rejected: pastes.rejected, unresolved: pastes.unresolved, sets: pasteSets });
await writeJson('normalized/munchstats.json', munch);

const tournamentBySpecies = bySpecies(limitlessSets);
const pasteBySpecies = bySpecies(pasteSets);
const meta: Meta = {
  generatedAt: new Date().toISOString(),
  regulation: REGULATION,
  sources: {
    limitlessTournaments: limitless.tournaments.length,
    limitlessSets: limitless.sets.length,
    pasteTeams: pastes.teams.length,
    pasteSets: pastes.sets.length,
    munchstatsSnapshot: munch.snapshot,
  },
  pokemon: munch.pokemon.map((p) => mergePokemon(p, tournamentBySpecies.get(p.species) ?? [], pasteBySpecies.get(p.species) ?? [])),
};
await writeJson('meta.json', meta);
const presets = buildPresets(REGULATION, limitlessSets, pasteSets);
await writeFile(join(DATA_DIR, 'presets.json'), JSON.stringify(presets) + '\n');

const confidence = new Map<string, number>();
for (const p of meta.pokemon) for (const s of p.sets) confidence.set(s.confidence, (confidence.get(s.confidence) ?? 0) + 1);
log(`presets.json: ${presets.species.length} species, ${presets.species.reduce((n, p) => n + p.presets.length, 0)} presets`);
log(`meta.json: ${meta.pokemon.length} pokemon, ${meta.pokemon.reduce((n, p) => n + p.sets.length, 0)} sets ${JSON.stringify(Object.fromEntries(confidence))}`);
