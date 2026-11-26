import { useEffect } from 'react';

interface EyeEmblemProps {
  size?: 'sm' | 'lg';
  badgeId?: string;
  className?: string;
}

/**
 * Interactive eye emblem that gazes smoothly toward pointer, focus, typing, and scroll.
 * DOM transforms update directly via [data-eye-pupil] so pointer motion causes zero React re-renders.
 */
export function EyeEmblem({ size = 'sm', badgeId, className = '' }: EyeEmblemProps) {
  return (
    <div
      id={badgeId}
      data-eye-size={size}
      aria-hidden="true"
      className={`${size === 'lg' ? 'studio-eye-lg' : ''} ${className}`.trim()}
    >
      <div className="studio-eye-avatar">
        <div className="studio-eye-sclera">
          <div className="studio-eye-pupil" data-eye-pupil={size} />
        </div>
      </div>
    </div>
  );
}

/**
 * Installs document-level gaze tracking anchored to #studioEyeBadge (top-left emblem)
 * and moves all mounted [data-eye-pupil] pupils in sync, returning to center after 6.5s idle.
 */
export function useGlobalEyeTracker(anchorId = 'studioEyeBadge') {
  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let idleTimer: number | null = null;
    let nudgePhase = 0;

    const setPupilOffset = (dx: number, dy: number) => {
      document.querySelectorAll<HTMLElement>('[data-eye-pupil]').forEach((pupil) => {
        if (reducedMotion) {
          pupil.style.transform = 'translate3d(0px, 0px, 0px)';
          return;
        }
        const scale = pupil.dataset.eyePupil === 'lg' ? 1.55 : 1;
        pupil.style.transform = `translate3d(${(dx * scale).toFixed(2)}px, ${(dy * scale).toFixed(2)}px, 0px)`;
      });
    };

    const resetIdleTimer = () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setPupilOffset(0, 0), 6500);
    };

    const lookAtPoint = (x: number, y: number) => {
      const badge = document.getElementById(anchorId);
      if (!badge) return;
      const rect = badge.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle = Math.atan2(y - cy, x - cx);
      const maxOffset = 4.5;
      const dist = Math.min(maxOffset, Math.hypot(x - cx, y - cy) / 90);
      setPupilOffset(Math.cos(angle) * dist, Math.sin(angle) * dist);
      resetIdleTimer();
    };

    const lookAtElement = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return;
      const r = el.getBoundingClientRect();
      nudgePhase = (nudgePhase + 1) % 4;
      const caretBias = (nudgePhase - 1.5) * 18;
      lookAtPoint(
        r.left + Math.min(r.width * 0.65, 60 + Math.abs(caretBias)),
        r.top + r.height / 2
      );
    };

    const onPointerDown = (e: PointerEvent) => lookAtPoint(e.clientX, e.clientY);
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') lookAtPoint(e.clientX, e.clientY);
    };
    const onFocusIn = (e: FocusEvent) => lookAtElement(e.target);
    const onKeyDown = () => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        lookAtElement(active);
      } else {
        const badge = document.getElementById(anchorId);
        if (!badge) return;
        const r = badge.getBoundingClientRect();
        nudgePhase = (nudgePhase + 1) % 6;
        lookAtPoint(
          r.left + 80 + Math.cos(nudgePhase) * 40,
          r.top + 120 + Math.sin(nudgePhase) * 30
        );
      }
    };
    const onScroll = () => {
      const badge = document.getElementById(anchorId);
      if (!badge) return;
      const r = badge.getBoundingClientRect();
      nudgePhase = (nudgePhase + 1) % 6;
      lookAtPoint(r.left + 60, r.top + 140 + Math.sin(nudgePhase) * 25);
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });

    return () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [anchorId]);
}
