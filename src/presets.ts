import { clusterSpreads, type Stats } from './lib/spread.js';
import { totalWeight } from './merge.js';
import type { SourceSet } from './lib/types.js';

export type Preset = {
  forme: string;
  item: string | null;
  ability: string | null;
  nature: string;
  sp: Stats | null;
  moves: string[];
  share: number;
  samples: number;
};

export type PresetSpecies = { species: string; sets: number; presets: Preset[] };

export type PresetsFile = { generatedAt: string; regulation: string; species: PresetSpecies[] };

const MAX_PRESETS = 6;
const MIN_SHARE = 0.03;

function mode<T extends { weight: number }>(values: T[], key: (v: T) => string) {
  const counts = new Map<string, { value: T; count: number }>();
  for (const v of values) {
    const k = key(v);
    const entry = counts.get(k) ?? { value: v, count: 0 };
    entry.count += v.weight;
    counts.set(k, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.value;
}

function topMoves(sets: SourceSet[]) {
  const counts = new Map<string, number>();
  for (const s of sets) for (const m of new Set(s.moves)) counts.set(m, (counts.get(m) ?? 0) + s.weight);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m]) => m);
}

function presetFrom(group: SourceSet[], share: number, pastes: SourceSet[]): Preset {
  const first = group[0];
  const withSp = pastes.length ? pastes : group.filter((s) => s.sp);
  const clusters = clusterSpreads(
    withSp.map((s) => ({ sp: s.sp!, share: s.weight })),
    4,
    (into, from) => (into.share += from.share),
  );
  return {
    forme: first.forme,
    item: first.item,
    ability: mode(group.filter((s) => s.ability), (s) => s.ability!)?.ability ?? null,
    nature: first.nature ?? 'Serious',
    sp: clusters[0]?.sp ?? null,
    moves: topMoves(pastes.length ? pastes : group),
    share: Number(share.toFixed(4)),
    samples: group.length,
  };
}

export function buildPresets(regulation: string, tournamentSets: SourceSet[], pasteSets: SourceSet[]): PresetsFile {
  const bySpecies = new Map<string, { tournament: SourceSet[]; pastes: SourceSet[] }>();
  const entry = (species: string) => {
    const e = bySpecies.get(species) ?? { tournament: [], pastes: [] };
    bySpecies.set(species, e);
    return e;
  };
  for (const s of tournamentSets) entry(s.species).tournament.push(s);
  for (const s of pasteSets) entry(s.species).pastes.push(s);

  const species: PresetSpecies[] = [];
  for (const [name, { tournament, pastes }] of bySpecies) {
    const source = tournament.length ? tournament : pastes;
    const key = (s: SourceSet) => `${s.forme}|${s.item ?? ''}|${s.nature ?? ''}`;
    const groups = new Map<string, SourceSet[]>();
    for (const s of source.filter((s) => s.nature)) groups.set(key(s), [...(groups.get(key(s)) ?? []), s]);
    const presets = [...groups.values()]
      .map((group) => ({ group, share: totalWeight(group) / totalWeight(source) }))
      .filter(({ share }, i) => share >= MIN_SHARE || i === 0)
      .sort((a, b) => b.share - a.share)
      .slice(0, MAX_PRESETS)
      .map(({ group, share }) =>
        presetFrom(
          group,
          share,
          pastes.filter((p) => key(p) === key(group[0])),
        ),
      );
    if (presets.length) species.push({ species: name, sets: tournament.length + pastes.length, presets });
  }
  species.sort((a, b) => b.sets - a.sets);
  return { generatedAt: new Date().toISOString(), regulation, species };
}
