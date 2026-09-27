import type { Boosts, Settings, SideToggles } from '../calc/types';
import { DEFAULT_SETTINGS, EMPTY_SIDE } from '../settings';
import type { Mode } from '../useStickyList';

type BoolKey = Exclude<keyof SideToggles, 'boosts'>;
type Role = 'attacker' | 'defender';

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

const BOOSTS: [keyof Boosts, string, Role][] = [
  ['atk', 'Atk', 'attacker'],
  ['spa', 'SpA', 'attacker'],
  ['def', 'Def', 'defender'],
  ['spd', 'SpD', 'defender'],
];

const TERRAINS: [Settings['terrain'], string][] = [
  ['auto', 'Auto'],
  ['', 'None'],
  ['Electric', 'Electric'],
  ['Grassy', 'Grassy'],
  ['Misty', 'Misty'],
  ['Psychic', 'Psychic'],
];

const WEATHERS: [Settings['weather'], string][] = [
  ['auto', 'Auto'],
  ['', 'None'],
  ['Sun', 'Sun'],
  ['Rain', 'Rain'],
  ['Sand', 'Sand'],
  ['Snow', 'Snow'],
];

export function Segmented<T extends string | number>({ value, options, onChange, label, grid }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string; grid?: boolean }) {
  return (
    <div className={grid ? 'segmented grid' : 'segmented'} role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : undefined} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <span className="stepper">
      <button type="button" aria-label={`Lower ${label}`} onClick={() => onChange(Math.max(-6, value - 1))} disabled={value <= -6}>
        −
      </button>
      <span className={`stepper-value tabular${value ? ' changed' : ''}`}>{value > 0 ? `+${value}` : value}</span>
      <button type="button" aria-label={`Raise ${label}`} onClick={() => onChange(Math.min(6, value + 1))} disabled={value >= 6}>
        +
      </button>
    </span>
  );
}

export function countFieldChanges(s: Settings) {
  const side = (t: SideToggles) => [...ATTACKER_TOGGLES, ...DEFENDER_TOGGLES].filter(([k]) => t[k]).length + BOOSTS.filter(([k]) => t.boosts[k]).length;
  return Number(s.terrain !== 'auto') + Number(s.weather !== 'auto') + Number(!s.autoIntimidate) + Number(s.gravity) + Number(s.crit) + side(s.mine) + side(s.theirs);
}

export function FieldPanel({ settings, onChange, mode }: { settings: Settings; onChange: (s: Settings) => void; mode: Mode }) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const roles: Record<'mine' | 'theirs', Role> = mode === 'in' ? { mine: 'defender', theirs: 'attacker' } : { mine: 'attacker', theirs: 'defender' };
  const flip = (who: 'mine' | 'theirs', key: BoolKey) => set(who, { ...settings[who], [key]: !settings[who][key] });
  const changes = countFieldChanges(settings);

  const toggleRows = (rows: [BoolKey, string][], role: Role) =>
    rows.map(([key, label]) => (
      <tr key={key}>
        <th scope="row">{label}</th>
        {(['mine', 'theirs'] as const).map((who) => (
          <td key={who} className={roles[who] === role ? undefined : 'dim'}>
            <input type="checkbox" checked={settings[who][key]} onChange={() => flip(who, key)} aria-label={`${label}, ${who === 'mine' ? 'you' : 'opponent'}`} />
          </td>
        ))}
      </tr>
    ));

  return (
    <section className="field-panel">
      <div className="panel-head">
        <h2>Field</h2>
        {changes > 0 && (
          <button
            type="button"
            className="link small"
            onClick={() => onChange({ ...DEFAULT_SETTINGS, band: settings.band, targets: settings.targets, top: settings.top, mine: EMPTY_SIDE, theirs: EMPTY_SIDE })}
          >
            Reset
          </button>
        )}
      </div>

      <div className="field">
        <span className="field-title">Terrain</span>
        <Segmented grid label="Terrain" value={settings.terrain} onChange={(v) => set('terrain', v)} options={TERRAINS} />
      </div>
      <div className="field">
        <span className="field-title">Weather</span>
        <Segmented grid label="Weather" value={settings.weather} onChange={(v) => set('weather', v)} options={WEATHERS} />
      </div>
      <p className="hint">Auto takes weather, terrain and Intimidate from each set's ability.</p>

      <div className="checks">
        <label className="check">
          <input type="checkbox" checked={settings.autoIntimidate} onChange={() => set('autoIntimidate', !settings.autoIntimidate)} />
          Intimidate
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.gravity} onChange={() => set('gravity', !settings.gravity)} />
          Gravity
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.crit} onChange={() => set('crit', !settings.crit)} />
          Critical hits
        </label>
      </div>

      <table className="side-table">
        <thead>
          <tr>
            <th />
            <th scope="col">You</th>
            <th scope="col">Opp</th>
          </tr>
        </thead>
        <tbody>
          {toggleRows(ATTACKER_TOGGLES, 'attacker')}
          <tr className="gap" aria-hidden>
            <td colSpan={3} />
          </tr>
          {toggleRows(DEFENDER_TOGGLES, 'defender')}
          <tr className="gap" aria-hidden>
            <td colSpan={3} />
          </tr>
          {BOOSTS.map(([key, label, role]) => (
            <tr key={key}>
              <th scope="row">{label} stage</th>
              {(['mine', 'theirs'] as const).map((who) => (
                <td key={who} className={roles[who] === role ? undefined : 'dim'}>
                  <Stepper label={`${label}, ${who === 'mine' ? 'you' : 'opponent'}`} value={settings[who].boosts[key]} onChange={(v) => set(who, { ...settings[who], boosts: { ...settings[who].boosts, [key]: v } })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Faded options don't affect this tab.</p>
    </section>
  );
}
