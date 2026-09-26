import { useEffect, useRef, type ReactNode } from 'react';
import type { Boosts, Settings, SideToggles } from '../calc/types';
import type { LibraryEntry } from '../library';
import { DEFAULT_SETTINGS, EMPTY_SIDE } from '../settings';
import type { Mode } from '../useStickyList';
import { Library } from './Library';
import { Popover } from './Popover';

type BoolKey = Exclude<keyof SideToggles, 'boosts'>;

const ATTACKER_TOGGLES: [BoolKey, string][] = [
  ['helpingHand', 'Helping Hand'],
  ['battery', 'Battery'],
  ['powerSpot', 'Power Spot'],
  ['steelySpirit', 'Steely Spirit'],
  ['charge', 'Charge'],
];

const DEFENDER_TOGGLES: [BoolKey, string][] = [
  ['reflect', 'Reflect'],
  ['lightScreen', 'Light Screen'],
  ['auroraVeil', 'Aurora Veil'],
  ['friendGuard', 'Friend Guard'],
  ['flowerGift', 'Flower Gift'],
];

const BOOSTS: [keyof Boosts, string, 'attack' | 'defense'][] = [
  ['atk', 'Atk', 'attack'],
  ['spa', 'SpA', 'attack'],
  ['def', 'Def', 'defense'],
  ['spd', 'SpD', 'defense'],
];

const TERRAIN_LABEL: Record<string, string> = { Grassy: 'Grassy Terrain', Psychic: 'Psychic Terrain', Electric: 'Electric Terrain', Misty: 'Misty Terrain' };

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : undefined} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onClick, children, dim }: { on: boolean; onClick: () => void; children: ReactNode; dim?: boolean }) {
  return (
    <button type="button" aria-pressed={on} className={`toggle${on ? ' on' : ''}${dim ? ' dim' : ''}`} onClick={onClick} title={dim ? 'Does not affect this tab' : undefined}>
      {children}
    </button>
  );
}

function Stepper({ label, value, onChange, dim }: { label: string; value: number; onChange: (v: number) => void; dim?: boolean }) {
  return (
    <div className={`stepper${dim ? ' dim' : ''}`}>
      <span className="stepper-label">{label}</span>
      <button type="button" aria-label={`Lower ${label}`} onClick={() => onChange(Math.max(-6, value - 1))} disabled={value <= -6}>
        −
      </button>
      <span className={`stepper-value tabular${value ? ' changed' : ''}`}>{value > 0 ? `+${value}` : value}</span>
      <button type="button" aria-label={`Raise ${label}`} onClick={() => onChange(Math.min(6, value + 1))} disabled={value >= 6}>
        +
      </button>
    </div>
  );
}

function SideColumn({ title, value, onChange, role }: { title: string; value: SideToggles; onChange: (v: SideToggles) => void; role: 'attacker' | 'defender' }) {
  const flip = (key: BoolKey) => onChange({ ...value, [key]: !value[key] });
  return (
    <div className="side-column">
      <span className="field-title">{title}</span>
      {ATTACKER_TOGGLES.map(([key, label]) => (
        <Toggle key={key} on={value[key]} onClick={() => flip(key)} dim={role !== 'attacker'}>
          {label}
        </Toggle>
      ))}
      <div className="side-gap" />
      {DEFENDER_TOGGLES.map(([key, label]) => (
        <Toggle key={key} on={value[key]} onClick={() => flip(key)} dim={role !== 'defender'}>
          {label}
        </Toggle>
      ))}
      <div className="side-gap" />
      {BOOSTS.map(([key, label, kind]) => (
        <Stepper
          key={key}
          label={label}
          value={value.boosts[key]}
          dim={(kind === 'attack') !== (role === 'attacker')}
          onChange={(v) => onChange({ ...value, boosts: { ...value.boosts, [key]: v } })}
        />
      ))}
    </div>
  );
}

function clampBand(n: number) {
  return Math.max(1, Math.min(300, Math.round(n || 0)));
}

type Chip = { key: string; label: string; clear: (s: Settings) => Settings };

function sideChips(side: SideToggles, who: 'You' | 'Opp', key: 'mine' | 'theirs'): Chip[] {
  const chips: Chip[] = [];
  for (const [k, label] of [...ATTACKER_TOGGLES, ...DEFENDER_TOGGLES])
    if (side[k]) chips.push({ key: `${key}.${k}`, label: `${who}: ${label}`, clear: (s) => ({ ...s, [key]: { ...s[key], [k]: false } }) });
  for (const [k, label] of BOOSTS)
    if (side.boosts[k]) {
      const v = side.boosts[k];
      chips.push({ key: `${key}.${k}`, label: `${who}: ${v > 0 ? '+' : ''}${v} ${label}`, clear: (s) => ({ ...s, [key]: { ...s[key], boosts: { ...s[key].boosts, [k]: 0 } } }) });
    }
  return chips;
}

function activeChips(s: Settings): Chip[] {
  const chips: Chip[] = [];
  if (s.terrain !== 'auto') chips.push({ key: 'terrain', label: s.terrain ? TERRAIN_LABEL[s.terrain] : 'No terrain', clear: (x) => ({ ...x, terrain: 'auto' }) });
  if (s.weather !== 'auto') chips.push({ key: 'weather', label: s.weather || 'No weather', clear: (x) => ({ ...x, weather: 'auto' }) });
  if (!s.autoIntimidate) chips.push({ key: 'intimidate', label: 'Intimidate off', clear: (x) => ({ ...x, autoIntimidate: true }) });
  if (s.gravity) chips.push({ key: 'gravity', label: 'Gravity', clear: (x) => ({ ...x, gravity: false }) });
  if (s.crit) chips.push({ key: 'crit', label: 'Crits', clear: (x) => ({ ...x, crit: false }) });
  return [...chips, ...sideChips(s.mine, 'You', 'mine'), ...sideChips(s.theirs, 'Opp', 'theirs')];
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
        placeholder="Find a Pokémon"
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
  const targets = [settings.targets.ohko && 'OHKO', settings.targets.twohko && '2HKO'].filter(Boolean).join(' + ');
  const chips = activeChips(settings);
  const active = library.filter((e) => e.active).length;
  const fieldCount = chips.length;

  return (
    <div className="toolbar-wrap">
      <div className="toolbar">
        <SearchBox value={query} onChange={onQueryChange} />
        <Popover label={`${lo}–${hi}% of ${targets}`}>
          <div className="panel-stack">
            <div className="field">
              <span className="field-title">Show calcs within</span>
              <div className="band">
                <input type="number" value={lo} step={5} aria-label="Minimum" onChange={(e) => set('band', [clampBand(+e.target.value), Math.max(hi, clampBand(+e.target.value))])} />
                <span className="muted">to</span>
                <input type="number" value={hi} step={5} aria-label="Maximum" onChange={(e) => set('band', [Math.min(lo, clampBand(+e.target.value)), clampBand(+e.target.value)])} />
                <span className="muted">% of the KO line</span>
              </div>
            </div>
            <div className="field">
              <span className="field-title">KO lines</span>
              <div className="toggle-row">
                <Toggle on={settings.targets.ohko} onClick={() => set('targets', { ...settings.targets, ohko: !settings.targets.ohko || !settings.targets.twohko })}>
                  OHKO
                </Toggle>
                <Toggle on={settings.targets.twohko} onClick={() => set('targets', { ...settings.targets, twohko: !settings.targets.twohko || !settings.targets.ohko })}>
                  2HKO
                </Toggle>
              </div>
              <p className="hint">The 2HKO line includes Sitrus Berry, Leftovers, Grassy Terrain healing and sand between hits.</p>
            </div>
          </div>
        </Popover>

        <Popover label={`Top ${settings.top}`}>
          <div className="panel-stack">
            <span className="field-title">Opponents by in-game usage</span>
            <Segmented label="Opponents" value={settings.top} onChange={(v) => set('top', v)} options={[[20, 'Top 20'], [40, 'Top 40'], [100, 'Top 100']]} />
          </div>
        </Popover>

        <Popover label={fieldCount ? `Field · ${fieldCount}` : 'Field'} active={fieldCount > 0} width={400}>
          <div className="panel-stack">
            <span className="field-title">Terrain</span>
            <Segmented
              label="Terrain"
              value={settings.terrain}
              onChange={(v) => set('terrain', v)}
              options={[
                ['auto', 'Auto'],
                ['', 'None'],
                ['Electric', 'Electric'],
                ['Grassy', 'Grassy'],
                ['Misty', 'Misty'],
                ['Psychic', 'Psychic'],
              ]}
            />
            <span className="field-title">Weather</span>
            <Segmented
              label="Weather"
              value={settings.weather}
              onChange={(v) => set('weather', v)}
              options={[
                ['auto', 'Auto'],
                ['', 'None'],
                ['Sun', 'Sun'],
                ['Rain', 'Rain'],
                ['Sand', 'Sand'],
                ['Snow', 'Snow'],
              ]}
            />
            <div className="toggle-row">
              <Toggle on={settings.autoIntimidate} onClick={() => set('autoIntimidate', !settings.autoIntimidate)}>
                Auto Intimidate
              </Toggle>
              <Toggle on={settings.gravity} onClick={() => set('gravity', !settings.gravity)}>
                Gravity
              </Toggle>
              <Toggle on={settings.crit} onClick={() => set('crit', !settings.crit)}>
                Crits
              </Toggle>
            </div>
            <p className="hint">Auto reads weather, terrain and Intimidate from each set's ability.</p>
            <div className="sides">
              <SideColumn title="You" value={settings.mine} onChange={(v) => set('mine', v)} role={mode === 'in' ? 'defender' : 'attacker'} />
              <SideColumn title="Opponent" value={settings.theirs} onChange={(v) => set('theirs', v)} role={mode === 'in' ? 'attacker' : 'defender'} />
            </div>
            {fieldCount > 0 && (
              <button
                type="button"
                className="link small"
                onClick={() => onChange({ ...DEFAULT_SETTINGS, band: settings.band, targets: settings.targets, top: settings.top, mine: EMPTY_SIDE, theirs: EMPTY_SIDE })}
              >
                Reset field
              </button>
            )}
          </div>
        </Popover>

        <Popover label={active ? `Library · ${active}` : 'Library'} active={customOnly && active > 0} width={380} align="right">
          <Library entries={library} onChange={onLibraryChange} ranks={ranks} customOnly={customOnly} onCustomOnlyChange={onCustomOnlyChange} />
        </Popover>
      </div>

      {(chips.length > 0 || (customOnly && active > 0)) && (
        <div className="chips" aria-label="Active modifiers">
          {customOnly && active > 0 && (
            <button type="button" className="chip" onClick={() => onCustomOnlyChange(false)}>
              Library sets only <span aria-hidden>×</span>
            </button>
          )}
          {chips.map((c) => (
            <button key={c.key} type="button" className="chip" onClick={() => onChange(c.clear(settings))} title="Remove">
              {c.label} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
