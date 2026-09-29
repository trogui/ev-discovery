import { abilityName, baseSpecies, battleForme, isEmptyItem, itemName, moveName, natureName, speciesName } from '../lib/dex.js';
import { fetchCached, mapLimit } from '../lib/http.js';
import { parsePaste } from '../lib/paste.js';
import { parseEvLine } from '../lib/spread.js';
import type { SourceSet } from '../lib/types.js';

const SHEET_ID = '1axlwmzPA49rYkqXh7zHvAtSP-TKbM0ijGYBPRflLSWw';
const SHEET_TABS: Record<string, string> = { 'M-C': '2001945654' };
const HOUR = 3_600_000;
const REGIONAL_EVENT = /regional|international|world/i;
const SIDE_EVENT = /challenge|cup|side|local/i;

const isoDate = (text: string) => {
  const time = Date.parse(`${text} UTC`);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : '';
};

export type PasteTeam = { teamId: string; url: string; date: string; event: string; rank: string; regional: boolean };

export type VgcPastesResult = {
  teams: PasteTeam[];
  sets: SourceSet[];
  convertedFromEvs: number;
  rejected: string[];
  unresolved: string[];
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function listTeams(regulation: string) {
  const gid = SHEET_TABS[regulation];
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const rows = parseCsv(await fetchCached(`vgcpastes/sheet-${regulation}.csv`, url, { maxAgeMs: 6 * HOUR }));
  const headerIndex = rows.findIndex((r) => r[0] === 'Team ID');
  const header = rows[headerIndex];
  const col = (name: string) => header.findIndex((h) => h.trim().startsWith(name));
  const [id, paste, evs, date, event, rank] = ['Team ID', 'Pokepaste', 'EVs', 'Date Shared', 'Tournament', 'Rank'].map(col);
  return rows
    .slice(headerIndex + 1)
    .filter((r) => /^M[A-Z]\d+$/.test(r[id] ?? '') && r[evs] === 'Yes' && /pokepast\.es\/[0-9a-f]+/.test(r[paste]))
    .map((r) => ({
      teamId: r[id],
      url: r[paste].match(/https?:\/\/pokepast\.es\/[0-9a-f]+/)![0],
      date: isoDate(r[date]),
      event: r[event],
      rank: r[rank],
      regional: REGIONAL_EVENT.test(r[event]) && !SIDE_EVENT.test(r[event]),
    }));
}

export async function ingestVgcPastes(regulation = 'M-C'): Promise<VgcPastesResult> {
  const teams = await listTeams(regulation);
  const unresolved = new Set<string>();
  const rejected: string[] = [];
  const sets: SourceSet[] = [];
  let convertedFromEvs = 0;

  const pastes = await mapLimit(teams, 4, async (team) => {
    const id = team.url.split('/').pop()!;
    try {
      return await fetchCached(`vgcpastes/pastes/${id}.txt`, `https://pokepast.es/${id}/raw`, { minIntervalMs: 150 });
    } catch {
      rejected.push(`${team.teamId}: fetch failed`);
      return null;
    }
  });

  teams.forEach((team, i) => {
    const text = pastes[i];
    if (!text) return;
    for (const mon of parsePaste(text)) {
      const species = speciesName(mon.species);
      if (!species) {
        unresolved.add(`species:${mon.species}`);
        continue;
      }
      const spread = mon.evs ? parseEvLine(mon.evs) : null;
      if (!spread) {
        rejected.push(`${team.teamId} ${species}: bad spread "${mon.evs}"`);
        continue;
      }
      if (spread.converted) convertedFromEvs++;
      const item = itemName(mon.item);
      if (mon.item && !item && !isEmptyItem(mon.item)) unresolved.add(`item:${mon.item}`);
      const nature = natureName(mon.nature) ?? 'Serious';
      sets.push({
        species: baseSpecies(species),
        forme: battleForme(species, item),
        item,
        ability: abilityName(mon.ability),
        nature,
        moves: mon.moves.map((m) => moveName(m)).filter((m): m is string => !!m),
        sp: spread.sp,
        origin: `vgcpastes:${team.teamId}`,
        date: team.date,
        regional: team.regional,
        weight: 1,
      });
    }
  });

  return { teams, sets, convertedFromEvs, rejected, unresolved: [...unresolved].sort() };
}
