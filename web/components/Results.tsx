import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StatID } from '@smogon/calc/dist/data/interface.js';
import { gen, toID } from '../../src/lib/dex';
import type { CalcResponse, CalcRow, PokemonResult, SetGroup, SetRef } from '../calc/types';
import { formatSp, formeSuffix, outcomeText, pct, toneOf, type Tone } from '../format';
import { bandDistance, displayLevel, inBand, lineOf, type Band, type Level, type Targets } from '../ko';
import { headOf, isDecisive, keyOf, watchedEntry, type Mode, type Watch } from '../useStickyList';
import type { LibraryEntry } from '../library';
import type { EditableSet } from '../me';
import { SetEditor } from './SetEditor';
import { ItemIcon, PokemonSprite } from './Sprites';

export type Picker = { active: boolean; has: (group: SetGroup, row: CalcRow) => boolean; toggle: (result: PokemonResult, group: SetGroup, row: CalcRow, level: Level) => void };

export type Customs = {
  editing: string | null;
  entry: (id: string) => LibraryEntry | undefined;
  create: (result: PokemonResult, group: SetGroup | null) => void;
  edit: (id: string | null) => void;
  update: (id: string, set: EditableSet) => void;
  remove: (id: string) => void;
  ranks: Map<string, number>;
};

type View = { band: Band; targets: Targets; mode: Mode; customOnly: boolean; watch: Watch | null; picker: Picker; customs: Customs };

const customId = (group: SetGroup) => (group.custom ? group.sets[0].id.slice('custom:'.length) : null);

const MODES: Record<Mode, { label: string }> = {
  in: { label: 'Defense' },
  out: { label: 'Offense' },
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

export function groupLabel(group: SetGroup, species: string, mode: Mode) {
  const first = group.sets[0];
  const stats = relevantStats(group, mode);
  return {
    forme: formeSuffix(first.forme, species),
    item: listOf(group.sets.map((s) => s.item ?? 'No item')),
    nature: listOf(group.sets.map((s) => s.nature)),
    sp: (() => {
      const unique = [...new Set(group.sets.map((s) => spPart(s, stats)))];
      return unique.length > 1 ? `${unique[0]} +${unique.length - 1}` : unique[0];
    })(),
    title: group.sets
      .map((s) => `${s.custom ? 'custom' : `${Math.round(s.weight * 100)}%`} · ${s.forme} · ${s.item ?? 'No item'} · ${s.ability ?? ''} · ${s.nature} · ${formatSp(s.sp)}`)
      .join('\n'),
  };
}

export function RangeBar({ row, band, level }: { row: CalcRow; band: Band; level: Level }) {
  const line = lineOf(row, level);
  const [lo, hi] = band;
  const half = Math.max(100 - lo, hi - 100) + 10;
  const at = (v: number) => (((v / line) * 100 - (100 - half)) / (2 * half)) * 100;
  const clampAt = (v: number) => Math.min(Math.max(at(v), 0), 100);
  const offRight = at(row.minPct) > 100;
  const offLeft = at(row.maxPct) < 0;
  const left = offRight ? 88 : clampAt(row.minPct);
  const right = offLeft ? 12 : clampAt(row.maxPct);
  return (
    <div className={`bar t-${toneOf(row, level)}${level === 2 ? ' two' : ''}`} aria-hidden>
      <div className="bar-band" style={{ left: `${clampAt((lo * line) / 100)}%`, right: `${100 - clampAt((hi * line) / 100)}%` }} />
      <div className={`bar-fill${offRight ? ' off-right' : offLeft ? ' off-left' : `${at(row.minPct) < 0 ? ' cut-left' : ''}${at(row.maxPct) > 100 ? ' cut-right' : ''}`}`} style={{ left: `${left}%`, width: `${Math.max(right - left, 1)}%` }} />
      <div className="bar-line" />
    </div>
  );
}

export function Result({ row, level, status }: { row: CalcRow; level: Level; status: Tone }) {
  const text = outcomeText(row, level);
  const m = text.match(/^([\d.]+%) (.*)$/);
  return (
    <span className={`result t-${status}`}>
      {m ? (
        <>
          <b className="tabular">{m[1]}</b> {m[2]}
        </>
      ) : (
        <b>{text}</b>
      )}
    </span>
  );
}

function RowView({ row, view, fixed, picked, onPick }: { row: CalcRow; view: View; fixed?: Level | null; picked: boolean; onPick: (level: Level) => void }) {
  const level = fixed ?? displayLevel(row, view.band, view.targets);
  const status = toneOf(row, level);
  const picking = view.picker.active;
  return (
    <li
      className={`${fixed || isDecisive(row) || inBand(row, view.band, view.targets) ? 'calc' : 'calc out-of-range'}${picking ? ' picking' : ''}${picked ? ' picked' : ''}`}
      title={`${row.desc}${row.field.length ? `\nField: ${row.field.join(', ')}` : ''}`}
      onClick={picking ? () => onPick(level) : undefined}
    >
      {picking && (
        <span className="calc-pick">
          <input type="checkbox" checked={picked} onChange={() => onPick(level)} onClick={(e) => e.stopPropagation()} aria-label={`Add ${row.move} to the report`} />
        </span>
      )}
      <div className="calc-move">
        <span>{row.move}</span>
        {row.field.length > 0 && <span className="note">{row.field.join(', ')}</span>}
      </div>
      <RangeBar row={row} band={view.band} level={level} />
      <div className="calc-result">
        <Result row={row} level={level} status={status} />
        <span className="note tabular">
          {pct(row.minPct)}–{pct(row.maxPct)}
          {level === 2 && ` of ${pct(row.line2Pct)}`}
          {level === 2 && row.recoveryNotes.length > 0 && `, ${row.recoveryNotes.join(', ')}`}
        </span>
      </div>
    </li>
  );
}

function Decided({ all, mode }: { all: CalcRow[]; mode: Mode }) {
  if (!all.length)
    return (
      <>
        <span className="head-move quiet">No damaging moves</span>
        <span />
        <span />
      </>
    );
  const pick = (test: (r: CalcRow) => boolean) => all.find(test);
  const ohko = pick((r) => r.koChance >= 1);
  const twohko = pick((r) => r.ko2Chance >= 1);
  let move: string | null = null;
  let text: string;
  if (mode === 'out') {
    if (ohko) [move, text] = [ohko.move, 'Clean OHKO'];
    else if (twohko) [move, text] = [twohko.move, 'Clean 2HKO'];
    else text = 'No KO in sight';
  } else if (ohko) [move, text] = [ohko.move, 'OHKOs you'];
  else if (twohko) [move, text] = [twohko.move, '2HKOs you'];
  else text = 'Walls you';
  return (
    <>
      <span className="head-move quiet">{move ?? '—'}</span>
      <span className="bar-empty">nothing close</span>
      <span className="result quiet">{text}</span>
    </>
  );
}

function Headline({ rows, all, view, pick }: { rows: CalcRow[]; all: CalcRow[]; view: View; pick?: { r: CalcRow; level: Level } }) {
  const worst = pick ?? headOf(rows, view.band, view.targets);
  if (!worst) return <Decided all={all} mode={view.mode} />;
  return (
    <>
      <span className="head-move">
        {worst.r.move}
        {rows.length > 1 && <span className="note tabular" title={`${rows.length - 1} more calcs`}> +{rows.length - 1}</span>}
      </span>
      <RangeBar row={worst.r} band={view.band} level={worst.level} />
      <Result row={worst.r} level={worst.level} status={toneOf(worst.r, worst.level)} />
    </>
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
  const editing = (g: SetGroup) => Number(view.customs.editing !== null && customId(g) === view.customs.editing);
  return [...groups].sort((a, b) => editing(b) - editing(a) || Number(b.custom) - Number(a.custom) || b.weight - a.weight || a.order - b.order);
}

const inRangeOf = (rows: CalcRow[], view: View) => rows.filter((r) => inBand(r, view.band, view.targets));

const closest = (rows: CalcRow[], view: View) => Math.min(...rows.map((r) => bandDistance(r, view.band, view.targets)));

const entryOf = (result: PokemonResult, group: SetGroup, row: CalcRow, view: View) => (view.watch ? watchedEntry(view.watch, result.key, view.mode, group, row) : null);

const hasAnchor = (result: PokemonResult, view: View) => groupsFor(result, view).some((g) => g.rows.some((r) => entryOf(result, g, r, view)?.anchor));

const hasEntry = (result: PokemonResult, view: View) => groupsFor(result, view).some((g) => g.rows.some((r) => entryOf(result, g, r, view) !== null));

function shownOf(result: PokemonResult, view: View) {
  const live = !hasEntry(result, view);
  return (group: SetGroup) => group.rows.filter((r) => (live ? inBand(r, view.band, view.targets) || isDecisive(r) : entryOf(result, group, r, view) !== null));
}

function fixedLevel(result: PokemonResult, group: SetGroup, row: CalcRow, view: View): Level | undefined {
  const entry = entryOf(result, group, row, view);
  if (entry) return entry.level === 2 && row.koChance > 0 ? 1 : entry.level;
  return isDecisive(row) && !inBand(row, view.band, view.targets) ? 1 : undefined;
}

function GroupView({ group, shown, result, view, showAll }: { group: SetGroup; shown: CalcRow[]; result: PokemonResult; view: View; showAll: boolean }) {
  const species = result.species;
  const label = groupLabel(group, species, view.mode);
  const rest = showAll || group.custom
    ? group.rows.filter((r) => !shown.includes(r)).sort((a, b) => bandDistance(a, view.band, view.targets) - bandDistance(b, view.band, view.targets) || a.order - b.order)
    : [];
  const share = Math.max(1, Math.round(group.weight * 100));
  const id = customId(group);
  return (
    <div className={shown.length ? 'group' : 'group dormant'}>
      <div className="group-head" title={label.title}>
        <ItemIcon item={group.sets[0].item} />
        <span className="set-main">
          {label.forme && <span className="forme">{label.forme}</span>}
          {label.item}, {label.nature}
        </span>
        {label.sp && <span className="set-spread tabular">{label.sp}</span>}
        {group.custom && <span className="badge">custom</span>}
        {!group.custom && (
          <span className="set-share tabular">
            <span className="share-bar" style={{ width: `${Math.min(share, 100) * 0.4}px` }} />
            {share}%{group.sets.length > 1 && ` of ${group.sets.length} sets`}
          </span>
        )}
        <span className={group.custom ? 'group-actions custom' : 'group-actions'}>
          {id ? (
            <>
              {view.customs.editing !== id && (
                <button type="button" className="link small" onClick={() => view.customs.edit(id)}>
                  Edit
                </button>
              )}
              <button type="button" className="icon-button" onClick={() => view.customs.remove(id)} aria-label="Remove this custom set">
                ×
              </button>
            </>
          ) : (
            <button type="button" className="link small" onClick={() => view.customs.create(result, group)} title="Copy this set into a custom set you can edit">
              Tweak
            </button>
          )}
        </span>
      </div>
      <ul className="calcs">
        {[...shown, ...rest].map((r) => (
          <RowView key={r.key} row={r} view={view} fixed={fixedLevel(result, group, r, view)} picked={view.picker.has(group, r)} onPick={(level) => view.picker.toggle(result, group, r, level)} />
        ))}
      </ul>
    </div>
  );
}

function CustomEditor({ entry, customs }: { entry: LibraryEntry; customs: Customs }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [entry.id]);
  return (
    <div className="card-editor" ref={ref}>
      <SetEditor
        inline
        embedded
        title={`Custom ${entry.set.species}`}
        value={entry.set}
        onChange={(set) => customs.update(entry.id, set)}
        ranks={customs.ranks}
        headerAction={
          <button type="button" className="button primary" onClick={() => customs.edit(null)}>
            Done
          </button>
        }
      />
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
  const shownIn = shownOf(result, view);
  const shown = new Map(groups.map((g) => [g, shownIn(g)]));
  const shownRows = groups.flatMap((g) => shown.get(g)!);
  const active = groups.filter((g) => g.custom || shown.get(g)!.length > 0);
  const idle = groups.filter((g) => !active.includes(g)).sort((a, b) => closest(a.rows, view) - closest(b.rows, view));
  const headKey = view.watch?.heads[view.mode].get(result.key);
  const pickGroup = headKey ? groups.find((g) => g.rows.some((r) => shownRows.includes(r) && g.sets.some((s) => keyOf(result.key, view.mode, s.id, r.move) === headKey))) : undefined;
  const pickRow = pickGroup?.rows.find((r) => pickGroup.sets.some((s) => keyOf(result.key, view.mode, s.id, r.move) === headKey));
  const pick = pickGroup && pickRow && view.watch ? { r: pickRow, level: fixedLevel(result, pickGroup, pickRow, view) ?? displayLevel(pickRow, view.band, view.targets) } : undefined;
  const fixed = groups.filter((g) => !g.custom);
  const hidden = fixed.flatMap((g) => g.rows).length - fixed.flatMap((g) => shown.get(g)!).length;
  const entry = view.customs.editing ? view.customs.entry(view.customs.editing) : undefined;
  const editing = entry && entry.set.species === result.species ? entry : undefined;

  return (
    <li className={`card${open ? ' open' : ''}${shownRows.length ? '' : ' dormant'}`}>
      <div className="card-head">
        <button type="button" className="card-toggle" onClick={onToggleOpen} aria-expanded={open}>
          <span className="rank tabular">{result.rank || ''}</span>
          <span className="name">
            <PokemonSprite species={result.species} size={36} />
            <span>{result.species}</span>
          </span>
          <Headline rows={shownRows} all={allRows} view={view} pick={pick} />
        </button>
        <button type="button" className={pinned ? 'pin on' : 'pin'} onClick={onTogglePin} aria-pressed={pinned} title={pinned ? 'Unpin' : 'Pin to top'}>
          <PinIcon filled={pinned} />
        </button>
      </div>
      {open && (
        <div className="card-body">
          {editing && <CustomEditor entry={editing} customs={view.customs} />}
          {active.map((g) => (
            <GroupView key={g.key} group={g} shown={shown.get(g)!} result={result} view={view} showAll={showAll} />
          ))}
          {!active.length && <p className="card-note">{groups.length ? 'Nothing close to a KO line.' : 'No damaging calcs.'}</p>}
          {showAll && idle.map((g) => <GroupView key={g.key} group={g} shown={[]} result={result} view={view} showAll />)}
          {hidden > 0 && (
            <button type="button" className="expand-rest" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
              {showAll
                ? `Hide the ${hidden} calcs outside the range`
                : `Show ${hidden} more calcs outside the range${idle.length ? `, from ${idle.length} more set${idle.length > 1 ? 's' : ''}` : ''}`}
            </button>
          )}
          {!editing && (
            <button type="button" className="expand-rest" onClick={() => view.customs.create(result, null)}>
              + Custom {result.species} set
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
  hasLibrary: boolean;
  toolbar: ReactNode;
  query: string;
  watch: Watch | null;
  onRebuild: () => void;
  pinned: string[];
  onTogglePin: (species: string) => void;
  open: string[];
  onOpenChange: (open: string[]) => void;
  picker: Picker;
  onPickingChange: (active: boolean) => void;
  customs: Customs;
};

export function Results(props: Props) {
  const { response, pending, stale, band, targets, top, mode, onModeChange, customOnly, hasLibrary, toolbar, query, watch, onRebuild, pinned, onTogglePin, open, onOpenChange, picker, onPickingChange, customs } = props;
  if (!response) return <div className="empty muted">Calculating…</div>;

  const only = customOnly && hasLibrary;
  const view: View = { band, targets, mode, customOnly: only, watch, picker, customs };
  const hasInRange = (r: PokemonResult, m: Mode) => groupsFor(r, { ...view, mode: m }).some((g) => inRangeOf(g.rows, view).length > 0);
  const threatens = (r: PokemonResult, m: Mode) => m === 'in' && groupsFor(r, { ...view, mode: m }).some((g) => g.rows.some(isDecisive));
  const relevant = (r: PokemonResult, m: Mode) => hasInRange(r, m) || threatens(r, m);
  const eligible = response.results.filter((r) => (only ? r.hasCustom : r.inTop || r.hasCustom || pinned.includes(r.key)));

  const pinnedResults = pinned.map((s) => eligible.find((r) => r.key === s)).filter((r): r is PokemonResult => !!r);
  const customResults = eligible.filter((r) => r.onlyCustom && !pinned.includes(r.key));
  const listed = eligible.filter((r) => !r.onlyCustom && !pinned.includes(r.key) && (r.hasCustom || (watch ? (mode === 'in' ? hasEntry(r, view) : hasAnchor(r, view)) : relevant(r, mode))));
  let entered = 0;
  let left = 0;
  if (watch)
    for (const r of eligible)
      for (const g of groupsFor(r, view))
        for (const row of g.rows) {
          const entry = watchedEntry(watch, r.key, mode, g, row);
          const now = inBand(row, band, targets);
          if (entry?.anchor && !now) left++;
          else if (!entry && now && !g.custom) entered++;
        }
  const counted = eligible.filter((r) => r.inTop || r.hasCustom);
  const counts = { in: counted.filter((r) => relevant(r, 'in')).length, out: counted.filter((r) => relevant(r, 'out')).length };
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

  const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matches = q
    ? eligible
        .filter((r) => r.species.toLowerCase().replace(/[^a-z0-9]/g, '').includes(q))
        .sort((a, b) => Number(!a.species.toLowerCase().startsWith(query.toLowerCase().trim())) - Number(!b.species.toLowerCase().startsWith(query.toLowerCase().trim())) || (a.rank || 999) - (b.rank || 999))
    : [];
  const sections: [string, PokemonResult[]][] = q
    ? [['Search', matches]]
    : [
        ['Your sets', customResults],
        ['Pinned', pinnedResults],
        ['By usage', listed],
      ];
  const nonEmpty = sections.filter(([, list]) => list.length);

  return (
    <div className={pending || stale ? 'results stale' : 'results'}>
      <div className="modes" role="tablist">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'mode on' : 'mode'} onClick={() => onModeChange(m)}>
            {MODES[m].label}
            <span className="mode-count tabular">{counts[m]}</span>
          </button>
        ))}
      </div>
      {toolbar}
      {(entered > 0 || left > 0) && (
        <div className="drift" role="status">
          <span>
            Same calcs as before your change.{' '}
            {[left > 0 && `${left} now outside the range`, entered > 0 && `${entered} new in range`].filter(Boolean).join(', ')}.
          </span>
          <button type="button" className="link" onClick={onRebuild}>
            Rebuild list
          </button>
        </div>
      )}
      <div className="table">
        <div className="table-head">
          <span>#</span>
          <span>{only ? 'Your sets' : mode === 'in' ? `${counts.in} of the top ${top} close or OHKO you` : `${counts.out} of the top ${top} in range`}</span>
          <span>Move</span>
          <span className="bar-legend">
            <span>Damage range</span>
            <span className="bar-key">OHKO line</span>
            {targets.twohko && <span className="bar-key two">2HKO line</span>}
          </span>
          <span className="table-actions">
            <button type="button" className={picker.active ? 'link on' : 'link'} onClick={() => onPickingChange(!picker.active)} aria-pressed={picker.active}>
              {picker.active ? 'Done selecting' : 'Select for report'}
            </button>
            {visible.length > 0 && (
              <button type="button" className="link" onClick={() => onOpenChange(allOpen ? [] : visible.map((r) => r.key))}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            )}
          </span>
        </div>
        <div className="table-body">
          {nonEmpty.map(([title, list]) => (
            <section key={title} className="result-section">
              {nonEmpty.length > 1 && <h3 className="section-title">{title}</h3>}
              <ul className="cards">{list.map(card)}</ul>
            </section>
          ))}
        </div>
      </div>
      {!nonEmpty.length && q && <div className="empty">No Pokémon called “{query}” in the top {top}.</div>}
      {!nonEmpty.length && !q && (
        <div className="empty">{only ? 'Your library is empty. Add opponents from Library.' : 'Nothing lands in this range. Widen it or bring in more opponents.'}</div>
      )}
      <p className="footnote tabular">
        {response.totalCalcs} calcs in {Math.round(response.ms)} ms
      </p>
    </div>
  );
}
