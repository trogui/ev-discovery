import { useState } from 'react';
import type { CalcResponse, CalcRow, PokemonResult } from '../calc/types';
import { formatSp, formeSuffix, outcomeText, pct, statusOf, type Status } from '../format';
import { bandDistance, displayLevel, inBand, lineOf, type Band, type Level, type Targets } from '../ko';
import type { Mode } from '../useStickyList';

type View = { band: Band; targets: Targets };

const DOMAIN: [number, number] = [0, 150];

const STATUS_ICON: Record<Status, string> = { good: '✓', warning: '◐', serious: '▲', critical: '✕' };
const STATUS_ORDER: Status[] = ['critical', 'serious', 'warning', 'good'];

const x = (v: number) => ((Math.min(Math.max(v, DOMAIN[0]), DOMAIN[1]) - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * 100;

const MODES: Record<Mode, { label: string; description: string; legend: Record<Status, string> }> = {
  in: {
    label: 'Defense',
    description: 'Their attacks on you',
    legend: { good: 'Always survives', warning: 'Usually survives', serious: 'Usually KO’d', critical: 'Always KO’d' },
  },
  out: {
    label: 'Offense',
    description: 'Your attacks on them',
    legend: { good: 'Always KOs', warning: 'Usually KOs', serious: 'Rarely KOs', critical: 'Never KOs' },
  },
};

function RangeBar({ row, view, level }: { row: CalcRow; view: View; level: Level }) {
  const left = x(row.minPct);
  const width = Math.max(x(row.maxPct) - left, 1.2);
  const [lo, hi] = view.band;
  const levels = ([1, 2] as Level[]).filter((l) => (l === 1 ? view.targets.ohko : view.targets.twohko));
  return (
    <div className="range" aria-hidden>
      {levels.map((l) => {
        const line = lineOf(row, l);
        return <div key={`band${l}`} className="range-band" style={{ left: `${x((lo * line) / 100)}%`, width: `${x((hi * line) / 100) - x((lo * line) / 100)}%` }} />;
      })}
      {levels.map((l) => (
        <div key={`line${l}`} className={l === 1 ? 'range-line' : 'range-line two'} style={{ left: `${x(lineOf(row, l))}%` }} />
      ))}
      <div className={`range-fill s-${statusOf(row, level)}`} style={{ left: `${left}%`, width: `${width}%` }} />
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  return (
    <span className="outcome-icon" aria-hidden>
      {STATUS_ICON[status]}
    </span>
  );
}

function SetsCell({ row, species }: { row: CalcRow; species: string }) {
  const [first, ...rest] = row.sets;
  const suffix = formeSuffix(first.forme, species);
  const title = row.sets.map((s) => `${Math.round(s.weight * 100)}% · ${s.forme} · ${s.item ?? 'No item'} · ${s.nature} · ${formatSp(s.sp)} (${s.confidence})`).join('\n');
  return (
    <div className="sets" title={title}>
      <span className="set-main">
        {suffix && <span className="forme">{suffix}</span>}
        {first.item ?? 'No item'} · {first.nature}
      </span>
      <span className="set-spread tabular">{formatSp(first.sp)}</span>
      <span className="muted small">
        {Math.round(row.weight * 100)}% of its sets{rest.length ? ` · +${rest.length} with the same result` : ''}
      </span>
    </div>
  );
}

function RowView({ row, species, view }: { row: CalcRow; species: string; view: View }) {
  const level = displayLevel(row, view.band, view.targets);
  const status = statusOf(row, level);
  const lineNote = level === 2 ? `2HKO at ${pct(row.line2Pct)}${row.recoveryNotes.length ? ` · ${row.recoveryNotes.join(', ')}` : ''}` : '';
  return (
    <li className={inBand(row, view.band, view.targets) ? 'calc' : 'calc out-of-range'} title={`${row.desc}${row.field.length ? `\nField: ${row.field.join(', ')}` : ''}`}>
      <div className="move">
        <span>{row.move}</span>
        {row.field.length > 0 && <span className="muted small">{row.field.join(' · ')}</span>}
      </div>
      <SetsCell row={row} species={species} />
      <RangeBar row={row} view={view} level={level} />
      <span className="pct tabular">
        {pct(row.minPct)} – {pct(row.maxPct)}
      </span>
      <div className="outcome-cell">
        <span className={`outcome s-${status}`}>
          <StatusIcon status={status} />
          {outcomeText(row, level)}
        </span>
        {lineNote && <span className="muted small">{lineNote}</span>}
      </div>
    </li>
  );
}

function StatusCounts({ rows, view }: { rows: CalcRow[]; view: View }) {
  if (!rows.length) return <span className="muted small">Nothing in range</span>;
  const counts = new Map<Status, number>();
  for (const r of rows) {
    const status = statusOf(r, displayLevel(r, view.band, view.targets));
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return (
    <div className="summary">
      {STATUS_ORDER.filter((s) => counts.get(s)).map((s) => (
        <span key={s} className={`outcome s-${s}`}>
          <StatusIcon status={s} />
          <span className="tabular">{counts.get(s)}</span>
        </span>
      ))}
    </div>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

type CardProps = {
  result: PokemonResult;
  mode: Mode;
  view: View;
  open: boolean;
  pinned: boolean;
  onToggleOpen: () => void;
  onTogglePin: () => void;
};

function PokemonCard({ result, mode, view, open, pinned, onToggleOpen, onTogglePin }: CardProps) {
  const [showRest, setShowRest] = useState(false);
  const all = result.rows.filter((r) => r.direction === mode);
  const inRange = all.filter((r) => inBand(r, view.band, view.targets));
  const rest = all
    .filter((r) => !inBand(r, view.band, view.targets))
    .map((r) => ({ r, d: bandDistance(r, view.band, view.targets) }))
    .sort((a, b) => a.d - b.d || a.r.order - b.r.order)
    .map(({ r }) => r);

  return (
    <li className={`card${open ? ' open' : ''}${inRange.length ? '' : ' dormant'}`}>
      <div className="card-head">
        <button type="button" className="card-toggle" onClick={onToggleOpen} aria-expanded={open}>
          <span className="rank tabular">{result.custom ? '' : `#${result.rank}`}</span>
          <span className="name">
            {result.species}
            {result.custom && <span className="badge">custom</span>}
          </span>
          <StatusCounts rows={inRange} view={view} />
          <span className="chevron" aria-hidden>
            ›
          </span>
        </button>
        {!result.custom && (
          <button type="button" className={pinned ? 'pin on' : 'pin'} onClick={onTogglePin} aria-pressed={pinned} title={pinned ? 'Unpin' : 'Pin to top'}>
            <PinIcon filled={pinned} />
          </button>
        )}
      </div>
      {open && (
        <div className="card-body">
          {inRange.length > 0 ? (
            <ul className="calcs">
              {inRange.map((r) => (
                <RowView key={r.key} row={r} species={result.species} view={view} />
              ))}
            </ul>
          ) : (
            <p className="muted small card-note">{all.length ? 'No calcs in range.' : 'No damaging calcs.'}</p>
          )}
          {rest.length > 0 && (
            <>
              <button type="button" className="expand-rest" onClick={() => setShowRest(!showRest)} aria-expanded={showRest}>
                <span aria-hidden>{showRest ? '−' : '+'}</span>
                {showRest ? `Hide ${rest.length} outside the range` : `Show ${rest.length} more outside the range`}
              </button>
              {showRest && (
                <ul className="calcs rest">
                  {rest.map((r) => (
                    <RowView key={r.key} row={r} species={result.species} view={view} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

type Props = {
  response: CalcResponse | null;
  pending: boolean;
  stale: boolean;
  band: Band;
  targets: Targets;
  top: number;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  sticky: Record<Mode, string[]>;
  onResetSticky: () => void;
  pinned: string[];
  onTogglePin: (species: string) => void;
  open: string[];
  onOpenChange: (open: string[]) => void;
};

export function Results(props: Props) {
  const { response, pending, stale, band, targets, top, mode, onModeChange, sticky, onResetSticky, pinned, onTogglePin, open, onOpenChange } = props;
  if (!response) return <div className="empty muted">Calculating…</div>;

  const view: View = { band, targets };
  const hasInRange = (r: PokemonResult, m: Mode) => r.rows.some((row) => row.direction === m && inBand(row, band, targets));
  const stickySet = new Set(sticky[mode]);
  const customResults = response.results.filter((r) => r.custom);
  const pinnedResults = pinned.map((s) => response.results.find((r) => !r.custom && r.key === s)).filter((r): r is PokemonResult => !!r);
  const topResults = response.results.filter((r) => r.inTop);
  const listed = topResults.filter((r) => !pinned.includes(r.key) && (hasInRange(r, mode) || stickySet.has(r.key)));
  const dormant = listed.filter((r) => !hasInRange(r, mode)).length;
  const counts = { in: topResults.filter((r) => hasInRange(r, 'in')).length, out: topResults.filter((r) => hasInRange(r, 'out')).length };
  const visible = [...customResults, ...pinnedResults, ...listed];
  const allOpen = visible.length > 0 && visible.every((r) => open.includes(r.key));
  const toggleOpen = (species: string) => onOpenChange(open.includes(species) ? open.filter((s) => s !== species) : [...open, species]);

  const card = (r: PokemonResult) => (
    <PokemonCard
      key={r.key}
      result={r}
      mode={mode}
      view={view}
      open={open.includes(r.key)}
      pinned={pinned.includes(r.key)}
      onToggleOpen={() => toggleOpen(r.key)}
      onTogglePin={() => onTogglePin(r.key)}
    />
  );

  return (
    <div className={pending || stale ? 'results stale' : 'results'}>
      <div className="tabs" role="tablist">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'tab on' : 'tab'} onClick={() => onModeChange(m)}>
            <span>{MODES[m].label}</span>
            <span className="tab-count tabular">{counts[m]}</span>
          </button>
        ))}
      </div>
      <div className="results-head">
        <p>
          {MODES[mode].description}
          <span className="muted">
            {' '}
            · <span className="tabular">{counts[mode]}</span> of the top {top} with calcs within {band[0]}–{band[1]}% of a {[targets.ohko && 'OHKO', targets.twohko && '2HKO'].filter(Boolean).join(' or ')}
          </span>
        </p>
        <div className="actions">
          {dormant > 0 && (
            <button type="button" className="link" onClick={onResetSticky} title="Drop Pokémon that no longer have calcs in range">
              Clear {dormant} out of range
            </button>
          )}
          {visible.length > 0 && (
            <button type="button" className="link" onClick={() => onOpenChange(allOpen ? [] : visible.map((r) => r.key))}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
      </div>
      <ul className="legend">
        {STATUS_ORDER.map((status) => (
          <li key={status} className={`outcome s-${status}`}>
            <StatusIcon status={status} />
            {MODES[mode].legend[status]}
          </li>
        ))}
      </ul>
      {stale && <p className="hint">Your set has an error, showing the last valid results.</p>}
      {customResults.length > 0 && (
        <>
          <h3 className="section-title">Custom</h3>
          <ul className="cards">{customResults.map(card)}</ul>
        </>
      )}
      {pinnedResults.length > 0 && (
        <>
          <h3 className="section-title">Pinned</h3>
          <ul className="cards">{pinnedResults.map(card)}</ul>
        </>
      )}
      {(customResults.length > 0 || pinnedResults.length > 0) && listed.length > 0 && <h3 className="section-title">By usage</h3>}
      {listed.length > 0 ? (
        <ul className="cards">{listed.map(card)}</ul>
      ) : (
        !pinnedResults.length && !customResults.length && <div className="empty muted">Nothing in this range. Widen it or include more opponents.</div>
      )}
      <p className="muted small footnote">
        {response.totalCalcs} calcs in {Math.round(response.ms)} ms
      </p>
    </div>
  );
}
