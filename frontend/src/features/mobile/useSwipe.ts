/**
 * Horizontal swipe on touch screens (MOBILE-005). Vertical movement keeps scrolling the page: a gesture becomes a
 * swipe only once it moves further sideways than up or down. Every swipe action also has a visible button.
 */

import { useRef, useState, type TouchEvent } from "react";

/** Distance in px that triggers the action when the finger is lifted. */
export const SWIPE_THRESHOLD = 80;
/** Movement before the gesture direction is decided. */
const DECIDE_AFTER = 10;

export interface SwipeOptions {
  readonly onSwipeRight?: (() => void) | undefined;
  readonly onSwipeLeft?: (() => void) | undefined;
  readonly enabled?: boolean;
}

export interface Swipe {
  /** Current horizontal offset in px (0 when idle). */
  readonly offset: number;
  readonly handlers: {
    onTouchStart: (event: TouchEvent) => void;
    onTouchMove: (event: TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
}

export function useSwipe({ onSwipeRight, onSwipeLeft, enabled = true }: SwipeOptions): Swipe {
  const start = useRef<{ x: number; y: number; mode: "undecided" | "swipe" | "scroll" } | null>(null);
  const [offset, setOffset] = useState(0);

  const reset = () => {
    start.current = null;
    setOffset(0);
  };

  return {
    offset,
    handlers: {
      onTouchStart: (event) => {
        const touch = event.touches[0];
        if (!enabled || !touch || event.touches.length > 1) return;
        start.current = { x: touch.clientX, y: touch.clientY, mode: "undecided" };
      },
      onTouchMove: (event) => {
        const touch = event.touches[0];
        const origin = start.current;
        if (!origin || !touch) return;
        const dx = touch.clientX - origin.x;
        const dy = touch.clientY - origin.y;
        if (origin.mode === "undecided" && Math.max(Math.abs(dx), Math.abs(dy)) > DECIDE_AFTER) {
          origin.mode = Math.abs(dx) > Math.abs(dy) ? "swipe" : "scroll";
        }
        if (origin.mode !== "swipe") return;
        // Only directions with an action move the card.
        const allowed = (dx > 0 && onSwipeRight) || (dx < 0 && onSwipeLeft) ? dx : 0;
        setOffset(Math.max(-SWIPE_THRESHOLD * 1.5, Math.min(SWIPE_THRESHOLD * 1.5, allowed)));
      },
      onTouchEnd: () => {
        if (offset >= SWIPE_THRESHOLD) onSwipeRight?.();
        else if (offset <= -SWIPE_THRESHOLD) onSwipeLeft?.();
        reset();
      },
      onTouchCancel: reset,
    },
  };
}
