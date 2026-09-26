import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type Option = { value: string; hint?: string; group?: number };

type Props = {
  value: string | null;
  options: Option[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
  ariaLabel: string;
  limit?: number;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function Combobox({ value, options, onChange, placeholder, allowEmpty, className, ariaLabel, limit = 40 }: Props) {
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const open = query !== null;

  const filtered = useMemo(() => {
    if (query === null) return [];
    const q = norm(query);
    if (!q) return options.slice(0, limit);
    const starts: Option[] = [];
    const contains: Option[] = [];
    for (const o of options) {
      const n = norm(o.value);
      if (n.startsWith(q)) starts.push(o);
      else if (n.includes(q)) contains.push(o);
      if (starts.length >= limit) break;
    }
    return [...starts, ...contains].slice(0, limit);
  }, [query, options, limit]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const commit = (next: string | null) => {
    setQuery(null);
    if (next !== value) onChange(next);
  };

  return (
    <div className={`combobox ${className ?? ''}`}>
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={id}
        value={query ?? value ?? ''}
        placeholder={placeholder}
        spellCheck={false}
        onFocus={() => setQuery('')}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => {
          const exact = query ? options.find((o) => norm(o.value) === norm(query)) : undefined;
          if (exact) commit(exact.value);
          else if (allowEmpty && query === '' && value === null) commit(null);
          else setQuery(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[active]) commit(filtered[active].value);
            else if (allowEmpty && !query) commit(null);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setQuery(null);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="combobox-list" id={id} role="listbox" ref={listRef}>
          {filtered.map((o, i) => (
            <li
              key={o.value}
              data-index={i}
              role="option"
              aria-selected={i === active}
              className={`${i === active ? 'active' : ''}${i > 0 && filtered[i - 1].group !== o.group ? ' divider' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(o.value);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{o.value}</span>
              {o.hint && <span className="muted small">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
      {allowEmpty && value && !open && (
        <button type="button" className="combobox-clear" aria-label={`Clear ${ariaLabel}`} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(null)}>
          ×
        </button>
      )}
    </div>
  );
}
