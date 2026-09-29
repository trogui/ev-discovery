import type { Meta } from '../../src/lib/types';
import { Popover } from './Popover';

const day = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const count = new Intl.NumberFormat('en');

const shortName = (name: string) => name.replace(/^\d{4} (.+?) Pok[eé]mon VGC? (\w+).*$/, '$1 $2');

export function DataStatus({ meta }: { meta: Meta }) {
  const { sources } = meta;
  const regionals = sources.regionals ?? [];
  const pasteTeams = regionals.reduce((sum, r) => sum + r.pasteTeams, 0);

  return (
    <Popover className="inline" label={day.format(new Date(meta.generatedAt))} width={340} align="right">
      <div className="panel-stack">
        <span className="field-title">Data behind these sets</span>
        <p className="hint">
          Ingested {day.format(new Date(meta.generatedAt))}, newest result from {day.format(new Date(sources.newestEvent))}.
        </p>
        <div className="data-list">
          <span className="field-title">Regionals</span>
          {regionals.length === 0 && <p className="hint">None in Reg {meta.regulation} yet.</p>}
          {regionals.map((r) => (
            <div className="data-row" key={r.id} title={r.name}>
              <span className="data-name">{shortName(r.name)}</span>
              <span className="muted tabular">{day.format(new Date(r.date))}</span>
              <span className="tabular">{count.format(r.lists)} teams</span>
              <span className={r.applied ? 'data-state applied' : 'data-state pending'}>{r.applied ? 'Applied' : 'Pending'}</span>
            </div>
          ))}
          {pasteTeams > 0 && <p className="hint">{pasteTeams} regional teams also came with shared EV spreads.</p>}
        </div>
        <div className="data-list">
          <span className="field-title">Everything else</span>
          <div className="data-row">
            <span className="data-name">Online tournaments</span>
            <span className="tabular">{count.format(sources.limitlessTournaments)}</span>
          </div>
          <div className="data-row">
            <span className="data-name">Shared team pastes</span>
            <span className="tabular">{count.format(sources.pasteTeams)}</span>
          </div>
          <div className="data-row">
            <span className="data-name">In-game ladder</span>
            <span className="muted tabular">{sources.munchstatsMonth ? month.format(new Date(`${sources.munchstatsMonth}-01`)) : 'latest month'}</span>
          </div>
        </div>
        <p className="hint">
          Regionals count {sources.regionalWeight}× per player, and every result loses half its weight each {sources.halfLifeDays} days.
        </p>
      </div>
    </Popover>
  );
}
