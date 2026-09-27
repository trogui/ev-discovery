import { useCallback, useEffect, useState } from 'react';
import type { CalcResponse, CalcRow, SetGroup } from './calc/types';
import { closestCall } from './format';
import { displayLevel, inBand, type Band, type Level, type Targets } from './ko';

export type Mode = 'in' | 'out';

type Entry = { level: Level; anchor: boolean };

export type Watch = Record<Mode, Map<string, Entry>> & { heads: Record<Mode, Map<string, string>> };

export const keyOf = (species: string, mode: Mode, setId: string, move: string) => `${species}|${mode}|${setId}|${move}`;

export const isDecisive = (row: CalcRow) => row.koChance >= 0.9995;

export function watchedEntry(watch: Watch, species: string, mode: Mode, group: SetGroup, row: CalcRow) {
  for (const s of group.sets) {
    const entry = watch[mode].get(keyOf(species, mode, s.id, row.move));
    if (entry) return entry;
  }
  return null;
}

export function headOf<T extends CalcRow>(rows: T[], band: Band, targets: Targets): { r: T; level: Level } | null {
  const decisive = rows.find((r) => isDecisive(r) && !inBand(r, band, targets)) ?? rows.find(isDecisive);
  if (decisive) return { r: decisive, level: 1 };
  return closestCall(rows.filter((r) => inBand(r, band, targets)), band, targets);
}

function snapshot(response: CalcResponse, band: Band, targets: Targets): Watch {
  const heads: Watch['heads'] = { in: new Map(), out: new Map() };
  const pick = (mode: Mode) => {
    const keys = new Map<string, Entry>();
    for (const r of response.results) {
      const ordered = [...r.groups[mode]].sort((a, b) => Number(b.custom) - Number(a.custom) || b.weight - a.weight || a.order - b.order);
      for (const g of ordered)
        for (const row of g.rows) {
          const anchor = inBand(row, band, targets);
          if (!anchor && !isDecisive(row)) continue;
          const entry = { level: anchor ? displayLevel(row, band, targets) : (1 as Level), anchor };
          for (const s of g.sets) keys.set(keyOf(r.key, mode, s.id, row.move), entry);
        }
      const rows = ordered.flatMap((g) => g.rows.filter((row) => inBand(row, band, targets) || isDecisive(row)).map((row) => ({ ...row, setId: g.sets[0].id })));
      const head = headOf(rows, band, targets);
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
