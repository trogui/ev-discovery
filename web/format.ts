import type { Stats } from '../src/lib/spread';
import type { CalcRow } from './calc/types';
import { chanceOf, displayLevel, type Band, type Level, type Targets } from './ko';

const STAT_LABELS: [keyof Stats, string][] = [
  ['hp', 'HP'],
  ['atk', 'Atk'],
  ['def', 'Def'],
  ['spa', 'SpA'],
  ['spd', 'SpD'],
  ['spe', 'Spe'],
];

export function formatSp(sp: Stats) {
  const parts = STAT_LABELS.filter(([k]) => sp[k] > 0).map(([k, label]) => `${sp[k]} ${label}`);
  return parts.length ? parts.join(' / ') : 'No SPs';
}

export function formeSuffix(forme: string, species: string) {
  return forme !== species && forme.startsWith(species) ? forme.slice(species.length + 1) : forme !== species ? forme : '';
}

export const pct = (x: number, digits = 1) => `${x.toFixed(digits)}%`;

export type Status = 'good' | 'warning' | 'serious' | 'critical';
export type Tone = Status | 'neutral';

export function favorability(row: Pick<CalcRow, 'direction' | 'koChance' | 'ko2Chance'>, level: Level) {
  const chance = chanceOf(row, level);
  return row.direction === 'in' ? 1 - chance : chance;
}

export function statusOf(row: Pick<CalcRow, 'direction' | 'koChance' | 'ko2Chance'>, level: Level): Status {
  const f = favorability(row, level);
  if (f >= 1) return 'good';
  if (f >= 0.5) return 'warning';
  if (f > 0) return 'serious';
  return 'critical';
}

export function toneOf(row: Pick<CalcRow, 'direction' | 'koChance' | 'ko2Chance'>, level: Level): Tone {
  if (level === 2) return 'neutral';
  const status = statusOf(row, level);
  return row.direction === 'out' && status === 'critical' ? 'neutral' : status;
}

export function outcomeText(row: Pick<CalcRow, 'direction' | 'koChance' | 'ko2Chance' | 'note'>, level: Level) {
  const chance = chanceOf(row, level);
  const ko = Math.round(chance * 1000) / 10;
  const label = level === 1 ? 'OHKO' : '2HKO';
  const safe = row.direction === 'in' ? (level === 1 ? 'Survives' : 'Survives 2 hits') : `No ${label}`;
  if (level === 1 && row.note && chance === 0) return `${safe} (${row.note})`;
  if (ko === 0) return safe;
  if (ko === 100) return label;
  return `${ko}% ${label}`;
}

export function closestCall<T extends CalcRow>(rows: T[], band: Band, targets: Targets) {
  if (!rows.length) return null;
  const scored = rows.map((r) => {
    const level = displayLevel(r, band, targets);
    return { r, level, f: favorability(r, level) };
  });
  return scored.reduce((a, b) => (Math.abs(b.f - 0.5) < Math.abs(a.f - 0.5) ? b : a));
}
