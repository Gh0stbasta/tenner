/** Offline completions waiting for sync (MOBILE-004), shown above every page until they are transferred. */

import { Alert } from "@mui/material";
import { useCompletion } from "../completions/CompletionProvider";

export function PendingSyncIndicator() {
  const { pending } = useCompletion();
  if (pending.length === 0) return null;
  const titles = pending.map((item) => `„${item.title}“`).join(", ");
  const label = pending.length === 1 ? "1 Offline-Erledigung wartet" : `${pending.length} Offline-Erledigungen warten`;
  return (
    <Alert severity="info" role="status" sx={{ mb: 2 }}>
      ⏳ {label} auf die Übertragung: {titles}.
    </Alert>
  );
}
