/**
 * First login (HOTFIX-001): a signed-in Google user without a household member picks who they are.
 * Each member can be claimed by one account only; once all are taken, strangers see "Kein freier Platz".
 * After a successful assignment the session is refreshed (new ID token with the household group).
 */

import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { isApiError } from "../../api/errors";
import { EmptyState } from "../../components/EmptyState";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageLoading } from "../../components/LoadingState";
import { AssignmentCard } from "./AssignmentCard";
import { useAssignHouseholdMember, useOnboarding } from "./api";

export const ASSIGNMENT_FAILED = "Zuordnung fehlgeschlagen. Bitte versuche es erneut.";

export interface AssignmentPageProps {
  /** Refresh the session so the new household group is in the token, then continue to the dashboard. */
  readonly onAssigned: () => Promise<void>;
  readonly onLogout: () => void;
}

export function AssignmentPage({ onAssigned, onLogout }: AssignmentPageProps) {
  const onboarding = useOnboarding();
  const assign = useAssignHouseholdMember();
  const [continuing, setContinuing] = useState(false);
  /** Set once this account has a member (just assigned here, or found assigned): never show the choice again. */
  const [assigned, setAssigned] = useState(false);
  const [continueFailed, setContinueFailed] = useState(false);
  const autoContinued = useRef(false);

  const proceed = useCallback(async () => {
    setContinuing(true);
    setContinueFailed(false);
    try {
      await onAssigned();
    } catch {
      setContinueFailed(true);
    } finally {
      setContinuing(false);
    }
  }, [onAssigned]);

  // Existing assignment (token older than the assignment): skip onboarding once, automatically.
  const assignedTo = onboarding.data?.assignedTo ?? null;
  useEffect(() => {
    if (assignedTo !== null && !autoContinued.current) {
      autoContinued.current = true;
      setAssigned(true);
      void proceed();
    }
  }, [assignedTo, proceed]);

  if (onboarding.isPending) return <PageLoading label="Konto wird geprüft" />;
  if (onboarding.isError) {
    return (
      <Box sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
        <ErrorAlert
          title="Tenner ist gerade nicht erreichbar"
          message={errorMessage(onboarding.error)}
          onRetry={() => void onboarding.refetch()}
        />
      </Box>
    );
  }

  const logout = (
    <Button variant="text" onClick={onLogout}>
      Abmelden
    </Button>
  );

  if (assigned || assignedTo !== null || continuing) {
    return (
      <Box sx={{ p: 3, maxWidth: 560, mx: "auto", textAlign: "center" }}>
        {continueFailed ? (
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <Alert severity="warning">
              Dein Konto ist verknüpft, aber die Anmeldung konnte nicht aktualisiert werden.
            </Alert>
            <Button variant="contained" onClick={() => void proceed()}>
              Weiter
            </Button>
            {logout}
          </Stack>
        ) : (
          <PageLoading label="Anmeldung wird aktualisiert" />
        )}
      </Box>
    );
  }

  const members = onboarding.data.members;
  if (!members.some((member) => member.available)) {
    return (
      <EmptyState
        title="Kein freier Platz"
        description="Alle Personen in diesem Haushalt sind bereits mit einem Konto verknüpft. Wende dich an die Person, die Tenner verwaltet."
        action={logout}
      />
    );
  }

  const failure = assign.error;
  return (
    <Box component="main" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 560, mx: "auto" }}>
      <Typography variant="h1" sx={{ mb: 1 }}>
        Willkommen bei Tenner
      </Typography>
      <Typography sx={{ mb: 3 }} color="text.secondary">
        Dein Google-Konto ist noch keiner Person im Haushalt zugeordnet. Bitte wähle aus, wer du bist. Die Auswahl gilt
        dauerhaft für dieses Konto.
      </Typography>
      {failure !== null && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {isApiError(failure) && failure.code === "MEMBER_TAKEN" ? errorMessage(failure) : ASSIGNMENT_FAILED}
        </Alert>
      )}
      <Stack spacing={2} role="list" aria-label="Personen im Haushalt">
        {members.map((member) => (
          <div role="listitem" key={member.userId}>
            <AssignmentCard
              member={member}
              disabled={assign.isPending}
              onSelect={(selected) =>
                assign.mutate(selected.userId, {
                  onSuccess: () => {
                    autoContinued.current = true;
                    setAssigned(true);
                    void proceed();
                  },
                  // Assigned meanwhile (e.g. in another tab): just refresh the session.
                  onError: (error) => {
                    if (isApiError(error) && error.code === "ALREADY_ASSIGNED") {
                      autoContinued.current = true;
                      setAssigned(true);
                      void proceed();
                    }
                  },
                })
              }
            />
          </div>
        ))}
      </Stack>
      <Box sx={{ mt: 3, textAlign: "center" }}>{logout}</Box>
    </Box>
  );
}
