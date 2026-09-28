import { useMemo, useState } from 'react';
import metaJson from '../data/meta.json';
import type { Meta } from '../src/lib/types';
import type { CalcRow, CalcSettings, PokemonResult, SetGroup, Settings } from './calc/types';
import { useCalcs } from './calc/useCalcs';
import { FieldPanel } from './components/FieldPanel';
import { Report } from './components/Report';
import { groupLabel, Results, type Picker } from './components/Results';
import { SetEditor } from './components/SetEditor';
import { StartPicker } from './components/StartPicker';
import { Toolbar } from './components/Toolbar';
import { activeOpponents, type LibraryEntry } from './library';
import type { Level } from './ko';
import { buildMySet, importPaste, type EditableSet } from './me';
import { conditionsOf, hash, type ReportItem } from './report';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';
import { usePersistentState } from './usePersistentState';
import { useWatchList, type Mode } from './useStickyList';

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
  const [report, setReport] = usePersistentState<ReportItem[]>('evd:report', []);
  const [reportTitle, setReportTitle] = usePersistentState<string>('evd:reportTitle', '');
  const [picking, setPicking] = useState(false);
  const [viewing, setViewing] = useState(false);

  const settings = useMemo(() => normalizeSettings(storedSettings), [storedSettings]);
  const calcSettings = useMemo<CalcSettings>(() => {
    const { band: _band, targets: _targets, ...rest } = settings;
    return rest;
  }, [settings]);

  const me = useMemo(() => (mine ? buildMySet(mine) : null), [mine]);
  const { response, pending } = useCalcs(me, calcSettings, pinned, custom);
  const build = useMemo(() => {
    const { top: _top, ...rest } = calcSettings;
    return hash(JSON.stringify([me, rest]));
  }, [me, calcSettings]);
  const picker = useMemo<Picker>(() => {
    const ids = new Set(report.map((i) => i.id));
    const idOf = (group: SetGroup, row: CalcRow) => `${build}.${hash(JSON.stringify(group.sets[0]))}|${row.key}`;
    const toggle = (result: PokemonResult, group: SetGroup, row: CalcRow, level: Level) => {
      if (!me) return;
      const id = idOf(group, row);
      if (ids.has(id)) return setReport((items) => items.filter((i) => i.id !== id));
      const label = groupLabel(group, result.species, row.direction);
      const first = group.sets[0];
      const item: ReportItem = {
        id,
        build,
        me,
        mode: row.direction,
        species: result.species,
        rank: result.rank,
        group: `${build}|${group.key}`,
        set: { forme: first.forme, item: label.item, icon: first.item, ability: first.ability, nature: label.nature, sp: label.sp, custom: group.custom },
        row,
        level,
        band: settings.band,
        conditions: conditionsOf(calcSettings, row),
        note: '',
      };
      setReport((items) => [...items, item]);
    };
    return { active: picking, has: (group, row) => ids.has(idOf(group, row)), toggle };
  }, [report, build, me, picking, settings.band, calcSettings, setReport]);
  const { watch, rebuild } = useWatchList(response, pending, settings.band, settings.targets, JSON.stringify([settings.band, settings.targets, settings.top, custom.length]));

  const togglePin = (species: string) => {
    setPinned(pinned.includes(species) ? pinned.filter((s) => s !== species) : [...pinned, species]);
    if (!pinned.includes(species) && !open.includes(species)) setOpen([...open, species]);
  };

  if (viewing)
    return (
      <Report
        items={report}
        onChange={setReport}
        title={reportTitle}
        onTitleChange={setReportTitle}
        onBack={() => setViewing(false)}
      />
    );

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
            <StartPicker species={meta.pokemon.slice(0, 12).map((p) => p.species)} onPick={setMine} />
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
            watch={watch}
            onRebuild={rebuild}
            pinned={pinned}
            onTogglePin={togglePin}
            open={open}
            onOpenChange={setOpen}
            picker={picker}
            onPickingChange={setPicking}
          />
        )}
        {mine && (picking || report.length > 0) && (
          <div className="pick-bar">
            <span>
              <b className="tabular">{report.length}</b> {report.length === 1 ? 'calc' : 'calcs'} in the report
            </span>
            {picking && <span className="muted small">Open a Pokémon and tick the calcs you want to keep</span>}
            <span className="pick-actions">
              {report.length > 0 && (
                <button type="button" className="link" onClick={() => confirm('Remove every calc from the report?') && setReport([])}>
                  Clear
                </button>
              )}
              <button type="button" className="button primary" onClick={() => setViewing(true)} disabled={!report.length}>
                View report
              </button>
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
