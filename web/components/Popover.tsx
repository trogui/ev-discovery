import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAnchor } from '../useAnchor';

type Props = {
  label: ReactNode;
  children: ReactNode;
  active?: boolean;
  className?: string;
  align?: 'left' | 'right';
  width?: number;
};

export function Popover({ label, children, active, className = 'tool', align = 'left', width }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useAnchor(ref, open, { align, width: width ?? 300, maxHeight: 640, gap: 6 });

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target) || panelRef.current?.contains(target) || target.closest?.('[data-floating]')) return;
      setOpen(false);
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
      <button type="button" className={`${className}${active ? ' active' : ''}${open ? ' open' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
        <svg className="caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        position &&
        createPortal(
          <div className="popover-panel" style={position} role="dialog" ref={panelRef} data-floating>
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
