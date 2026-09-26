import type { Stats } from '../../src/lib/spread';
import type { Confidence, MetaSet } from '../../src/lib/types';

export type Weather = '' | 'Sun' | 'Rain' | 'Sand' | 'Snow';
export type Terrain = '' | 'Grassy' | 'Psychic' | 'Electric' | 'Misty';

export type Boosts = { atk: number; def: number; spa: number; spd: number };

export type SideToggles = {
  helpingHand: boolean;
  battery: boolean;
  powerSpot: boolean;
  steelySpirit: boolean;
  charge: boolean;
  flowerGift: boolean;
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
  friendGuard: boolean;
  boosts: Boosts;
};

export type Settings = {
  band: [number, number];
  targets: { ohko: boolean; twohko: boolean };
  top: number;
  autoIntimidate: boolean;
  gravity: boolean;
  crit: boolean;
  weather: Weather | 'auto';
  terrain: Terrain | 'auto';
  mine: SideToggles;
  theirs: SideToggles;
};

export type CalcSettings = Omit<Settings, 'band' | 'targets'>;

export type MySet = {
  species: string;
  forme: string;
  item: string | null;
  ability: string | null;
  nature: string;
  sp: Stats;
  moves: string[];
  stats: Stats;
};

export type SetRef = { id: string; forme: string; item: string | null; ability: string | null; nature: string; sp: Stats; weight: number; confidence: Confidence; custom: boolean };

export type CalcRow = {
  key: string;
  order: number;
  direction: 'in' | 'out';
  move: string;
  moveType: string;
  minPct: number;
  maxPct: number;
  minDamage: number;
  maxDamage: number;
  hp: number;
  koChance: number;
  ko2Chance: number;
  line2Pct: number;
  recoveryNotes: string[];
  field: string[];
  desc: string;
  note?: string;
};

export type SetGroup = {
  key: string;
  order: number;
  custom: boolean;
  weight: number;
  sets: SetRef[];
  rows: CalcRow[];
};

export type PokemonResult = {
  key: string;
  species: string;
  rank: number;
  inTop: boolean;
  hasCustom: boolean;
  onlyCustom: boolean;
  groups: Record<'in' | 'out', SetGroup[]>;
};

export type CustomOpponent = { id: string; species: string; set: MetaSet };

export type CalcRequest = { id: number; me: MySet; settings: CalcSettings; extraSpecies: string[]; custom: CustomOpponent[] };
export type CalcResponse = { id: number; forme: string; results: PokemonResult[]; totalCalcs: number; ms: number };
