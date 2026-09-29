import type { Stats } from './spread.js';

export type SourceSet = {
  species: string;
  forme: string;
  item: string | null;
  ability: string | null;
  nature: string | null;
  moves: string[];
  sp: Stats | null;
  origin: string;
  date: string;
  regional: boolean;
  weight: number;
};

export type MunchEntry = { name: string; pct: number };

export type MunchPokemon = {
  species: string;
  rank: number;
  moves: MunchEntry[];
  items: MunchEntry[];
  abilities: MunchEntry[];
  natures: MunchEntry[];
  spreads: { sp: Stats; pct: number }[];
};

export type Confidence = 'paste' | 'paste-nature' | 'ladder' | 'ladder-only' | 'custom';

export type MetaSet = {
  weight: number;
  confidence: Confidence;
  samples: { archetype: number; spread: number };
  spreadMix: { tournament: number; ladder: number };
  forme: string;
  item: string | null;
  ability: string | null;
  nature: string;
  sp: Stats;
  moves: string[];
  autoField?: { weather?: string; terrain?: string; intimidate?: true };
};

export type MetaPokemon = {
  species: string;
  rank: number;
  tournamentSets: number;
  pasteSets: number;
  sets: MetaSet[];
};

export type RegionalStatus = {
  id: string;
  name: string;
  date: string;
  players: number;
  lists: number;
  pasteTeams: number;
  applied: boolean;
};

export type Meta = {
  generatedAt: string;
  regulation: string;
  sources: {
    limitlessTournaments: number;
    limitlessSets: number;
    regionalSets: number;
    pasteTeams: number;
    pasteSets: number;
    munchstatsSnapshot: string;
    newestEvent: string;
    regionalWeight: number;
    halfLifeDays: number;
    regionals: RegionalStatus[];
  };
  pokemon: MetaPokemon[];
};
