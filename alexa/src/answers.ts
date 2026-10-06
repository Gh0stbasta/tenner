/**
 * Spoken answers built from the dashboard (ALEXA-003). Pure functions returning plain text; handlers XML-escape
 * the text for SSML. Answers start with the number, use short German sentences and list at most three items.
 */

import type { Dashboard, DashboardTenner } from "./dashboard.js";
import type { AlexaMember } from "./tennerApi.js";
import { joinAlternatives } from "./speech.js";

export const LIST_PAGE_SIZE = 3;

const NUMBER_WORDS = ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];

/** „ein Tenner“, „drei Tenner“, „15 Tenner“. */
export function tennerCount(count: number): string {
  return `${NUMBER_WORDS[count] ?? String(count)} Tenner`;
}

/** „eine Minute“, „25 Minuten“. */
export function minutes(count: number): string {
  return count === 1 ? "eine Minute" : `${count} Minuten`;
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const isAre = (count: number): string => (count === 1 ? "ist" : "sind");

/** „Pflanzen gießen (10 Minuten)“ */
export const tennerWithMinutes = (tenner: DashboardTenner): string => `${tenner.title} (${minutes(tenner.estimatedMinutes)})`;

/** „seit gestern“, „seit 4 Tagen“ */
export function overdueSince(days: number): string {
  return days <= 1 ? "seit gestern" : `seit ${days} Tagen`;
}

/** „morgen“, „übermorgen“, „in 5 Tagen“ */
export function dueIn(days: number): string {
  if (days <= 1) return "morgen";
  if (days === 2) return "übermorgen";
  return `in ${days} Tagen`;
}

/** Whose Tenners an answer is about. */
export type Audience = { readonly kind: "speaker"; readonly member: AlexaMember } | { readonly kind: "member"; readonly member: AlexaMember } | { readonly kind: "household" };

/** „für dich“, „für Julia“, „“ */
function forWhom(audience: Audience): string {
  if (audience.kind === "speaker") return " für dich";
  if (audience.kind === "member") return ` für ${audience.member.displayName}`;
  return "";
}

/** A spoken answer plus the items not read yet (continued with „ja“). */
export interface Answer {
  readonly text: string;
  readonly remaining: readonly string[];
}

/** Read the first page of items; the rest is offered with „Soll ich die restlichen … vorlesen?“. */
function listing(intro: string, items: readonly string[]): Answer {
  const page = items.slice(0, LIST_PAGE_SIZE);
  const remaining = items.slice(LIST_PAGE_SIZE);
  const more = remaining.length > 0 ? ` ${continuationQuestion(remaining.length)}` : "";
  return { text: `${intro}: ${joinAlternatives(page, "und")}.${more}`, remaining };
}

export function continuationQuestion(remaining: number): string {
  return remaining === 1 ? "Soll ich den letzten auch vorlesen?" : `Soll ich die restlichen ${NUMBER_WORDS[remaining] ?? remaining} vorlesen?`;
}

/** Next page of a listing started earlier. */
export function continueListing(items: readonly string[]): Answer {
  return listing("Weiter", items);
}

/** TodayIntent: today's Tenners (count, minutes, up to three titles), overdue as a hint, next upcoming if nothing is due. */
export function todayAnswer(dashboard: Dashboard, audience: Audience): Answer {
  const due = dashboard.dueToday;
  const overdueHint =
    dashboard.overdue.length > 0 ? ` Außerdem ${isAre(dashboard.overdue.length)} ${tennerCount(dashboard.overdue.length)} überfällig.` : "";
  if (due.length === 0) {
    const next = dashboard.upcoming[0];
    const nextHint = next ? ` Als Nächstes: ${next.title}, ${dueIn(next.daysUntilDue ?? 1)}.` : "";
    return { text: `Heute ist${forWhom(audience)} nichts fällig.${overdueHint}${nextHint}`, remaining: [] };
  }
  const total = due.reduce((sum, tenner) => sum + tenner.estimatedMinutes, 0);
  const intro = `${capitalize(tennerCount(due.length))}${forWhom(audience)} heute, zusammen ${minutes(total)}`;
  const answer = listing(intro, due.map(tennerWithMinutes));
  return { text: answer.remaining.length > 0 ? answer.text : `${answer.text}${overdueHint}`, remaining: answer.remaining };
}

/** OverdueIntent: overdue Tenners, longest overdue first, with „seit …“. */
export function overdueAnswer(dashboard: Dashboard, audience: Audience): Answer {
  const overdue = [...dashboard.overdue].sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));
  if (overdue.length === 0) return { text: `Nichts ist${forWhom(audience)} überfällig. Gut gemacht!`, remaining: [] };
  const intro = `${capitalize(tennerCount(overdue.length))} ${isAre(overdue.length)}${forWhom(audience)} überfällig`;
  return listing(intro, overdue.map((tenner) => `${tenner.title} (${overdueSince(tenner.overdueDays ?? 1)})`));
}

/**
 * SuggestIntent rule: overdue before due today; within a group the shortest first; ties → longest overdue, then
 * title. Returns undefined when nothing is actionable.
 */
export function suggestion(dashboard: Dashboard): DashboardTenner | undefined {
  const byRule = (a: DashboardTenner, b: DashboardTenner) =>
    a.estimatedMinutes - b.estimatedMinutes || (b.overdueDays ?? 0) - (a.overdueDays ?? 0) || a.title.localeCompare(b.title, "de");
  return [...dashboard.overdue].sort(byRule)[0] ?? [...dashboard.dueToday].sort(byRule)[0];
}

export function suggestionAnswer(tenner: DashboardTenner | undefined): string {
  if (tenner === undefined) return "Gerade ist nichts zu tun. Genieß die freie Zeit!";
  const why = tenner.overdueDays !== undefined ? ` Das ist ${overdueSince(tenner.overdueDays)} überfällig.` : "";
  return `Wie wäre es mit ${tenner.title}? Das dauert ${minutes(tenner.estimatedMinutes)}.${why}`;
}

/** WorkLeftIntent: open minutes today + overdue; split per member when the answer is household-wide. */
export function workLeftAnswer(dashboard: Dashboard, audience: Audience, members: readonly AlexaMember[]): string {
  const { dueTodayMinutes, overdueMinutes, totalActionableMinutes } = dashboard.summary;
  if (totalActionableMinutes === 0) return `Heute ist${forWhom(audience)} nichts mehr zu tun.`;
  const parts = [dueTodayMinutes > 0 ? `${minutes(dueTodayMinutes)} für heute` : "", overdueMinutes > 0 ? `${minutes(overdueMinutes)} überfällig` : ""].filter(
    (part) => part !== "",
  );
  const base = `Noch ${minutes(totalActionableMinutes)}${forWhom(audience)}: ${joinAlternatives(parts, "und")}.`;
  if (audience.kind !== "household") return base;
  const perMember = members
    .map((member) => ({ member, minutes: dashboard.byUser[member.userId]?.estimatedMinutes ?? 0 }))
    .filter((entry) => entry.minutes > 0)
    .map((entry) => `${entry.member.displayName} ${minutes(entry.minutes)}`);
  return perMember.length > 0 ? `${base} Davon ${joinAlternatives(perMember, "und")}.` : base;
}
