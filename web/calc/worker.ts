import metaJson from '../../data/meta.json';
import type { Meta } from '../../src/lib/types';
import { computeAll } from './engine';
import type { CalcRequest, CalcResponse } from './types';

const meta = metaJson as unknown as Meta;

self.onmessage = (event: MessageEvent<CalcRequest>) => {
  const { id, me, settings, extraSpecies, custom } = event.data;
  const start = performance.now();
  const { results, totalCalcs } = computeAll(meta, me, settings, extraSpecies, custom);
  const response: CalcResponse = { id, forme: me.forme, results, totalCalcs, ms: performance.now() - start };
  self.postMessage(response);
};
