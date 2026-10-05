'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  children: ReactNode;
  widthClassName?: string;
  /** Preferred edge of the icon the popup lines up with: 'right' opens leftward (default), 'left' opens rightward. The popup is still kept inside the screen if there isn't room. */
  align?: 'left' | 'right';
}

/**
 * Hover/focus/tap info icon. The popup is rendered in a portal with fixed
 * positioning, so it is never clipped by a scrolling or overflow-hidden
 * ancestor (e.g. a wide table's scroll box), and it is clamped to the viewport
 * and flipped above the icon when there isn't room below.
 */
export function InfoTooltip({ children, widthClassName = 'w-56', align = 'right' }: InfoTooltipProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  // Runs when the popup mounts: measure it, place it next to the icon, then reveal it.
  const placePopup = useCallback(
    (pop: HTMLDivElement | null) => {
      const icon = iconRef.current;
      if (!pop || !icon) return;
      const r = icon.getBoundingClientRect();
      const margin = 8;
      const width = pop.offsetWidth;
      const height = pop.offsetHeight;
      let left = align === 'left' ? r.left : r.right - width;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      let top = r.bottom + 6;
      if (top + height > window.innerHeight - margin && r.top - 6 - height >= margin) top = r.top - 6 - height;
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      pop.style.visibility = 'visible';
    },
    [align]
  );

  // A fixed popup doesn't follow its icon, so close it if the page moves under it.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span
      ref={iconRef}
      role="button"
      tabIndex={0}
      aria-label="More information"
      aria-expanded={open}
      className="relative inline-flex cursor-pointer shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <Info className={`w-3.5 h-3.5 ${open ? 'text-ey-light' : 'text-ey-muted'} hover:text-ey-light`} />
      {open &&
        createPortal(
          <div
            ref={placePopup}
            role="tooltip"
            style={{ position: 'fixed', top: 0, left: 0, visibility: 'hidden' }}
            className={`bg-ey-black text-ey-light text-[11px] p-2.5 rounded shadow-xl border border-ey-border ${widthClassName} max-w-[85vw] z-[60] font-sans normal-case leading-relaxed pointer-events-none`}
          >
            {children}
          </div>,
          document.body
        )}
    </span>
  );
}
