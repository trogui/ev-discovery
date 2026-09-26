import type { CalcRow } from './calc/types';

export type Level = 1 | 2;
export type Targets = { ohko: boolean; twohko: boolean };
export type Band = [number, number];

export const lineOf = (row: Pick<CalcRow, 'line2Pct'>, level: Level) => (level === 1 ? 100 : row.line2Pct);

export const chanceOf = (row: Pick<CalcRow, 'koChance' | 'ko2Chance'>, level: Level) => (level === 1 ? row.koChance : row.ko2Chance);

function levels(targets: Targets): Level[] {
  const out: Level[] = [];
  if (targets.ohko) out.push(1);
  if (targets.twohko) out.push(2);
  return out;
}

function distance(row: CalcRow, [lo, hi]: Band, level: Level) {
  const line = lineOf(row, level);
  const min = (row.minPct / line) * 100;
  const max = (row.maxPct / line) * 100;
  if (max < lo) return lo - max;
  if (min > hi) return min - hi;
  return 0;
}

export function levelInBand(row: CalcRow, band: Band, targets: Targets): Level | null {
  for (const level of levels(targets)) if (distance(row, band, level) === 0) return level;
  return null;
}

export const inBand = (row: CalcRow, band: Band, targets: Targets) => levelInBand(row, band, targets) !== null;

export function bandDistance(row: CalcRow, band: Band, targets: Targets) {
  return Math.min(...levels(targets).map((level) => distance(row, band, level)));
}

export function displayLevel(row: CalcRow, band: Band, targets: Targets): Level {
  const inRange = levelInBand(row, band, targets);
  if (inRange) return inRange;
  const options = levels(targets);
  return options.reduce((best, level) => (distance(row, band, level) < distance(row, band, best) ? level : best), options[0] ?? 1);
}
