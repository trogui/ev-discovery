import { useCallback, useEffect, useState } from 'react';
import type { CalcResponse } from './calc/types';
import { inBand, type Band, type Targets } from './ko';

export type Mode = 'in' | 'out';

type Sticky = { forme: string; in: string[]; out: string[] };

function collect(response: CalcResponse, band: Band, targets: Targets, base: Sticky): Sticky {
  const add = (mode: Mode) => {
    const species = new Set(base[mode]);
    for (const r of response.results) if (r.rows.some((row) => row.direction === mode && inBand(row, band, targets))) species.add(r.key);
    return [...species];
  };
  return { forme: response.forme, in: add('in'), out: add('out') };
}

export function useStickyList(response: CalcResponse | null, band: Band, targets: Targets) {
  const [sticky, setSticky] = useState<Sticky>({ forme: '', in: [], out: [] });

  useEffect(() => {
    if (!response) return;
    setSticky((prev) => {
      const next = collect(response, band, targets, prev.forme === response.forme ? prev : { forme: response.forme, in: [], out: [] });
      return next.in.length === prev.in.length && next.out.length === prev.out.length && next.forme === prev.forme ? prev : next;
    });
  }, [response, band, targets]);

  const reset = useCallback(() => {
    if (response) setSticky(collect(response, band, targets, { forme: response.forme, in: [], out: [] }));
  }, [response, band, targets]);

  return { sticky, reset };
}
