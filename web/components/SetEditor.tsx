import { useMemo, useState } from 'react';
import { defaultAbility } from '../../src/lib/dex';
import type { Preset } from '../../src/presets';
import { SP_MAX, SP_TOTAL, emptyStats, spreadKey, type Stats } from '../../src/lib/spread';
import { formatSp } from '../format';
import { buildMySet, exportPaste, importPaste, type EditableSet } from '../me';
import { NATURE_OPTIONS, cycleNature, describeNature, rolesOf, type NatureStat } from '../natures';
import { abilityOptions, itemOptions, moveOptions, presetsFor, speciesOptions, usePresets } from '../presets';
import { Combobox } from './Combobox';

const ROWS: [keyof Stats, string][] = [
  ['hp', 'HP'],
  ['atk', 'Atk'],
  ['def', 'Def'],
  ['spa', 'SpA'],
  ['spd', 'SpD'],
  ['spe', 'Spe'],
];

type Props = {
  title: string;
  value: EditableSet | null;
  onChange: (value: EditableSet) => void;
  ranks: Map<string, number>;
  footer?: React.ReactNode;
  embedded?: boolean;
  headerAction?: React.ReactNode;
};

export function fromPreset(species: string, preset: Preset, current?: EditableSet | null): EditableSet {
  return {
    species,
    item: preset.item,
    ability: preset.ability,
    nature: preset.nature,
    sp: preset.sp ?? current?.sp ?? emptyStats(),
    moves: preset.moves,
  };
}

function blank(species: string): EditableSet {
  return { species, item: null, ability: defaultAbility(species), nature: 'Serious', sp: emptyStats(), moves: [] };
}

function SpRow({ stat, label, value, set, onChange }: { stat: keyof Stats; label: string; value: number; set: EditableSet; onChange: (s: EditableSet) => void }) {
  const used = Object.values(set.sp).reduce((a, b) => a + b, 0);
  const cap = Math.min(SP_MAX, value + SP_TOTAL - used);
  const { plus, minus } = rolesOf(set.nature);
  const role = plus === stat ? 'plus' : minus === stat ? 'minus' : '';
  const final = useMemo(() => buildMySet(set).stats[stat], [set, stat]);
  const update = (n: number) => onChange({ ...set, sp: { ...set.sp, [stat]: Math.max(0, Math.min(cap, Math.round(n || 0))) } });

  return (
    <div className="sp-row">
      {stat === 'hp' ? (
        <span className="stat-name">{label}</span>
      ) : (
        <button
          type="button"
          className={`stat-name clickable ${role}`}
          title="Click to raise, again to lower, again to clear"
          onClick={() => onChange({ ...set, nature: cycleNature(set.nature, stat as NatureStat, set.sp) })}
        >
          {label}
          <span className="nature-mark" aria-hidden>
            {role === 'plus' ? '▲' : role === 'minus' ? '▼' : ''}
          </span>
        </button>
      )}
      <input type="range" min={0} max={SP_MAX} value={value} aria-label={`${label} Stat Points`} onChange={(e) => update(+e.target.value)} style={{ '--fill': `${(value / SP_MAX) * 100}%` } as React.CSSProperties} />
      <input
        type="number"
        min={0}
        max={SP_MAX}
        value={value}
        aria-label={`${label} Stat Points value`}
        onChange={(e) => update(+e.target.value)}
        onKeyDown={(e) => {
          if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            update(value + (e.key === 'ArrowUp' ? 4 : -4));
          }
        }}
      />
      <span className={`stat-final tabular ${role}`}>{final}</span>
    </div>
  );
}

export function SetEditor({ title, value, onChange, ranks, footer, embedded, headerAction }: Props) {
  const presets = usePresets();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const entry = value ? presetsFor(presets, value.species) : undefined;
  const species = useMemo(() => speciesOptions(presets, ranks), [presets, ranks]);
  const items = useMemo(() => (value ? itemOptions(entry, value.species) : []), [entry, value?.species]);
  const moves = useMemo(() => moveOptions(entry), [entry]);
  const abilities = useMemo(() => (value ? abilityOptions(entry, value.species) : []), [entry, value?.species]);
  const my = useMemo(() => (value ? buildMySet(value) : null), [value]);
  const used = value ? Object.values(value.sp).reduce((a, b) => a + b, 0) : 0;

  const pickSpecies = (name: string | null) => {
    if (!name || name === value?.species) return;
    const first = presetsFor(presets, name)?.presets[0];
    onChange(first ? fromPreset(name, first) : blank(name));
  };

  const togglePaste = () => {
    setPasteOpen(!pasteOpen);
    setPasteText(value ? exportPaste(value) : '');
    setPasteError(null);
  };

  const applyPaste = () => {
    const result = importPaste(pasteText);
    if (!result.ok) return setPasteError(result.error);
    onChange(result.sets[0]);
    setPasteError(result.warnings.join(' ') || null);
    if (!result.warnings.length) setPasteOpen(false);
  };

  return (
    <section className={embedded ? 'editor embedded' : 'panel editor'}>
      <div className="panel-head">
        <h2>{title}</h2>
        <div className="actions">
          <button type="button" className="link small" onClick={togglePaste}>
            {pasteOpen ? 'Close paste' : 'Import / export'}
          </button>
          {headerAction}
        </div>
      </div>

      {pasteOpen && (
        <div className="paste-box">
          <textarea className="paste" value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={8} spellCheck={false} placeholder="Paste a Showdown set" />
          <div className="paste-actions">
            <button type="button" className="button primary" onClick={applyPaste}>
              Apply
            </button>
            <button type="button" className="button" onClick={() => navigator.clipboard.writeText(pasteText)}>
              Copy
            </button>
          </div>
          {pasteError && <p className="error">{pasteError}</p>}
        </div>
      )}

      <Combobox className="species" ariaLabel="Pokémon" value={value?.species ?? null} options={species} onChange={pickSpecies} placeholder="Search Pokémon…" />

      {value && my && (
        <>
          {entry && entry.presets.length > 0 && (
            <div className="presets" role="list" aria-label="Common sets">
              {entry.presets.map((p, i) => {
                const active = p.item === value.item && p.nature === value.nature && (!p.sp || spreadKey(p.sp) === spreadKey(value.sp));
                return (
                  <button key={i} type="button" role="listitem" className={active ? 'preset on' : 'preset'} onClick={() => onChange(fromPreset(value.species, p, value))} title={p.moves.join(' · ')}>
                    <span className="preset-main">
                      {p.item ?? 'No item'} · {p.nature}
                    </span>
                    <span className="muted small tabular">
                      {p.sp ? formatSp(p.sp) : 'no spread data'} · {Math.round(p.share * 100)}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="editor-grid">
            <label className="mini-label">Item</label>
            <Combobox ariaLabel="Item" value={value.item} options={items} onChange={(item) => onChange({ ...value, item })} allowEmpty placeholder="No item" />
            <label className="mini-label">Ability</label>
            {my.forme !== value.species ? (
              <div className="static-field" title={`${my.forme} always has ${my.ability}`}>
                {my.ability} <span className="muted small">({my.forme.replace(`${value.species}-`, '')})</span>
              </div>
            ) : (
              <Combobox ariaLabel="Ability" value={my.ability} options={abilities} onChange={(ability) => ability && onChange({ ...value, ability })} placeholder="Ability" />
            )}
            <label className="mini-label">Nature</label>
            <select aria-label="Nature" value={value.nature} onChange={(e) => onChange({ ...value, nature: e.target.value })}>
              {NATURE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} ({describeNature(n)})
                </option>
              ))}
            </select>
          </div>

          <div className="sp-head">
            <span className="mini-label">Stat Points</span>
            <span className={`small tabular ${used === SP_TOTAL ? 'muted' : 'sp-left'}`}>{SP_TOTAL - used} left</span>
          </div>
          <div className="sp-rows">
            {ROWS.map(([stat, label]) => (
              <SpRow key={stat} stat={stat} label={label} value={value.sp[stat]} set={value} onChange={onChange} />
            ))}
          </div>

          <div className="moves-grid">
            {[0, 1, 2, 3].map((i) => (
              <Combobox
                key={i}
                ariaLabel={`Move ${i + 1}`}
                value={value.moves[i] ?? null}
                options={moves}
                allowEmpty
                placeholder={`Move ${i + 1}`}
                onChange={(m) => {
                  const next = [...value.moves];
                  next[i] = m ?? '';
                  onChange({ ...value, moves: next.slice(0, 4) });
                }}
              />
            ))}
          </div>
          {footer}
        </>
      )}
    </section>
  );
}
