import { useMemo } from 'react';
import metaJson from '../data/meta.json';
import type { Meta } from '../src/lib/types';
import type { Settings } from './calc/types';
import { useCalcs } from './calc/useCalcs';
import { Controls } from './components/Controls';
import { Results } from './components/Results';
import { SetInput } from './components/SetInput';
import { parseMySet } from './me';
import { usePersistentState } from './usePersistentState';

const meta = metaJson as unknown as Meta;

const NO_SIDE = { reflect: false, lightScreen: false, helpingHand: false, friendGuard: false };

const DEFAULT_SETTINGS: Settings = {
  band: [85, 115],
  top: 40,
  direction: 'both',
  autoIntimidate: true,
  weather: 'auto',
  terrain: 'auto',
  mine: NO_SIDE,
  theirs: NO_SIDE,
};

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export function App() {
  const [text, setText] = usePersistentState('evd:set', '');
  const [settings, setSettings] = usePersistentState<Settings>('evd:settings', DEFAULT_SETTINGS);
  const parsed = useMemo(() => parseMySet(text), [text]);
  const me = parsed.ok ? parsed.set : null;
  const stableMe = useMemo(() => me, [JSON.stringify(me)]);
  const { response, pending } = useCalcs(stableMe, settings);

  return (
    <div className="app">
      <header className="top">
        <h1>EV Discovery</h1>
        <p className="muted small">
          Reg {meta.regulation} · datos del {dateFormat.format(new Date(meta.generatedAt))} · {meta.sources.limitlessTournaments} torneos · {meta.sources.pasteTeams} pastes · ladder in-game
        </p>
      </header>
      <aside className="side">
        <SetInput text={text} onChange={setText} parsed={parsed} />
        <Controls settings={settings} onChange={setSettings} />
        <button type="button" className="link reset" onClick={() => setSettings(DEFAULT_SETTINGS)}>
          Restablecer ajustes
        </button>
      </aside>
      <main className="main">
        <Results response={response} pending={pending} band={settings.band} top={settings.top} hasSet={!!me} />
      </main>
    </div>
  );
}
