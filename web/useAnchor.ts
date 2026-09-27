import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

type Options = { align?: 'left' | 'right'; width?: number; maxHeight: number; gap?: number };

const MARGIN = 8;

export function useAnchor(anchor: RefObject<HTMLElement | null>, open: boolean, { align = 'left', width, maxHeight, gap = 4 }: Options) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(width ?? r.width, vw - MARGIN * 2);
      const below = vh - r.bottom - gap - MARGIN;
      const above = r.top - gap - MARGIN;
      const up = below < Math.min(maxHeight, 220) && above > below;
      const left = Math.max(MARGIN, Math.min(align === 'right' ? r.right - w : r.left, vw - w - MARGIN));
      setStyle({
        position: 'fixed',
        left,
        width: width ? w : undefined,
        minWidth: width ? undefined : w,
        maxHeight: Math.min(maxHeight, up ? above : below),
        ...(up ? { bottom: vh - r.top + gap } : { top: r.bottom + gap }),
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, open, align, width, maxHeight, gap]);

  return style;
}
