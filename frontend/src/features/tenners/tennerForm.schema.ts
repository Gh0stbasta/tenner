/** Form validation for Create/Edit (FRONTEND-004/005). Mirrors backend LIMITS (backend/src/validators). */

import { z } from "zod";
import { CATEGORIES, USER_IDS } from "../../types/domain";

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

export const tennerFormSchema = z.object({
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
  frequencyDays: integerBetween(
    LIMITS.frequencyMin,
    LIMITS.frequencyMax,
    `Die Häufigkeit muss zwischen ${LIMITS.frequencyMin} und ${LIMITS.frequencyMax} Tagen liegen.`,
  ),
  active: z.boolean(),
});

export type TennerFormValues = z.infer<typeof tennerFormSchema>;

export const FREQUENCY_PRESETS: readonly { readonly label: string; readonly days: number }[] = [
  { label: "Täglich", days: 1 },
  { label: "Wöchentlich", days: 7 },
  { label: "Alle 2 Wochen", days: 14 },
  { label: "Monatlich", days: 30 },
  { label: "Vierteljährlich", days: 90 },
  { label: "Jährlich", days: 365 },
];
