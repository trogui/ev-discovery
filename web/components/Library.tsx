import { useState } from 'react';
import { formatSp } from '../format';
import { newId, type LibraryEntry } from '../library';
import { buildMySet, exportPaste, importPaste, type EditableSet } from '../me';
import { SetEditor } from './SetEditor';
import { PokemonSprite } from './Sprites';

type Props = {
  entries: LibraryEntry[];
  onChange: (entries: LibraryEntry[]) => void;
  ranks: Map<string, number>;
  customOnly: boolean;
  onCustomOnlyChange: (v: boolean) => void;
};

export function Library({ entries, onChange, ranks, customOnly, onCustomOnlyChange }: Props) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const current = editing && editing !== 'new' ? (entries.find((e) => e.id === editing) ?? null) : null;
  const update = (id: string, patch: Partial<LibraryEntry>) => onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const onEdit = (set: EditableSet) => {
    if (editing === 'new') {
      const id = newId();
      onChange([...entries, { id, set, active: true }]);
      setEditing(id);
    } else if (current) update(current.id, { set });
  };

  const importTeam = () => {
    const result = importPaste(pasteText);
    if (!result.ok) return setMessage({ error: true, text: result.error });
    onChange([...entries, ...result.sets.map((set) => ({ id: newId(), set, active: true }))]);
    setMessage({ error: false, text: `Added ${result.sets.length} Pokémon.${result.warnings.length ? ` ${result.warnings.join(' ')}` : ''}` });
    setPasteText('');
    setPasteOpen(false);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(entries.map((e) => exportPaste(e.set)).join('\n\n'));
    setMessage({ error: false, text: `Copied ${entries.length} sets as a paste.` });
  };

  return (
    <section className="library">
      <div className="panel-head">
        <h2>Your sets</h2>
        <div className="actions">
          {entries.length > 0 && (
            <button type="button" className="link small" onClick={copyAll}>
              Copy all
            </button>
          )}
          <button type="button" className="link small" onClick={() => setPasteOpen(!pasteOpen)}>
            {pasteOpen ? 'Close' : 'Paste team'}
          </button>
        </div>
      </div>

      {pasteOpen && (
        <div className="paste-box">
          <textarea className="paste" rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste one set or a whole team from Showdown / pokepast.es" spellCheck={false} />
          <div className="paste-actions">
            <button type="button" className="button primary" onClick={importTeam}>
              Add to library
            </button>
          </div>
        </div>
      )}
      {message && <p className={message.error ? 'error' : 'hint'}>{message.text}</p>}

      {entries.length === 0 && !editing && !pasteOpen && (
        <p className="hint">Add sets you want to calc against, even if nobody runs them. They join their Pokémon in the results.</p>
      )}
      {entries.some((e) => e.active) && (
        <label className="check">
          <input type="checkbox" checked={customOnly} onChange={(e) => onCustomOnlyChange(e.target.checked)} />
          Only show these sets
        </label>
      )}

      {entries.length > 0 && (
        <ul className="library-list">
          {entries.map((e) => {
            const my = buildMySet(e.set);
            return (
              <li key={e.id} className={`${e.active ? '' : 'inactive'}${editing === e.id ? ' editing' : ''}`}>
                <input type="checkbox" checked={e.active} aria-label={`Use ${e.set.species}`} onChange={() => update(e.id, { active: !e.active })} />
                <PokemonSprite species={my.forme} size={32} />
                <button type="button" className="library-entry" onClick={() => setEditing(editing === e.id ? null : e.id)}>
                  <span className="library-name">{my.forme}</span>
                  <span className="muted small">
                    {e.set.item ?? 'No item'} · {e.set.nature} · {formatSp(e.set.sp)}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${e.set.species}`}
                  onClick={() => {
                    onChange(entries.filter((x) => x.id !== e.id));
                    if (editing === e.id) setEditing(null);
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <SetEditor
          embedded
          title={editing === 'new' ? 'New opponent' : 'Edit opponent'}
          value={current?.set ?? null}
          onChange={onEdit}
          ranks={ranks}
          headerAction={
            <button type="button" className="link small" onClick={() => setEditing(null)}>
              Done
            </button>
          }
        />
      ) : (
        <button type="button" className="button add" onClick={() => setEditing('new')}>
          + Add opponent
        </button>
      )}
    </section>
  );
}
