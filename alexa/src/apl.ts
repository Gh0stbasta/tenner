/**
 * Echo Show views (ALEXA-006): pure datasource builders for the APL documents in alexa/apl/. The documents only
 * bind to these datasources; all wording and truncation happens here (testable, same data as the speech).
 */

import type { RequestEnvelope } from "ask-sdk-model";
import { dueIn, minutes, overdueSince, tennerCount } from "./answers.js";
import { SHARED_ASSIGNEE, type Dashboard, type DashboardTenner } from "./dashboard.js";
import type { AlexaMember } from "./tennerApi.js";

/** Member columns before „weitere“ (Echo Show 8/10 width). */
export const MAX_MEMBER_COLUMNS = 3;
/** Rows per column / list before „+ n weitere“. */
export const MAX_ROWS = 4;
/** Show 5 shows only the next three Tenners. */
export const SMALL_SCREEN_ROWS = 3;

/**
 * Member accent colors on the dark surface: the categorical palette validated for ANALYTICS-009 (dark mode,
 * surface #1c1f24), assigned by position in the member list. Identity is always also the written name.
 */
export const MEMBER_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"] as const;
const SHARED_COLOR = "#b8bec6";

export interface AplRow {
  readonly tennerId: string;
  readonly title: string;
  /** „Auto waschen (30 Min.)“ */
  readonly label: string;
  /** Overdue / list rows: „seit 4 Tagen · Julia“ */
  readonly detail: string;
  /** Spoken label for screen readers / VoiceView. */
  readonly accessibilityLabel: string;
}

export interface AplColumn {
  readonly name: string;
  readonly color: string;
  readonly rows: readonly AplRow[];
  /** „+ 2 weitere“ or "" */
  readonly more: string;
}

export interface DashboardView {
  readonly title: string;
  readonly date: string;
  /** „Heute: 3 Tenner · 15 Minuten offen · 1 überfällig“ */
  readonly summary: string;
  /** Short success state after a completion („✓ Erledigt: Altglas“), else "". */
  readonly banner: string;
  readonly columns: readonly AplColumn[];
  /** „Weitere: Lena (2)“ when more members have Tenners than columns fit, else "". */
  readonly moreMembers: string;
  readonly overdue: readonly AplRow[];
  readonly overdueMore: string;
  /** Show 5: the next three actionable Tenners (overdue first). */
  readonly next: readonly AplRow[];
  /** Shown instead of rows when nothing is actionable, else "". */
  readonly empty: string;
}

export interface ListView {
  readonly title: string;
  readonly rows: readonly AplRow[];
  readonly empty: string;
}

/** APL only for devices that declare the interface; voice-only devices get speech (and a card) only. */
export function supportsApl(envelope: RequestEnvelope): boolean {
  return envelope.context?.System?.device?.supportedInterfaces?.["Alexa.Presentation.APL"] !== undefined;
}

const shortMinutes = (value: number): string => `${value} Min.`;

function row(tenner: DashboardTenner, detail: string): AplRow {
  const label = `${tenner.title} (${shortMinutes(tenner.estimatedMinutes)})`;
  return { tennerId: tenner.tennerId, title: tenner.title, label, detail, accessibilityLabel: `${tenner.title}, ${minutes(tenner.estimatedMinutes)}. Antippen zum Erledigen.` };
}

const moreText = (hidden: number): string => (hidden > 0 ? `+ ${hidden} weitere` : "");

/** „Montag, 5. Oktober“ for YYYY-MM-DD. */
export function headerDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function summaryLine(dashboard: Dashboard): string {
  const { dueTodayCount, overdueCount, totalActionableMinutes } = dashboard.summary;
  const parts = [dueTodayCount === 0 ? "Heute: nichts fällig" : `Heute: ${tennerCount(dueTodayCount)}`];
  if (totalActionableMinutes > 0) parts.push(`${minutes(totalActionableMinutes)} offen`);
  if (overdueCount > 0) parts.push(`${overdueCount} überfällig`);
  return parts.join(" · ");
}

const nameOf = (members: readonly AlexaMember[], userId: string): string =>
  userId === SHARED_ASSIGNEE ? "Alle" : (members.find((member) => member.userId === userId)?.displayName ?? userId);

function overdueRow(tenner: DashboardTenner, members: readonly AlexaMember[]): AplRow {
  return row(tenner, `⚠ ${overdueSince(tenner.overdueDays ?? 1)} · ${nameOf(members, tenner.assignedTo)}`);
}

export function dashboardView(dashboard: Dashboard, members: readonly AlexaMember[], banner = ""): DashboardView {
  const columnFor = (name: string, color: string, tenners: readonly DashboardTenner[]): AplColumn => ({
    name,
    color,
    rows: tenners.slice(0, MAX_ROWS).map((tenner) => row(tenner, "")),
    more: moreText(tenners.length - MAX_ROWS),
  });
  const memberColumns = members
    .map((member, index) => ({ member, color: MEMBER_COLORS[index % MEMBER_COLORS.length] ?? SHARED_COLOR, tenners: dashboard.dueToday.filter((tenner) => tenner.assignedTo === member.userId) }))
    .filter((entry) => entry.tenners.length > 0);
  const shown = memberColumns.slice(0, MAX_MEMBER_COLUMNS);
  const hidden = memberColumns.slice(MAX_MEMBER_COLUMNS);
  const shared = dashboard.dueToday.filter((tenner) => tenner.assignedTo === SHARED_ASSIGNEE);
  const overdue = [...dashboard.overdue].sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));
  const actionable = [...overdue.map((tenner) => overdueRow(tenner, members)), ...dashboard.dueToday.map((tenner) => row(tenner, nameOf(members, tenner.assignedTo)))];
  const next = dashboard.upcoming[0];
  return {
    title: "Tenner",
    date: headerDate(dashboard.referenceDate),
    summary: summaryLine(dashboard),
    banner,
    columns: [
      ...shown.map((entry) => columnFor(entry.member.displayName, entry.color, entry.tenners)),
      ...(shared.length > 0 ? [columnFor("Alle", SHARED_COLOR, shared)] : []),
    ],
    moreMembers: hidden.length > 0 ? `Weitere: ${hidden.map((entry) => `${entry.member.displayName} (${entry.tenners.length})`).join(", ")}` : "",
    overdue: overdue.slice(0, MAX_ROWS).map((tenner) => overdueRow(tenner, members)),
    overdueMore: moreText(overdue.length - MAX_ROWS),
    next: actionable.slice(0, SMALL_SCREEN_ROWS),
    empty: actionable.length === 0 ? `Heute ist nichts fällig.${next ? ` Als Nächstes: ${next.title}, ${dueIn(next.daysUntilDue ?? 1)}.` : ""}` : "",
  };
}

/** Scrollable list (overdue intent, „mehr zeigen“). */
export function overdueListView(dashboard: Dashboard, members: readonly AlexaMember[]): ListView {
  const overdue = [...dashboard.overdue].sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));
  return { title: "Überfällig", rows: overdue.map((tenner) => overdueRow(tenner, members)), empty: overdue.length === 0 ? "Nichts ist überfällig. Gut gemacht!" : "" };
}
