/**
 * ICS feed of the meal plan (FOOD-015, RFC 5545): one 30-minute event per planned meal at the household's meal
 * times, in UTC (no VTIMEZONE needed). UIDs are stable per meal slot, so calendar apps update an event when the dish
 * changes. Only dish names, active time and the vegetarian variant — no allergies or other profile data.
 */

import { localDateTimeToInstant } from "../utils/timezone.js";
import type { PlanSlotResponse } from "./models/plan.js";

export const CALENDAR_EVENT_MINUTES = 30;
/** Suggested refresh for calendar apps (they may refresh less often, Google up to 24 hours). */
export const CALENDAR_REFRESH = "PT6H";
const UID_DOMAIN = "meals.zentrale";

/** RFC 5545 3.3.11: escape backslash, semicolon, comma and newlines. */
export function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 3.1: lines of at most 75 octets, continued with CRLF + space; never splits a UTF-8 character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const icsDate = (date: Date): string => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export interface CalendarInput {
  readonly slots: readonly PlanSlotResponse[];
  readonly mealTimes: { readonly lunch: string; readonly dinner: string };
  readonly timeZone: string;
  readonly now: Date;
}

const LABEL = { LUNCH: "Mittag", DINNER: "Abend" } as const;

export function buildMealCalendar({ slots, mealTimes, timeZone, now }: CalendarInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zentrale//Essensplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Zentrale Essen",
    `X-WR-TIMEZONE:${timeZone}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${CALENDAR_REFRESH}`,
    `X-PUBLISHED-TTL:${CALENDAR_REFRESH}`,
  ];
  for (const slot of slots) {
    if (!slot.dish || slot.status === "SKIPPED") continue;
    const start = localDateTimeToInstant(slot.date, slot.slot === "LUNCH" ? mealTimes.lunch : mealTimes.dinner, timeZone);
    const end = new Date(start.getTime() + CALENDAR_EVENT_MINUTES * 60_000);
    const details = [`${slot.dish.activeMinutes} Min. aktive Kochzeit`];
    if (slot.dish.isVegetarian) details.push("vegetarisch");
    else if (slot.dish.vegetarianVariant) details.push(`vegetarisch: ${slot.dish.vegetarianVariant}`);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${slot.slotId.replace("#", "-")}@${UID_DOMAIN}`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeText(`🍽️ ${LABEL[slot.slot]}: ${slot.dish.name}`)}`,
      `DESCRIPTION:${escapeText(details.join(" · "))}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
