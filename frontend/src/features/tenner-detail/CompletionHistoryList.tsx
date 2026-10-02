import { Button, List, ListItem, ListItemText, Typography } from "@mui/material";
import { SectionLoading } from "../../components/LoadingState";
import { ErrorAlert } from "../../components/ErrorAlert";
import { USER_LABELS } from "../../types/domain";
import { formatMinutes } from "../../utils/format";
import type { HistoryItem } from "../completions/api";

export interface CompletionHistoryListProps {
  readonly items: readonly HistoryItem[];
  readonly loading: boolean;
  readonly error: boolean;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
}

function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

/** Completions newest first with "Mehr anzeigen" (cursor pagination). */
export function CompletionHistoryList({
  items,
  loading,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  onRetry,
}: CompletionHistoryListProps) {
  if (loading) return <SectionLoading label="Verlauf wird geladen" />;
  if (error)
    return (
      <ErrorAlert title="Verlauf konnte nicht geladen werden" message="Bitte versuche es erneut." onRetry={onRetry} />
    );
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Noch nicht erledigt.
      </Typography>
    );
  }
  return (
    <>
      <List dense disablePadding aria-label="Erledigungen">
        {items.map((item) => (
          <ListItem key={item.completionId} disableGutters divider>
            <ListItemText
              primary={<time dateTime={item.completedAt}>{formatDateTime(item.completedAt)}</time>}
              secondary={`${USER_LABELS[item.completedBy]} · ${formatMinutes(item.actualMinutes)}`}
            />
          </ListItem>
        ))}
      </List>
      {hasMore && (
        <Button onClick={onLoadMore} disabled={loadingMore} sx={{ mt: 1 }}>
          Mehr anzeigen
        </Button>
      )}
    </>
  );
}
