import { useMemo, useState } from 'react';
import metaJson from '../data/meta.json';
import type { Meta } from '../src/lib/types';
import type { CalcSettings, Settings } from './calc/types';
import { useCalcs } from './calc/useCalcs';
import { FieldPanel } from './components/FieldPanel';
import { Results } from './components/Results';
import { SetEditor } from './components/SetEditor';
import { Toolbar } from './components/Toolbar';
import { activeOpponents, type LibraryEntry } from './library';
import { EXAMPLE, buildMySet, importPaste, type EditableSet } from './me';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';
import { usePersistentState } from './usePersistentState';
import { useStickyList, type Mode } from './useStickyList';

const meta = metaJson as unknown as Meta;

const ranks = new Map(meta.pokemon.map((p) => [p.species, p.rank]));

function initialSet(): EditableSet | null {
  try {
    const legacy = localStorage.getItem('evd:set');
    if (!legacy) return null;
    const result = importPaste(JSON.parse(legacy));
    return result.ok ? result.sets[0] : null;
  } catch {
    return null;
  }
}

const INITIAL_SET = initialSet();

function migrateTop() {
  try {
    if (localStorage.getItem('evd:migrated:top100')) return;
    const stored = localStorage.getItem('evd:settings');
    if (stored) localStorage.setItem('evd:settings', JSON.stringify({ ...JSON.parse(stored), top: 100 }));
    localStorage.setItem('evd:migrated:top100', '1');
  } catch {
    return;
  }
}

migrateTop();

const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' });

export function App() {
  const [mine, setMine] = usePersistentState<EditableSet | null>('evd:me', INITIAL_SET);
  const [storedSettings, setSettings] = usePersistentState<Settings>('evd:settings', DEFAULT_SETTINGS);
  const [mode, setMode] = usePersistentState<Mode>('evd:mode', 'in');
  const [pinned, setPinned] = usePersistentState<string[]>('evd:pinned', []);
  const [open, setOpen] = usePersistentState<string[]>('evd:open', []);
  const [library, setLibrary] = usePersistentState<LibraryEntry[]>('evd:library', []);
  const [customOnly, setCustomOnly] = usePersistentState<boolean>('evd:customOnly', false);
  const custom = useMemo(() => activeOpponents(library), [library]);
  const [query, setQuery] = useState('');

  const settings = useMemo(() => normalizeSettings(storedSettings), [storedSettings]);
  const calcSettings = useMemo<CalcSettings>(() => {
    const { band: _band, targets: _targets, ...rest } = settings;
    return rest;
  }, [settings]);

  const me = useMemo(() => (mine ? buildMySet(mine) : null), [mine]);
  const { response, pending } = useCalcs(me, calcSettings, pinned, custom);
  const { sticky, reset } = useStickyList(response, settings.band, settings.targets);

  const togglePin = (species: string) => {
    setPinned(pinned.includes(species) ? pinned.filter((s) => s !== species) : [...pinned, species]);
    if (!pinned.includes(species) && !open.includes(species)) setOpen([...open, species]);
  };

  return (
    <div className="app">
      <header className="top">
        <h1>EV Discovery</h1>
        <p className="muted small" title={`${meta.sources.limitlessTournaments} Limitless tournaments, ${meta.sources.pasteTeams} team pastes and the in-game ladder`}>
          Regulation {meta.regulation} usage, updated {dateFormat.format(new Date(meta.generatedAt))}
        </p>
      </header>
      <aside className="side">
        <SetEditor title="Your Pokémon" value={mine} onChange={setMine} ranks={ranks} />
      </aside>
      {mine && (
        <aside className="field-side">
          <FieldPanel settings={settings} onChange={setSettings} mode={mode} />
        </aside>
      )}
      <main className="main">
        {!mine ? (
          <div className="empty">
            <p className="empty-title">Which spreads are one point away from a KO?</p>
            <p>
              Pick your Pokémon on the left. You get every matchup against the common sets of the top {settings.top} in Reg {meta.regulation}, filtered down to the calcs that land near an OHKO or 2HKO.
            </p>
            <p>
              <button type="button" className="link" onClick={() => setMine(EXAMPLE)}>
                Try an example
              </button>
            </p>
          </div>
        ) : (
          <Results
            response={response}
            pending={pending}
            stale={false}
            band={settings.band}
            targets={settings.targets}
            top={settings.top}
            mode={mode}
            onModeChange={setMode}
            customOnly={customOnly}
            hasLibrary={library.some((e) => e.active)}
            query={query}
            toolbar={
              <Toolbar
                settings={settings}
                onChange={setSettings}
                mode={mode}
                library={library}
                onLibraryChange={setLibrary}
                customOnly={customOnly}
                onCustomOnlyChange={setCustomOnly}
                ranks={ranks}
                query={query}
                onQueryChange={setQuery}
              />
            }
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
