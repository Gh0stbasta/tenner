/** Form validation for Create/Edit (FRONTEND-004/005). Mirrors backend LIMITS (backend/src/validators). */

import { z } from "zod";
import {
  APPROXIMATE_DAYS_PER_UNIT,
  FREQUENCY_UNITS,
  WEEKDAYS,
  type FrequencyUnit,
  type Weekday,
} from "../../types/domain";

export const LIMITS = {
  titleMin: 3,
  titleMax: 100,
  minutesMin: 1,
  minutesMax: 480,
  frequencyMin: 1,
  frequencyMax: 3650,
} as const;

const integerBetween = (min: number, max: number, message: string) =>
  z
    .number({ error: "Bitte eine Zahl eingeben." })
    .refine((value) => !Number.isNaN(value), "Bitte eine Zahl eingeben.")
    .refine((value) => Number.isInteger(value), "Bitte eine ganze Zahl eingeben.")
    .refine((value) => value >= min && value <= max, message);

export const tennerFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Titel ist erforderlich.")
      .min(LIMITS.titleMin, `Der Titel braucht mindestens ${LIMITS.titleMin} Zeichen.`)
      .max(LIMITS.titleMax, `Der Titel darf höchstens ${LIMITS.titleMax} Zeichen haben.`),
    category: z.string({ error: "Bitte eine Kategorie wählen." }).min(1, "Bitte eine Kategorie wählen."),
    assignedTo: z.string({ error: "Bitte eine Person wählen." }).min(1, "Bitte eine Person wählen."),
    estimatedMinutes: integerBetween(
      LIMITS.minutesMin,
      LIMITS.minutesMax,
      `Geschätzte Minuten müssen zwischen ${LIMITS.minutesMin} und ${LIMITS.minutesMax} liegen.`,
    ),
    frequencyInterval: integerBetween(LIMITS.frequencyMin, LIMITS.frequencyMax, "Bitte eine Zahl ab 1 eingeben."),
    frequencyUnit: z.enum(FREQUENCY_UNITS, { error: "Bitte eine Einheit wählen." }),
    /** Only used with "Wochen" (SCHEDULING-002); empty = every n weeks after the last completion. */
    weekdays: z.array(z.enum(WEEKDAYS)),
    /** HOUSEHOLD-001: rotate between the selected members after each completion. */
    rotating: z.boolean(),
    rotation: z.array(z.string()),
    active: z.boolean(),
    /** HOTFIX-006: first active day; before it the Aufgabe is not due and not shown. */
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein Datum wählen."),
  })
  .refine((values) => !values.rotating || values.rotation.length >= 2, {
    path: ["rotation"],
    message: "Bitte mindestens zwei Personen auswählen.",
  })
  .refine((values) => !values.rotating || values.rotation.includes(values.assignedTo), {
    path: ["assignedTo"],
    message: "Die zuständige Person muss in der Rotation sein.",
  })
  // Same upper bound as the backend: at most 3650 (approximate) days.
  .refine(
    (values) => APPROXIMATE_DAYS_PER_UNIT[values.frequencyUnit] * values.frequencyInterval <= LIMITS.frequencyMax,
    {
      path: ["frequencyInterval"],
      message: `Die Häufigkeit darf höchstens ${LIMITS.frequencyMax} Tage (10 Jahre) betragen.`,
    },
  );

export type TennerFormValues = z.infer<typeof tennerFormSchema>;

export interface FrequencyPreset {
  readonly label: string;
  readonly unit: FrequencyUnit;
  readonly interval: number;
}

/** Presets (SCHEDULING-001). "Alle X Tage" is the free input with the unit "Tage". */
export const FREQUENCY_PRESETS: readonly FrequencyPreset[] = [
  { label: "Täglich", unit: "DAY", interval: 1 },
  { label: "Wöchentlich", unit: "WEEK", interval: 1 },
  { label: "Alle 2 Wochen", unit: "WEEK", interval: 2 },
  { label: "Monatlich", unit: "MONTH", interval: 1 },
  { label: "Vierteljährlich", unit: "MONTH", interval: 3 },
  { label: "Jährlich", unit: "YEAR", interval: 1 },
];

/** Weekdays as the API expects them: ISO order for WEEK, otherwise (or when none is selected) null. */
export function weekdaysForApi(values: Pick<TennerFormValues, "frequencyUnit" | "weekdays">): Weekday[] | null {
  if (values.frequencyUnit !== "WEEK") return null;
  const selected = WEEKDAYS.filter((day) => values.weekdays.includes(day));
  return selected.length > 0 ? selected : null;
}

/** Assignment fields for the API (HOUSEHOLD-001): rotation in the order of `memberOrder`. */
export function assignmentForApi(
  values: Pick<TennerFormValues, "rotating" | "rotation">,
  memberOrder: readonly string[],
): { assignmentMode: "FIXED" | "ROTATING"; rotation: string[] | null } {
  if (!values.rotating) return { assignmentMode: "FIXED", rotation: null };
  const ordered = memberOrder.filter((id) => values.rotation.includes(id));
  return {
    assignmentMode: "ROTATING",
    rotation: [...ordered, ...values.rotation.filter((id) => !ordered.includes(id))],
  };
}
