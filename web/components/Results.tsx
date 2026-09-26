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

const STATUS_ORDER: Status[] = ['critical', 'serious', 'warning', 'good'];

function StatusCounts({ rows }: { rows: CalcRow[] }) {
  const counts = new Map<Status, number>();
  for (const r of rows) counts.set(statusOf(r), (counts.get(statusOf(r)) ?? 0) + 1);
  return (
    <div className="summary">
      {STATUS_ORDER.filter((s) => counts.get(s)).map((s) => (
        <span key={s} className={`outcome s-${s}`}>
          <span className="outcome-icon" aria-hidden>
            {STATUS_ICON[s]}
          </span>
          <span className="tabular">{counts.get(s)}</span>
        </span>
      ))}
    </div>
  );
}

function PokemonCard({ result, rows, open, onToggle, band }: { result: PokemonResult; rows: CalcRow[]; open: boolean; onToggle: () => void; band: [number, number] }) {
  return (
    <li className={open ? 'card open' : 'card'}>
      <button type="button" className="card-head" onClick={onToggle} aria-expanded={open}>
        <span className="rank tabular">#{result.rank}</span>
        <span className="name">{result.species}</span>
        <StatusCounts rows={rows} />
        <span className="chevron" aria-hidden>
          ›
        </span>
      </button>
      {open && (
        <div className="card-body">
          <ul className="calcs">
            {rows.map((r) => (
              <RowView key={r.key} row={r} species={result.species} band={band} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export type Mode = 'in' | 'out';

const MODES: Record<Mode, { label: string; description: string; legend: Record<Status, string> }> = {
  in: {
    label: 'Defensivo',
    description: 'Lo que te hacen sus ataques',
    legend: { good: 'Aguantas seguro', warning: 'Probablemente aguantas', serious: 'Probablemente te mata', critical: 'Te mata seguro' },
  },
  out: {
    label: 'Ofensivo',
    description: 'Lo que les hacen tus ataques',
    legend: { good: 'Lo matas seguro', warning: 'Probablemente lo matas', serious: 'Probablemente no lo matas', critical: 'No lo matas' },
  },
};

type Props = {
  response: CalcResponse | null;
  pending: boolean;
  band: [number, number];
  top: number;
  hasSet: boolean;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
};

export function Results({ response, pending, band, top, hasSet, mode, onModeChange }: Props) {
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

  const byMode = (m: Mode) =>
    response.results.map((result) => ({ result, rows: result.rows.filter((r) => r.direction === m) })).filter((x) => x.rows.length > 0);
  const visible = byMode(mode);
  const counts = { in: byMode('in').length, out: byMode('out').length };
  const allOpen = visible.length > 0 && visible.every((v) => open.has(v.result.species));
  const toggle = (species: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(species)) next.delete(species);
      else next.add(species);
      return next;
    });

  return (
    <div className={pending ? 'results stale' : 'results'}>
      <div className="tabs" role="tablist">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'tab on' : 'tab'} onClick={() => onModeChange(m)}>
            <span className="tab-label">{MODES[m].label}</span>
            <span className="tab-count tabular">{counts[m]}</span>
          </button>
        ))}
      </div>
      <div className="results-head">
        <p>
          {MODES[mode].description}
          <span className="muted">
            {' '}
            · <span className="tabular">{visible.length}</span> de {top} rivales · <span className="tabular">{visible.reduce((n, v) => n + v.rows.length, 0)}</span> cálculos al filo
          </span>
        </p>
        {visible.length > 0 && (
          <button type="button" className="link" onClick={() => setOpen(allOpen ? new Set() : new Set(visible.map((v) => v.result.species)))}>
            {allOpen ? 'Contraer todo' : 'Expandir todo'}
          </button>
        )}
      </div>
      <ul className="legend">
        {STATUS_ORDER.map((status) => (
          <li key={status} className={`outcome s-${status}`}>
            <span className="outcome-icon" aria-hidden>
              {STATUS_ICON[status]}
            </span>
            {MODES[mode].legend[status]}
          </li>
        ))}
      </ul>
      {visible.length === 0 ? (
        <div className="empty muted">
          {mode === 'out' && !response.results.some((r) => r.rows.some((x) => x.direction === 'out'))
            ? 'Nada al filo. Si tu set no tiene movimientos de daño, aquí no saldrá nada.'
            : 'Nada cae en este rango. Prueba a ampliarlo o a subir el número de rivales.'}
        </div>
      ) : (
        <ul className="cards">
          {visible.map(({ result, rows }) => (
            <PokemonCard key={result.species} result={result} rows={rows} open={open.has(result.species)} onToggle={() => toggle(result.species)} band={band} />
          ))}
        </ul>
      )}
      <p className="muted small footnote">{response.totalCalcs} cálculos en {Math.round(response.ms)} ms</p>
    </div>
  );
}
