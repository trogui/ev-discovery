import { useCallback, useEffect, useState } from 'react';
import type { CalcResponse, CalcRow } from './calc/types';

export type Mode = 'in' | 'out';

export const inBand = (row: CalcRow, [lo, hi]: [number, number]) => row.maxPct >= lo && row.minPct <= hi;

type Sticky = { forme: string; in: string[]; out: string[] };

function collect(response: CalcResponse, band: [number, number], base: Sticky): Sticky {
  const add = (mode: Mode) => {
    const species = new Set(base[mode]);
    for (const r of response.results) if (r.rows.some((row) => row.direction === mode && inBand(row, band))) species.add(r.species);
    return [...species];
  };
  return { forme: response.forme, in: add('in'), out: add('out') };
}

export function useStickyList(response: CalcResponse | null, band: [number, number]) {
  const [sticky, setSticky] = useState<Sticky>({ forme: '', in: [], out: [] });

  useEffect(() => {
    if (!response) return;
    setSticky((prev) => {
      const next = collect(response, band, prev.forme === response.forme ? prev : { forme: response.forme, in: [], out: [] });
      return next.in.length === prev.in.length && next.out.length === prev.out.length && next.forme === prev.forme ? prev : next;
    });
  }, [response, band]);

  const reset = useCallback(() => {
    if (response) setSticky(collect(response, band, { forme: response.forme, in: [], out: [] }));
  }, [response, band]);

  return { sticky, reset };
}
