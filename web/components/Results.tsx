import { useState } from 'react';
import type { CalcRow, CalcResponse, PokemonResult } from '../calc/types';
import { formatSp, formeSuffix, outcomeText, pct, statusOf, type Status } from '../format';

const DOMAIN: [number, number] = [40, 160];

const STATUS_ICON: Record<Status, string> = { good: '✓', warning: '◐', serious: '▲', critical: '✕' };

const x = (v: number) => ((Math.min(Math.max(v, DOMAIN[0]), DOMAIN[1]) - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * 100;

function RangeBar({ row, band }: { row: CalcRow; band: [number, number] }) {
  const status = statusOf(row);
  const left = x(row.minPct);
  const width = Math.max(x(row.maxPct) - left, 1.2);
  return (
    <div className="range" aria-hidden>
      <div className="range-band" style={{ left: `${x(band[0])}%`, width: `${x(band[1]) - x(band[0])}%` }} />
      <div className="range-100" style={{ left: `${x(100)}%` }} />
      <div className={`range-fill s-${status}`} style={{ left: `${left}%`, width: `${width}%` }} />
    </div>
  );
}

function Outcome({ row }: { row: CalcRow }) {
  const status = statusOf(row);
  return (
    <span className={`outcome s-${status}`}>
      <span className="outcome-icon" aria-hidden>
        {STATUS_ICON[status]}
      </span>
      {outcomeText(row)}
    </span>
  );
}

function SetsCell({ row, species }: { row: CalcRow; species: string }) {
  const [first, ...rest] = row.sets;
  const suffix = formeSuffix(first.forme, species);
  const title = row.sets.map((s) => `${Math.round(s.weight * 100)}% · ${s.forme} · ${s.item ?? 'Sin objeto'} · ${s.nature} · ${formatSp(s.sp)} (${s.confidence})`).join('\n');
  return (
    <div className="sets" title={title}>
      <span className="set-main">
        {suffix && <span className="forme">{suffix}</span>}
        {first.item ?? 'Sin objeto'} · {first.nature}
      </span>
      <span className="set-spread tabular">{formatSp(first.sp)}</span>
      <span className="muted small">
        {Math.round(row.weight * 100)}% de sus sets{rest.length ? ` · +${rest.length} con el mismo resultado` : ''}
      </span>
    </div>
  );
}

function RowView({ row, species, band }: { row: CalcRow; species: string; band: [number, number] }) {
  return (
    <li className="calc" title={`${row.desc}${row.field.length ? `\nCampo: ${row.field.join(', ')}` : ''}`}>
      <div className="move">
        <span>{row.move}</span>
        {row.field.length > 0 && <span className="muted small">{row.field.join(' · ')}</span>}
      </div>
      <SetsCell row={row} species={species} />
      <RangeBar row={row} band={band} />
      <span className="pct tabular">
        {pct(row.minPct)} – {pct(row.maxPct)}
      </span>
      <Outcome row={row} />
    </li>
  );
}

function SummaryGroup({ label, rows }: { label: string; rows: CalcRow[] }) {
  if (!rows.length) return null;
  return (
    <span className="summary-group">
      <span className="muted small">{label}</span>
      <span className="dots">
        {rows.map((r) => (
          <span key={r.key} className={`dot s-${statusOf(r)}`} />
        ))}
      </span>
    </span>
  );
}

function Summary({ rows }: { rows: CalcRow[] }) {
  return (
    <div className="summary">
      <SummaryGroup label="Recibes" rows={rows.filter((r) => r.direction === 'in')} />
      <SummaryGroup label="Haces" rows={rows.filter((r) => r.direction === 'out')} />
    </div>
  );
}

function PokemonCard({ result, open, onToggle, band }: { result: PokemonResult; open: boolean; onToggle: () => void; band: [number, number] }) {
  const incoming = result.rows.filter((r) => r.direction === 'in');
  const outgoing = result.rows.filter((r) => r.direction === 'out');
  return (
    <li className={open ? 'card open' : 'card'}>
      <button type="button" className="card-head" onClick={onToggle} aria-expanded={open}>
        <span className="rank tabular">#{result.rank}</span>
        <span className="name">{result.species}</span>
        <Summary rows={result.rows} />
        <span className="chevron" aria-hidden>
          ›
        </span>
      </button>
      {open && (
        <div className="card-body">
          {incoming.length > 0 && (
            <>
              <h3>Lo que te hace</h3>
              <ul className="calcs">
                {incoming.map((r) => (
                  <RowView key={r.key} row={r} species={result.species} band={band} />
                ))}
              </ul>
            </>
          )}
          {outgoing.length > 0 && (
            <>
              <h3>Lo que le haces</h3>
              <ul className="calcs">
                {outgoing.map((r) => (
                  <RowView key={r.key} row={r} species={result.species} band={band} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}

const LEGEND: [Status, string][] = [
  ['good', 'Seguro a tu favor'],
  ['warning', 'Probable a tu favor'],
  ['serious', 'Probable en contra'],
  ['critical', 'Seguro en contra'],
];

type Props = { response: CalcResponse | null; pending: boolean; band: [number, number]; top: number; hasSet: boolean };

export function Results({ response, pending, band, top, hasSet }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (!hasSet)
    return (
      <div className="empty">
        <p>Pega tu set a la izquierda.</p>
        <p className="muted">
          Calculamos lo que te hacen y lo que haces contra los sets más usados de los top {top} de Reg M-C, y te enseñamos solo lo que cae entre el {band[0]}% y el {band[1]}% de la vida.
        </p>
      </div>
    );
  if (!response) return <div className="empty muted">Calculando…</div>;

  const results = response.results;
  const allOpen = results.length > 0 && results.every((r) => open.has(r.species));
  const toggle = (species: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(species)) next.delete(species);
      else next.add(species);
      return next;
    });

  return (
    <div className={pending ? 'results stale' : 'results'}>
      <div className="results-head">
        <p>
          <strong>{results.length}</strong> de {top} rivales con cálculos al filo
          <span className="muted">
            {' '}
            · {results.reduce((n, r) => n + r.rows.length, 0)} cálculos · {response.totalCalcs} evaluados en {Math.round(response.ms)} ms
          </span>
        </p>
        {results.length > 0 && (
          <button type="button" className="link" onClick={() => setOpen(allOpen ? new Set() : new Set(results.map((r) => r.species)))}>
            {allOpen ? 'Contraer todo' : 'Expandir todo'}
          </button>
        )}
      </div>
      <ul className="legend">
        {LEGEND.map(([status, label]) => (
          <li key={status} className={`outcome s-${status}`}>
            <span className="outcome-icon" aria-hidden>
              {STATUS_ICON[status]}
            </span>
            {label}
          </li>
        ))}
      </ul>
      {results.length === 0 ? (
        <div className="empty muted">Nada cae en este rango. Prueba a ampliarlo o a subir el número de rivales.</div>
      ) : (
        <ul className="cards">
          {results.map((r) => (
            <PokemonCard key={r.species} result={r} open={open.has(r.species)} onToggle={() => toggle(r.species)} band={band} />
          ))}
        </ul>
      )}
    </div>
  );
}
