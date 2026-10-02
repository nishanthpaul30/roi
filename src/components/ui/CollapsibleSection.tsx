import type { ComponentType, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  /** DOM id: the anchor for in-page navigation and the base of the body's aria-controls id. */
  id: string;
  title: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
  /** Muted text beside the title, e.g. a count. */
  meta?: ReactNode;
  /** Buttons shown beside the header (outside the toggle, so they work while collapsed). */
  actions?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** 'section' = a top-level card; 'sub' = a nested/inner block. */
  variant?: 'section' | 'sub';
  children: ReactNode;
}

/**
 * Controlled expand/collapse block. State lives with the parent so the page can
 * offer "expand all / collapse all" and open sections from in-page navigation.
 * The body is unmounted while collapsed, which keeps long tables out of the DOM.
 */
export function CollapsibleSection({
  id,
  title,
  icon: Icon,
  iconClassName = 'text-ey-yellow',
  meta,
  actions,
  open,
  onToggle,
  variant = 'section',
  children,
}: CollapsibleSectionProps) {
  const isSection = variant === 'section';
  const Heading = isSection ? 'h2' : 'h3';

  return (
    <section
      id={id}
      className={`scroll-mt-4 ${
        isSection ? 'bg-ey-card border border-ey-border rounded-xl' : 'bg-ey-black/40 border border-ey-border/70 rounded-lg'
      }`}
    >
      <div className={`flex items-center gap-3 ${isSection ? 'px-5 py-3.5' : 'px-4 py-2.5'}`}>
        <Heading className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={`${id}-body`}
            className="flex w-full items-center gap-2 text-left group"
          >
            <ChevronRight
              className={`w-4 h-4 shrink-0 text-ey-muted group-hover:text-ey-yellow transition-transform ${open ? 'rotate-90' : ''}`}
            />
            {Icon && <Icon className={`w-4 h-4 shrink-0 ${iconClassName}`} />}
            <span
              className={`font-bold text-ey-light tracking-wider ${
                isSection ? 'text-sm uppercase' : 'text-xs uppercase'
              }`}
            >
              {title}
            </span>
            {meta && <span className="ml-auto pl-3 text-[11px] text-ey-muted font-mono text-right">{meta}</span>}
          </button>
        </Heading>
        {actions}
      </div>
      {open && (
        <div id={`${id}-body`} className={`space-y-4 ${isSection ? 'px-5 pb-5' : 'px-4 pb-4'}`}>
          {children}
        </div>
      )}
    </section>
  );
}
