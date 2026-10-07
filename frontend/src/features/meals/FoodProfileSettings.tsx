/**
 * Family food profile (FOOD-004): who eats, allergies, diet and dislikes per person, and the household's planning
 * rules. Applies to the whole household; the meal planner uses it for every plan.
 */

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { Alert, Box, Button, IconButton, List, ListItem, ListItemText, Typography } from "@mui/material";
import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { SettingsSection } from "../settings/SettingsSection";
import {
  attendingEaters,
  useFoodProfile,
  useSaveFoodProfile,
  type Attendance,
  type Eater,
  type FoodProfile,
  type HouseholdFoodRules,
} from "./api";
import { EaterDialog } from "./EaterDialog";
import { describeEater } from "./eaters";
import { FoodRulesDialog } from "./FoodRulesDialog";
import { ATTENDANCE_LABELS, PROTEIN_LABELS, tagList, weekSlotLabel } from "./labels";

function ruleLines(profile: FoodProfile): string[] {
  const { household, eaters } = profile;
  const attendance = (Object.keys(ATTENDANCE_LABELS) as (keyof Attendance)[]).map((meal) => {
    const attending = attendingEaters(eaters, household.attendance, meal);
    const names =
      attending.length === eaters.length
        ? "alle"
        : attending.length === 0
          ? "niemand"
          : attending.map((eater) => eater.name).join(", ");
    return `${ATTENDANCE_LABELS[meal]}: ${names}`;
  });
  const chicken =
    household.chicken.maxPerWeek === 0
      ? "kein Hühnchen"
      : `Hühnchen höchstens ${household.chicken.maxPerWeek}× (${household.chicken.allowedSlots.map(weekSlotLabel).join(", ") || "nie"})`;
  return [
    ...(eaters.length > 0 ? [attendance.join(" · ")] : []),
    `Höchstens ${household.maxActiveMinutes} Min. aktive Kochzeit${household.lightLunchOnWeekdays ? " · mittags unter der Woche leicht" : ""}`,
    `${chicken} · Burger höchstens ${household.maxBurgerPerWeek}× · Salat mittags höchstens ${household.maxSaladLunchesPerWeek}×`,
    `Je einmal pro Woche: ${household.limitedProteinTags.map((tag) => PROTEIN_LABELS[tag]).join(", ") || "keine Grenze"}`,
    `Nie im Plan: ${tagList(household.dislikeTags) || "nichts"}`,
  ];
}

export function FoodProfileSettings() {
  const notify = useNotify();
  const profile = useFoodProfile();
  const save = useSaveFoodProfile();
  /** undefined = closed, null = add, Eater = edit */
  const [editing, setEditing] = useState<Eater | null | undefined>(undefined);
  const [editingRules, setEditingRules] = useState(false);
  const data = profile.data;

  const persist = (eaters: readonly Eater[], household: HouseholdFoodRules, message: string, onDone: () => void) =>
    save.mutate(
      { eaters, household },
      {
        onSuccess: () => {
          notify({ message });
          onDone();
        },
      },
    );

  const saveEater = (eater: Eater) => {
    if (!data) return;
    const exists = data.eaters.some((candidate) => candidate.eaterId === eater.eaterId);
    const eaters = exists
      ? data.eaters.map((candidate) => (candidate.eaterId === eater.eaterId ? eater : candidate))
      : [...data.eaters, eater];
    persist(eaters, data.household, `„${eater.name}“ gespeichert.`, () => setEditing(undefined));
  };

  const removeEater = (eater: Eater) => {
    if (!data) return;
    const without = (list: readonly string[] | null) =>
      list === null ? null : list.filter((id) => id !== eater.eaterId);
    const { attendance } = data.household;
    const household = {
      ...data.household,
      attendance: {
        weekdayLunch: without(attendance.weekdayLunch),
        weekendLunch: without(attendance.weekendLunch),
        dinner: without(attendance.dinner),
      },
    };
    save.mutate(
      { eaters: data.eaters.filter((candidate) => candidate.eaterId !== eater.eaterId), household },
      {
        onSuccess: () => notify({ message: `„${eater.name}“ entfernt.` }),
        onError: (error) => notify({ message: `Entfernen fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
      },
    );
  };

  return (
    <SettingsSection
      title="Essen: Familienprofil"
      description="Wer mitisst, Allergien, vegetarisch und was ihr nicht mögt. Der Essensplan hält sich immer daran."
    >
      {profile.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(profile.error)}
        </Alert>
      )}
      {data && (
        <>
          {data.eaters.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Noch niemand eingetragen.
            </Typography>
          ) : (
            <List dense disablePadding sx={{ mb: 1 }}>
              {data.eaters.map((eater) => (
                <ListItem
                  key={eater.eaterId}
                  disableGutters
                  secondaryAction={
                    <Box>
                      <IconButton aria-label={`${eater.name} bearbeiten`} onClick={() => setEditing(eater)}>
                        <EditOutlinedIcon />
                      </IconButton>
                      <IconButton
                        aria-label={`${eater.name} entfernen`}
                        onClick={() => removeEater(eater)}
                        disabled={save.isPending}
                      >
                        <DeleteOutlinedIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText primary={eater.name} secondary={describeEater(eater)} sx={{ pr: 10 }} />
                </ListItem>
              ))}
            </List>
          )}
          <Box
            component="ul"
            aria-label="Planungsregeln"
            sx={{ m: 0, mb: 2, pl: 2.5, color: "text.secondary", typography: "body2" }}
          >
            {ruleLines(data).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button startIcon={<PersonAddAlt1OutlinedIcon />} variant="outlined" onClick={() => setEditing(null)}>
              Person hinzufügen
            </Button>
            <Button startIcon={<TuneOutlinedIcon />} onClick={() => setEditingRules(true)}>
              Regeln bearbeiten
            </Button>
          </Box>
          {editing !== undefined && (
            <EaterDialog
              key={editing?.eaterId ?? "new"}
              eater={editing}
              pending={save.isPending}
              error={save.error}
              onSave={saveEater}
              onClose={() => {
                save.reset();
                setEditing(undefined);
              }}
            />
          )}
          {editingRules && (
            <FoodRulesDialog
              rules={data.household}
              eaters={data.eaters}
              pending={save.isPending}
              error={save.error}
              onSave={(household) =>
                persist(data.eaters, household, "Planungsregeln gespeichert.", () => setEditingRules(false))
              }
              onClose={() => {
                save.reset();
                setEditingRules(false);
              }}
            />
          )}
        </>
      )}
    </SettingsSection>
  );
}
