import type { Stats } from '../../src/lib/spread';
import type { Confidence } from '../../src/lib/types';

export type Weather = '' | 'Sun' | 'Rain' | 'Sand' | 'Snow';
export type Terrain = '' | 'Grassy' | 'Psychic' | 'Electric' | 'Misty';

export type SideToggles = { reflect: boolean; lightScreen: boolean; helpingHand: boolean; friendGuard: boolean };

export type Settings = {
  band: [number, number];
  top: number;
  autoIntimidate: boolean;
  weather: Weather | 'auto';
  terrain: Terrain | 'auto';
  mine: SideToggles;
  theirs: SideToggles;
};

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

export type SetRef = { forme: string; item: string | null; nature: string; sp: Stats; weight: number; confidence: Confidence };

export type CalcRow = {
  key: string;
  direction: 'in' | 'out';
  move: string;
  moveType: string;
  minPct: number;
  maxPct: number;
  minDamage: number;
  maxDamage: number;
  hp: number;
  koChance: number;
  weight: number;
  sets: SetRef[];
  field: string[];
  desc: string;
  note?: string;
};

export type PokemonResult = {
  species: string;
  rank: number;
  rows: CalcRow[];
  totalSets: number;
};

export type CalcRequest = { id: number; me: MySet; settings: Settings };
export type CalcResponse = { id: number; results: PokemonResult[]; totalCalcs: number; ms: number };
