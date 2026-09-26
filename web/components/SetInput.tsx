import type { ParseResult } from '../me';
import { EXAMPLE } from '../me';

const STAT_ORDER = [
  ['hp', 'HP'],
  ['atk', 'Atk'],
  ['def', 'Def'],
  ['spa', 'SpA'],
  ['spd', 'SpD'],
  ['spe', 'Spe'],
] as const;

type Props = { text: string; onChange: (text: string) => void; parsed: ParseResult };

export function SetInput({ text, onChange, parsed }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Your Pokémon</h2>
        {!text.trim() && (
          <button type="button" className="link" onClick={() => onChange(EXAMPLE)}>
            Load example
          </button>
        )}
      </div>
      <textarea
        className="paste"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'Paste a Showdown set\n\nGengar @ Gengarite\nEVs: 2 HP / 32 SpA / 32 Spe\nTimid Nature\n- Shadow Ball'}
        spellCheck={false}
        rows={9}
      />
      {parsed.ok ? (
        <div className="parsed">
          <div className="parsed-title">
            <strong>{parsed.set.forme}</strong>
            <span className="muted">
              {parsed.set.nature}
              {parsed.set.ability ? ` · ${parsed.set.ability}` : ''}
            </span>
          </div>
          <dl className="stat-grid">
            {STAT_ORDER.map(([key, label]) => (
              <div key={key} className={parsed.set.sp[key] ? 'invested' : undefined}>
                <dt>{label}</dt>
                <dd>{parsed.set.stats[key]}</dd>
              </div>
            ))}
          </dl>
          {parsed.warnings.map((w) => (
            <p key={w} className="hint">
              {w}
            </p>
          ))}
        </div>
      ) : (
        parsed.error && <p className="error">{parsed.error}</p>
      )}
    </section>
  );
}
