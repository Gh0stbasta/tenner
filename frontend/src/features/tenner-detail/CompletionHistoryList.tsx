import { Button, List, ListItem, ListItemText, Typography } from "@mui/material";
import { errorMessage } from "../../api/errorMessages";
import { SectionLoading } from "../../components/LoadingState";
import { ErrorAlert } from "../../components/ErrorAlert";
import { formatMinutes } from "../../utils/format";
import type { HistoryItem } from "../completions/api";
import { useMemberName } from "../members/api";

export interface CompletionHistoryListProps {
  readonly items: readonly HistoryItem[];
  readonly loading: boolean;
  /** The loading error, or null. */
  readonly error: unknown;
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
  const memberName = useMemberName();
  if (loading) return <SectionLoading label="Verlauf wird geladen" />;
  if (error !== null && error !== undefined)
    return <ErrorAlert title="Verlauf konnte nicht geladen werden" message={errorMessage(error)} onRetry={onRetry} />;
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
              secondary={`${memberName(item.completedBy)} · ${formatMinutes(item.actualMinutes)}`}
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
