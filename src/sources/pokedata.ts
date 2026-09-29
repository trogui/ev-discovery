import { abilityName, baseSpecies, battleForme, isEmptyItem, itemName, moveName, natureName, speciesName } from '../lib/dex.js';
import { fetchCached, fetchJsonCached } from '../lib/http.js';
import type { SourceSet } from '../lib/types.js';

const BASE = 'https://www.pokedata.ovh/standingsVGC';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

type Player = {
  name: string;
  placing: number;
  decklist?: { name?: string; ability?: string | null; item?: string | null; stat_alignment?: string | null; badges?: string[] }[];
};

export type PokedataEvent = { id: string; name: string; date: string };

export type RegionalEvent = PokedataEvent & { players: number; lists: number; sets: number };

export type PokedataResult = { events: RegionalEvent[]; sets: SourceSet[]; unresolved: string[] };

const FORME_SUFFIX: Record<string, string> = {
  'hisuian form': '-Hisui',
  'alolan form': '-Alola',
  'galarian form': '-Galar',
  female: '-F',
  male: '',
  'eternal flower': '-Eternal',
  'dusk form': '-Dusk',
  'midnight form': '-Midnight',
  'midday form': '',
  'family of four': '-Four',
  'family of three': '',
  'masterpiece form': '-Masterpiece',
  'unremarkable form': '',
  'white plumage': '-White',
  'amped form': '',
  'low key form': '-Low-Key',
};

function pokedataSpecies(name: string | undefined) {
  const match = name?.match(/^(.+?) \[(.+)\]$/);
  if (!match) return speciesName(name);
  const [, base, label] = match;
  const breed = label.match(/^paldean form - (\w+) breed$/i);
  const rotom = label.match(/^(\w+) rotom$/i);
  const suffix = breed ? `-Paldea-${breed[1]}` : rotom ? `-${rotom[1]}` : FORME_SUFFIX[label.toLowerCase()];
  return suffix === undefined ? null : speciesName(`${base}${suffix}`);
}

export function regionalKey(name: string) {
  const official = name.match(/^(\d{4}) (.+?) Pok[eé]mon/);
  if (official) return `${official[1]}|${official[2].toLowerCase()}`;
  const sheet = name.match(/^(.+?) Regional (\d{4})$/i);
  return sheet ? `${sheet[2]}|${sheet[1].toLowerCase()}` : null;
}

async function listEvents(since: string) {
  const html = await fetchCached('pokedata/standings-vgc.html', `${BASE}/`, { maxAgeMs: 6 * HOUR });
  const events: PokedataEvent[] = [];
  for (const match of html.matchAll(/location\.href='(\d+)\/'[^>]*>([^<]*)/g)) {
    const label = match[2].replace(/\s+/g, ' ').trim();
    const parts = label.match(/^(.*) - ([A-Za-z]+) (\d+)(?:-(\d+))?, (\d{4})$/);
    const month = MONTHS.indexOf(parts?.[2].toLowerCase() ?? '');
    if (!parts || month < 0) continue;
    const date = new Date(Date.UTC(Number(parts[5]), month, Number(parts[4] ?? parts[3]))).toISOString().slice(0, 10);
    if (date >= since && Date.parse(date) <= Date.now()) events.push({ id: match[1], name: parts[1], date });
  }
  return events;
}

export async function ingestPokedata(since: string): Promise<PokedataResult> {
  const unresolved = new Set<string>();
  const sets: SourceSet[] = [];
  const events: RegionalEvent[] = [];

  for (const event of await listEvents(since)) {
    const settled = Date.now() - Date.parse(event.date) > 10 * DAY;
    let players: Player[] = [];
    try {
      players = await fetchJsonCached<Player[]>(`pokedata/${event.id}.json`, `${BASE}/${event.id}/masters/${event.id}_Masters.json`, {
        maxAgeMs: settled ? undefined : 6 * HOUR,
        minIntervalMs: 500,
      });
    } catch {}
    const before = sets.length;
    for (const player of players) {
      for (const mon of player.decklist ?? []) {
        const species = pokedataSpecies(mon.name);
        if (!species) {
          unresolved.add(`species:${mon.name}`);
          continue;
        }
        const item = itemName(mon.item);
        if (mon.item && !item && !isEmptyItem(mon.item)) unresolved.add(`item:${mon.item}`);
        const moves = (mon.badges ?? []).filter(Boolean).map((m) => {
          const name = moveName(m);
          if (!name) unresolved.add(`move:${m}`);
          return name;
        });
        sets.push({
          species: baseSpecies(species),
          forme: battleForme(species, item),
          item,
          ability: abilityName(mon.ability),
          nature: natureName(mon.stat_alignment),
          moves: moves.filter((m): m is string => !!m),
          sp: null,
          origin: `pokedata:${event.id}:${player.name}`,
          date: event.date,
          regional: true,
          weight: 1,
        });
      }
    }
    events.push({ ...event, players: players.length, lists: players.filter((p) => p.decklist?.length).length, sets: sets.length - before });
  }

  return { events, sets, unresolved: [...unresolved].sort() };
}
