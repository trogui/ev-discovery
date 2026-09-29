import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { MERGE_RULES, applyWeights, mergePokemon, newestDate } from './merge.js';
import { buildPresets } from './presets.js';
import type { Meta, SourceSet } from './lib/types.js';
import { ingestLimitless } from './sources/limitless.js';
import { ingestMunchStats } from './sources/munchstats.js';
import { ingestPokedata, regionalKey } from './sources/pokedata.js';
import { ingestVgcPastes } from './sources/vgcpastes.js';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const REGULATION = 'M-C';
const REGULATION_START = '2026-09-09';

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
const [limitless, pastes, pokedata] = await Promise.all([ingestLimitless(REGULATION), ingestVgcPastes(REGULATION), ingestPokedata(REGULATION_START)]);
log(`limitless: ${limitless.tournaments.length} tournaments, ${limitless.sets.length} sets, ${limitless.unresolved.length} unresolved`);
log(`pokedata: ${pokedata.events.length} events, ${pokedata.sets.length} sets, ${pokedata.unresolved.length} unresolved`);
for (const e of pokedata.events) log(`  ${e.date} ${e.name}: ${e.lists}/${e.players} lists, ${e.sets} sets`);
log(`vgcpastes: ${pastes.teams.length} teams, ${pastes.sets.length} sets, ${pastes.rejected.length} rejected, ${pastes.unresolved.length} unresolved`);
log(`munchstats: fetching top ${top} (crawl delay 10s, cached per day)`);
const munch = await ingestMunchStats(top);
log(`munchstats: snapshot ${munch.snapshot} (stats month ${munch.month}), ${munch.pokemon.length} pokemon, ${munch.unresolved.length} unresolved`);

const anchor = newestDate([...limitless.sets, ...pokedata.sets, ...pastes.sets]);
const tournamentSets = applyWeights([...limitless.sets, ...pokedata.sets], anchor);
const pasteSets = applyWeights(pastes.sets, anchor);
log(`weights anchored at ${new Date(anchor).toISOString().slice(0, 10)}`);

await mkdir(join(DATA_DIR, 'normalized'), { recursive: true });
await writeJson('normalized/limitless.json', { tournaments: limitless.tournaments, unresolved: limitless.unresolved, sets: tournamentSets.filter((s) => !s.regional) });
await writeJson('normalized/pokedata.json', { events: pokedata.events, unresolved: pokedata.unresolved, sets: tournamentSets.filter((s) => s.regional) });
await writeJson('normalized/vgcpastes.json', { teams: pastes.teams, rejected: pastes.rejected, unresolved: pastes.unresolved, sets: pasteSets });
await writeJson('normalized/munchstats.json', munch);

const tournamentBySpecies = bySpecies(tournamentSets);
const pasteBySpecies = bySpecies(pasteSets);
const regionals = pokedata.events.map((e) => {
  const key = regionalKey(e.name);
  const teams = pastes.teams.filter((t) => t.regional && regionalKey(t.event) === key).length;
  return { id: e.id, name: e.name, date: e.date, players: e.players, lists: e.lists, pasteTeams: teams, applied: e.lists > 0 };
});
const meta: Meta = {
  generatedAt: new Date().toISOString(),
  regulation: REGULATION,
  sources: {
    limitlessTournaments: limitless.tournaments.length,
    limitlessSets: limitless.sets.length,
    regionalSets: pokedata.sets.length,
    pasteTeams: pastes.teams.length,
    pasteSets: pastes.sets.length,
    munchstatsSnapshot: munch.snapshot,
    munchstatsMonth: munch.month,
    newestEvent: new Date(anchor).toISOString().slice(0, 10),
    regionalWeight: MERGE_RULES.regionalWeight,
    halfLifeDays: MERGE_RULES.halfLifeDays,
    regionals,
  },
  pokemon: munch.pokemon.map((p) => mergePokemon(p, tournamentBySpecies.get(p.species) ?? [], pasteBySpecies.get(p.species) ?? [])),
};
await writeJson('meta.json', meta);
const presets = buildPresets(REGULATION, tournamentSets, pasteSets);
await writeFile(join(DATA_DIR, 'presets.json'), JSON.stringify(presets) + '\n');

const confidence = new Map<string, number>();
for (const p of meta.pokemon) for (const s of p.sets) confidence.set(s.confidence, (confidence.get(s.confidence) ?? 0) + 1);
log(`presets.json: ${presets.species.length} species, ${presets.species.reduce((n, p) => n + p.presets.length, 0)} presets`);
log(`meta.json: ${meta.pokemon.length} pokemon, ${meta.pokemon.reduce((n, p) => n + p.sets.length, 0)} sets ${JSON.stringify(Object.fromEntries(confidence))}`);
