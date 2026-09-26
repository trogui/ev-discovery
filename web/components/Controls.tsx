import type { Boosts, Settings, SideToggles } from '../calc/types';
import type { Mode } from '../useStickyList';

type Props = { settings: Settings; onChange: (settings: Settings) => void; mode: Mode; onReset: () => void };

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
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

function Toggle({ on, onClick, children, dim }: { on: boolean; onClick: () => void; children: string; dim?: boolean }) {
  return (
    <button type="button" aria-pressed={on} className={`toggle${on ? ' on' : ''}${dim ? ' dim' : ''}`} onClick={onClick} title={dim ? 'Does not affect this mode' : undefined}>
      {children}
    </button>
  );
}

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
      <span className="label">{title}</span>
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

export function Controls({ settings, onChange, mode, onReset }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const [lo, hi] = settings.band;

  return (
    <>
      <section className="panel controls">
        <div className="field">
          <span className="label">Range</span>
          <div className="band">
            <input type="number" value={lo} step={5} aria-label="Minimum" onChange={(e) => set('band', [clampBand(+e.target.value), Math.max(hi, clampBand(+e.target.value))])} />
            <span className="muted">–</span>
            <input type="number" value={hi} step={5} aria-label="Maximum" onChange={(e) => set('band', [Math.min(lo, clampBand(+e.target.value)), clampBand(+e.target.value)])} />
            <span className="muted">% HP</span>
          </div>
        </div>
        <div className="field">
          <span className="label">Opponents</span>
          <Segmented label="Opponents" value={settings.top} onChange={(v) => set('top', v)} options={[[10, 'Top 10'], [20, 'Top 20'], [40, 'Top 40']]} />
        </div>
      </section>

      <section className="panel controls">
        <div className="panel-head">
          <h2>Field</h2>
          <button type="button" className="link small" onClick={onReset}>
            Reset
          </button>
        </div>
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
            Crit
          </Toggle>
        </div>
        <p className="hint">Auto takes weather, terrain and Intimidate from each set's ability.</p>
        <div className="sides">
          <SideColumn title="You" value={settings.mine} onChange={(v) => set('mine', v)} role={mode === 'in' ? 'defender' : 'attacker'} />
          <SideColumn title="Opponent" value={settings.theirs} onChange={(v) => set('theirs', v)} role={mode === 'in' ? 'attacker' : 'defender'} />
        </div>
      </section>
    </>
  );
}
