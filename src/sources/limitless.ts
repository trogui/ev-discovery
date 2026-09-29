import { abilityName, baseSpecies, battleForme, isEmptyItem, itemName, moveName, natureName, speciesName } from '../lib/dex.js';
import { fetchJsonCached, mapLimit } from '../lib/http.js';
import type { SourceSet } from '../lib/types.js';

const API = 'https://play.limitlesstcg.com/api';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const GIMMICK_EVENT = /monotype|gen ?\d+ edition|off[ -]?meta|little ?cup|\blc\b|draft|random|inverse/i;

type Tournament = { id: string; name: string; date: string; format: string; players: number };

type Standing = {
  player: string;
  record?: { wins: number; losses: number; ties: number };
  decklist?: {
    id?: string;
    name?: string;
    item?: string | null;
    ability?: string | null;
    nature?: string | null;
    attacks?: string[];
  }[];
};

export type LimitlessResult = { tournaments: Tournament[]; sets: SourceSet[]; unresolved: string[] };

async function listTournaments(format: string) {
  const all: Tournament[] = [];
  for (let page = 1; ; page++) {
    const url = `${API}/tournaments?game=VGC&format=${format}&limit=100&page=${page}`;
    const batch = await fetchJsonCached<Tournament[]>(`limitless/list-${format}-p${page}.json`, url, { maxAgeMs: 6 * HOUR });
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter((t) => t.format === format && !GIMMICK_EVENT.test(t.name) && Date.parse(t.date) <= Date.now());
}

export async function ingestLimitless(format = 'M-C'): Promise<LimitlessResult> {
  const tournaments = await listTournaments(format);
  const unresolved = new Set<string>();
  const sets: SourceSet[] = [];

  const standings = await mapLimit(tournaments, 4, (t) => {
    const settled = Date.now() - Date.parse(t.date) > 3 * DAY;
    return fetchJsonCached<Standing[]>(`limitless/standings/${t.id}.json`, `${API}/tournaments/${t.id}/standings`, {
      maxAgeMs: settled ? undefined : 6 * HOUR,
      minIntervalMs: 250,
    });
  });

  tournaments.forEach((tournament, i) => {
    for (const standing of standings[i]) {
      for (const mon of standing.decklist ?? []) {
        const species = speciesName(mon.id) ?? speciesName(mon.name);
        if (!species) {
          unresolved.add(`species:${mon.name ?? mon.id}`);
          continue;
        }
        const item = itemName(mon.item);
        if (mon.item && !item && !isEmptyItem(mon.item)) unresolved.add(`item:${mon.item}`);
        const moves = (mon.attacks ?? []).map((m) => {
          const name = moveName(m);
          if (!name) unresolved.add(`move:${m}`);
          return name;
        });
        sets.push({
          species: baseSpecies(species),
          forme: battleForme(species, item),
          item,
          ability: abilityName(mon.ability),
          nature: natureName(mon.nature),
          moves: moves.filter((m): m is string => !!m),
          sp: null,
          origin: `limitless:${tournament.id}:${standing.player}`,
          date: tournament.date.slice(0, 10),
          regional: false,
          weight: 1,
        });
      }
    }
  });

  return { tournaments, sets, unresolved: [...unresolved].sort() };
}
