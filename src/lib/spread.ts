import type { StatID } from '@smogon/calc/dist/data/interface.js';
import { STAT_IDS, nature } from './dex.js';

export type Stats = Record<StatID, number>;

export const SP_TOTAL = 66;
export const SP_MAX = 32;

const STAT_LABELS: Record<string, StatID> = {
  hp: 'hp',
  atk: 'atk',
  def: 'def',
  spa: 'spa',
  spd: 'spd',
  spe: 'spe',
};

export function emptyStats(): Stats {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export function evToSp(ev: number) {
  if (ev < 4) return 0;
  return Math.min(SP_MAX, 1 + Math.floor((ev - 4) / 8));
}

export function isValidSp(sp: Stats) {
  const values = STAT_IDS.map((stat) => sp[stat]);
  return values.every((v) => Number.isInteger(v) && v >= 0 && v <= SP_MAX) && values.reduce((a, b) => a + b, 0) <= SP_TOTAL;
}

export function parseSlashSpread(text: string): Stats | null {
  const parts = text.trim().split('/').map((part) => Number(part));
  if (parts.length !== 6 || parts.some((n) => !Number.isFinite(n))) return null;
  const sp = emptyStats();
  STAT_IDS.forEach((stat, i) => (sp[stat] = parts[i]));
  return isValidSp(sp) ? sp : null;
}

export function parseEvLine(text: string): { sp: Stats; converted: boolean } | null {
  const raw = emptyStats();
  for (const chunk of text.split('/')) {
    const match = chunk.trim().match(/^(\d+)\s+([A-Za-z]+)$/);
    if (!match) return null;
    const stat = STAT_LABELS[match[2].toLowerCase()];
    if (!stat) return null;
    raw[stat] = Number(match[1]);
  }
  if (isValidSp(raw)) return { sp: raw, converted: false };
  const sp = emptyStats();
  for (const stat of STAT_IDS) sp[stat] = evToSp(raw[stat]);
  return isValidSp(sp) ? { sp, converted: true } : null;
}

export function spreadKey(sp: Stats) {
  return STAT_IDS.map((stat) => sp[stat]).join('/');
}

export function spDistance(a: Stats, b: Stats) {
  return STAT_IDS.reduce((sum, stat) => sum + Math.abs(a[stat] - b[stat]), 0);
}

export function clusterSpreads<T extends { sp: Stats; share: number }>(entries: T[], radius: number, merge: (into: T, from: T) => void) {
  const clusters: T[] = [];
  for (const entry of [...entries].sort((a, b) => b.share - a.share)) {
    let nearest: T | undefined;
    let best = Infinity;
    for (const cluster of clusters) {
      const distance = spDistance(cluster.sp, entry.sp);
      if (distance <= radius && distance < best) {
        nearest = cluster;
        best = distance;
      }
    }
    if (nearest) merge(nearest, entry);
    else clusters.push({ ...entry });
  }
  return clusters.sort((a, b) => b.share - a.share);
}

export function natureFit(natureName: string, sp: Stats) {
  const { plus, minus } = nature(natureName);
  if (!plus || !minus || plus === minus) return 1;
  if (sp[minus] > 4) return 0;
  if ((plus === 'atk' || plus === 'spa' || plus === 'spe') && sp[plus] === 0) return 0.15;
  return 1;
}
