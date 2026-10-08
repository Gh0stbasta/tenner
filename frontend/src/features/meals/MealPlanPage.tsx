/**
 * Meal plan page /essen (FOOD-009): today first, then the week (this or next week). Visible offline from the cache
 * (MOBILE-003). Meal menu: replace (FOOD-007), choose, swap, lock (FOOD-022); „Woche neu planen“ (FOOD-008).
 */

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import { errorMessage } from "../../api/errorMessages";
import { isApiError } from "../../api/errors";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageLoading } from "../../components/LoadingState";
import { useNotify } from "../../components/NotificationProvider";
import { PageHeader } from "../../components/PageHeader";
import { useOnline } from "../../hooks/useConnectivity";
import { formatLongDate, formatShortDate } from "../../utils/format";
import {
  useChooseMeal,
  useMealPlan,
  useRegenerateWeek,
  useReplaceMeal,
  useSwapMeals,
  type MealOption,
  type MealPlan,
  type PlanSlot,
  type WeekChoice,
} from "./api";
import { isKept, localToday } from "./format";
import { MealActions } from "./MealActions";
import { MealCard } from "./MealCard";
import { MealPickerDialog } from "./MealPickerDialog";
import { SwapMealDialog } from "./SwapMealDialog";
import { MEAL_SLOT_LABELS } from "./labels";

const slotLabel = (slot: PlanSlot) => `${formatShortDate(slot.date)} ${MEAL_SLOT_LABELS[slot.slot]}`;

/** A choice or swap that harms someone (allergy, vegetarian) is retried with `confirm` after the user agrees. */
interface PendingConfirmation {
  readonly message: string;
  readonly confirmLabel: string;
  readonly run: () => void;
}

/** Confirmation text of „Woche neu planen“: how many meals change and which future meals stay. */
function regenerateMessage(plan: MealPlan, today: string): string {
  const kept = plan.slots.filter((slot) => isKept(slot, today));
  const replanned = plan.slots.length - kept.length;
  const staying = kept
    .filter((slot) => slot.date >= today)
    .map((slot) => `${slotLabel(slot)}${slot.dish ? ` (${slot.dish.name})` : ""}`);
  return [
    `${replanned} ${replanned === 1 ? "Mahlzeit wird" : "Mahlzeiten werden"} neu geplant.`,
    staying.length > 0 ? `Bleiben: ${staying.join(", ")}.` : "",
    "Vergangene, festgelegte und selbst gewählte Mahlzeiten bleiben, wie sie sind.",
  ]
    .filter(Boolean)
    .join(" ");
}

const hintsFor = (plan: MealPlan, slot: PlanSlot) =>
  plan.violations.filter((violation) => violation.slotIds.includes(slot.slotId));

function SetupHint({ plan }: { readonly plan: MealPlan }) {
  const missing = [
    ...(plan.setup.hasEaters ? [] : ["wer mitisst (Familienprofil)"]),
    ...(plan.setup.hasDishes ? [] : ["eure Gerichte (Gerichtekatalog)"]),
  ];
  return (
    <Alert
      severity="info"
      sx={{ mb: 3 }}
      action={
        <Button component={RouterLink} to="/settings" color="inherit" size="small">
          Einrichten
        </Button>
      }
    >
      Der Essensplan entsteht, sobald Tenner {missing.join(" und ")} kennt.
    </Alert>
  );
}

function DayCard({
  date,
  slots,
  plan,
  today,
  actionsFor,
}: {
  date: string;
  slots: readonly PlanSlot[];
  plan: MealPlan;
  today: boolean;
  actionsFor: (slot: PlanSlot) => ReactNode;
}) {
  return (
    <Card
      component="section"
      aria-label={formatLongDate(date)}
      sx={{ height: "100%", ...(today ? { borderColor: "primary.main", borderWidth: 2, borderStyle: "solid" } : {}) }}
    >
      <CardContent sx={{ pb: "12px !important" }}>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
          {today ? `Heute · ${formatShortDate(date)}` : formatShortDate(date)}
        </Typography>
        {slots.map((slot, index) => (
          <Box key={slot.slotId}>
            {index > 0 && <Divider />}
            <MealCard slot={slot} hints={hintsFor(plan, slot)} actions={actionsFor(slot)} />
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export function MealPlanPage() {
  const [week, setWeek] = useState<WeekChoice>("current");
  const plan = useMealPlan(week);
  const today = localToday();
  const online = useOnline();
  const notify = useNotify();
  const replace = useReplaceMeal(week);
  const choose = useChooseMeal(week);
  const swap = useSwapMeals(week);
  /** Dishes rejected per meal in this visit, so „Anderes Gericht“ cycles through alternatives (FOOD-007). */
  const [rejected, setRejected] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [picking, setPicking] = useState<PlanSlot | null>(null);
  const [swapping, setSwapping] = useState<PlanSlot | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const regenerate = useRegenerateWeek(week);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const busy = replace.isPending || choose.isPending || swap.isPending || regenerate.isPending;

  /** Errors of choose and swap: a harmful conflict asks for a confirmation, anything else is shown. */
  const onChangeError = (error: unknown, confirmLabel: string, retry: () => void) => {
    if (isApiError(error) && error.code === "CONFIRMATION_REQUIRED") {
      setConfirmation({ message: error.message, confirmLabel, run: retry });
    } else {
      notify({ message: errorMessage(error), severity: "error" });
    }
  };
  const undoFailed = (error: unknown) =>
    notify({ message: `Rückgängig fehlgeschlagen. ${errorMessage(error)}`, severity: "error" });

  const chooseDish = (slot: PlanSlot, option: MealOption, confirm = false) => {
    const previous = slot.dish;
    choose.mutate(
      { slotId: slot.slotId, dishId: option.dish.dishId, ...(confirm ? { confirm } : {}) },
      {
        onSuccess: () => {
          setPicking(null);
          notify({
            message: `${slotLabel(slot)}: ${option.dish.name} festgelegt.`,
            ...(previous
              ? {
                  action: {
                    label: "Rückgängig",
                    onClick: () =>
                      choose.mutate(
                        { slotId: slot.slotId, dishId: previous.dishId, locked: slot.locked, confirm: true },
                        { onError: undoFailed },
                      ),
                  },
                }
              : {}),
          });
        },
        onError: (error) => onChangeError(error, "Trotzdem wählen", () => chooseDish(slot, option, true)),
      },
    );
  };

  const swapMeals = (slot: PlanSlot, target: PlanSlot, confirm = false) => {
    swap.mutate(
      { from: slot.slotId, to: target.slotId, ...(confirm ? { confirm } : {}) },
      {
        onSuccess: () => {
          setSwapping(null);
          notify({
            message: `${slotLabel(slot)} und ${slotLabel(target)} getauscht.`,
            action: {
              label: "Rückgängig",
              onClick: () =>
                swap.mutate({ from: slot.slotId, to: target.slotId, confirm: true }, { onError: undoFailed }),
            },
          });
        },
        onError: (error) => onChangeError(error, "Trotzdem tauschen", () => swapMeals(slot, target, true)),
      },
    );
  };

  const toggleLock = (slot: PlanSlot) =>
    choose.mutate(
      { slotId: slot.slotId, locked: !slot.locked },
      {
        onSuccess: () =>
          notify({
            message: slot.locked
              ? `${slotLabel(slot)}: darf wieder neu geplant werden.`
              : `${slotLabel(slot)}: festgelegt, bleibt beim Neuplanen.`,
          }),
        onError: (error) => notify({ message: errorMessage(error), severity: "error" }),
      },
    );

  const regenerateWeek = (previous: MealPlan) => {
    setConfirmRegenerate(false);
    regenerate.mutate(
      {},
      {
        onSuccess: (changed) => {
          const before = new Map(previous.slots.map((slot) => [slot.slotId, slot.dishId]));
          const restore = changed.slots
            .filter((slot) => before.get(slot.slotId) !== slot.dishId)
            .map((slot) => ({ slotId: slot.slotId, dishId: before.get(slot.slotId) ?? null }));
          notify({
            message: `Woche neu geplant: ${changed.regeneration.changed} ${
              changed.regeneration.changed === 1 ? "Mahlzeit" : "Mahlzeiten"
            } geändert.`,
            ...(restore.length > 0
              ? {
                  action: {
                    label: "Rückgängig",
                    onClick: () => regenerate.mutate({ restore }, { onError: undoFailed }),
                  },
                }
              : {}),
          });
        },
        onError: (error) => notify({ message: errorMessage(error), severity: "error" }),
      },
    );
  };

  const replaceMeal = (slot: PlanSlot) => {
    const previous = slot.dish;
    const label = slotLabel(slot);
    const excludeDishIds = [...(rejected[slot.slotId] ?? []), ...(previous ? [previous.dishId] : [])];
    replace.mutate(
      { slotId: slot.slotId, excludeDishIds },
      {
        onSuccess: (changed) => {
          setRejected((current) => ({ ...current, [slot.slotId]: excludeDishIds }));
          const now = changed.slots.find((candidate) => candidate.slotId === slot.slotId)?.dish;
          notify({
            message: `${label}: ${now?.name ?? "nichts"}${previous ? ` statt ${previous.name}` : ""}.`,
            ...(previous
              ? {
                  action: {
                    label: "Rückgängig",
                    onClick: () =>
                      replace.mutate({ slotId: slot.slotId, dishId: previous.dishId }, { onError: undoFailed }),
                  },
                }
              : {}),
          });
        },
        onError: (error) => notify({ message: errorMessage(error), severity: "error" }),
      },
    );
  };

  const actionsFor = (slot: PlanSlot): ReactNode => (
    <MealActions
      label={slotLabel(slot)}
      disabled={!online || slot.date < today || busy}
      actions={[
        { label: "Anderes Gericht", onClick: () => replaceMeal(slot) },
        { label: "Selbst wählen", onClick: () => setPicking(slot) },
        { label: "Tauschen", onClick: () => setSwapping(slot) },
        { label: slot.locked ? "Festlegung lösen" : "Festlegen", onClick: () => toggleLock(slot) },
      ]}
    />
  );

  const header = (
    <PageHeader
      title="Essen"
      subtitle={
        plan.data ? `${formatShortDate(plan.data.weekStart)} – ${formatShortDate(plan.data.weekEnd)}` : undefined
      }
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          {plan.data?.ready && (
            <Button component={RouterLink} to="/einkaufsliste" variant="outlined" size="small">
              Einkaufsliste
            </Button>
          )}
          {plan.data?.ready && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setConfirmRegenerate(true)}
              disabled={!online || busy || plan.data.slots.every((slot) => isKept(slot, today))}
            >
              Woche neu planen
            </Button>
          )}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={week}
            onChange={(_, value: WeekChoice | null) => value && setWeek(value)}
            aria-label="Woche"
          >
            <ToggleButton value="current">Diese Woche</ToggleButton>
            <ToggleButton value="next">Nächste Woche</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      }
    />
  );

  if (plan.isPending) return <PageLoading label="Essensplan wird geladen" />;
  if (plan.isError) {
    return (
      <>
        {header}
        <ErrorAlert
          title="Essensplan konnte nicht geladen werden"
          message={errorMessage(plan.error)}
          onRetry={() => void plan.refetch()}
        />
      </>
    );
  }

  const data = plan.data;
  const days = [...new Set(data.slots.map((slot) => slot.date))];
  return (
    <>
      {header}
      {!data.ready && <SetupHint plan={data} />}
      {data.ready && (
        <Grid container spacing={2}>
          {days.map((date) => (
            <Grid key={date} size={{ xs: 12, sm: 6, lg: 4 }} sx={{ order: date === today ? -1 : 0 }}>
              <DayCard
                date={date}
                slots={data.slots.filter((slot) => slot.date === date)}
                plan={data}
                today={date === today}
                actionsFor={actionsFor}
              />
            </Grid>
          ))}
        </Grid>
      )}
      <MealPickerDialog
        week={week}
        slotId={picking?.slotId ?? null}
        label={picking ? slotLabel(picking) : ""}
        onPick={(option) => picking && chooseDish(picking, option)}
        onClose={() => setPicking(null)}
      />
      <SwapMealDialog
        plan={data}
        slot={swapping}
        today={today}
        onPick={(target) => swapping && swapMeals(swapping, target)}
        onClose={() => setSwapping(null)}
      />
      <ConfirmDialog
        open={confirmRegenerate}
        title="Woche neu planen?"
        message={regenerateMessage(data, today)}
        confirmLabel="Neu planen"
        busy={busy}
        onConfirm={() => regenerateWeek(data)}
        onCancel={() => setConfirmRegenerate(false)}
      />
      <ConfirmDialog
        open={confirmation !== null}
        title="Wirklich?"
        message={confirmation?.message ?? ""}
        confirmLabel={confirmation?.confirmLabel ?? "Trotzdem"}
        destructive
        busy={busy}
        onConfirm={() => {
          confirmation?.run();
          setConfirmation(null);
        }}
        onCancel={() => setConfirmation(null)}
      />
    </>
  );
}
