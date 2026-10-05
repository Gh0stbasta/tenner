/**
 * Pull-to-refresh for the dashboard (MOBILE-005). Installed apps have no browser pull-to-refresh, so pulling down at
 * the top of the page reloads the data. Only active on touch input at scroll position 0.
 */

import { Box, CircularProgress } from "@mui/material";
import { useRef, useState, type ReactNode } from "react";

/** Pull distance (px, after damping) that triggers a refresh. */
export const PULL_THRESHOLD = 60;
const MAX_PULL = 90;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  readonly onRefresh: () => Promise<unknown>;
  readonly children: ReactNode;
}) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const end = () => {
    startY.current = null;
    if (pull >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      void onRefresh().finally(() => setRefreshing(false));
    }
    setPull(0);
  };

  return (
    <Box
      onTouchStart={(event) => {
        const touch = event.touches[0];
        startY.current = window.scrollY <= 0 && touch ? touch.clientY : null;
      }}
      onTouchMove={(event) => {
        const touch = event.touches[0];
        if (startY.current === null || !touch) return;
        // Damped, so the content follows the finger at half speed.
        setPull(Math.max(0, Math.min(MAX_PULL, (touch.clientY - startY.current) / 2)));
      }}
      onTouchEnd={end}
      onTouchCancel={() => {
        startY.current = null;
        setPull(0);
      }}
    >
      {(pull > 0 || refreshing) && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            height: refreshing ? 40 : pull,
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <CircularProgress
            size={24}
            variant={refreshing ? "indeterminate" : "determinate"}
            value={Math.min(100, (pull / PULL_THRESHOLD) * 100)}
            aria-label={refreshing ? "Wird aktualisiert" : "Zum Aktualisieren ziehen"}
          />
        </Box>
      )}
      {children}
    </Box>
  );
}
