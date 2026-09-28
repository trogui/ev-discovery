import { useEffect, useRef, useState, type Ref } from 'react';
import type { StatID } from '@smogon/calc/dist/data/interface.js';
import type { MySet } from '../calc/types';
import { formeSuffix, pct, toneOf } from '../format';
import { describeNature, rolesOf } from '../natures';
import { canCopyImages, download, exportPdf, renderPng } from '../export';
import type { ReportItem } from '../report';
import type { Mode } from '../useStickyList';
import { RangeBar, Result } from './Results';
import { ItemIcon, PokemonSprite } from './Sprites';

const STATS: [StatID, string][] = [
  ['hp', 'HP'],
  ['atk', 'Atk'],
  ['def', 'Def'],
  ['spa', 'SpA'],
  ['spd', 'SpD'],
  ['spe', 'Spe'],
];

const MODES: Record<Mode, { title: string; sub: string }> = {
  in: { title: 'Defense', sub: 'Their attacks into you' },
  out: { title: 'Offense', sub: 'Your attacks into them' },
};

function groupBy<T>(list: T[], key: (item: T) => string) {
  const out = new Map<string, T[]>();
  for (const item of list) out.set(key(item), [...(out.get(key(item)) ?? []), item]);
  return [...out.values()];
}

function Build({ me }: { me: MySet }) {
  const { plus, minus } = rolesOf(me.nature);
  const forme = formeSuffix(me.forme, me.species);
  return (
    <div className="report-me">
      <PokemonSprite species={me.forme} size={68} />
      <div className="report-me-main">
        <h2 className="report-me-name">
          {me.species}
          {forme && <span className="forme">{forme}</span>}
        </h2>
        <p className="report-me-set">
          <ItemIcon item={me.item} />
          <span>{me.item ?? 'No item'}</span>
          {me.ability && <span className="muted">· {me.ability}</span>}
        </p>
        <p className="report-me-moves">
          {me.nature} ({describeNature(me.nature)})
        </p>
        {me.moves.length > 0 && <p className="report-me-moves">{me.moves.join(' · ')}</p>}
      </div>
      <div className="report-stats">
        <span />
        <span className="report-stats-key">EV</span>
        <span className="report-stats-key">Stat</span>
        {STATS.flatMap(([k, label]) => {
          const role = plus === k ? ' plus' : minus === k ? ' minus' : '';
          return [
            <span key={`${k}-label`} className={`report-stat-label${role}`}>
              {label}
            </span>,
            <span key={`${k}-ev`} className={`report-ev tabular${me.sp[k] ? '' : ' zero'}`}>
              {me.sp[k]}
            </span>,
            <span key={`${k}-stat`} className={`report-stat tabular${role}`}>
              {me.stats[k]}
            </span>,
          ];
        })}
      </div>
    </div>
  );
}

type CopyProps = { flash: Flash | null; onCopy: (key: string, items: ReportItem[]) => void };

function CopyButton({ id, items, flash, onCopy }: CopyProps & { id: string; items: ReportItem[] }) {
  const label = flash?.key === id ? flash.label : canCopyImages() ? 'Copy image' : 'Save image';
  return (
    <button type="button" className={flash?.key === id ? 'link report-copy done' : 'link report-copy'} onClick={() => onCopy(id, items)}>
      {label}
    </button>
  );
}

function Calc({ item, exporting, onRemove, onNote, ...copy }: CopyProps & { item: ReportItem; exporting: boolean; onRemove: () => void; onNote: (note: string) => void }) {
  const { row, level } = item;
  const [editing, setEditing] = useState(false);
  const extra = [...item.conditions, ...(level === 2 ? row.recoveryNotes : [])];
  return (
    <li className="report-calc">
      <div className="report-calc-move">
        <span>{row.move}</span>
        {extra.length > 0 && <span className="note">{extra.join(' · ')}</span>}
      </div>
      <RangeBar row={row} band={item.band} level={level} />
      <div className="report-calc-result">
        <Result row={row} level={level} status={toneOf(row, level)} />
        <span className="note tabular">
          {pct(row.minPct)}–{pct(row.maxPct)}
          {level === 2 && ` of ${pct(row.line2Pct)}`}
        </span>
      </div>
      {!exporting && (
        <span className="report-actions">
          <CopyButton id={item.id} items={[item]} {...copy} />
          {!item.note && !editing && (
            <button type="button" className="link" onClick={() => setEditing(true)}>
              Note
            </button>
          )}
          <button type="button" className="icon-button" onClick={onRemove} aria-label={`Remove ${row.move} from the report`}>
            ×
          </button>
        </span>
      )}
      <p className="report-desc">{row.desc}</p>
      {exporting
        ? item.note && <p className="report-note">{item.note}</p>
        : (item.note || editing) && (
            <input className="report-note" value={item.note} onChange={(e) => onNote(e.target.value)} onBlur={() => setEditing(false)} autoFocus={editing && !item.note} placeholder="Add a note" aria-label="Note" />
          )}
    </li>
  );
}

type Flash = { key: string; label: string };

type SheetProps = CopyProps & {
  items: ReportItem[];
  title: string;
  fallback: string;
  exporting: boolean;
  bare?: boolean;
  onTitleChange: (title: string) => void;
  onUpdate: (id: string, patch: Partial<ReportItem>) => void;
  onRemove: (id: string) => void;
  ref?: Ref<HTMLElement>;
};

function Sheet({ items, title, fallback, exporting, bare, onTitleChange, onUpdate, onRemove, flash, onCopy, ref }: SheetProps) {
  const copy = { flash, onCopy };
  return (
    <article ref={ref} className={exporting ? 'report exporting' : 'report'}>
      {!bare && (
        <header className="report-head">
          <p className="report-kicker">EV Discovery · Damage calcs</p>
          {exporting ? (
            <h1 className="report-title">{title.trim() || fallback}</h1>
          ) : (
            <input className="report-title" value={title} placeholder={fallback} onChange={(e) => onTitleChange(e.target.value)} aria-label="Report title" spellCheck={false} />
          )}
        </header>
      )}

      {!items.length && (
        <div className="empty">
          <p>No calcs in the report yet. Go back, turn on Select for report and tick the calcs you want.</p>
        </div>
      )}

      {groupBy(items, (i) => i.build).map((build) => (
        <section key={build[0].build} className="report-build">
          <Build me={build[0].me} />
          {(['in', 'out'] as const).map((mode) => {
            const list = build.filter((i) => i.mode === mode);
            if (!list.length) return null;
            return (
              <section key={mode} className="report-mode">
                <h3 className="report-mode-title">
                  {MODES[mode].title}
                  <span>{MODES[mode].sub}</span>
                  {!exporting && <CopyButton id={`${build[0].build}|${mode}`} items={list} {...copy} />}
                </h3>
                {groupBy(list, (i) => i.species).map((opponent) => {
                  const head = opponent[0];
                  return (
                    <div key={head.species} className="report-opp">
                      <div className="report-opp-head">
                        <PokemonSprite species={head.set.forme} size={36} />
                        <span className="report-opp-name">{head.species}</span>
                        {head.rank > 0 && <span className="muted small tabular">#{head.rank} in usage</span>}
                      </div>
                      {groupBy(opponent, (i) => i.group).map((set) => {
                        const s = set[0].set;
                        const forme = formeSuffix(s.forme, head.species);
                        return (
                          <div key={set[0].group} className="report-set">
                            <div className="report-set-head">
                              <ItemIcon item={s.icon} />
                              <span className="set-main">
                                {forme && <span className="forme">{forme}</span>}
                                {s.item}, {s.nature}
                              </span>
                              {s.ability && <span className="muted small">{s.ability}</span>}
                              {s.sp && <span className="set-spread tabular">{s.sp}</span>}
                              {s.custom && <span className="badge">custom</span>}
                            </div>
                            <ul className="report-calcs">
                              {set.map((i) => (
                                <Calc key={i.id} item={i} exporting={exporting} {...copy} onRemove={() => onRemove(i.id)} onNote={(note) => onUpdate(i.id, { note })} />
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </section>
      ))}
    </article>
  );
}

type Props = {
  items: ReportItem[];
  onChange: (items: ReportItem[]) => void;
  title: string;
  onTitleChange: (title: string) => void;
  onBack: () => void;
};

type Job = { width: number } & ({ kind: 'pdf' } | { kind: 'image'; items: ReportItem[]; bare: boolean; resolve: (blob: Blob) => void; reject: (error: unknown) => void });

export function Report({ items, onChange, title, onTitleChange, onBack }: Props) {
  const fallback = items.length ? `${items[0].me.species} calcs` : 'Calc report';
  const name = title.trim() || fallback;
  const sheet = useRef<HTMLElement>(null);
  const copy = useRef<HTMLElement>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = name;
    return () => {
      document.title = previous;
    };
  }, [name]);

  useEffect(() => {
    if (!job) return;
    const done = () => setJob(null);
    if (job.kind === 'pdf') exportPdf(copy.current!, `${name}.pdf`).finally(done);
    else renderPng(copy.current!).then(job.resolve, job.reject).finally(done);
  }, [job]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(timer);
  }, [flash]);

  const copyImage = (key: string, picked: ReportItem[], bare = true) => {
    if (job) return;
    let resolve!: (blob: Blob) => void;
    let reject!: (error: unknown) => void;
    const blob = new Promise<Blob>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    setJob({ kind: 'image', width: sheet.current!.clientWidth, items: picked, bare, resolve, reject });
    const saved = canCopyImages()
      ? navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => 'Copied')
      : blob.then((b) => {
          download(b, `${name}.png`);
          return 'Saved';
        });
    saved.then(
      (label) => setFlash({ key, label }),
      () => setFlash({ key, label: 'Failed' }),
    );
  };

  const update = (id: string, patch: Partial<ReportItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const sheetProps = { title, fallback, onTitleChange, onUpdate: update, onRemove: remove, flash, onCopy: copyImage };

  return (
    <div className="report-page">
      <div className="report-bar">
        <button type="button" className="link" onClick={onBack}>
          ← Back to calcs
        </button>
        <span className="report-bar-actions">
          {items.length > 0 && (
            <button type="button" className="link" onClick={() => confirm('Remove every calc from the report?') && onChange([])}>
              Clear all
            </button>
          )}
          <button type="button" className={flash?.key === 'all' ? 'button copy copied' : 'button copy'} onClick={() => copyImage('all', items, false)} disabled={!items.length || job !== null}>
            <span className="copy-idle">{canCopyImages() ? 'Copy image' : 'Save image'}</span>
            <span className="copy-done" aria-hidden={flash?.key !== 'all'}>
              {flash?.key === 'all' ? flash.label : ''}
            </span>
          </button>
          <button type="button" className="button primary" onClick={() => setJob({ kind: 'pdf', width: sheet.current!.clientWidth })} disabled={!items.length || job !== null}>
            Save as PDF
          </button>
        </span>
      </div>
      <Sheet ref={sheet} items={items} exporting={false} {...sheetProps} />
      {job && (
        <div className="report-export" style={{ width: job.width }} aria-hidden>
          <Sheet ref={copy} items={job.kind === 'pdf' ? items : job.items} exporting bare={job.kind === 'image' && job.bare} {...sheetProps} />
        </div>
      )}
    </div>
  );
}
