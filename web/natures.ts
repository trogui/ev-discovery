import type { StatID } from '@smogon/calc/dist/data/interface.js';
import { gen } from '../src/lib/dex';
import type { Stats } from '../src/lib/spread';

export type NatureStat = Exclude<StatID, 'hp'>;
export type Role = 'plus' | 'minus' | null;

const NATURES = [...gen.natures];

export const NATURE_OPTIONS = NATURES.map((n) => n.name).sort();

export function rolesOf(nature: string): { plus: NatureStat | null; minus: NatureStat | null } {
  const n = NATURES.find((x) => x.name === nature);
  if (!n || n.plus === n.minus) return { plus: null, minus: null };
  return { plus: n.plus as NatureStat, minus: n.minus as NatureStat };
}

function natureFor(plus: NatureStat | null, minus: NatureStat | null) {
  if (!plus || !minus) return 'Serious';
  return NATURES.find((n) => n.plus === plus && n.minus === minus)?.name ?? 'Serious';
}

const unusedAttack = (sp: Stats): NatureStat => (sp.atk <= sp.spa ? 'atk' : 'spa');

function defaultMinus(plus: NatureStat, sp: Stats): NatureStat {
  if (plus === 'atk') return 'spa';
  if (plus === 'spa') return 'atk';
  return unusedAttack(sp);
}

function defaultPlus(minus: NatureStat, sp: Stats): NatureStat {
  const candidates = (['atk', 'spa', 'spe', 'def', 'spd'] as NatureStat[]).filter((s) => s !== minus);
  return candidates.reduce((best, s) => (sp[s] > sp[best] ? s : best), candidates[0]);
}

export function cycleNature(nature: string, stat: NatureStat, sp: Stats) {
  const { plus, minus } = rolesOf(nature);
  const current: Role = plus === stat ? 'plus' : minus === stat ? 'minus' : null;
  if (current === null) {
    const nextMinus = minus && minus !== stat ? minus : defaultMinus(stat, sp);
    return natureFor(stat, nextMinus === stat ? defaultMinus(stat, { ...sp, [stat]: 0 }) : nextMinus);
  }
  if (current === 'plus') {
    const nextPlus = plus === stat ? defaultPlus(stat, sp) : plus;
    return natureFor(nextPlus, stat);
  }
  return 'Serious';
}

export function describeNature(nature: string) {
  const { plus, minus } = rolesOf(nature);
  const label: Record<NatureStat, string> = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
  return plus && minus ? `+${label[plus]} −${label[minus]}` : 'neutral';
}
