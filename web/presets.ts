import { useEffect, useState } from 'react';
import { gen, toID } from '../src/lib/dex';
import type { PresetSpecies, PresetsFile } from '../src/presets';
import type { Option } from './components/Combobox';

let cache: PresetsFile | null = null;
let loading: Promise<PresetsFile> | null = null;

export function usePresets() {
  const [presets, setPresets] = useState<PresetsFile | null>(cache);
  useEffect(() => {
    if (cache) return;
    loading ??= import('../data/presets.json').then((m) => (cache = m.default as unknown as PresetsFile));
    loading.then(setPresets);
  }, []);
  return presets;
}

export function presetsFor(file: PresetsFile | null, species: string): PresetSpecies | undefined {
  return file?.species.find((s) => s.species === species);
}

const allSpecies = [...gen.species].filter((s) => !/-Mega/.test(s.name)).map((s) => s.name);
const allItems = [...gen.items].map((i) => ({ name: i.name, megaStone: i.megaStone as Record<string, string> | undefined }));
const allMoves = [...gen.moves].map((m) => m.name).filter((m) => !m.startsWith('Max ') && !m.startsWith('G-Max') && m !== '(No Move)');

export function speciesOptions(file: PresetsFile | null, ranks: Map<string, number>): Option[] {
  const used = file?.species ?? [];
  const usedNames = new Set(used.map((s) => s.species));
  const common = used.map((s) => ({ value: s.species, hint: ranks.has(s.species) ? `#${ranks.get(s.species)}` : `${s.sets} teams`, group: 0 }));
  const rest = allSpecies.filter((s) => !usedNames.has(s)).sort().map((s) => ({ value: s, group: 1 }));
  return [...common, ...rest];
}

export function itemOptions(entry: PresetSpecies | undefined, species: string): Option[] {
  const counts = new Map<string, number>();
  for (const p of entry?.presets ?? []) if (p.item) counts.set(p.item, (counts.get(p.item) ?? 0) + p.share);
  const common = [...counts].sort((a, b) => b[1] - a[1]).map(([value, share]) => ({ value, hint: `${Math.round(share * 100)}%`, group: 0 }));
  const commonSet = new Set(counts.keys());
  const rest = allItems
    .filter((i) => !commonSet.has(i.name) && (!i.megaStone || species in i.megaStone))
    .map((i) => i.name)
    .sort()
    .map((value) => ({ value, group: 1 }));
  return [...common, ...rest];
}

export function moveOptions(entry: PresetSpecies | undefined): Option[] {
  const counts = new Map<string, number>();
  for (const p of entry?.presets ?? []) for (const m of p.moves) counts.set(m, (counts.get(m) ?? 0) + p.share);
  const common = [...counts].sort((a, b) => b[1] - a[1]).map(([value]) => ({ value, hint: 'common', group: 0 }));
  const rest = allMoves
    .filter((m) => !counts.has(m))
    .sort()
    .map((value) => ({ value, hint: moveHint(value), group: 1 }));
  return [...common.map((o) => ({ ...o, hint: moveHint(o.value) })), ...rest];
}

function moveHint(name: string) {
  const move = gen.moves.get(toID(name) as never);
  if (!move) return undefined;
  if (move.category !== 'Physical' && move.category !== 'Special') return move.type;
  return `${move.type} · ${move.basePower || '—'}`;
}
