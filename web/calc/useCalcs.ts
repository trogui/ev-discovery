import { useEffect, useRef, useState } from 'react';
import type { CalcResponse, CalcSettings, CustomOpponent, MySet } from './types';

export function useCalcs(me: MySet | null, settings: CalcSettings, extraSpecies: string[], custom: CustomOpponent[], delayMs = 120) {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const [response, setResponse] = useState<CalcResponse | null>(null);
  const [pending, setPending] = useState(false);
  const settingsKey = JSON.stringify(settings);
  const extraKey = extraSpecies.join('|');
  const customKey = JSON.stringify(custom);

  useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<CalcResponse>) => {
      if (event.data.id !== idRef.current) return;
      setResponse(event.data);
      setPending(false);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (!me) return;
    setPending(true);
    const timer = setTimeout(() => {
      const id = ++idRef.current;
      workerRef.current?.postMessage({ id, me, settings: JSON.parse(settingsKey), extraSpecies: extraKey ? extraKey.split('|') : [], custom: JSON.parse(customKey) });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [me, settingsKey, extraKey, customKey, delayMs]);

  return { response, pending };
}
