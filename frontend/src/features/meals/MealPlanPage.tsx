/**
 * Meal plan page /essen (FOOD-009): today first, then the week (this or next week). Visible offline from the cache
 * (MOBILE-003); actions of the plan follow with FOOD-007, FOOD-008 and FOOD-022.
 */

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink } from "react-router";
import { errorMessage } from "../../api/errorMessages";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageLoading } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { formatLongDate, formatShortDate } from "../../utils/format";
import { useMealPlan, type MealPlan, type PlanSlot, type WeekChoice } from "./api";
import { localToday } from "./format";
import { MealCard } from "./MealCard";

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
}: {
  date: string;
  slots: readonly PlanSlot[];
  plan: MealPlan;
  today: boolean;
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
            <MealCard slot={slot} hints={hintsFor(plan, slot)} />
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

  const header = (
    <PageHeader
      title="Essen"
      subtitle={
        plan.data ? `${formatShortDate(plan.data.weekStart)} – ${formatShortDate(plan.data.weekEnd)}` : undefined
      }
      actions={
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
              />
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
}
