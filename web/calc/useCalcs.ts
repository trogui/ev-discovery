import { useEffect, useRef, useState } from 'react';
import type { CalcResponse, MySet, Settings } from './types';

export function useCalcs(me: MySet | null, settings: Settings, delayMs = 150) {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const [response, setResponse] = useState<CalcResponse | null>(null);
  const [pending, setPending] = useState(false);

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
    if (!me) {
      setResponse(null);
      return;
    }
    setPending(true);
    const timer = setTimeout(() => {
      const id = ++idRef.current;
      workerRef.current?.postMessage({ id, me, settings });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [me, settings, delayMs]);

  return { response, pending };
}
