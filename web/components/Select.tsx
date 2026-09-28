import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAnchor } from '../useAnchor';

type Option = { value: string; hint?: string };

type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  ariaLabel: string;
};

export function Select({ value, options, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const position = useAnchor(buttonRef, open, { maxHeight: 320 });
  const current = options.findIndex((o) => o.value === value);
  const selected = options[current];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, position]);

  const show = () => {
    setActive(Math.max(current, 0));
    setOpen(true);
  };

  const commit = (i: number) => {
    setOpen(false);
    if (options[i] && options[i].value !== value) onChange(options[i].value);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={open ? 'select open' : 'select'}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) return show();
            setActive((a) => Math.min(Math.max(a + (e.key === 'ArrowDown' ? 1 : -1), 0), options.length - 1));
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (open) commit(active);
            else show();
          } else if (e.key === 'Escape' && open) {
            e.preventDefault();
            setOpen(false);
          } else if (open && e.key.length === 1 && /\w/.test(e.key)) {
            const key = e.key.toLowerCase();
            const next = [...options.keys()].map((k) => (active + 1 + k) % options.length).find((i) => options[i].value.toLowerCase().startsWith(key));
            if (next !== undefined) setActive(next);
          }
        }}
      >
        <span>
          {selected?.value ?? value}
          {selected?.hint && ` (${selected.hint})`}
        </span>
        <svg className="caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        position &&
        createPortal(
          <ul className="combobox-list" id={id} role="listbox" aria-label={ariaLabel} ref={listRef} style={position} data-floating>
            {options.map((o, i) => (
              <li
                key={o.value}
                data-index={i}
                role="option"
                aria-selected={i === current}
                className={`${i === active ? 'active' : ''}${i === current ? ' selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(i);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span>{o.value}</span>
                {o.hint && <span className="option-hint">{o.hint}</span>}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
