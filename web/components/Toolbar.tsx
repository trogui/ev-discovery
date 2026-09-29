import { useEffect, useRef, type ReactNode } from 'react';
import type { Settings } from '../calc/types';
import type { LibraryEntry } from '../library';
import type { Mode } from '../useStickyList';
import { FieldPanel, Segmented, countFieldChanges } from './FieldPanel';
import { Library } from './Library';
import { Popover } from './Popover';

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} className={`toggle${on ? ' on' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function clampBand(n: number) {
  return Math.max(1, Math.min(300, Math.round(n || 0)));
}

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
  mode: Mode;
  library: LibraryEntry[];
  onLibraryChange: (entries: LibraryEntry[]) => void;
  customOnly: boolean;
  onCustomOnlyChange: (v: boolean) => void;
  ranks: Map<string, number>;
  query: string;
  onQueryChange: (q: string) => void;
};

function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <label className="search">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder="Jump to a Pokémon"
        aria-label="Find a Pokémon"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('');
            e.currentTarget.blur();
          }
        }}
      />
      {!value && <kbd>/</kbd>}
    </label>
  );
}

export function Toolbar({ settings, onChange, mode, library, onLibraryChange, customOnly, onCustomOnlyChange, ranks, query, onQueryChange }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const [lo, hi] = settings.band;
  const targets = [settings.targets.ohko && 'OHKO', settings.targets.twohko && '2HKO'].filter(Boolean).join(' or ');
  const active = library.filter((e) => e.active).length;
  const changes = countFieldChanges(settings);

  return (
    <div className="toolbar-wrap">
      <div className="toolbar">
        <div className="query">
          {mode === 'in' ? 'Their attacks on you' : 'Your attacks on them'}, from the{' '}
          <Popover className="inline" label={`top ${settings.top}`}>
            <div className="panel-stack">
              <span className="field-title">Opponents by in-game usage</span>
              <Segmented label="Opponents" value={settings.top} onChange={(v) => set('top', v)} options={[[20, 'Top 20'], [40, 'Top 40'], [100, 'Top 100']]} />
            </div>
          </Popover>
          , landing within{' '}
          <Popover className="inline" label={`${lo}–${hi}%`}>
            <div className="field">
              <span className="field-title">Show calcs within</span>
              <div className="band">
                <input type="number" value={lo} step={5} aria-label="Minimum" onChange={(e) => set('band', [clampBand(+e.target.value), Math.max(hi, clampBand(+e.target.value))])} />
                <span className="muted">to</span>
                <input type="number" value={hi} step={5} aria-label="Maximum" onChange={(e) => set('band', [Math.min(lo, clampBand(+e.target.value)), clampBand(+e.target.value)])} />
                <span className="muted">%</span>
              </div>
            </div>
          </Popover>{' '}
          of the{' '}
          <Popover className="inline" label={targets}>
            <div className="panel-stack">
              <span className="field-title">KO lines</span>
              <div className="toggle-row">
                <Toggle on={settings.targets.ohko} onClick={() => set('targets', { ...settings.targets, ohko: !settings.targets.ohko || !settings.targets.twohko })}>
                  OHKO
                </Toggle>
                <Toggle on={settings.targets.twohko} onClick={() => set('targets', { ...settings.targets, twohko: !settings.targets.twohko || !settings.targets.ohko })}>
                  2HKO
                </Toggle>
              </div>
              <p className="hint">Each calc is drawn against whichever line it lands closer to. The 2HKO line counts Sitrus Berry, Leftovers, Grassy Terrain and sand between hits.</p>
            </div>
          </Popover>
          .
        </div>
        <div className="toolbar-side">
          <SearchBox value={query} onChange={onQueryChange} />
          <span className="field-button">
            <Popover label={changes ? `Field ${changes}` : 'Field'} active={changes > 0} width={300} align="right">
              <FieldPanel settings={settings} onChange={onChange} mode={mode} />
            </Popover>
          </span>
          <Popover label={active ? `Library ${active}` : 'Library'} active={customOnly && active > 0} width={380} align="right">
            <Library entries={library} onChange={onLibraryChange} ranks={ranks} customOnly={customOnly} onCustomOnlyChange={onCustomOnlyChange} />
          </Popover>
        </div>
      </div>

      {customOnly && active > 0 && (
        <div className="chips" aria-label="Active filters">
          <button type="button" className="chip" onClick={() => onCustomOnlyChange(false)}>
            Library sets only <span aria-hidden>×</span>
          </button>
        </div>
      )}
    </div>
  );
}
