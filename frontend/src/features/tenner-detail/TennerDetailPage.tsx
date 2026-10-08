/** Tenner detail and history (FRONTEND-009): /tenners/:tennerId */

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { Button, Card, CardContent, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { errorMessage } from "../../api/errorMessages";
import { isApiError } from "../../api/errors";
import { EmptyState } from "../../components/EmptyState";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageLoading } from "../../components/LoadingState";
import { useArchiveTenner, useRestoreTenner } from "../tenners/api";
import { usePauseControls } from "../pause/usePauseControls";
import { ConfirmArchiveDialog } from "../tenners/ConfirmArchiveDialog";
import { EditTennerDialog } from "../tenners/EditTennerDialog";
import type { Tenner } from "../tenners/schemas";
import { useTenner, useTennerHistory } from "./api";
import { CompletionHistoryList } from "./CompletionHistoryList";
import { ConsistencyIndicator } from "./ConsistencyIndicator";
import { ScheduleSummary } from "./ScheduleSummary";
import { TennerDetailHeader } from "./TennerDetailHeader";

function BackLink() {
  return (
    <Button component={Link} to="/tenners" startIcon={<ArrowBackIcon />} sx={{ mb: 1, ml: -1 }}>
      Alle Aufgaben
    </Button>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <Card component="section" aria-label={title} sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h2" sx={{ mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

export function TennerDetailPage() {
  const { tennerId = "" } = useParams();
  const navigate = useNavigate();
  const tenner = useTenner(tennerId);
  const history = useTennerHistory(tennerId);
  const archive = useArchiveTenner();
  const restore = useRestoreTenner();
  const [editing, setEditing] = useState<Tenner | null>(null);
  const [archiveCandidate, setArchiveCandidate] = useState<Tenner | null>(null);
  const pauseControls = usePauseControls();

  if (tenner.isPending) return <PageLoading label="Aufgabe wird geladen" />;
  if (tenner.isError) {
    if (isApiError(tenner.error) && tenner.error.status === 404) {
      return (
        <EmptyState
          icon={<SearchOffOutlinedIcon aria-hidden />}
          title="Aufgabe nicht gefunden"
          description="Diese Aufgabe gibt es nicht (mehr)."
          action={
            <Button component={Link} to="/tenners" variant="contained">
              Zu allen Aufgaben
            </Button>
          }
        />
      );
    }
    return (
      <>
        <BackLink />
        <ErrorAlert
          title="Aufgabe konnte nicht geladen werden"
          message={errorMessage(tenner.error)}
          onRetry={() => void tenner.refetch()}
        />
      </>
    );
  }

  const data = tenner.data;
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <BackLink />
      <TennerDetailHeader
        tenner={data}
        busy={archive.isPending || restore.isPending || pauseControls.resumingTennerId === data.tennerId}
        onEdit={() => setEditing(data)}
        onArchive={() => setArchiveCandidate(data)}
        onRestore={() => restore.mutate(data)}
        onPause={() => pauseControls.requestPause(data)}
        onResume={() => pauseControls.resume(data)}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title="Zeitplan">
            <ScheduleSummary tenner={data} />
          </Section>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title="Regelmäßigkeit">
            <ConsistencyIndicator items={items} frequencyDays={data.frequencyDays} />
          </Section>
        </Grid>
        <Grid size={12}>
          <Section title="Verlauf">
            <CompletionHistoryList
              items={items}
              loading={history.isPending}
              error={history.error}
              hasMore={history.hasNextPage}
              loadingMore={history.isFetchingNextPage}
              onLoadMore={() => void history.fetchNextPage()}
              onRetry={() => void history.refetch()}
            />
          </Section>
        </Grid>
      </Grid>
      <EditTennerDialog tenner={editing} onClose={() => setEditing(null)} />
      {pauseControls.dialog}
      <ConfirmArchiveDialog
        tenner={archiveCandidate}
        busy={archive.isPending}
        onCancel={() => setArchiveCandidate(null)}
        onConfirm={(t) =>
          archive.mutate(t, {
            onSuccess: () => void navigate("/tenners"),
            onSettled: () => setArchiveCandidate(null),
          })
        }
      />
    </>
  );
}
