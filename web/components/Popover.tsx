import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  label: ReactNode;
  children: ReactNode;
  active?: boolean;
  align?: 'left' | 'right';
  width?: number;
};

export function Popover({ label, children, active, align = 'left', width }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="popover" ref={ref}>
      <button type="button" className={`tool${active ? ' active' : ''}${open ? ' open' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
        <svg className="caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className={`popover-panel ${align}`} style={width ? { width } : undefined} role="dialog">
          {children}
        </div>
      )}
    </div>
  );
}
