import { useMemo } from 'react';
import metaJson from '../data/meta.json';
import type { Meta } from '../src/lib/types';
import type { CalcSettings, Settings } from './calc/types';
import { useCalcs } from './calc/useCalcs';
import { Controls } from './components/Controls';
import { Results } from './components/Results';
import { SetInput } from './components/SetInput';
import { parseMySet } from './me';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';
import { usePersistentState } from './usePersistentState';
import { useStickyList, type Mode } from './useStickyList';

const meta = metaJson as unknown as Meta;

const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' });

export function App() {
  const [text, setText] = usePersistentState('evd:set', '');
  const [storedSettings, setSettings] = usePersistentState<Settings>('evd:settings', DEFAULT_SETTINGS);
  const [mode, setMode] = usePersistentState<Mode>('evd:mode', 'in');
  const [pinned, setPinned] = usePersistentState<string[]>('evd:pinned', []);
  const [open, setOpen] = usePersistentState<string[]>('evd:open', []);

  const settings = useMemo(() => normalizeSettings(storedSettings), [storedSettings]);
  const calcSettings = useMemo<CalcSettings>(() => {
    const { band: _band, ...rest } = settings;
    return rest;
  }, [settings]);

  const parsed = useMemo(() => parseMySet(text), [text]);
  const meKey = parsed.ok ? JSON.stringify(parsed.set) : '';
  const me = useMemo(() => (parsed.ok ? parsed.set : null), [meKey]);
  const { response, pending } = useCalcs(me, calcSettings, pinned);
  const { sticky, reset } = useStickyList(response, settings.band);

  const togglePin = (species: string) => {
    setPinned(pinned.includes(species) ? pinned.filter((s) => s !== species) : [...pinned, species]);
    if (!pinned.includes(species) && !open.includes(species)) setOpen([...open, species]);
  };

  return (
    <div className="app">
      <header className="top">
        <h1>EV Discovery</h1>
        <p className="muted small">
          Reg {meta.regulation} · data from {dateFormat.format(new Date(meta.generatedAt))} · {meta.sources.limitlessTournaments} tournaments · {meta.sources.pasteTeams} team pastes · in-game ladder
        </p>
      </header>
      <aside className="side">
        <SetInput text={text} onChange={setText} parsed={parsed} />
        <Controls settings={settings} onChange={setSettings} mode={mode} onReset={() => setSettings({ ...DEFAULT_SETTINGS, band: settings.band, top: settings.top })} />
      </aside>
      <main className="main">
        {!text.trim() ? (
          <div className="empty">
            <p>Paste your set on the left.</p>
            <p className="muted">
              Every matchup against the most common sets of the top {settings.top} in Reg {meta.regulation}, filtered to the calcs that land between {settings.band[0]}% and {settings.band[1]}% HP.
            </p>
          </div>
        ) : (
          <Results
            response={response}
            pending={pending}
            stale={!parsed.ok}
            band={settings.band}
            top={settings.top}
            mode={mode}
            onModeChange={setMode}
            sticky={sticky}
            onResetSticky={reset}
            pinned={pinned}
            onTogglePin={togglePin}
            open={open}
            onOpenChange={setOpen}
          />
        )}
      </main>
    </div>
  );
}
