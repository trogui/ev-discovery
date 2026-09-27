import { useCallback, useEffect, useState } from 'react';
import type { CalcResponse, CalcRow, SetGroup } from './calc/types';
import { closestCall } from './format';
import { displayLevel, inBand, type Band, type Level, type Targets } from './ko';

export type Mode = 'in' | 'out';

export type Watch = Record<Mode, Map<string, Level>> & { heads: Record<Mode, Map<string, string>> };

export const keyOf = (species: string, mode: Mode, setId: string, move: string) => `${species}|${mode}|${setId}|${move}`;

export function watchedLevel(watch: Watch, species: string, mode: Mode, group: SetGroup, row: CalcRow) {
  for (const s of group.sets) {
    const level = watch[mode].get(keyOf(species, mode, s.id, row.move));
    if (level) return level;
  }
  return null;
}

export const isWatched = (watch: Watch, species: string, mode: Mode, group: SetGroup, row: CalcRow) => watchedLevel(watch, species, mode, group, row) !== null;

function snapshot(response: CalcResponse, band: Band, targets: Targets): Watch {
  const heads: Watch['heads'] = { in: new Map(), out: new Map() };
  const pick = (mode: Mode) => {
    const keys = new Map<string, Level>();
    for (const r of response.results) {
      const ordered = [...r.groups[mode]].sort((a, b) => Number(b.custom) - Number(a.custom) || b.weight - a.weight || a.order - b.order);
      const rows = ordered.flatMap((g) => g.rows.filter((row) => inBand(row, band, targets)).map((row) => ({ ...row, setId: g.sets[0].id })));
      for (const g of r.groups[mode]) for (const row of g.rows) if (inBand(row, band, targets)) for (const s of g.sets) keys.set(keyOf(r.key, mode, s.id, row.move), displayLevel(row, band, targets));
      const head = closestCall(rows, band, targets);
      if (head) heads[mode].set(r.key, keyOf(r.key, mode, head.r.setId, head.r.move));
    }
    return keys;
  };
  return { in: pick('in'), out: pick('out'), heads };
}

export function useWatchList(response: CalcResponse | null, pending: boolean, band: Band, targets: Targets, scope: string) {
  const [state, setState] = useState<{ scope: string; watch: Watch } | null>(null);
  const fullScope = response ? `${response.forme}|${scope}` : '';

  useEffect(() => {
    if (!response || pending) return;
    setState((prev) => (prev && prev.scope === fullScope ? prev : { scope: fullScope, watch: snapshot(response, band, targets) }));
  }, [response, pending, band, targets, fullScope]);

  const rebuild = useCallback(() => {
    if (response) setState({ scope: fullScope, watch: snapshot(response, band, targets) });
  }, [response, band, targets, fullScope]);

  return { watch: state?.scope === fullScope ? state.watch : null, rebuild };
}
