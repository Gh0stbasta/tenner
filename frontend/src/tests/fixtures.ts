/** Test data builders matching the backend contracts. */

import type { Dashboard, DashboardTenner } from "../features/dashboard/api";
import type { Tenner } from "../features/tenners/schemas";

export function dashboardTenner(overrides: Partial<DashboardTenner> = {}): DashboardTenner {
  return {
    tennerId: "t-1",
    title: "Büro saugen",
    category: "HOUSEHOLD",
    assignedTo: "STEFAN",
    originalAssignee: null,
    estimatedMinutes: 10,
    nextDue: "2026-10-02",
    snoozedUntil: null,
    ...overrides,
  };
}

export function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  const dueToday = overrides.dueToday ?? [dashboardTenner()];
  const overdue = overrides.overdue ?? [
    dashboardTenner({
      tennerId: "t-2",
      title: "Haustür putzen",
      category: "HOME",
      assignedTo: "JULIA",
      estimatedMinutes: 15,
      nextDue: "2026-09-20",
      overdueDays: 12,
    }),
  ];
  const upcoming = overrides.upcoming ?? [
    dashboardTenner({
      tennerId: "t-3",
      title: "Auto waschen",
      category: "PERSONAL",
      estimatedMinutes: 30,
      nextDue: "2026-10-05",
      daysUntilDue: 3,
    }),
  ];
  const minutes = (list: readonly DashboardTenner[]) => list.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  return {
    referenceDate: "2026-10-02",
    timezone: "Europe/Berlin",
    summary: {
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      dueTodayMinutes: minutes(dueToday),
      overdueMinutes: minutes(overdue),
      upcomingMinutes: minutes(upcoming),
      totalActionableCount: dueToday.length + overdue.length,
      totalActionableMinutes: minutes(dueToday) + minutes(overdue),
    },
    byUser: { STEFAN: { count: 1, estimatedMinutes: 10 }, JULIA: { count: 1, estimatedMinutes: 15 } },
    byCategory: { HOUSEHOLD: { count: 1, estimatedMinutes: 10 }, HOME: { count: 1, estimatedMinutes: 15 } },
    ...overrides,
    dueToday,
    overdue,
    upcoming,
    paused: overrides.paused ?? [],
  };
}

export function tenner(overrides: Partial<Tenner> = {}): Tenner {
  return {
    tennerId: "t-1",
    title: "Büro saugen",
    category: "HOUSEHOLD",
    estimatedMinutes: 10,
    frequencyDays: 14,
    frequencyUnit: "DAY",
    frequencyInterval: 14,
    weekdays: null,
    assignedTo: "STEFAN",
    assignmentMode: "FIXED",
    rotation: null,
    originalAssignee: null,
    lastCompleted: null,
    nextDue: "2026-10-02",
    snoozedUntil: null,
    pausedAt: null,
    pausedUntil: null,
    active: true,
    deletedAt: null,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-09-01T08:00:00Z",
    ...overrides,
  };
}

export function completeResponse(tennerId = "t-1") {
  return {
    tenner: tenner({ tennerId, lastCompleted: "2026-10-02T08:00:00Z", nextDue: "2026-10-16" }),
    completion: {
      completionId: "c-1",
      tennerId,
      completedBy: "STEFAN",
      completedAt: "2026-10-02T08:00:00Z",
      actualMinutes: 10,
    },
  };
}

/** A ready meal plan for the week of 2026-10-12 (FOOD-009); `dishes` by slot ID override the defaults. */
export function mealPlanFixture(overrides: { dishes?: Record<string, string | null>; violations?: unknown[] } = {}) {
  const dates = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
  const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
  const names = [
    "Onigiri",
    "Chicken Dinos mit Pommes",
    "Salat mit Halloumi",
    "Spaghetti Bolognese",
    "Linseneintopf",
    "Käsespätzle mit Röstzwiebeln",
    "Eierreis mit Gemüse",
    "Burger",
    "Ofengemüse mit Kräuterquark",
    "Fischstäbchen mit Erbsenpüree",
    "Kaiserschmarrn",
    "Hot Dogs",
    "Gnocchi in Tomatensoße",
    "Flammkuchen",
  ];
  const slots = dates.flatMap((date, day) =>
    (["LUNCH", "DINNER"] as const).map((slot, meal) => {
      const slotId = `${date}#${slot}`;
      const name = overrides.dishes && slotId in overrides.dishes ? overrides.dishes[slotId] : names[day * 2 + meal];
      return {
        slotId,
        date,
        weekday: weekdays[day],
        slot,
        dishId: name ? `dish-${day * 2 + meal}` : null,
        locked: false,
        source: "AUTO",
        status: "PLANNED",
        ...(name ? {} : { emptyReason: "Kein Gericht passt (meist: mittags leicht)." }),
        dish: name
          ? {
              dishId: `dish-${day * 2 + meal}`,
              name,
              category: "VEGETARIAN",
              lightness: slot === "LUNCH" ? "LIGHT" : "FILLING",
              temperature: "WARM",
              activeMinutes: 15,
              totalMinutes: 20,
              isVegetarian: name !== "Burger",
              ...(name === "Burger" ? { vegetarianVariant: "mit Gemüse-Patty" } : {}),
              favorite: false,
              archived: false,
            }
          : null,
      };
    }),
  );
  return {
    weekStart: "2026-10-12",
    weekEnd: "2026-10-18",
    ready: true,
    setup: { hasDishes: true, hasEaters: true },
    generatedAt: "2026-10-12T05:00:00Z",
    slots,
    violations: overrides.violations ?? [],
  };
}
