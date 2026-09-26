import type { Settings, SideToggles } from '../calc/types';

type Props = { settings: Settings; onChange: (settings: Settings) => void };

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

const SIDE_TOGGLES: [keyof SideToggles, string][] = [
  ['helpingHand', 'Helping Hand'],
  ['reflect', 'Reflect'],
  ['lightScreen', 'Light Screen'],
  ['friendGuard', 'Friend Guard'],
];

function SideChips({ value, onChange }: { value: SideToggles; onChange: (v: SideToggles) => void }) {
  return (
    <div className="chips">
      {SIDE_TOGGLES.map(([key, label]) => (
        <button key={key} type="button" aria-pressed={value[key]} className={value[key] ? 'chip on' : 'chip'} onClick={() => onChange({ ...value, [key]: !value[key] })}>
          {label}
        </button>
      ))}
    </div>
  );
}

function clampBand(n: number) {
  return Math.max(1, Math.min(300, Math.round(n)));
}

export function Controls({ settings, onChange }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const [lo, hi] = settings.band;

  return (
    <section className="panel controls">
      <div className="field">
        <label className="label">Rango al filo</label>
        <div className="band">
          <input type="number" value={lo} step={5} aria-label="Mínimo" onChange={(e) => set('band', [clampBand(+e.target.value), Math.max(hi, clampBand(+e.target.value))])} />
          <span className="muted">–</span>
          <input type="number" value={hi} step={5} aria-label="Máximo" onChange={(e) => set('band', [Math.min(lo, clampBand(+e.target.value)), clampBand(+e.target.value)])} />
          <span className="muted">% de la vida</span>
        </div>
      </div>

      <div className="field">
        <label className="label">Rivales</label>
        <Segmented label="Rivales" value={settings.top} onChange={(v) => set('top', v)} options={[[10, 'Top 10'], [20, 'Top 20'], [40, 'Top 40']]} />
      </div>

      <div className="field">
        <label className="label">Cálculos</label>
        <Segmented
          label="Dirección"
          value={settings.direction}
          onChange={(v) => set('direction', v)}
          options={[
            ['both', 'Ambos'],
            ['in', 'Recibes'],
            ['out', 'Haces'],
          ]}
        />
      </div>

      <div className="field two">
        <div>
          <label className="label" htmlFor="weather">
            Clima
          </label>
          <select id="weather" value={settings.weather} onChange={(e) => set('weather', e.target.value as Settings['weather'])}>
            <option value="auto">Auto</option>
            <option value="">Ninguno</option>
            <option value="Sun">Sol</option>
            <option value="Rain">Lluvia</option>
            <option value="Sand">Arena</option>
            <option value="Snow">Nieve</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="terrain">
            Terreno
          </label>
          <select id="terrain" value={settings.terrain} onChange={(e) => set('terrain', e.target.value as Settings['terrain'])}>
            <option value="auto">Auto</option>
            <option value="">Ninguno</option>
            <option value="Grassy">Grassy</option>
            <option value="Psychic">Psychic</option>
            <option value="Electric">Electric</option>
            <option value="Misty">Misty</option>
          </select>
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={settings.autoIntimidate} onChange={(e) => set('autoIntimidate', e.target.checked)} />
        Aplicar Intimidate de las habilidades
      </label>
      <p className="hint">Auto usa la habilidad de cada set: Rillaboom trae Grassy Terrain, Charizard-Mega-Y trae sol…</p>

      <div className="field">
        <label className="label">Tu lado</label>
        <SideChips value={settings.mine} onChange={(v) => set('mine', v)} />
      </div>
      <div className="field">
        <label className="label">Lado rival</label>
        <SideChips value={settings.theirs} onChange={(v) => set('theirs', v)} />
      </div>
    </section>
  );
}
