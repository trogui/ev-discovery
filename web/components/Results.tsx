import { useState } from 'react';
import type { StatID } from '@smogon/calc/dist/data/interface.js';
import { gen, toID } from '../../src/lib/dex';
import type { CalcResponse, CalcRow, PokemonResult, SetGroup, SetRef } from '../calc/types';
import { formatSp, formeSuffix, outcomeText, pct, statusOf, type Status } from '../format';
import { bandDistance, displayLevel, inBand, lineOf, type Band, type Level, type Targets } from '../ko';
import type { Mode } from '../useStickyList';

type View = { band: Band; targets: Targets; mode: Mode; customOnly: boolean };

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

const STAT_LABEL: Record<StatID, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

function listOf(values: string[]) {
  const unique = [...new Set(values)];
  return unique.length <= 2 ? unique.join(' / ') : `${unique.slice(0, 2).join(' / ')} +${unique.length - 2}`;
}

function relevantStats(group: SetGroup, mode: Mode): StatID[] {
  if (mode === 'out') return ['hp', 'def', 'spd'];
  const categories = new Set(group.rows.map((r) => gen.moves.get(toID(r.move) as never)?.category));
  const stats: StatID[] = [];
  if (categories.has('Physical')) stats.push('atk');
  if (categories.has('Special')) stats.push('spa');
  return stats;
}

function spPart(set: SetRef, stats: StatID[]) {
  return stats.map((s) => `${set.sp[s]} ${STAT_LABEL[s]}`).join(' / ');
}

function groupLabel(group: SetGroup, species: string, mode: Mode) {
  const first = group.sets[0];
  const stats = relevantStats(group, mode);
  return {
    forme: formeSuffix(first.forme, species),
    main: `${listOf(group.sets.map((s) => s.item ?? 'No item'))} · ${listOf(group.sets.map((s) => s.nature))}`,
    sp: listOf(group.sets.map((s) => spPart(s, stats))),
    title: group.sets
      .map((s) => `${s.custom ? 'custom' : `${Math.round(s.weight * 100)}%`} · ${s.forme} · ${s.item ?? 'No item'} · ${s.ability ?? ''} · ${s.nature} · ${formatSp(s.sp)}`)
      .join('\n'),
  };
}

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

function RowView({ row, view }: { row: CalcRow; view: View }) {
  const level = displayLevel(row, view.band, view.targets);
  const status = statusOf(row, level);
  const lineNote = level === 2 ? `2HKO at ${pct(row.line2Pct)}${row.recoveryNotes.length ? ` · ${row.recoveryNotes.join(', ')}` : ''}` : '';
  return (
    <li className={inBand(row, view.band, view.targets) ? 'calc' : 'calc out-of-range'} title={`${row.desc}${row.field.length ? `\nField: ${row.field.join(', ')}` : ''}`}>
      <div className="move">
        <span>{row.move}</span>
        {row.field.length > 0 && <span className="muted small">{row.field.join(' · ')}</span>}
      </div>
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

function groupsFor(result: PokemonResult, view: View) {
  const groups = result.groups[view.mode].filter((g) => !view.customOnly || g.custom);
  return [...groups].sort((a, b) => Number(b.custom) - Number(a.custom) || b.weight - a.weight || a.order - b.order);
}

const inRangeOf = (rows: CalcRow[], view: View) => rows.filter((r) => inBand(r, view.band, view.targets));

const closest = (rows: CalcRow[], view: View) => Math.min(...rows.map((r) => bandDistance(r, view.band, view.targets)));

function GroupView({ group, species, view, showAll }: { group: SetGroup; species: string; view: View; showAll: boolean }) {
  const label = groupLabel(group, species, view.mode);
  const inRange = inRangeOf(group.rows, view);
  const rest = showAll || group.custom
    ? group.rows.filter((r) => !inRange.includes(r)).sort((a, b) => bandDistance(a, view.band, view.targets) - bandDistance(b, view.band, view.targets) || a.order - b.order)
    : [];
  return (
    <div className={inRange.length ? 'group' : 'group dormant'}>
      <div className="group-head" title={label.title}>
        <div className="group-label">
          <span className="set-main">
            {label.forme && <span className="forme">{label.forme}</span>}
            {label.main}
          </span>
          {label.sp && <span className="set-spread tabular">{label.sp}</span>}
        </div>
        <span className="group-weight muted small tabular">
          {group.custom ? <span className="badge">custom</span> : `${Math.max(1, Math.round(group.weight * 100))}%`}
          {group.sets.length > 1 && ` · ${group.sets.length} sets`}
        </span>
      </div>
      <ul className="calcs">
        {[...inRange, ...rest].map((r) => (
          <RowView key={r.key} row={r} view={view} />
        ))}
      </ul>
    </div>
  );
}

type CardProps = {
  result: PokemonResult;
  view: View;
  open: boolean;
  pinned: boolean;
  onToggleOpen: () => void;
  onTogglePin: () => void;
};

function PokemonCard({ result, view, open, pinned, onToggleOpen, onTogglePin }: CardProps) {
  const [showAll, setShowAll] = useState(false);
  const groups = groupsFor(result, view);
  const allRows = groups.flatMap((g) => g.rows);
  const inRangeRows = inRangeOf(allRows, view);
  const active = groups.filter((g) => g.custom || inRangeOf(g.rows, view).length > 0);
  const idle = groups.filter((g) => !active.includes(g)).sort((a, b) => closest(a.rows, view) - closest(b.rows, view));
  const hidden = groups.filter((g) => !g.custom).flatMap((g) => g.rows).length - inRangeOf(groups.filter((g) => !g.custom).flatMap((g) => g.rows), view).length;

  return (
    <li className={`card${open ? ' open' : ''}${inRangeRows.length ? '' : ' dormant'}`}>
      <div className="card-head">
        <button type="button" className="card-toggle" onClick={onToggleOpen} aria-expanded={open}>
          <span className="rank tabular">{result.rank ? `#${result.rank}` : ''}</span>
          <span className="name">
            {result.species}
            {result.hasCustom && <span className="badge">custom</span>}
          </span>
          <StatusCounts rows={inRangeRows} view={view} />
          <span className="chevron" aria-hidden>
            ›
          </span>
        </button>
        <button type="button" className={pinned ? 'pin on' : 'pin'} onClick={onTogglePin} aria-pressed={pinned} title={pinned ? 'Unpin' : 'Pin to top'}>
          <PinIcon filled={pinned} />
        </button>
      </div>
      {open && (
        <div className="card-body">
          {active.map((g) => (
            <GroupView key={g.key} group={g} species={result.species} view={view} showAll={showAll} />
          ))}
          {!active.length && <p className="muted small card-note">{groups.length ? 'No calcs in range.' : 'No damaging calcs.'}</p>}
          {showAll && idle.map((g) => <GroupView key={g.key} group={g} species={result.species} view={view} showAll />)}
          {hidden > 0 && (
            <button type="button" className="expand-rest" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
              <span aria-hidden>{showAll ? '−' : '+'}</span>
              {showAll
                ? `Hide ${hidden} outside the range`
                : `Show ${hidden} more outside the range${idle.length ? ` · ${idle.length} more set${idle.length > 1 ? 's' : ''}` : ''}`}
            </button>
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
  customOnly: boolean;
  onCustomOnlyChange: (value: boolean) => void;
  hasLibrary: boolean;
  sticky: Record<Mode, string[]>;
  onResetSticky: () => void;
  pinned: string[];
  onTogglePin: (species: string) => void;
  open: string[];
  onOpenChange: (open: string[]) => void;
};

export function Results(props: Props) {
  const { response, pending, stale, band, targets, top, mode, onModeChange, customOnly, onCustomOnlyChange, hasLibrary, sticky, onResetSticky, pinned, onTogglePin, open, onOpenChange } = props;
  if (!response) return <div className="empty muted">Calculating…</div>;

  const only = customOnly && hasLibrary;
  const view: View = { band, targets, mode, customOnly: only };
  const hasInRange = (r: PokemonResult, m: Mode) => groupsFor(r, { ...view, mode: m }).some((g) => inRangeOf(g.rows, view).length > 0);
  const eligible = response.results.filter((r) => (only ? r.hasCustom : r.inTop || r.hasCustom || pinned.includes(r.key)));
  const stickySet = new Set(sticky[mode]);

  const pinnedResults = pinned.map((s) => eligible.find((r) => r.key === s)).filter((r): r is PokemonResult => !!r);
  const customResults = eligible.filter((r) => r.onlyCustom && !pinned.includes(r.key));
  const listed = eligible.filter((r) => !r.onlyCustom && !pinned.includes(r.key) && (r.hasCustom || hasInRange(r, mode) || stickySet.has(r.key)));
  const dormant = listed.filter((r) => !r.hasCustom && !hasInRange(r, mode)).length;
  const counted = eligible.filter((r) => r.inTop || r.hasCustom);
  const counts = { in: counted.filter((r) => hasInRange(r, 'in')).length, out: counted.filter((r) => hasInRange(r, 'out')).length };
  const visible = [...customResults, ...pinnedResults, ...listed];
  const allOpen = visible.length > 0 && visible.every((r) => open.includes(r.key));
  const toggleOpen = (key: string) => onOpenChange(open.includes(key) ? open.filter((s) => s !== key) : [...open, key]);

  const card = (r: PokemonResult) => (
    <PokemonCard
      key={r.key}
      result={r}
      view={view}
      open={open.includes(r.key)}
      pinned={pinned.includes(r.key)}
      onToggleOpen={() => toggleOpen(r.key)}
      onTogglePin={() => onTogglePin(r.key)}
    />
  );

  const sections: [string, PokemonResult[]][] = [
    ['Custom', customResults],
    ['Pinned', pinnedResults],
    ['By usage', listed],
  ];
  const nonEmpty = sections.filter(([, list]) => list.length);

  return (
    <div className={pending || stale ? 'results stale' : 'results'}>
      <div className="tabs" role="tablist">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'tab on' : 'tab'} onClick={() => onModeChange(m)}>
            <span>{MODES[m].label}</span>
            <span className="tab-count tabular">{counts[m]}</span>
          </button>
        ))}
        {hasLibrary && (
          <button type="button" className={`toggle tabs-toggle${only ? ' on' : ''}`} aria-pressed={only} onClick={() => onCustomOnlyChange(!customOnly)}>
            Custom only
          </button>
        )}
      </div>
      <div className="results-head">
        <p>
          {MODES[mode].description}
          <span className="muted">
            {' '}
            · <span className="tabular">{counts[mode]}</span> {only ? 'with custom sets' : `of the top ${top}`} with calcs within {band[0]}–{band[1]}% of a{' '}
            {[targets.ohko && 'OHKO', targets.twohko && '2HKO'].filter(Boolean).join(' or ')}
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
      {nonEmpty.map(([title, list]) => (
        <section key={title} className="result-section">
          {nonEmpty.length > 1 && <h3 className="section-title">{title}</h3>}
          <ul className="cards">{list.map(card)}</ul>
        </section>
      ))}
      {!nonEmpty.length && (
        <div className="empty muted">{only ? 'No custom sets yet. Add some in Custom opponents.' : 'Nothing in this range. Widen it or include more opponents.'}</div>
      )}
      <p className="muted small footnote">
        {response.totalCalcs} calcs in {Math.round(response.ms)} ms
      </p>
    </div>
  );
}
