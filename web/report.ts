import { gen, toID } from '../src/lib/dex';
import type { Band, Level } from './ko';
import type { CalcRow, CalcSettings, MySet, SideToggles } from './calc/types';
import type { Mode } from './useStickyList';

export type ReportSet = {
  forme: string;
  item: string;
  icon: string | null;
  ability: string | null;
  nature: string;
  sp: string;
  custom: boolean;
};

export type ReportItem = {
  id: string;
  me: MySet;
  mode: Mode;
  species: string;
  rank: number;
  set: ReportSet;
  row: CalcRow;
  level: Level;
  band: Band;
  conditions: string[];
  note: string;
};

export function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const ATTACKER: [keyof SideToggles, string][] = [
  ['helpingHand', 'Helping Hand'],
  ['battery', 'Battery'],
  ['powerSpot', 'Power Spot'],
  ['steelySpirit', 'Steely Spirit'],
  ['charge', 'Charge'],
];

const DEFENDER: [keyof SideToggles, string][] = [
  ['reflect', 'Reflect'],
  ['lightScreen', 'Light Screen'],
  ['auroraVeil', 'Aurora Veil'],
  ['friendGuard', 'Friend Guard'],
  ['flowerGift', 'Flower Gift'],
];

const stage = (n: number, stat: string) => (n ? `${n > 0 ? '+' : ''}${n} ${stat}` : null);

export function conditionsOf(settings: CalcSettings, row: CalcRow) {
  const attacker = row.direction === 'in' ? settings.theirs : settings.mine;
  const defender = row.direction === 'in' ? settings.mine : settings.theirs;
  const category = gen.moves.get(toID(row.move) as never)?.category;
  const physical = category === 'Physical';
  return [
    settings.weather !== 'auto' && settings.weather ? settings.weather : null,
    settings.terrain !== 'auto' && settings.terrain ? `${settings.terrain} Terrain` : null,
    ...row.field,
    settings.gravity ? 'Gravity' : null,
    settings.crit ? 'Critical hit' : null,
    ...ATTACKER.filter(([k]) => attacker[k]).map(([, label]) => label),
    stage(physical ? attacker.boosts.atk : attacker.boosts.spa, physical ? 'Atk' : 'SpA'),
    ...DEFENDER.filter(([k]) => defender[k]).map(([, label]) => label),
    stage(physical ? defender.boosts.def : defender.boosts.spd, physical ? 'Def' : 'SpD'),
  ].filter((c): c is string => !!c);
}

export const buildOf = (item: ReportItem) => hash(JSON.stringify(item.me));

export const setOf = (item: ReportItem) => item.row.key.slice(0, item.row.key.lastIndexOf('|'));
