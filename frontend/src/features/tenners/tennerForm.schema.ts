/** Form validation for Create/Edit (FRONTEND-004/005). Mirrors backend LIMITS (backend/src/validators). */

import { z } from "zod";
import {
  APPROXIMATE_DAYS_PER_UNIT,
  CATEGORIES,
  FREQUENCY_UNITS,
  USER_IDS,
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
    category: z.enum(CATEGORIES, { error: "Bitte eine Kategorie wählen." }),
    assignedTo: z.enum(USER_IDS, { error: "Bitte eine Person wählen." }),
    estimatedMinutes: integerBetween(
      LIMITS.minutesMin,
      LIMITS.minutesMax,
      `Geschätzte Minuten müssen zwischen ${LIMITS.minutesMin} und ${LIMITS.minutesMax} liegen.`,
    ),
    frequencyInterval: integerBetween(LIMITS.frequencyMin, LIMITS.frequencyMax, "Bitte eine Zahl ab 1 eingeben."),
    frequencyUnit: z.enum(FREQUENCY_UNITS, { error: "Bitte eine Einheit wählen." }),
    /** Only used with "Wochen" (SCHEDULING-002); empty = every n weeks after the last completion. */
    weekdays: z.array(z.enum(WEEKDAYS)),
    active: z.boolean(),
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
