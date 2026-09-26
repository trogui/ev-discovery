import { autoField, defaultAbility, isDamagingMove } from './lib/dex.js';
import { clusterSpreads, natureFit, type Stats } from './lib/spread.js';
import type { Confidence, MetaPokemon, MetaSet, MunchPokemon, SourceSet } from './lib/types.js';

export const MERGE_RULES = {
  minTournamentSets: 15,
  archetypeShare: 0.1,
  archetypeFloorShare: 0.03,
  minArchetypes: 3,
  maxArchetypes: 6,
  minPasteSamples: 2,
  moveShare: 0.2,
  maxMoves: 4,
  spreadShare: 0.15,
  minSpreads: 2,
  maxSpreads: 3,
  clusterRadius: 4,
  tournamentSpreadWeight: 0.5,
  maxSetsPerPokemon: 8,
  ladderNatureShare: 0.1,
  ladderItemShare: 0.25,
};

type Archetype = { forme: string; item: string | null; nature: string; share: number; sets: SourceSet[]; confidence?: Confidence };

type SpreadEntry = { sp: Stats; share: number; tournament: number; ladder: number };

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, { count: number; items: T[] }>();
  for (const item of items) {
    const k = key(item);
    const entry = counts.get(k) ?? { count: 0, items: [] };
    entry.count++;
    entry.items.push(item);
    counts.set(k, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

function takeTop<T extends { share: number }>(sorted: T[], share: number, floorShare: number, min: number, max: number) {
  const kept: T[] = [];
  for (const entry of sorted) {
    if (kept.length >= max) break;
    if (entry.share >= share || (kept.length < min && entry.share >= floorShare)) kept.push(entry);
  }
  return kept;
}

function normalize<T extends { share: number }>(entries: T[]) {
  const total = entries.reduce((sum, e) => sum + e.share, 0);
  return total > 0 ? entries.map((e) => ({ ...e, share: e.share / total })) : entries;
}

function archetypesFromSets(sets: SourceSet[]): Archetype[] {
  const groups = countBy(
    sets.filter((s) => s.nature),
    (s) => `${s.forme}|${s.item ?? ''}|${s.nature}`,
  );
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  const all = groups.map((g) => ({
    forme: g.items[0].forme,
    item: g.items[0].item,
    nature: g.items[0].nature!,
    share: g.count / total,
    sets: g.items,
  }));
  return takeTop(all, MERGE_RULES.archetypeShare, MERGE_RULES.archetypeFloorShare, MERGE_RULES.minArchetypes, MERGE_RULES.maxArchetypes);
}

function archetypesFromLadder(munch: MunchPokemon): Archetype[] {
  const natures = takeTop(
    munch.natures.map((n) => ({ ...n, share: n.pct })),
    MERGE_RULES.ladderNatureShare,
    MERGE_RULES.archetypeFloorShare,
    1,
    3,
  );
  const items = takeTop(
    munch.items.map((i) => ({ ...i, share: i.pct })),
    MERGE_RULES.ladderItemShare,
    0,
    1,
    2,
  );
  const archetypes: Archetype[] = [];
  for (const nature of natures)
    for (const item of items) archetypes.push({ forme: munch.species, item: item.name, nature: nature.name, share: nature.share * item.share, sets: [] });
  return normalize(archetypes).map((a) => ({ ...a, confidence: 'ladder-only' as const }));
}

function pickMoves(archetype: Archetype, munch: MunchPokemon) {
  if (archetype.sets.length) {
    const counts = countBy(
      archetype.sets.flatMap((s) => [...new Set(s.moves)].filter(isDamagingMove)),
      (m) => m,
    );
    return counts
      .filter((c) => c.count / archetype.sets.length >= MERGE_RULES.moveShare)
      .slice(0, MERGE_RULES.maxMoves)
      .map((c) => c.items[0]);
  }
  return munch.moves
    .filter((m) => isDamagingMove(m.name) && m.pct >= MERGE_RULES.moveShare)
    .slice(0, MERGE_RULES.maxMoves)
    .map((m) => m.name);
}

function pickAbility(archetype: Archetype, munch: MunchPokemon) {
  if (archetype.forme !== munch.species) return defaultAbility(archetype.forme);
  const fromSets = countBy(
    archetype.sets.filter((s) => s.ability),
    (s) => s.ability!,
  )[0]?.items[0].ability;
  return fromSets ?? munch.abilities[0]?.name ?? defaultAbility(archetype.forme);
}

function tournamentDistribution(pastes: SourceSet[]): SpreadEntry[] {
  return pastes.map((p) => ({ sp: p.sp!, share: 1 / pastes.length, tournament: 1 / pastes.length, ladder: 0 }));
}

function ladderDistribution(archetype: Archetype, munch: MunchPokemon): SpreadEntry[] {
  const fitted = munch.spreads.map((s) => ({ sp: s.sp, share: s.pct * natureFit(archetype.nature, s.sp) })).filter((s) => s.share > 0);
  const total = fitted.reduce((sum, s) => sum + s.share, 0);
  return fitted.map((s) => ({ sp: s.sp, share: s.share / total, tournament: 0, ladder: s.share / total }));
}

const mergeEntry = (into: SpreadEntry, from: SpreadEntry) => {
  into.share += from.share;
  into.tournament += from.tournament;
  into.ladder += from.ladder;
};

function pickSpreads(archetype: Archetype, pastes: SourceSet[], munch: MunchPokemon) {
  const exact = pastes.filter((p) => p.forme === archetype.forme && p.item === archetype.item && p.nature === archetype.nature);
  const byNature = pastes.filter((p) => p.forme === archetype.forme && p.nature === archetype.nature);
  const tournamentPastes = exact.length >= MERGE_RULES.minPasteSamples ? exact : byNature.length >= MERGE_RULES.minPasteSamples ? byNature : [];
  const tournamentConfidence: Confidence = tournamentPastes === exact ? 'paste' : 'paste-nature';
  const ladderConfidence: Confidence = archetype.confidence ?? 'ladder';

  const ladder = ladderDistribution(archetype, munch);
  const w = tournamentPastes.length ? (ladder.length ? MERGE_RULES.tournamentSpreadWeight : 1) : 0;
  const scale = (entries: SpreadEntry[], k: number) =>
    entries.map((e) => ({ sp: e.sp, share: e.share * k, tournament: e.tournament * k, ladder: e.ladder * k }));
  const clusters = clusterSpreads(
    [...scale(tournamentDistribution(tournamentPastes), w), ...scale(ladder, 1 - w)],
    MERGE_RULES.clusterRadius,
    mergeEntry,
  );
  const kept = normalize(takeTop(clusters, MERGE_RULES.spreadShare, 0, MERGE_RULES.minSpreads, MERGE_RULES.maxSpreads));
  return kept.map((c) => {
    const total = c.tournament + c.ladder || 1;
    return {
      sp: c.sp,
      share: c.share,
      mix: { tournament: Number((c.tournament / total).toFixed(3)), ladder: Number((c.ladder / total).toFixed(3)) },
      confidence: c.tournament >= c.ladder ? tournamentConfidence : ladderConfidence,
      pasteSamples: tournamentPastes.length,
    };
  });
}

export function mergePokemon(munch: MunchPokemon, tournamentSets: SourceSet[], pasteSets: SourceSet[]): MetaPokemon {
  const archetypeSource = tournamentSets.length >= MERGE_RULES.minTournamentSets ? tournamentSets : [...tournamentSets, ...pasteSets];
  const archetypes =
    archetypeSource.length >= MERGE_RULES.minTournamentSets ? normalize(archetypesFromSets(archetypeSource)) : archetypesFromLadder(munch);

  const sets: MetaSet[] = [];
  for (const archetype of archetypes) {
    const moves = pickMoves(archetype, munch);
    const ability = pickAbility(archetype, munch);
    for (const spread of pickSpreads(archetype, pasteSets, munch)) {
      const field = autoField(ability);
      sets.push({
        weight: Number((archetype.share * spread.share).toFixed(4)),
        confidence: spread.confidence,
        samples: { archetype: archetype.sets.length, spread: spread.pasteSamples },
        spreadMix: spread.mix,
        forme: archetype.forme,
        item: archetype.item,
        ability,
        nature: archetype.nature,
        sp: spread.sp,
        moves,
        ...(field ? { autoField: field } : {}),
      });
    }
  }

  sets.sort((a, b) => b.weight - a.weight);
  return {
    species: munch.species,
    rank: munch.rank,
    tournamentSets: tournamentSets.length,
    pasteSets: pasteSets.length,
    sets: sets.slice(0, MERGE_RULES.maxSetsPerPokemon),
  };
}
