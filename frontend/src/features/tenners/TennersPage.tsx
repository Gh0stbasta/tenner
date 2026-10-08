/** Tenner management (FRONTEND-003): search, filter, sort, complete, archive and restore. */

import AddIcon from "@mui/icons-material/Add";
import { Alert, Box, Button } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useMemo, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { ErrorAlert } from "../../components/ErrorAlert";
import { NoTennersFound } from "../../components/EmptyState";
import { SkeletonList } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useHouseholdVacation, useToday } from "../household/api";
import { usePauseControls } from "../pause/usePauseControls";
import { formatMinutes } from "../../utils/format";
import { trackEvent } from "../../utils/telemetry";
import { DEFAULT_LIST_PARAMS, useArchiveTenner, useRestoreTenner, useTenners, type TennerListParams } from "./api";
import { ConfirmArchiveDialog } from "./ConfirmArchiveDialog";
import { CreateTennerDialog } from "./CreateTennerDialog";
import { EditTennerDialog } from "./EditTennerDialog";
import { QuickAddTenner } from "./QuickAddTenner";
import type { Tenner } from "./schemas";
import { tennerStatus } from "./status";
import { TennerCard } from "./TennerCard";
import { TennerFilters } from "./TennerFilters";
import { TennerSearch } from "./TennerSearch";

const SEARCH_DEBOUNCE_MS = 300;

function summary(tenners: readonly Tenner[], today: string): string {
  const active = tenners.filter((t) => t.active && t.deletedAt === null);
  const overdue = active.filter((t) => t.nextDue < today).length;
  const minutes = active.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  return `${active.length} ${active.length === 1 ? "aktive Aufgabe" : "aktive Aufgaben"} · ${overdue} überfällig · ${formatMinutes(minutes)} geschätzt`;
}

export function TennersPage() {
  const [params, setParams] = useState<TennerListParams>(DEFAULT_LIST_PARAMS);
  const [search, setSearch] = useState("");
  const [archiveCandidate, setArchiveCandidate] = useState<Tenner | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Tenner | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim().toLocaleLowerCase("de-DE"), SEARCH_DEBOUNCE_MS);
  const today = useToday();
  const vacation = useHouseholdVacation();
  const pauseControls = usePauseControls();

  const tenners = useTenners(params);
  const archive = useArchiveTenner();
  const restore = useRestoreTenner();

  const visible = useMemo(
    () =>
      (tenners.data ?? []).filter(
        (t) => !debouncedSearch || t.title.toLocaleLowerCase("de-DE").includes(debouncedSearch),
      ),
    [tenners.data, debouncedSearch],
  );

  const busyId = [archive, restore].find((m) => m.isPending)?.variables;
  const busyTennerId = busyId === undefined ? undefined : "tennerId" in busyId ? busyId.tennerId : undefined;
  const failed = archive.isError || restore.isError;

  const changeParams = (next: TennerListParams) => {
    trackEvent("FilterChanged", { ...next });
    setParams(next);
  };

  return (
    <>
      <PageHeader
        title="Aufgaben"
        subtitle={tenners.data ? summary(tenners.data, today) : undefined}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Neue Aufgabe
          </Button>
        }
      />
      <QuickAddTenner />
      <Box sx={{ display: "grid", gap: 1.5, mb: 3 }}>
        <TennerSearch value={search} onChange={setSearch} />
        <TennerFilters value={params} onChange={changeParams} />
      </Box>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Die Aktion ist fehlgeschlagen. {errorMessage(archive.error ?? restore.error)}
        </Alert>
      )}

      {tenners.isPending ? (
        <SkeletonList count={4} label="Aufgaben werden geladen" />
      ) : tenners.isError ? (
        <ErrorAlert
          title="Aufgaben konnten nicht geladen werden"
          message={errorMessage(tenners.error)}
          onRetry={() => void tenners.refetch()}
        />
      ) : visible.length === 0 ? (
        <NoTennersFound />
      ) : (
        <Grid container spacing={2} component="ul" sx={{ p: 0, m: 0 }} aria-label="Aufgabenliste">
          {visible.map((tenner) => (
            <Grid
              key={tenner.tennerId}
              size={{ xs: 12, sm: 6, lg: 4 }}
              sx={{ display: "flex", "& > li": { flexGrow: 1 } }}
            >
              <TennerCard
                tenner={tenner}
                status={tennerStatus(tenner, today, vacation)}
                busy={busyTennerId === tenner.tennerId || pauseControls.resumingTennerId === tenner.tennerId}
                onEdit={setEditing}
                onArchive={setArchiveCandidate}
                onRestore={(t) => restore.mutate(t)}
                onPause={pauseControls.requestPause}
                onResume={pauseControls.resume}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <CreateTennerDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditTennerDialog tenner={editing} onClose={() => setEditing(null)} />
      {pauseControls.dialog}
      <ConfirmArchiveDialog
        tenner={archiveCandidate}
        busy={archive.isPending}
        onCancel={() => setArchiveCandidate(null)}
        onConfirm={(tenner) => archive.mutate(tenner, { onSettled: () => setArchiveCandidate(null) })}
      />
    </>
  );
}
