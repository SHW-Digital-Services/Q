import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryScrollerProps {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
}

export const CategoryScroller: React.FC<CategoryScrollerProps> = ({ children, ariaLabel, className = '' }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateScrollControls = useCallback(() => {
    const element = scrollerRef.current;
    if (!element) return;
    setCanScrollBack(element.scrollLeft > 2);
    setCanScrollForward(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollControls();
    const element = scrollerRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollControls);
    if (element) observer?.observe(element);
    window.addEventListener('resize', updateScrollControls);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollControls);
    };
  }, [children, updateScrollControls]);

  const scroll = (direction: -1 | 1) => {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(180, element.clientWidth * 0.7), behavior: 'smooth' });
  };

  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`}>
      <button type="button" onClick={() => scroll(-1)} disabled={!canScrollBack} aria-label={`Scroll ${ariaLabel} left`} className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700 shadow-sm disabled:cursor-default disabled:opacity-25">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div ref={scrollerRef} role="toolbar" aria-label={ariaLabel} onScroll={updateScrollControls} onWheel={(event) => {
        const element = scrollerRef.current;
        if (!element || element.scrollWidth <= element.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
        const canMove = event.deltaY > 0 ? element.scrollLeft + element.clientWidth < element.scrollWidth - 2 : element.scrollLeft > 2;
        if (!canMove) return;
        event.preventDefault();
        element.scrollLeft += event.deltaY;
      }} className="category-scroller flex min-w-0 flex-1 snap-x snap-mandatory items-center gap-2 overflow-x-auto pb-2 pt-1">
        {children}
      </div>
      <button type="button" onClick={() => scroll(1)} disabled={!canScrollForward} aria-label={`Scroll ${ariaLabel} right`} className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700 shadow-sm disabled:cursor-default disabled:opacity-25">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
