/**
 * Daily briefing (ALEXA-005): fixed order, each part only if non-empty, at most about 40 seconds. Pure; built from
 * one household-wide dashboard so personal and household parts stay consistent.
 *
 * NOTIFICATION-003 (written digest) does not exist yet; when it does, it should reuse these rules (move this module
 * to a shared package or duplicate it with a shared fixture — see the ticket).
 */

import { tennerCount, minutes, overdueSince } from "./answers.js";
import { SHARED_ASSIGNEE, type Dashboard, type DashboardTenner } from "./dashboard.js";
import { joinAlternatives } from "./speech.js";
import type { AlexaMember } from "./tennerApi.js";

/** Titles read per part before „und … weitere“. */
export const BRIEFING_TITLES = 3;
/** About 2.5 spoken words per second: 100 words ≈ 40 seconds. */
export const MAX_BRIEFING_WORDS = 100;

/** Dashboard as returned by the API, including the pause fields the briefing reads. */
export interface BriefingDashboard extends Dashboard {
  readonly paused: readonly (DashboardTenner & { readonly pauseReason?: "PAUSE" | "VACATION"; readonly pausedUntil?: string | null })[];
}

export interface Briefing {
  readonly text: string;
  /** Suggested first Tenner for „ja“ on the closing question, if anything is actionable. */
  readonly suggestion: DashboardTenner | undefined;
}

const NUMBER = ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** „Guten Morgen“ until 11:00, „Hallo“ until 17:00, then „Guten Abend“ — in the household timezone. */
export function greetingFor(now: Date, timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now));
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Hallo";
  return "Guten Abend";
}

/** „A, B und C“ or „A, B, C und 2 weitere“. */
function titles(tenners: readonly DashboardTenner[]): string {
  const shown = tenners.slice(0, BRIEFING_TITLES).map((tenner) => tenner.title);
  const hidden = tenners.length - shown.length;
  if (hidden === 0) return joinAlternatives(shown, "und");
  return `${shown.join(", ")} und ${hidden === 1 ? "eine weitere" : `${NUMBER[hidden] ?? hidden} weitere`}`;
}

function vacationUntil(dashboard: BriefingDashboard): string | undefined {
  const until = dashboard.paused.find((tenner) => tenner.pauseReason === "VACATION")?.pausedUntil;
  if (until === undefined || until === null) return undefined;
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${until}T00:00:00Z`));
}

const byRule = (a: DashboardTenner, b: DashboardTenner) => a.estimatedMinutes - b.estimatedMinutes || (b.overdueDays ?? 0) - (a.overdueDays ?? 0) || a.title.localeCompare(b.title, "de");

export interface BriefingInput {
  readonly dashboard: BriefingDashboard;
  readonly members: readonly AlexaMember[];
  /** Recognized speaker; undefined (e.g. a routine) → household-wide briefing. */
  readonly speaker: AlexaMember | undefined;
  readonly now: Date;
  readonly timeZone: string;
  /** FOOD-017: „Heute gibt es mittags … und abends ….“; undefined when nothing is planned or the plan failed. */
  readonly meals?: string | undefined;
}

export function buildBriefing({ dashboard, members, speaker, now, timeZone, meals }: BriefingInput): Briefing {
  const mine = (tenner: DashboardTenner) => speaker === undefined || tenner.assignedTo === speaker.userId || tenner.assignedTo === SHARED_ASSIGNEE;
  const due = dashboard.dueToday.filter(mine);
  const overdue = dashboard.overdue.filter(mine).sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));
  const parts: string[] = [];

  // 1. Greeting
  parts.push(`${greetingFor(now, timeZone)}${speaker ? `, ${speaker.displayName}` : ""}.`);

  // 2. Today (titles are dropped first if the briefing gets too long)
  const today = (withTitles: boolean): string => {
    if (due.length === 0) return speaker ? "Heute ist für dich nichts fällig." : "Heute ist nichts fällig.";
    const total = due.reduce((sum, tenner) => sum + tenner.estimatedMinutes, 0);
    const verb = due.length === 1 ? "steht" : "stehen";
    return `Heute ${verb} ${tennerCount(due.length)} an, zusammen etwa ${minutes(total)}${withTitles ? `: ${titles(due)}` : ""}.`;
  };
  const todayIndex = parts.push(today(true)) - 1;

  // 2b. Meals of the day (FOOD-017)
  if (meals) parts.push(meals);

  // 3. Overdue
  const longest = overdue[0];
  if (longest) {
    const since = overdueSince(longest.overdueDays ?? 1);
    parts.push(
      overdue.length === 1
        ? `${capitalize(tennerCount(1))} ist überfällig: ${longest.title}, ${since}.`
        : `${capitalize(NUMBER[overdue.length] ?? String(overdue.length))} sind überfällig, am längsten ${longest.title} ${since}.`,
    );
  }

  // 4. Household (only with more than one member)
  let householdIndex = -1;
  if (members.length > 1) {
    const counts = members
      .filter((member) => member.userId !== speaker?.userId)
      .map((member) => ({ member, count: dashboard.byUser[member.userId]?.count ?? 0 }))
      .filter((entry) => entry.count > 0)
      .map((entry) => `${entry.member.displayName} hat ${entry.count}`);
    const open = dashboard.summary.totalActionableCount;
    if (open > 0) householdIndex = parts.push(`Im Haushalt sind heute insgesamt ${open} offen${counts.length > 0 ? `; ${joinAlternatives(counts, "und")}` : ""}.`) - 1;
  }

  // 5. Vacation
  const vacation = vacationUntil(dashboard);
  if (vacation) parts.push(`Urlaubsmodus bis ${vacation}.`);

  // 7. Closing question (6. „gestern erledigt“ is optional and not part of this version)
  const suggestion = [...overdue].sort(byRule)[0] ?? [...due].sort(byRule)[0];
  if (suggestion) parts.push("Soll ich dir die erste Aufgabe nennen?");

  // ≤ 40 s: first drop the titles, then the household sentence.
  if (wordCount(parts.join(" ")) > MAX_BRIEFING_WORDS) parts[todayIndex] = today(false);
  if (wordCount(parts.join(" ")) > MAX_BRIEFING_WORDS && householdIndex >= 0) parts.splice(householdIndex, 1);
  return { text: parts.join(" "), suggestion };
}

export const wordCount = (text: string): number => text.split(/\s+/).filter((word) => word !== "").length;
